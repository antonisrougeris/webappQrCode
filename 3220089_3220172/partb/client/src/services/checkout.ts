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

export interface CheckoutInvoiceDetails {
  companyName: string;
  vatNumber: string;
  taxOffice: string;
  activity: string;
  address: string;
  city: string;
  postalCode: string;
}

export interface CheckoutPayload {
  locale?: "en" | "el";
  customer: CheckoutCustomer;
  shippingAddress: CheckoutShippingAddress;
  phoneCountryCode: string;
  delivery?: "home" | "boxnow";
  locker?: string;
  notes?: string;
  giftOptions?: {
    tier: "none" | "simple" | "premium";
    giftBox?: boolean;
    personalNote: string;
  };
  documentType?: "receipt" | "invoice";
  invoiceDetails?: CheckoutInvoiceDetails | null;
  recoveryCode?: string;
  termsAcceptance: {
    accepted: true;
    version: "2026-09";
  };
}

export interface CheckoutResult {
  orderId: string;
  orderNumber?: string;
  qrCodesCreated?: number;
  order?: unknown;
  vivaOrderCode?: string;
  checkoutUrl?: string;
}

export async function checkout(
  payload: CheckoutPayload
): Promise<CheckoutResult> {
  const res = await apiRequest<CheckoutResult | { data: CheckoutResult }>(
    "/checkout",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  if ("data" in res && res.data) {
    return res.data;
  }

  return res as CheckoutResult;
}


export async function validateRecoveryOffer(
  code: string
): Promise<{
  code: string;
  discountPercent: number;
  expiresAt: string | null;
  minOrderAmount?: number;
}> {
  const res = await apiRequest<
    | {
        offer?: {
          code: string;
          discountPercent: number;
          expiresAt: string | null;
          minOrderAmount?: number;
        };
        data?: {
          offer?: {
            code: string;
            discountPercent: number;
            expiresAt: string | null;
            minOrderAmount?: number;
          };
        };
      }
  >("/checkout/discount-code", {
    method: "POST",
    body: JSON.stringify({ code }),
  });

  const offer = res?.offer || res?.data?.offer;

  if (!offer) {
    throw new Error("Discount code could not be validated");
  }

  return offer;
}
