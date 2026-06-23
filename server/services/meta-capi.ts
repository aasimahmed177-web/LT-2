import crypto from 'crypto';

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data.trim().toLowerCase()).digest('hex');
}

const STATUS_EVENT_MAP: Record<string, string> = {
  // Old SQLite statuses (lowercase)
  new: 'Lead',
  contacted: 'Contacted',
  'pre-qualified': 'Prospect',
  qualified: 'ConversionLead',
  converted: 'Purchase',
  'not-qualified': 'CustomEvent',
  junk: 'CustomEvent',
  // New Convex stage keys (capitalized)
  Lead: 'Lead',
  Contact: 'Contacted',
  Prospect: 'Prospect',
  ConversionLead: 'ConversionLead',
  Purchase: 'Purchase',
  NotQualified: 'CustomEvent',
  NoResponse: 'CustomEvent',
  Duplicate: 'Duplicate',
  Invalid: 'CustomEvent',
};

function getEventName(status: string): string {
  return STATUS_EVENT_MAP[status] || 'Lead';
}

function getEventCustomData(status: string): Record<string, string> {
  const mapping: Record<string, string> = {
    // Old statuses
    new: 'lead_captured',
    contacted: 'lead_contacted',
    'pre-qualified': 'lead_interested',
    qualified: 'lead_qualified',
    converted: 'deal_closed',
    'not-qualified': 'lead_not_qualified',
    junk: 'lead_junk',
    // New Convex stages
    Lead: 'lead_captured',
    Contact: 'lead_contacted',
    Prospect: 'lead_interested',
    ConversionLead: 'lead_qualified',
    Purchase: 'deal_closed',
    NotQualified: 'lead_not_qualified',
    NoResponse: 'lead_no_response',
    Duplicate: 'lead_duplicate',
    Invalid: 'lead_invalid',
  };
  return { lead_type: mapping[status] || status };
}

