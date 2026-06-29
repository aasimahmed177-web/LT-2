import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import metaRoutes from "./routes/meta.js";
import leadsRoutes from "./routes/leads.js";
import statsRoutes from "./routes/stats.js";
import eventsRoutes from "./routes/events.js";
import systemRoutes from "./routes/system.js";
import { getClients, getClientMetaConfig, getClientLeadForms, resolveClientId, resolveConvexClientId, checkDeployStatus, backfillDefaultClient, isConvexBackend, autoBackfillMetaConfig, resyncClients } from "./clients.js";
import { getConvex } from "./convexClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../../dist");

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/meta", metaRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/debug", leadsRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/system", systemRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "leadtrace-api" });
});

// GET /api/clients - list all clients
app.get("/api/clients", async (_req, res) => {
  const deploy = await checkDeployStatus();
  const list = getClients().map((c) => {
    const config = getClientMetaConfig(c.id);
    const forms = getClientLeadForms(c.id);
    return {
      ...c,
      convexId: isConvexBackend() ? c.id : undefined,
      config: config
        ? { pageId: config.pageId ? config.pageId.substring(0, 5) + "..." : null, tokenConfigured: config.accessTokenConfigured, pixelId: config.pixelId, formCount: forms.length }
        : null,
    };
  });
  res.json({ clients: list, convexBackend: deploy.available, deployStatus: deploy });
});

// GET /api/clients/deploy-status
app.get("/api/clients/deploy-status", async (_req, res) => {
  const status = await checkDeployStatus();
  res.json(status);
});

// POST /api/clients/backfill
app.post("/api/clients/backfill", async (_req, res) => {
  const result = await backfillDefaultClient();
  res.json(result);
});

// POST /api/clients - create a new client
app.post("/api/clients", async (req, res) => {
  try {
    const { name, pageId, pixelId } = req.body;
    if (!name) { res.status(400).json({ error: "Client name is required" }); return; }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
    const convex = getConvex();
    const clientId = await convex.mutation("clients:create", { name, slug, status: "active" });
    if (pageId || pixelId) {
      await convex.mutation("clients:upsertMetaConfig", {
        clientId,
        pageId: pageId || "",
        accessTokenConfigured: !!(process.env.META_ACCESS_TOKEN && pageId),
        pixelId: pixelId || undefined,
      });
    }
    await resyncClients();
    const client = getClientMetaConfig(clientId);
    res.json({ id: clientId, name, slug, status: "active", config: client || null });
  } catch (err: any) {
    console.error("Create client error:", err.message);
    res.status(500).json({ error: "Failed to create client", detail: err.message });
  }
});

// PUT /api/clients/:id/config - update client config (MUST be before GET /api/clients/:id)
app.put("/api/clients/:id/config", async (req, res) => {
  try {
    const id = resolveClientId(req.params.id);
    const convex = getConvex();
    const { name, pageId, pixelId } = req.body;

    // Need to look up the actual Convex document ID
    const clients = getClients();
    const client = clients.find((c: any) => c.id === id);
    if (!client) { res.status(404).json({ error: "Client not found" }); return; }

    // If we have a Convex backend, resolve to the Convex document ID
    let convexClientId = id;
    if (isConvexBackend()) {
      convexClientId = resolveConvexClientId(id);
    }

    if (name) {
      await convex.mutation("clients:updateName", { id: convexClientId, name });
    }
    if (pageId !== undefined || pixelId !== undefined) {
      const currentConfig = getClientMetaConfig(id);
      await convex.mutation("clients:upsertMetaConfig", {
        clientId: convexClientId,
        pageId: pageId !== undefined ? pageId : (currentConfig?.pageId || ""),
        accessTokenConfigured: !!(process.env.META_ACCESS_TOKEN && (pageId !== undefined ? pageId : currentConfig?.pageId)),
        pixelId: pixelId !== undefined ? (pixelId || undefined) : currentConfig?.pixelId,
      });
    }
    await resyncClients();
    const updatedConfig = getClientMetaConfig(id);
    res.json({ id, name: name || client.name, config: updatedConfig || null });
  } catch (err: any) {
    console.error("Update client config error:", err.message);
    res.status(500).json({ error: "Failed to update client config", detail: err.message });
  }
});

// GET /api/schema-instructions
app.get("/api/schema-instructions", (_req, res) => {
  res.json({ message: "Schema is ready. Run `npx convex deploy` from project root.", steps: ["1. Set CONVEX_URL in .env.local", "2. npx convex deploy", "3. POST /api/clients/backfill"], envFile: ".env.local", requiredVars: ["CONVEX_URL"] });
});

// GET /api/clients/:id - single client details (MUST be after specific routes)
app.get("/api/clients/:id", (req, res) => {
  const id = resolveClientId(req.params.id);
  const config = getClientMetaConfig(id);
  const forms = getClientLeadForms(id);
  res.json({ id, config: config ? { pageId: config.pageId || null, tokenConfigured: config.accessTokenConfigured, pixelId: config.pixelId } : null, forms: forms.map((f: any) => ({ formId: f.id || f.formId, formName: f.name || f.formName, status: f.status })) });
});

// Serve built frontend for all non-API routes (SPA)
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`LeadTrace API running on port ${PORT}`);
  // Auto-backfill Meta config on startup (async, non-blocking)
  autoBackfillMetaConfig()
});