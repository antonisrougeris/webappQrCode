import { trackEcommerceEvent, trackMetaEcommerceEvent } from "./analytics";
import { apiRequest } from "./api";
import type { ProductVariant } from "./products";

export interface CartItem {
  selectedVariant: ProductVariant | null | undefined;
  priceEUR: any;
  id: string;
  productId: string;
  title: string;
  slug?: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  currency?: string;
  quantity: number;
  image?: string;
  variant?: ProductVariant | null;
  qrDestination?: string;
  isFreeReward?: boolean;
}
export type GiftTier = "none" | "simple" | "premium";

export interface GiftOptions {
  tier: GiftTier;
  giftBox?: boolean;
  personalNote: string;
}

export interface Cart {
  id?: string;
  userId?: string;
  items: CartItem[];
  rewardItem?: CartItem | null;
  subtotal?: number;
  totalItems?: number;
  currency?: string;
  giftOptions?: GiftOptions;
}
export interface AddToCartPayload {
  productId: string;
  quantity?: number;
  variant?: ProductVariant | null;
  qrDestination?: string;
}
// Share overlapping header/cart-drawer reads. A mutation always invalidates this
// in-flight snapshot so a later read does not replace the newly updated cart.
let pendingCartRead: Promise<Cart> | null = null;

export function getCart(): Promise<Cart> {
  if (!pendingCartRead) {
    const request = apiRequest<{ cart: Cart }>("/cart").then(res => res.cart);
    const pending = request.finally(() => {
      if (pendingCartRead === pending) pendingCartRead = null;
    });
    pendingCartRead = pending;
  }
  return pendingCartRead;
}

function invalidatePendingCartRead(): void {
  pendingCartRead = null;
}
export async function addCartItem(payload:AddToCartPayload):Promise<Cart> {
  invalidatePendingCartRead();
  const res=await apiRequest<{cart:Cart}>("/cart/items",{method:"POST",body:JSON.stringify(payload)});
  const item = res.cart.items?.find(entry => entry.productId === payload.productId);
  if (item) {
    const eventItems = [{
    item_id: String(item.productId), item_name: item.title,
    price: Number(item.priceEUR ?? item.price ?? 0),
    quantity: Number(payload.quantity || 1),
    ...(item.variant?.sku ? { item_sku: String(item.variant.sku) } : {}),
    ...(item.variant ? { item_variant: [item.variant.color, item.variant.size].filter(Boolean).join(" / ") } : {})
    }];
    trackEcommerceEvent("add_to_cart", eventItems);
    trackMetaEcommerceEvent("add_to_cart", eventItems);
  }
  return res.cart;
}
export async function updateCartItem(itemId:string,payload:{quantity?:number;qrDestination?:string}):Promise<Cart> {
  invalidatePendingCartRead();
  const res=await apiRequest<{cart:Cart}>(`/cart/items/${encodeURIComponent(itemId)}`,{method:"PATCH",body:JSON.stringify(payload)});return res.cart;
}
export async function removeCartItem(itemId:string):Promise<Cart> {
  invalidatePendingCartRead();
  const res=await apiRequest<{cart:Cart}>(`/cart/items/${encodeURIComponent(itemId)}`,{method:"DELETE"});return res.cart;
}
export async function transferCartToGuest():Promise<Cart> {
  invalidatePendingCartRead();
  const res=await apiRequest<{cart:Cart}>("/cart/transfer-to-guest",{method:"POST"});return res.cart;
}

export async function updateCartGiftOptions(
  payload: GiftOptions
): Promise<Cart> {
  invalidatePendingCartRead();
  const res = await apiRequest<{cart:Cart}>("/cart/gift-options", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return res.cart;
}
