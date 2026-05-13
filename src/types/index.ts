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
  supplierId: number;
  supplierName: string;
  items: OrderItem[];
  createdAt: string;
}

export interface OrderItem {
  materialName: string;
  spec: string;
  quantity: number;
  unit: string;
}