async function getConnection(): Promise<{ pixelId: string; accessToken: string; facebookPageId: string } | null> {
  try {
    const { default: db } = await import('../db');
    const row = db.prepare("SELECT value FROM settings WHERE key = 'meta_connection'").get() as { value: string } | undefined;
    if (!row) return null;
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export async function sendStatusEvent(
  leadId: string,
  name: string,
  email: string,
  phone: string,
  newStatus: string,
  source: string = 'manual',
  clientIp: string = '',
  userAgent: string = '',
  eventId?: string,
): Promise<{ success: boolean; response?: any; error?: string }> {
  const conn = await getConnection();
  if (!conn || !conn.accessToken || !conn.pixelId) {
    return { success: false, error: 'Meta connection not configured' };
  }

  const eventName = getEventName(newStatus);
  const eventTime = Math.floor(Date.now() / 1000);
  const dedupId = eventId || `${eventName}_${leadId}_${eventTime}`;

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        event_id: dedupId,
        action_source: source === 'facebook' ? 'website' : 'crm',
        user_data: {
          em: email ? [sha256(email)] : undefined,
          ph: phone ? [sha256(phone)] : undefined,
          ...(source === 'facebook' && clientIp ? { client_ip_address: clientIp } : {}),
          ...(source === 'facebook' && userAgent ? { client_user_agent: userAgent } : {}),
        },
        custom_data: {
          lead_id: leadId,
          status: newStatus,
          lead_name: name,
          source,
          ...getEventCustomData(newStatus),
        },
      },
    ],
    access_token: conn.accessToken,
  };

  try {
    const url = `${META_GRAPH_URL}/${conn.pixelId}/events`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Unknown Meta API error', response: data };
    }

    // Update sync status in DB
    try {
      const { default: db } = await import('../db');
      db.prepare(`
        UPDATE status_changes SET synced_to_meta = 1, meta_response = ? WHERE rowid IN (
          SELECT rowid FROM status_changes WHERE lead_id = ? ORDER BY rowid DESC LIMIT 1
        )
      `).run(JSON.stringify(data), leadId);
    } catch {}

    return { success: true, response: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  const conn = await getConnection();
  if (!conn || !conn.accessToken || !conn.pixelId) {
    return { success: false, error: 'Meta connection not configured' };
  }

  try {
    const url = `${META_GRAPH_URL}/${conn.pixelId}/events`;
    const payload = {
      data: [
        {
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'crm',
          user_data: { em: [sha256('test@leadtrace.com')], ph: [sha256('+0000000000')] },
          custom_data: { lead_id: 'TEST', status: 'test_connection' },
        },
      ],
      access_token: conn.accessToken,
      test_event_code: 'TEST50937',
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error?.message || 'Meta API error' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Lead Forms & Lead Import from Meta Lead Ads API ───

interface MetaConnection {
  accessToken: string;
  facebookPageId: string;
  pixelId: string;
}

interface SyncResult {
  success: boolean;
  formsSynced: number;
  leadsImported: number;
  errors: string[];
}

function extractField(fieldData: { name: string; values: string[] }[], fieldName: string): string {
  const field = fieldData.find(f => f.name === fieldName || f.name === fieldName.replace(/_/g, '_'));
  return field?.values?.[0] || '';
}

export async function syncLeadsFromMeta(): Promise<SyncResult> {
  const conn = await getConnection();
  if (!conn || !conn.accessToken) {
    return { success: false, formsSynced: 0, leadsImported: 0, errors: ['Meta connection not configured'] };
  }

  const result: SyncResult = { success: true, formsSynced: 0, leadsImported: 0, errors: [] };

  try {
    // Step 1: Fetch pages to get Page Access Tokens (lead forms require a page token)
    const accountsUrl = `${META_GRAPH_URL}/me/accounts?access_token=${conn.accessToken}`;
    const accountsRes = await fetch(accountsUrl);
    const accountsData = await accountsRes.json();

    if (!accountsRes.ok) {
      return { success: false, formsSynced: 0, leadsImported: 0, errors: [accountsData.error?.message || 'Failed to fetch pages'] };
    }

    const pages: { id: string; name: string; access_token: string }[] = accountsData.data || [];
    if (pages.length === 0) {
      return { success: false, formsSynced: 0, leadsImported: 0, errors: ['No Facebook pages found. The access token needs page management permissions.'] };
    }

    // Find matching page, or use the first one
    let page = pages.find(p => p.id === conn.facebookPageId) || pages[0];
    if (!conn.facebookPageId || conn.facebookPageId !== page.id) {
      result.errors.push(`Using page "${page.name}" (${page.id})`);
    }

    // Step 2: Fetch lead forms using the Page Access Token
    const formsUrl = `${META_GRAPH_URL}/${page.id}/leadgen_forms?access_token=${page.access_token}`;
    const formsRes = await fetch(formsUrl);
    const formsData = await formsRes.json();

    if (!formsRes.ok) {
      return { success: false, formsSynced: 0, leadsImported: 0, errors: [`${page.name}: ${formsData.error?.message || 'Failed to fetch forms'}`] };
    }

    const forms: { id: string; name: string; status: string }[] = formsData.data || [];
    if (forms.length === 0) {
      result.errors.push(`No lead forms found on page "${page.name}". Create an Instant Form in Meta Ads Manager first.`);
      return result;
    }

    const { default: db } = await import('../db');
    const now = new Date().toISOString();

    // Step 3: For each form, fetch leads using the page token
    for (const form of forms) {
      const leadsUrl = `${META_GRAPH_URL}/${form.id}/leads?access_token=${page.access_token}&fields=id,created_time,field_data,ad_id,ad_name`;
      const leadsRes = await fetch(leadsUrl);
      const leadsData = await leadsRes.json();

      if (!leadsRes.ok) {
        result.errors.push(`Form ${form.name}: ${leadsData.error?.message || 'Failed to fetch leads'}`);
        continue;
      }

      const metaLeads: any[] = leadsData.data || [];
      let importedCount = 0;

      for (const metaLead of metaLeads) {
        const fieldData: { name: string; values: string[] }[] = metaLead.field_data || [];

        const name = extractField(fieldData, 'full_name') || extractField(fieldData, 'name');
        const email = extractField(fieldData, 'email') || extractField(fieldData, 'email_address');
        const phone = extractField(fieldData, 'phone_number') || extractField(fieldData, 'phone');
        const city = extractField(fieldData, 'city');
        const propertyInterest = extractField(fieldData, 'property_interest') ||
          extractField(fieldData, 'what_are_you_looking_for') ||
          extractField(fieldData, 'interest');
        const budget = extractField(fieldData, 'budget') ||
          extractField(fieldData, 'budget_range') ||
          extractField(fieldData, 'what_is_your_budget');

        if (!email && !phone) {
          result.errors.push(`Lead ${metaLead.id}: No email or phone, skipped`);
          continue;
        }

        // Check for duplicate
        const existing = email
          ? db.prepare('SELECT id FROM leads WHERE email = ? AND form_name = ?').get(email, form.name)
          : db.prepare('SELECT id FROM leads WHERE phone = ? AND form_name = ?').get(phone, form.name);

        if (existing) {
          db.prepare('UPDATE leads SET ad_name = ?, updated_at = ? WHERE id = ?')
            .run(metaLead.ad_name || form.name, now, (existing as { id: string }).id);
          continue;
        }

        const last = db.prepare("SELECT id FROM leads ORDER BY id DESC LIMIT 1").get() as { id: string } | undefined;
        const nextNum = last ? parseInt(last.id.split('-')[1]) + 1 : 1001;
        const id = `LD-${nextNum}`;

        db.prepare(`
          INSERT INTO leads (id, name, email, phone, status, source, form_name, ad_name, property_interest, budget, notes, assigned_to, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'new', 'facebook', ?, ?, ?, ?, '', '', ?, ?)
        `).run(
          id,
          name || 'Unknown',
          email || `${phone}@imported.lead`,
          phone,
          form.name,
          metaLead.ad_name || '',
          propertyInterest || city,
          budget || '',
          metaLead.created_time || now,
          now,
        );

        importedCount++;

        const changeId = `ch-${Date.now()}-${id}`;
        db.prepare(`
          INSERT INTO status_changes (id, lead_id, from_status, to_status, timestamp, synced_to_meta, meta_response)
          VALUES (?, ?, 'system', 'new', ?, 1, ?)
        `).run(changeId, id, metaLead.created_time || now, JSON.stringify({ imported_from_form: form.name }));

        // Send Lead CAPI event for imported leads
        sendStatusEvent(id, name || 'Unknown', email || '', phone, 'new', 'facebook').catch(() => {});
      }

      result.leadsImported += importedCount;
      result.formsSynced++;
    }

    // Save synced form summaries
    const formSummaries = forms.map(f => {
      const formLeads = db.prepare("SELECT COUNT(*) as c FROM leads WHERE form_name = ?").get(f.name) as { c: number };
      const lastLead = db.prepare("SELECT created_at FROM leads WHERE form_name = ? ORDER BY created_at DESC LIMIT 1").get(f.name) as { created_at: string } | undefined;
      return {
        id: f.id,
        name: f.name,
        status: f.status.toLowerCase(),
        leadCount: formLeads.c,
        lastLeadAt: lastLead?.created_at || null,
      };
    });

    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('lead_forms', JSON.stringify(formSummaries));

    // Update meta connection with the correct page ID + sync time
    const metaConn = await getSetting_('meta_connection') || {};
    metaConn.facebookPageId = page.id;
    metaConn.lastSync = now;
    metaConn.connected = true;
    insertSetting.run('meta_connection', JSON.stringify(metaConn));

  } catch (err: any) {
    result.success = false;
    result.errors.push(err.message);
  }

  return result;
}

// Helper to read a setting
async function getSetting_(key: string): Promise<any> {
  try {
    const { default: db } = await import('../db');
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : null;
  } catch {
    return null;
  }
}