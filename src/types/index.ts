export interface Supplier {
  id?: number;
  name: string;
  createdAt: string;
}

export interface Material {
  id?: number;
  supplierId: number;
  name: string;
  spec: string;
  unit: string;
  price: number;
  sortOrder: number;
}

export interface Order {
  id?: number;
  supplierId: number | null;
  supplierName: string;
  items: OrderItem[];
  userName?: string;
  note?: string;
  requestId?: string;
  createdAt: string;
}

export interface OrderItem {
  materialName: string;
  spec: string;
  quantity: number;
  unit: string;
  price?: number;
}
