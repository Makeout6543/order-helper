import { Router, Request, Response } from "express";
import { getDB } from "../db.js";
import { asyncHandler } from "../middleware/async.js";

const router = Router();

// 供应商 CRUD
router.get("/", asyncHandler(async (_req, res) => {
  const db = await getDB();
  res.json(db.prepare("SELECT * FROM suppliers ORDER BY id").all());
}));

router.post("/", asyncHandler(async (req, res) => {
  const db = await getDB();
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "名称必填" });
  const r = db.prepare("INSERT INTO suppliers (name) VALUES (?)").run(name);
  res.status(201).json(db.prepare("SELECT * FROM suppliers WHERE id = ?").get(r.lastInsertRowid));
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const db = await getDB();
  db.prepare("DELETE FROM materials WHERE supplier_id = ?").run(req.params.id);
  db.prepare("DELETE FROM suppliers WHERE id = ?").run(req.params.id);
  res.json({ message: "已删除" });
}));

// 物料 CRUD
router.get("/:supplierId/materials", asyncHandler(async (req, res) => {
  const db = await getDB();
  res.json(db.prepare("SELECT * FROM materials WHERE supplier_id = ? ORDER BY sort_order").all(req.params.supplierId));
}));

router.post("/:supplierId/materials", asyncHandler(async (req, res) => {
  const db = await getDB();
  const { name, spec, unit, price } = req.body;
  if (!name || !unit) return res.status(400).json({ error: "名称和单位必填" });
  const maxOrder = db.prepare("SELECT MAX(sort_order) as m FROM materials WHERE supplier_id = ?")
    .get(req.params.supplierId) as { m: number };
  const r = db.prepare("INSERT INTO materials (supplier_id, name, spec, unit, price, sort_order) VALUES (?, ?, ?, ?, ?, ?)")
    .run(req.params.supplierId, name, spec || "", unit, price || 0, (maxOrder?.m || 0) + 1);
  res.status(201).json(db.prepare("SELECT * FROM materials WHERE id = ?").get(r.lastInsertRowid));
}));

router.put("/:supplierId/materials/:id", asyncHandler(async (req, res) => {
  const db = await getDB();
  const { name, spec, unit, price } = req.body;
  const sets: string[] = [];
  const vals: any[] = [];
  if (name !== undefined) { sets.push("name = ?"); vals.push(name); }
  if (spec !== undefined) { sets.push("spec = ?"); vals.push(spec); }
  if (unit !== undefined) { sets.push("unit = ?"); vals.push(unit); }
  if (price !== undefined) { sets.push("price = ?"); vals.push(price); }
  if (sets.length === 0) return res.status(400).json({ error: "无更新字段" });
  vals.push(req.params.id);
  db.prepare(`UPDATE materials SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  res.json(db.prepare("SELECT * FROM materials WHERE id = ?").get(req.params.id));
}));

router.delete("/:supplierId/materials/:id", asyncHandler(async (req, res) => {
  const db = await getDB();
  db.prepare("DELETE FROM materials WHERE id = ?").run(req.params.id);
  res.json({ message: "已删除" });
}));

export default router;
