import { Router, Request, Response } from "express";
import { getDB } from "../db.js";
import { asyncHandler } from "../middleware/async.js";

const router = Router();

// 获取订单（按时间倒序，最近50条）
router.get("/", asyncHandler(async (_req, res) => {
  const db = await getDB();
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 50").all();
  // items 是 JSON 字符串，转回对象
  const result = orders.map((o: any) => ({ ...o, items: JSON.parse(o.items) }));
  res.json(result);
}));

// 创建订单
router.post("/", asyncHandler(async (req, res) => {
  const db = await getDB();
  const { supplier_id, supplier_name, items } = req.body;
  if (!supplier_id || !items?.length) return res.status(400).json({ error: "参数不完整" });

  const r = db.prepare("INSERT INTO orders (supplier_id, supplier_name, items) VALUES (?, ?, ?)")
    .run(supplier_id, supplier_name, JSON.stringify(items));
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(r.lastInsertRowid);
  res.status(201).json({ ...order, items: JSON.parse(order.items) });
}));

// 删除订单
router.delete("/:id", asyncHandler(async (req, res) => {
  const db = await getDB();
  db.prepare("DELETE FROM orders WHERE id = ?").run(req.params.id);
  res.json({ message: "已删除" });
}));

export default router;
