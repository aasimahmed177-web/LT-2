import { Router, Request, Response } from 'express';
import db from '../db';
import { sendStatusEvent } from '../services/meta-capi';

const router = Router();

// List leads with search, status filter, pagination
router.get('/', (req: Request, res: Response) => {
  const search = (req.query.search as string || '').trim().toLowerCase();
  const status = req.query.status as string || '';
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;

  let query = 'SELECT * FROM leads WHERE 1=1';
  const params: any[] = [];

  if (search) {
    query += ' AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(id) LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (status && status !== 'all') {
    const statuses = status.split(',');
    query += ` AND status IN (${statuses.map(() => '?').join(',')})`;
    params.push(...statuses);
  }

  // Count total
  const countRow = db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as total')).get(...params) as { total: number };
  const total = countRow?.total || 0;

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const leads = db.prepare(query).all(...params);
  res.json({ leads, total, page, limit, totalPages: Math.ceil(total / limit) });
});

// Get single lead
router.get('/:id', (req: Request, res: Response) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

// Create lead
router.post('/', (req: Request, res: Response) => {
  const { name, email, phone, source = 'manual', form_name = '', ad_name = '', property_interest = '', budget = '', notes = '', assigned_to = '' } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email, and phone are required' });
  }

  // Generate next lead ID
  const last = db.prepare("SELECT id FROM leads ORDER BY id DESC LIMIT 1").get() as { id: string } | undefined;
  const nextNum = last ? parseInt(last.id.split('-')[1]) + 1 : 1001;
  const id = `LD-${nextNum}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO leads (id, name, email, phone, status, source, form_name, ad_name, property_interest, budget, notes, assigned_to, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, email, phone, source, form_name, ad_name, property_interest, budget, notes, assigned_to, now, now);

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  res.status(201).json(lead);

  // Record status change for the new lead
  const changeId = `ch-${Date.now()}`;
  db.prepare(`
    INSERT INTO status_changes (id, lead_id, from_status, to_status, timestamp, synced_to_meta, meta_response)
    VALUES (?, ?, 'system', 'new', ?, 0, '')
  `).run(changeId, id, now);

  // Send Lead CAPI event for new manual leads (async)
  const clientIp = req.ip || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  sendStatusEvent(id, name, email, phone, 'new', source, clientIp, userAgent).catch(() => {});
});

// Update lead fields
router.patch('/:id', (req: Request, res: Response) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id) as any;
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const fields = ['name', 'email', 'phone', 'source', 'form_name', 'ad_name', 'property_interest', 'budget', 'notes', 'assigned_to'];
  const updates: string[] = [];
  const params: any[] = [];

  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  if (updates.length === 0) return res.json(lead);

  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(req.params.id);

  db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Update lead status (triggers Meta CAPI)
router.patch('/:id/status', async (req: Request, res: Response) => {
  const { status } = req.body;
  const validStatuses = ['new', 'contacted', 'pre-qualified', 'qualified', 'converted', 'not-qualified', 'junk'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id) as any;
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (lead.status === status) return res.json(lead);

  const oldStatus = lead.status;
  const now = new Date().toISOString();

  // Update lead
  db.prepare('UPDATE leads SET status = ?, updated_at = ? WHERE id = ?').run(status, now, req.params.id);

  // Record status change
  const changeId = `ch-${Date.now()}`;
  db.prepare(`
    INSERT INTO status_changes (id, lead_id, from_status, to_status, timestamp, synced_to_meta, meta_response)
    VALUES (?, ?, ?, ?, ?, 0, '')
  `).run(changeId, req.params.id, oldStatus, status, now);

  // Always send to Meta CAPI — Lead event for new, Contacted/Prospect/etc for others
  const clientIp = req.ip || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  sendStatusEvent(req.params.id, lead.name, lead.email, lead.phone, status, lead.source, clientIp, userAgent).catch(() => {});

  const updated = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete lead
router.delete('/:id', (req: Request, res: Response) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  db.prepare('DELETE FROM status_changes WHERE lead_id = ?').run(req.params.id);
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Get status changes for a lead
router.get('/:id/changes', (req: Request, res: Response) => {
  const changes = db.prepare('SELECT * FROM status_changes WHERE lead_id = ? ORDER BY timestamp DESC').all(req.params.id);
  res.json(changes);
});

export default router;