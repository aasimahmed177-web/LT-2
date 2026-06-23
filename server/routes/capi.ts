import { Router, Request, Response } from 'express';
import { sendStatusEvent } from '../services/meta-capi';

const router = Router();

// Send a single CAPI event (called from frontend after Convex stage changes)
router.post('/send', async (req: Request, res: Response) => {
  const { leadId, name, email, phone, status } = req.body;

  if (!leadId || !name) {
    return res.status(400).json({ success: false, error: 'leadId and name are required' });
  }

  const clientIp = req.ip || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';

  try {
    const result = await sendStatusEvent(leadId, name, email || '', phone || '', status || 'new', 'crm', clientIp, userAgent);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check for CAPI route
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export default router;