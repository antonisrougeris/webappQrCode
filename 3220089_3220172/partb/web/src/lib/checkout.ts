import { apiRequest } from "@/lib/api";

export interface CheckoutPayload {
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    city: string;
    postalCode: string;
    addressLine1: string;
    addressLine2?: string;
  };
  delivery: "home" | "boxnow";
  locker?: string;
  notes?: string;
}

export interface CheckoutResponse {
  checkoutUrl?: string;
  order?: unknown;
}

export async function checkout(
  payload: CheckoutPayload
): Promise<CheckoutResponse> {
  return apiRequest<CheckoutResponse>("/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
