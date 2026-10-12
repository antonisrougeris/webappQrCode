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
  paymentStatus?: string;
  fulfillmentStatus?: string;
  shipping?: {
    provider?: string;
    carrier?: string;
    status?: string;
    parcelId?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    deliveredAt?: string;
    boxnow?: {
      parcelIds?: string[];
      environment?: string;
      lastEvent?: string;
      lastEventAt?: string;
    };
  };
}

export async function getOrders(): Promise<Order[]> {
  const response = await apiRequest<{ orders?: Order[] } | Order[]>("/orders");
  return Array.isArray(response) ? response : response.orders || [];
}
