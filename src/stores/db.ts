import { supabase } from "../lib/supabase";
import { api } from "./api";
import type { Supplier, Material, Order, OrderItem } from "../types";

export interface Snapshot {
  version: 1;
  exportedAt: string;
  suppliers: Supplier[];
  materials: Material[];
  orders: Order[];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNonNegative = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isDate = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));

export function validateSnapshot(value: unknown): Snapshot {
  if (!isObject(value) || value.version !== 1 || !isDate(value.exportedAt)) throw new Error("备份版本或导出时间无效");
  if (!Array.isArray(value.suppliers) || !Array.isArray(value.materials) || !Array.isArray(value.orders)) throw new Error("备份缺少供应商、物料或订单数组");
  if (value.suppliers.length > 1000 || value.materials.length > 10000 || value.orders.length > 100000) throw new Error("备份记录数超过安全限制");

  const supplierIds = new Set<number>();
  for (const row of value.suppliers) {
    if (!isObject(row) || typeof row.id !== "number" || !Number.isInteger(row.id) || row.id <= 0 || typeof row.name !== "string" || !row.name.trim() || !isDate(row.createdAt)) throw new Error("供应商数据不完整");
    if (supplierIds.has(row.id)) throw new Error("供应商 ID 重复");
    supplierIds.add(row.id);
  }
  for (const row of value.materials) {
    if (!isObject(row) || typeof row.id !== "number" || !Number.isInteger(row.id) || row.id <= 0 || typeof row.supplierId !== "number" || !supplierIds.has(row.supplierId) || typeof row.name !== "string" || !row.name.trim() || typeof row.spec !== "string" || typeof row.unit !== "string" || !row.unit.trim() || !isFiniteNonNegative(row.price) || !isFiniteNonNegative(row.sortOrder)) throw new Error("物料数据不完整或供应商关联无效");
  }
  for (const row of value.orders) {
    if (!isObject(row) || typeof row.id !== "number" || !Number.isInteger(row.id) || row.id <= 0 || (row.supplierId !== null && (typeof row.supplierId !== "number" || !supplierIds.has(row.supplierId))) || typeof row.supplierName !== "string" || !row.supplierName.trim() || !Array.isArray(row.items) || !isDate(row.createdAt)) throw new Error("订单数据不完整或供应商关联无效");
    for (const item of row.items) {
      if (!isObject(item) || typeof item.materialName !== "string" || !item.materialName.trim() || typeof item.spec !== "string" || !isFiniteNonNegative(item.quantity) || item.quantity === 0 || typeof item.unit !== "string" || !item.unit.trim() || (item.price !== undefined && !isFiniteNonNegative(item.price))) throw new Error("订单物料明细无效");
    }
  }
  return value as unknown as Snapshot;
}

export async function snapshot(): Promise<Snapshot> {
  const [suppliers, orders] = await Promise.all([api.suppliers.list(), api.orders.list()]);
  const materials = (await Promise.all(suppliers.filter(s => s.id != null).map(s => api.materials.list(s.id!)))).flat();
  return { version: 1, exportedAt: new Date().toISOString(), suppliers, materials, orders };
}

export async function backupToLocalStorage(): Promise<void> {
  try { localStorage.setItem("orderhelper:backup:v1", JSON.stringify(await snapshot())); }
  catch (e) { console.warn("本地快照失败", e); }
}

export async function restoreFromSnapshot(input: unknown): Promise<{ suppliers: number; materials: number; orders: number }> {
  const data = validateSnapshot(input);
  const { data: result, error } = await supabase.rpc("restore_snapshot", { p_snapshot: data });
  if (error) throw new Error("恢复失败：" + error.message);
  if (!isObject(result) || result.suppliers !== data.suppliers.length || result.materials !== data.materials.length || result.orders !== data.orders.length) throw new Error("恢复后的记录数量与备份不一致");
  return result as { suppliers: number; materials: number; orders: number };
}

export type { OrderItem };
