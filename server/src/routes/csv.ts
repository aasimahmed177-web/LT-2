import { Router, Request, Response } from "express";
import { getConvex } from "../convexClient.js";

const router = Router();

// ─── Stage Configuration ────────────────────────────────────────────

const STAGES = ["Lead", "Contact", "Prospect", "ConversionLead", "Purchase", "NotQualified", "NoResponse", "Invalid", "Duplicate"];
const VALID_STAGES = new Set(STAGES);
const CAPI_STAGES = new Set(["Contact", "Prospect", "ConversionLead", "Purchase"]);

// ─── CSV Parsing ────────────────────────────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }
    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeMetaLeadId(raw: string): string {
  return raw.trim().replace(/^[!'"\s]+/, "").trim();
}

function findColumn(headers: string[], ...patterns: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const p of patterns) {
    const idx = lower.indexOf(p.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  // Try partial match
  for (const p of patterns) {
    const lp = p.toLowerCase();
    for (const h of headers) {
      const lh = h.toLowerCase();
      if (lh.includes(lp) || lp.includes(lh)) return h;
    }
  }
  return null;
}

// ─── POST /api/csv/preview ──────────────────────────────────────────

router.post("/preview", async (req: Request, res: Response) => {
  try {
    const { csvText } = req.body;
    if (!csvText || typeof csvText !== "string") {
      res.status(400).json({ error: "csvText is required" });
      return;
    }

    const parsed = parseCsv(csvText);
    if (parsed.length === 0) {
      res.status(400).json({ error: "CSV must have at least a header row and one data row" });
      return;
    }

    const headers = Object.keys(parsed[0]);

    // Detect columns
    const metaLeadCol = findColumn(headers, "Meta Lead ID", "meta_lead_id", "metaleadid", "Lead ID", "lead_id");
    const stageCol = findColumn(headers, "Final Lead Stage", "final_lead_stage", "final stage", "Stage", "stage");
    const commentsCol = findColumn(headers, "Call Comments", "call_comments", "comments", "Comment", "comment");
    const callPickedCol = findColumn(headers, "Call Picked?", "call_picked", "callpicked", "Picked", "picked");
    const interestedCol = findColumn(headers, "Interested/Prospect?", "interested", "prospect", "interested/prospect");
    const meetingCol = findColumn(headers, "Meeting Schedule", "meeting_schedule", "meeting", "Meeting");
    const purchaseCol = findColumn(headers, "Purchase", "purchase");
    const callerCol = findColumn(headers, "caller", "Caller");
    const adNameCol = findColumn(headers, "ad_name", "adname", "ad name", "Ad Name");
    const lastCallDateCol = findColumn(headers, "Last Call Date", "last_call_date", "last call date", "lastCallDate");

    // Fetch all leads for matching
    const convex = getConvex();
    const allLeads: any[] = await convex.query("leads:list");

    // Build lead lookup by metaLeadId (normalized)
    const leadByMetaId = new Map<string, any>();
    for (const lead of allLeads) {
      if (lead.metaLeadId) {
        leadByMetaId.set(lead.metaLeadId.trim(), lead);
      }
    }

    // Process each row
    const rows: any[] = [];
    let matched = 0;
    let unmatched = 0;
    let stageChanges = 0;
    let noChanges = 0;
    let capiTriggering = 0;
    let invalidStageCount = 0;

    for (const rawRow of parsed) {
      const rawMetaLeadId = metaLeadCol ? (rawRow[metaLeadCol] || "").trim() : "";
      const normalizedMetaLeadId = normalizeMetaLeadId(rawMetaLeadId);
      const rawStage = stageCol ? (rawRow[stageCol] || "").trim() : "";
      const comments = commentsCol ? (rawRow[commentsCol] || "").trim() : "";

      const lead = leadByMetaId.get(normalizedMetaLeadId) || null;
      const currentStage = lead?.stage || null;
      const newStage = rawStage;
      const stageValid = VALID_STAGES.has(newStage);
      const stageWillChange = lead && stageValid && currentStage !== newStage && newStage !== "";
      const isCapiTriggering = stageValid && CAPI_STAGES.has(newStage) && stageWillChange;

      if (lead) matched++;
      else unmatched++;

      if (stageWillChange) stageChanges++;
      else if (lead && !stageWillChange) noChanges++;

      if (isCapiTriggering) capiTriggering++;
      if (newStage && !stageValid && !stageWillChange) invalidStageCount++;

      // Telecalling fields
      const callPicked = callPickedCol ? (rawRow[callPickedCol] || "").trim() : "";
      const interested = interestedCol ? (rawRow[interestedCol] || "").trim() : "";
      const meeting = meetingCol ? (rawRow[meetingCol] || "").trim() : "";
      const purchase = purchaseCol ? (rawRow[purchaseCol] || "").trim() : "";
      const caller = callerCol ? (rawRow[callerCol] || "").trim() : deriveCaller(adNameCol ? (rawRow[adNameCol] || "").trim() : "");
      const adName = adNameCol ? (rawRow[adNameCol] || "").trim() : "";
      const lastCallDate = lastCallDateCol ? (rawRow[lastCallDateCol] || "").trim() : "";

      rows.push({
        csvRow: rows.length + 1,
        metaLeadId: normalizedMetaLeadId,
        leadName: lead?.name || null,
        currentStage,
        newStage,
        stageWillChange: !!stageWillChange,
        capiTriggered: !!isCapiTriggering,
        unmatched: !lead,
        callComment: comments,
        stageValid,
        validationError: newStage && !stageValid ? `Invalid stage: "${newStage}"` : null,
        // Telecalling field preview
        callPicked,
        interested,
        meetingScheduled: meeting,
        purchase,
        caller: caller || null,
        adName,
        lastCallDate,
      });
    }

    const summary = {
      total: rows.length,
      matched,
      unmatched,
      stageChanges,
      noChanges,
      capiTriggering,
      invalidStages: invalidStageCount,
    };

    res.json({ rows, summary, detectedColumns: { metaLeadCol, stageCol, commentsCol, callPickedCol, interestedCol, meetingCol, purchaseCol, callerCol, adNameCol, lastCallDateCol } });
  } catch (err: any) {
    console.error("CSV preview error:", err.message);
    res.status(500).json({ error: "Failed to preview CSV", detail: err.message });
  }
});

function deriveCaller(adName: string): string {
  const lower = adName.toLowerCase();
  if (lower.includes("aparna")) return "Aparna";
  if (lower.includes("suganya")) return "Suganya";
  return "Unknown";
}

// ─── POST /api/csv/apply ────────────────────────────────────────────

router.post("/apply", async (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "rows array is required and must not be empty" });
      return;
    }

    const convex = getConvex();
    const results: any[] = [];
    let updated = 0;
    let errors = 0;
    let capiEventsCreated = 0;
    let notesAdded = 0;
    let callActivitiesStored = 0;

    for (const row of rows) {
      try {
        // Server-side re-validation
        if (!row.metaLeadId || row.unmatched) {
          results.push({ metaLeadId: row.metaLeadId, status: "skipped", reason: "Unmatched lead" });
          continue;
        }

        // Validate stage
        if (row.newStage && !VALID_STAGES.has(row.newStage)) {
          results.push({ metaLeadId: row.metaLeadId, status: "skipped", reason: `Invalid stage: "${row.newStage}"` });
          errors++;
          continue;
        }

        // Look up lead by metaLeadId
        const lead = await convex.query("leads:getByMetaLeadId", { metaLeadId: row.metaLeadId });
        if (!lead) {
          results.push({ metaLeadId: row.metaLeadId, status: "skipped", reason: "Lead not found in CRM" });
          errors++;
          continue;
        }

        const leadId = lead._id;
        const stageChanged = row.newStage && row.newStage !== lead.stage;

        // 1. Update stage if changed (reuses existing CAPI logic with suppression)
        if (stageChanged) {
          const stageResult = await convex.mutation("crm:updateStage", {
            leadId,
            stage: row.newStage,
            reason: row.callComment ? `CSV Import: ${row.callComment}` : "CSV Import",
          });
          if (stageResult.capiEventCreated) capiEventsCreated++;
          updated++;
        }

        // 2. Add call comment as note if present and not a duplicate
        if (row.callComment) {
          const existingNotes: any[] = await convex.query("crm:listNotes", { leadId });
          const latestNote = existingNotes.length > 0 ? existingNotes[0] : null;
          const isDuplicate = latestNote && latestNote.content === row.callComment;
          if (!isDuplicate) {
            await convex.mutation("crm:addNote", {
              leadId,
              content: `[CSV Import] ${row.callComment}`,
            });
            notesAdded++;
          }
        }

        // 3. Store call activity fields (telecalling reporting — no CAPI)
        await convex.mutation("callActivities:storeCallActivity", {
          leadId,
          metaLeadId: row.metaLeadId,
          callPicked: row.callPicked || undefined,
          interested: row.interested || undefined,
          meetingScheduled: row.meetingScheduled || undefined,
          purchase: row.purchase || undefined,
          callComments: row.callComment || undefined,
          caller: row.caller || undefined,
          adName: row.adName || undefined,
          lastCallDate: row.lastCallDate || undefined,
          importBatchId: `csv-import-${Date.now()}`,
        });
        callActivitiesStored++;

        results.push({ metaLeadId: row.metaLeadId, status: "success", stageChanged });
      } catch (rowErr: any) {
        console.error(`CSV apply row error (${row.metaLeadId}):`, rowErr.message);
        results.push({ metaLeadId: row.metaLeadId, status: "error", reason: rowErr.message });
        errors++;
      }
    }

    res.json({
      success: true,
      summary: {
        total: rows.length,
        updated,
        errors,
        capiEventsCreated,
        notesAdded,
        callActivitiesStored,
      },
      results,
    });
  } catch (err: any) {
    console.error("CSV apply error:", err.message);
    res.status(500).json({ error: "Failed to apply CSV updates", detail: err.message });
  }
});

export default router;