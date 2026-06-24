import { apiRequest } from "./api";
import type { CartItem } from "./cart";

export interface Order {
  id: string;
  orderNumber?: string;
  status?: string;
  total?: number;
  currency?: string;
  items?: CartItem[];
  createdAt?: string;
}

export async function getOrders(): Promise<Order[]> {
  return apiRequest<Order[]>("/orders");
}
