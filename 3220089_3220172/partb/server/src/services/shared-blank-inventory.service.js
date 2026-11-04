import { getDB } from "../config/db.js";
import { nowIso } from "../utils/ids.js";

export const BLANK_COLLECTION = "blankInventory";
export const JOB_COLLECTION = "productionJobs";
export const SETTINGS_COLLECTION = "inventorySettings";
export const SETTINGS_ID = "sharedTshirts";
export const BLANK_SIZES = Object.freeze(["S", "M", "L", "XL", "2XL"]);
export const BLANK_COLORS = Object.freeze(["BLACK", "WHITE"]);

export function blankKey(variant) {
  const color = String(variant?.color || "").trim().toUpperCase();
  const size = String(variant?.size || "").trim().toUpperCase().replace(/^XXL$/, "2XL");
  return BLANK_COLORS.includes(color) && BLANK_SIZES.includes(size) ? `${color}__${size}` : null;
}

export function isSharedTshirt(product, variant) {
  const category = String(product?.category || "").toLowerCase().replace(/[^a-z]/g, "");
  return ["tshirt", "tshirts", "teeshirt", "teeshirts"].includes(category) && Boolean(blankKey(variant));
}

export function sharedInventoryKey(product, variant, enabled) {
  if (!enabled || !isSharedTshirt(product, variant)) return null;
  return `blank::${blankKey(variant)}`;
}

export function sharedAvailable(row) {
  const onHand = Number(row?.onHand || 0);
  const committedPhysical = Number(row?.committedPhysical || 0);
  const virtualLimit = Number(row?.virtualLimit || 0);
  const backorderOpen = Number(row?.backorderOpen || 0);
  if (![onHand,committedPhysical,virtualLimit,backorderOpen].every(n => Number.isSafeInteger(n) && n >= 0) ||
      committedPhysical > onHand || backorderOpen > virtualLimit) throw new Error("Invalid blank inventory counters");
  return Math.max(0, onHand - committedPhysical) + Math.max(0, virtualLimit - backorderOpen);
}

export function planSharedAllocation(row, requested) {
  const quantity = Number(requested);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) throw new Error("Invalid shared allocation quantity");
  if (sharedAvailable(row) < quantity) throw new Error("Insufficient shared blank capacity");
  const physical = Math.min(quantity, Number(row.onHand || 0) - Number(row.committedPhysical || 0));
  return { physical, virtual: quantity - physical };
}

export function isSharedReservationKey(key) {
  return /^blank::(BLACK|WHITE)__(S|M|L|XL|2XL)$/.test(String(key || ""));
}

export function blankIdFromReservationKey(key) {
  return isSharedReservationKey(key) ? String(key).slice(7) : null;
}

export async function readSharedEnabled(db = getDB()) {
  const snapshot = await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_ID).get();
  return snapshot.data()?.enabled === true;
}

export async function readSharedBlankRows(db = getDB()) {
  const snap = await db.collection(BLANK_COLLECTION).get();
  return new Map(snap.docs.map(doc => [doc.id, {id:doc.id,...doc.data()}]));
}

export function blankNewRow(id, quantity = 0) {
  if (!/^(BLACK|WHITE)__(S|M|L|XL|2XL)$/.test(id)) throw new Error("Invalid blank identifier");
  if (!Number.isSafeInteger(quantity) || quantity < 0) throw new Error("Invalid stock quantity");
  const [color,size] = id.split("__");
  return {color,size,onHand:quantity,committedPhysical:0,virtualLimit:0,backorderOpen:0,updatedAt:nowIso()};
}

/** A finished garment is a preprinted unique QR already physically applied to a shirt.
 * Uploaded artwork or a loose A3 DTF transfer is NOT a finished garment.
 */
export function isAvailableFinishedGood(qr) {
 return qr?.fulfillmentMode === "preprinted" && qr?.finishedGoodStatus === "available" &&
   qr?.status === "available" && Boolean(qr?.physicalAppliedAt) && Boolean(qr?.printFileUrl);
}
/** A reserved QR retains its physical production metadata, but its status
 * changes from available to reserved at checkout. Validate the *real*
 * physical A3 properties, never label every reserved QR as finished.
 */
export function isReservedFinishedGood(qr) {
  return qr?.status === "reserved" &&
    isAvailableFinishedGood({...qr, status:"available"});
}

export function finishedKey(productId,sku) {
 return `${String(productId)}::${String(sku)}`;
}
export function getSharedReservationSplit(holds, {excludeIds = new Set(), nowMs=Date.now()}={}) {
 const blankReserved=holds.reduce((sum,h)=>{
  if(excludeIds.has(String(h.id)) || !(Date.parse(String(h.expiresAt||""))>nowMs))return sum;
  return sum+Number(h.blankQuantity??h.quantity??0);
 },0);
 const finishedReservedBySku=new Map();
 for(const h of holds){
  if(excludeIds.has(String(h.id)) || !(Date.parse(String(h.expiresAt||""))>nowMs))continue;
  const key=finishedKey(h.productId,h.sku);
  finishedReservedBySku.set(key,(finishedReservedBySku.get(key)||0)+Number(h.finishedQuantity||0));
 }
 return {blankReserved,finishedReservedBySku};
}
