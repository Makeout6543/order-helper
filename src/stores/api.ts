import type { Supplier, Material, Order } from "../types";

const BASE = "/api";

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "请求失败");
  return res.json();
}

export const api = {
  // 供应商
  suppliers: {
    list: () => req<Supplier[]>("/suppliers"),
    create: (name: string) => req<Supplier>("/suppliers", { method: "POST", body: JSON.stringify({ name }) }),
    delete: (id: number) => req("/suppliers/" + id, { method: "DELETE" }),
  },
  // 物料
  materials: {
    list: (supplierId: number) => req<Material[]>(`/suppliers/${supplierId}/materials`),
    create: (supplierId: number, data: { name: string; spec: string; unit: string; price: number }) =>
      req<Material>(`/suppliers/${supplierId}/materials`, { method: "POST", body: JSON.stringify(data) }),
    update: (supplierId: number, id: number, data: Partial<Material>) =>
      req<Material>(`/suppliers/${supplierId}/materials/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (supplierId: number, id: number) =>
      req(`/suppliers/${supplierId}/materials/${id}`, { method: "DELETE" }),
  },
  // 订单
  orders: {
    list: () => req<Order[]>("/orders"),
    create: (data: { supplier_id: number; supplier_name: string; items: any[] }) =>
      req<Order>("/orders", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: number) => req("/orders/" + id, { method: "DELETE" }),
  },
};
