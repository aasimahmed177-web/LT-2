import express from "express";
import cors from "cors";
import metaRoutes from "./routes/meta.js";
import leadsRoutes from "./routes/leads.js";
import statsRoutes from "./routes/stats.js";
import eventsRoutes from "./routes/events.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json());

app.use("/api/meta", metaRoutes);
app.use("/api/leads", leadsRoutes);
app.use("/api/debug", leadsRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/events", eventsRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "leadtrace-api" });
});

app.listen(PORT, () => {
  console.log(`LeadTrace API running on port ${PORT}`);
});