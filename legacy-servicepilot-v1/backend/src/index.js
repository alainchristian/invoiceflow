import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import clientsRoutes from "./routes/clients.js";
import projectsRoutes from "./routes/projects.js";
import proposalsRoutes from "./routes/proposals.js";
import invoicesRoutes, { publicRouter as publicInvoicesRoutes } from "./routes/invoices.js";
import settingsRoutes from "./routes/settings.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" })); // logo data URLs can be a few hundred KB

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/proposals", proposalsRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/public/invoices", publicInvoicesRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`ServicePilot API listening on port ${PORT}`);
});
