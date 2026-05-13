import express from "express";
import cors from "cors";
import { initDB, saveDB } from "./db.js";
import suppliersRouter from "./routes/suppliers.js";
import ordersRouter from "./routes/orders.js";

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.use("/api/suppliers", suppliersRouter);
app.use("/api/orders", ordersRouter);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("❌", err.message);
  res.status(500).json({ error: err.message || "服务器错误" });
});

initDB().then(() => {
  console.log("🗄️ DB ready");
  setInterval(() => { try { saveDB(); } catch {} }, 30000);
  process.on("SIGINT", () => { saveDB(); process.exit(0); });
  process.on("SIGTERM", () => { saveDB(); process.exit(0); });
  app.listen(PORT, () => console.log(`📦 Order Helper API @ http://localhost:${PORT}`));
}).catch(err => { console.error(err); process.exit(1); });
