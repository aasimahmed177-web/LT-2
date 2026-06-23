import { Router, Request, Response } from 'express';
import db from '../db';

const router = Router();

// Dashboard stats
router.get('/', (_req: Request, res: Response) => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const totalLeads = (db.prepare('SELECT COUNT(*) as c FROM leads').get() as { c: number }).c;
  const newToday = (db.prepare('SELECT COUNT(*) as c FROM leads WHERE created_at >= ?').get(todayStart) as { c: number }).c;
  const qualified = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status IN ('qualified', 'converted')").get() as { c: number }).c;
  const converted = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE status = 'converted'").get() as { c: number }).c;
  const conversionRate = totalLeads > 0 ? ((converted / totalLeads) * 100).toFixed(1) : '0';

  res.json({
    totalLeads,
    newToday,
    qualified,
    converted,
    conversionRate: parseFloat(conversionRate),
  });
});

// Weekly lead activity
router.get('/weekly', (_req: Request, res: Response) => {
  const days: { day: string; leads: number; qualified: number; converted: number }[] = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
    const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
    const dayName = dayNames[d.getDay()];

    const leads = (db.prepare('SELECT COUNT(*) as c FROM leads WHERE created_at >= ? AND created_at < ?').get(dayStart, dayEnd) as { c: number }).c;
    const qualified = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE created_at >= ? AND created_at < ? AND status IN ('qualified', 'converted')").get(dayStart, dayEnd) as { c: number }).c;
    const converted = (db.prepare("SELECT COUNT(*) as c FROM leads WHERE created_at >= ? AND created_at < ? AND status = 'converted'").get(dayStart, dayEnd) as { c: number }).c;

    days.push({ day: dayName, leads, qualified, converted });
  }

  res.json(days);
});

// Recent status changes (for sidebar sync indicator)
router.get('/recent-changes', (_req: Request, res: Response) => {
  const changes = db.prepare(`
    SELECT sc.*, l.name as lead_name
    FROM status_changes sc
    JOIN leads l ON l.id = sc.lead_id
    ORDER BY sc.timestamp DESC LIMIT 10
  `).all();
  res.json(changes);
});

export default router;