import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import metaRoutes from "./routes/meta.js";
import leadsRoutes from "./routes/leads.js";
import statsRoutes from "./routes/stats.js";
import eventsRoutes from "./routes/events.js";

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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "leadtrace-api" });
});

// Serve built frontend for all non-API routes (SPA)
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`LeadTrace API running on port ${PORT}`);
});