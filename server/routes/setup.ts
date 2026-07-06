import { Router, Request, Response } from 'express';
import db from '../db';
import { testConnection, syncLeadsFromMeta } from '../services/meta-capi';

const router = Router();

function getSetting(key: string): any {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? JSON.parse(row.value) : null;
}

function setSetting(key: string, value: any) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

// Meta connection
router.get('/meta', (_req: Request, res: Response) => {
  const meta = getSetting('meta_connection');
  if (!meta) return res.json({ pixelId: '', accessToken: '', facebookPageId: '', connected: false, lastSync: null });
  res.json(meta);
});

router.put('/meta', (req: Request, res: Response) => {
  const { pixelId, accessToken, facebookPageId } = req.body;
  const meta = getSetting('meta_connection') || {};
  const updated = {
    pixelId: pixelId || meta.pixelId || '',
    accessToken: accessToken || meta.accessToken || '',
    facebookPageId: facebookPageId || meta.facebookPageId || '',
    connected: true,
    lastSync: new Date().toISOString(),
  };
  setSetting('meta_connection', updated);
  res.json(updated);
});

router.post('/meta/test', async (_req: Request, res: Response) => {
  const result = await testConnection();
  res.json(result);
});

// Lead forms
router.get('/forms', (_req: Request, res: Response) => {
  const forms = getSetting('lead_forms') || [];
  res.json(forms);
});

router.put('/forms', (req: Request, res: Response) => {
  setSetting('lead_forms', req.body);
  res.json(req.body);
});

// Sync lead forms and import leads from Meta Lead Ads
router.post('/forms/sync', async (_req: Request, res: Response) => {
  const result = await syncLeadsFromMeta();
  res.json(result);
  if (result.success) {
    console.log(`Sync complete: ${result.formsSynced} forms, ${result.leadsImported} leads imported`);
  } else {
    console.error('Sync failed:', result.errors);
  }
});

// Team members
router.get('/team', (_req: Request, res: Response) => {
  const members = getSetting('team_members') || [];
  res.json(members);
});

router.put('/team', (req: Request, res: Response) => {
  setSetting('team_members', req.body);
  res.json(req.body);
});

// Assignment rules
router.get('/rules', (_req: Request, res: Response) => {
  const rules = getSetting('assignment_rules') || [];
  res.json(rules);
});

router.put('/rules', (req: Request, res: Response) => {
  setSetting('assignment_rules', req.body);
  res.json(req.body);
});

// Bulk settings get
router.get('/', (_req: Request, res: Response) => {
  res.json({
    metaConnection: getSetting('meta_connection'),
    leadForms: getSetting('lead_forms') || [],
    teamMembers: getSetting('team_members') || [],
    assignmentRules: getSetting('assignment_rules') || [],
  });
});

export default router;