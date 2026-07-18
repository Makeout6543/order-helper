import { supabase } from "../lib/supabase";
import type { Supplier, Material, Order, OrderItem } from "../types";

// snake_case ↔ camelCase 转换 helpers
interface SupplierRow {
  id: number;
  name: string;
  created_at: string;
}

interface MaterialRow {
  id: number;
  supplier_id: number;
  name: string;
  spec: string | null;
  unit: string;
  price: number | string | null;
  sort_order: number | null;
  created_at: string;
}

interface OrderRow {
  id: number;
  supplier_id: number | null;
  supplier_name: string;
  items: OrderItem[] | null;
  user_name: string | null;
  note: string | null;
  request_id: string;
  created_at: string;
}

const supplierFromDB = (row: SupplierRow): Supplier => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
});

const materialFromDB = (row: MaterialRow): Material => ({
  id: row.id,
  supplierId: row.supplier_id,
  name: row.name,
  spec: row.spec ?? "",
  unit: row.unit,
  price: typeof row.price === "string" ? parseFloat(row.price) || 0 : row.price ?? 0,
  sortOrder: row.sort_order ?? 0,
});

const orderFromDB = (row: OrderRow): Order => ({
  id: row.id,
  supplierId: row.supplier_id,
  supplierName: row.supplier_name,
  items: Array.isArray(row.items) ? row.items : [],
  userName: row.user_name ?? "",
  note: row.note ?? "",
  requestId: row.request_id,
  createdAt: row.created_at,
});

const fail = (msg: string, error: { message?: string } | null): never => {
  throw new Error(`${msg}：${error?.message ?? "未知错误"}`);
};

export const api = {
  // 供应商
  suppliers: {
    list: async (): Promise<Supplier[]> => {
      const rows: SupplierRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("suppliers").select("*").order("id", { ascending: true }).range(from, from + 999);
        if (error) fail("加载供应商失败", error);
        rows.push(...((data ?? []) as SupplierRow[]));
        if ((data?.length ?? 0) < 1000) break;
      }
      return rows.map(supplierFromDB);
    },
    create: async (name: string): Promise<Supplier> => {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ name })
        .select()
        .single();
      if (error || !data) fail("创建供应商失败", error);
      return supplierFromDB(data as SupplierRow);
    },
    delete: async (id: number): Promise<void> => {
      // CASCADE 会自动删 materials；orders 会 SET NULL（保留快照）
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) fail("删除供应商失败", error);
    },
  },

  // 物料
  materials: {
    list: async (supplierId: number): Promise<Material[]> => {
      const rows: MaterialRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("materials").select("*").eq("supplier_id", supplierId).order("sort_order", { ascending: true }).order("id", { ascending: true }).range(from, from + 999);
        if (error) fail("加载物料失败", error);
        rows.push(...((data ?? []) as MaterialRow[]));
        if ((data?.length ?? 0) < 1000) break;
      }
      return rows.map(materialFromDB);
    },
    create: async (
      supplierId: number,
      data: { name: string; spec: string; unit: string; price: number }
    ): Promise<Material> => {
      // sort_order 设为当前 supplier 已有物料数量
      const { count, error: countErr } = await supabase
        .from("materials")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", supplierId);
      if (countErr) fail("计算物料数量失败", countErr);

      const { data: row, error } = await supabase
        .from("materials")
        .insert({
          supplier_id: supplierId,
          name: data.name,
          spec: data.spec,
          unit: data.unit,
          price: data.price,
          sort_order: count ?? 0,
        })
        .select()
        .single();
      if (error || !row) fail("创建物料失败", error);
      return materialFromDB(row as MaterialRow);
    },
    update: async (
      _supplierId: number,
      id: number,
      data: Partial<Material>
    ): Promise<Material> => {
      const patch: Record<string, unknown> = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.spec !== undefined) patch.spec = data.spec;
      if (data.unit !== undefined) patch.unit = data.unit;
      if (data.price !== undefined) patch.price = data.price;
      if (data.sortOrder !== undefined) patch.sort_order = data.sortOrder;
      const { data: row, error } = await supabase
        .from("materials")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error || !row) fail("更新物料失败", error);
      return materialFromDB(row as MaterialRow);
    },
    delete: async (_supplierId: number, id: number): Promise<void> => {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) fail("删除物料失败", error);
    },
  },

  // 订单
  orders: {
    list: async (): Promise<Order[]> => {
      const rows: OrderRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).range(from, from + 999);
        if (error) fail("加载订单失败", error);
        rows.push(...((data ?? []) as OrderRow[]));
        if ((data?.length ?? 0) < 1000) break;
      }
      return rows.map(orderFromDB);
    },
    create: async (data: {
      supplier_id: number;
      supplier_name: string;
      items: OrderItem[];
      user_name?: string;
      note?: string;
      request_id: string;
    }): Promise<Order> => {
      const { data: row, error } = await supabase
        .from("orders")
        .insert({
          supplier_id: data.supplier_id,
          supplier_name: data.supplier_name,
          items: data.items,
          user_name: data.user_name ?? "",
          note: data.note ?? "",
          request_id: data.request_id,
        })
        .select()
        .single();
      if (error || !row) fail("创建订单失败", error);
      return orderFromDB(row as OrderRow);
    },
    delete: async (id: number): Promise<void> => {
      const { error } = await supabase.from("orders").delete().eq("id", id);
      if (error) fail("删除订单失败", error);
    },
  },
};
