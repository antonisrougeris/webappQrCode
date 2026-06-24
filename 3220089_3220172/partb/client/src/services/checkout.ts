import { apiRequest } from "./api";

export interface CheckoutCustomer {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface CheckoutShippingAddress {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  country?: string;
  city: string;
  postalCode?: string;
  addressLine1: string;
  addressLine2?: string;
}

export interface CheckoutPayload {
  customer: CheckoutCustomer;
  shippingAddress: CheckoutShippingAddress;
  delivery?: "home" | "boxnow";
  locker?: string;
  notes?: string;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber?: string;
  qrCodesCreated?: number;
  order?: any;
}

export async function checkout(
  payload: CheckoutPayload
): Promise<CheckoutResult> {
  return apiRequest<CheckoutResult>("/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
