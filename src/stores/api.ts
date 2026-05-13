import { db } from "./db";
import type { Supplier, Material, Order } from "../types";

// 数据全部存储在浏览器 IndexedDB 中，无需后端
export const api = {
  // 供应商
  suppliers: {
    list: async (): Promise<Supplier[]> => db.suppliers.toArray(),
    create: async (name: string): Promise<Supplier> => {
      const id = await db.suppliers.add({ name, createdAt: new Date().toISOString() });
      return (await db.suppliers.get(id))!;
    },
    delete: async (id: number): Promise<void> => {
      await db.suppliers.delete(id);
      await db.materials.where("supplierId").equals(id).delete();
      await db.orders.where("supplierId").equals(id).delete();
    },
  },
  // 物料
  materials: {
    list: async (supplierId: number): Promise<Material[]> =>
      db.materials.where("supplierId").equals(supplierId).sortBy("sortOrder"),
    create: async (supplierId: number, data: { name: string; spec: string; unit: string; price: number }): Promise<Material> => {
      const maxOrder = await db.materials.where("supplierId").equals(supplierId).count();
      const id = await db.materials.add({ ...data, supplierId, sortOrder: maxOrder });
      return (await db.materials.get(id))!;
    },
    update: async (supplierId: number, id: number, data: Partial<Material>): Promise<Material> => {
      await db.materials.update(id, data);
      return (await db.materials.get(id))!;
    },
    delete: async (_supplierId: number, id: number): Promise<void> => {
      await db.materials.delete(id);
    },
  },
  // 订单
  orders: {
    list: async (): Promise<Order[]> =>
      db.orders.orderBy("createdAt").reverse().toArray(),
    create: async (data: { supplier_id: number; supplier_name: string; items: any[] }): Promise<Order> => {
      const id = await db.orders.add({
        supplierId: data.supplier_id,
        supplierName: data.supplier_name,
        items: data.items,
        createdAt: new Date().toISOString(),
      });
      return (await db.orders.get(id))!;
    },
    delete: async (id: number): Promise<void> => {
      await db.orders.delete(id);
    },
  },
};
