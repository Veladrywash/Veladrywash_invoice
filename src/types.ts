export type OrderItem = {
  id: string;
  name: string;
  qty: number;
  price: number; // per item
};

export type Order = {
  id: string; // e.g., VDW-2025-001
  customerName: string;
  remark?: string;
  createdAt: string; // ISO string
  deliveryDate?: string; // ISO string, optional for now
  items: OrderItem[];
  roundOff?: number;
};