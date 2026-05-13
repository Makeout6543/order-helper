import Dexie, { type Table } from "dexie";
import type { Supplier, Material, Order } from "../types";

class OrderDB extends Dexie {
  suppliers!: Table<Supplier, number>;
  materials!: Table<Material, number>;
  orders!: Table<Order, number>;

  constructor() {
    super("OrderHelper");
    this.version(1).stores({
      suppliers: "++id, name",
      materials: "++id, supplierId, sortOrder",
      orders: "++id, supplierId, createdAt",
    });
  }
}

export const db = new OrderDB();
