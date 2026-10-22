import { getDB } from "../config/db.js";
import { nowIso } from "../utils/ids.js";

export const DTF_COLLECTION = "dtfComponentStock";
export const DTF_TYPES = Object.freeze(["logo", "neck", "size", "text"]);
export const DTF_COLORS = Object.freeze(["black", "white"]);
export const DTF_SIZES = Object.freeze(["S", "M", "L", "XL", "2XL"]);

export function normalizeDtfColor(color) {
  const value = String(color || "").trim().toLowerCase();
  if (["black", "μαύρο", "μαυρο"].includes(value)) return "white";
  if (["white", "λευκό", "λευκο", "άσπρο", "ασπρο"].includes(value)) return "black";
  if (DTF_COLORS.includes(value)) return value;
  throw new Error("Invalid print color");
}
export function normalizeSize(size) {
  const s = String(size || "").trim().toUpperCase();
  const normalized = s === "XXL" ? "2XL" : s;
  if (!DTF_SIZES.includes(normalized)) throw new Error("Unsupported DTF size");
  return normalized;
}
export function normalizePrintText(text) {
  const value = String(text || "").normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
  if (!value || value.length > 90 || /[<>]/.test(value)) throw new Error("Invalid print text");
  return value;
}
export function componentSpec(type, color, {size, text}={}) {
  const kind = String(type || "").toLowerCase();
  if (!DTF_TYPES.includes(kind) || !DTF_COLORS.includes(color)) throw new Error("Invalid DTF component");
  const result = {type:kind,color};
  if (kind === "size") result.size=normalizeSize(size);
  if (kind === "text") result.text=normalizePrintText(text);
  return result;
}
export function componentKey(spec) {
  const extra = spec.type === "size" ? spec.size : spec.type === "text" ? spec.text : "";
  return [spec.type,spec.color,extra].map(part=>encodeURIComponent(part)).join("__");
}
export function neededComponents(qr) {
  const color = normalizeDtfColor(qr.variant?.color || "Black");
  const size = normalizeSize(qr.variant?.size);
  const result = [
    componentSpec("logo",color),
    componentSpec("neck",color),
    componentSpec("size",color,{size}),
  ];
  const text = String(qr.qrConfig?.textPrint ?? "").trim();
  if (text) result.push(componentSpec("text",color,{text}));
  return result;
}

/**
 * Claim physical DTF transfers, transactionally and exactly once per paid order.
 * This is intentionally separate from QR assignment; missing transfers become
 * production instructions and never falsely count as physical inventory.
 */
export async function ensureOrderDtfPlan(orderId, qrDocs, {db=getDB()}={}) {
  const orderRef=db.collection("orders").doc(String(orderId));
  const needed = [];
  for (const qr of qrDocs) {
    if (qr.fulfillmentMode !== "modular_qr") continue;
    if (!qr.variant?.size || !["S","M","L","XL","2XL","XXL"].includes(String(qr.variant.size).toUpperCase())) continue;
    for (const spec of neededComponents(qr)) needed.push({...spec, qrId:qr.id});
  }
  if (!needed.length) return {components:[], missing:[]};
  const keys=[...new Set(needed.map(componentKey))].sort();
  return db.runTransaction(async tx=>{
    const orderSnap=await tx.get(orderRef);
    if (!orderSnap.exists) throw new Error("Order missing for DTF allocation");
    if (orderSnap.data()?.dtfProductionPlan) return orderSnap.data().dtfProductionPlan;
    const refs=keys.map(key=>db.collection(DTF_COLLECTION).doc(key));
    const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
    const availability=new Map(snaps.map((snap,i)=>[keys[i],Number(snap.data()?.physicalQuantity || 0)]));
    const used=new Map();
    const components=needed.map(spec=>{
      const key=componentKey(spec);
      const available=availability.get(key)||0;
      const inStock=available>0;
      if (inStock) {
        availability.set(key,available-1);
        used.set(key,(used.get(key)||0)+1);
      }
      return {...spec,key,source:inStock?"physical_stock":"print_required"};
    });
    for (let i=0;i<refs.length;i++) {
      const consumed=used.get(keys[i])||0;
      if (consumed) tx.set(refs[i],{physicalQuantity:availability.get(keys[i]),updatedAt:nowIso()},{merge:true});
    }
    const plan={components,missing:components.filter(item=>item.source==="print_required"),createdAt:nowIso()};
    tx.set(orderRef,{dtfProductionPlan:plan,updatedAt:nowIso()},{merge:true});
    return plan;
  });
}

export async function getDtfInventory(db=getDB()) {
  const snapshot=await db.collection(DTF_COLLECTION).get();
  return snapshot.docs.map(doc=>({key:doc.id,...doc.data()}));
}

export async function setPhysicalDtfQuantity(spec, quantity, {db=getDB()}={}) {
  if (!Number.isSafeInteger(quantity)||quantity<0||quantity>100000) throw new Error("Invalid physical quantity");
  const key=componentKey(spec);
  await db.collection(DTF_COLLECTION).doc(key).set({...spec,physicalQuantity:quantity,updatedAt:nowIso()},{merge:true});
  return {key,...spec,physicalQuantity:quantity};
}
