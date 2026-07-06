import express from 'express';
import cors from 'cors';
import { initialize } from './db';
import leadsRouter from './routes/leads';
import statsRouter from './routes/stats';
import setupRouter from './routes/setup';
import capiRouter from './routes/capi';

// Initialize database
initialize();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/leads', leadsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/setup', setupRouter);
app.use('/api/capi', capiRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export for Vercel serverless, or listen directly in development
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`LeadTrace API server running on http://localhost:${PORT}`);
  });
}

export default app;