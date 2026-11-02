import { getDB } from "../config/db.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { nowIso } from "../utils/ids.js";
import {
 BLANK_COLLECTION, JOB_COLLECTION, SETTINGS_COLLECTION, SETTINGS_ID,
 BLANK_COLORS, BLANK_SIZES, blankNewRow, sharedAvailable, readSharedEnabled,isAvailableFinishedGood,
} from "../services/shared-blank-inventory.service.js";
import { pruneExpiredHolds } from "../services/inventory-reservation.service.js";

const keyFromInput = body => {
 const id = `${String(body?.color || "").toUpperCase()}__${String(body?.size || "").toUpperCase().replace(/^XXL$/,"2XL")}`;
 if (!/^(BLACK|WHITE)__(S|M|L|XL|2XL)$/.test(id)) throw new ApiError(400, "Select a valid shirt color and size");
 return id;
};
const unsigned = (value, max = 10000) => {
 const n = Number(value);
 if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new ApiError(400, "Invalid non-negative stock quantity");
 return n;
};
function inventoryMove(tx, db, kind, blankId, qty, extra = {}) {
 const ref = db.collection("inventoryMovements").doc();
 tx.set(ref, {id:ref.id, kind, blankId, quantity:qty, ...extra, at:nowIso()});
}

export const getSharedBlankInventory = asyncHandler(async (_req,res) => {
 const db = getDB();
 const [config, blanks, jobs, qrs, a3] = await Promise.all([
   db.collection(SETTINGS_COLLECTION).doc(SETTINGS_ID).get(),
   db.collection(BLANK_COLLECTION).get(),
   db.collection(JOB_COLLECTION).limit(300).get(),
   db.collection("qrCodes").where("fulfillmentMode","==","modular_qr").limit(1000).get(),
   db.collection("qrCodes").where("fulfillmentMode","==","preprinted").limit(1000).get()
 ]);
 const rows = blanks.docs.map(doc => {
   const row={id:doc.id,...doc.data()};
   return {...row, physicalAvailable:Math.max(0,Number(row.onHand||0)-Number(row.committedPhysical||0)),
     virtualAvailable:Math.max(0,Number(row.virtualLimit||0)-Number(row.backorderOpen||0)), saleable:sharedAvailable(row)};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 const production = jobs.docs.map(doc=>({id:doc.id,...doc.data()})).sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
 const qrItems=qrs.docs.map(doc=>({id:doc.id,shortId:doc.data().shortId||"",printColor:doc.data().modularPrintColor||"",status:doc.data().status,printFileUrl:doc.data().printFileUrl||"",orderId:doc.data().orderId||"",physicalConfirmedAt:doc.data().physicalConfirmedAt||null}));
 const a3Items=a3.docs.map(doc=>({id:doc.id,shortId:doc.data().shortId||"",productId:doc.data().productId||"",
  productTitle:doc.data().productTitle||"",variant:doc.data().variant||{},status:doc.data().status||"",
  printFileUrl:doc.data().printFileUrl||"",physicalAppliedAt:doc.data().physicalAppliedAt||null,
  finishedGoodStatus:doc.data().finishedGoodStatus||null,finishedSource:doc.data().finishedSource||null,
  eligibleForFinish:doc.data().status==="available" && !doc.data().physicalAppliedAt && Boolean(doc.data().printFileUrl)}));
 const readyFinished=a3.docs.filter(doc=>isAvailableFinishedGood(doc.data())).length;
 res.json({success:true,enabled:config.data()?.enabled===true,initialized:rows.length===BLANK_COLORS.length*BLANK_SIZES.length,
  rows,production,qrItems,a3Items,summary:{onHand:rows.reduce((n,x)=>n+Number(x.onHand||0),0),
  committed:rows.reduce((n,x)=>n+Number(x.committedPhysical||0),0),
  backorders:rows.reduce((n,x)=>n+Number(x.backorderOpen||0),0),
  blankSellable:rows.reduce((n,x)=>n+Number(x.saleable||0),0),
  finishedReady:readyFinished,qrReady:qrItems.filter(x=>x.status==="available").length}});
});

export const initializeBlankInventory = asyncHandler(async(req,res)=>{
 const stock=req.body?.stock;
 if (!Array.isArray(stock)||stock.length!==10) throw new ApiError(400,"Provide all ten color/size quantities");
 const inputs=new Map(stock.map(r=>[keyFromInput(r),unsigned(r.quantity,100000)]));
 if(inputs.size!==10) throw new ApiError(400,"Duplicate or missing color/size");
 const db=getDB();
 await db.runTransaction(async tx=>{
   const configRef=db.collection(SETTINGS_COLLECTION).doc(SETTINGS_ID);
   const refs=[...inputs.keys()].sort().map(id=>db.collection(BLANK_COLLECTION).doc(id));
   const [cfg,...snapshots]=await Promise.all([tx.get(configRef),...refs.map(r=>tx.get(r))]);
   if(cfg.data()?.enabled||snapshots.some(s=>s.exists))throw new ApiError(409,"Blank stock is already initialized");
   for(const ref of refs)tx.create(ref,blankNewRow(ref.id,inputs.get(ref.id)));
   tx.set(configRef,{enabled:false,initializedAt:nowIso(),updatedAt:nowIso()},{merge:true});
 });
 res.json({success:true,message:"Blank inventory initialized. Activate it separately after verification."});
});

export const enableSharedBlankInventory = asyncHandler(async(req,res)=>{
 if(req.body?.confirm!=="ACTIVATE_SHARED_STOCK")throw new ApiError(400,"Explicit activation confirmation required");
 const db=getDB();
 const [config, rows, holdSnap]=await Promise.all([
   db.collection(SETTINGS_COLLECTION).doc(SETTINGS_ID).get(),
   db.collection(BLANK_COLLECTION).get(),
   db.collection("inventoryHolds").get()
 ]);
 if(config.data()?.enabled===true)return res.json({success:true,enabled:true});
 if(rows.size!==10)throw new ApiError(409,"Initialize all ten blank rows first");
 // Prevent the cutover while active legacy carts or checkouts hold old per-product stock.
 if(holdSnap.docs.some(doc=>pruneExpiredHolds(doc.data()?.holds).length))throw new ApiError(409,"Active carts/checkouts exist. Activate after their stock holds expire.");
 await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_ID).set({enabled:true,activatedAt:nowIso(),updatedAt:nowIso()},{merge:true});
 res.json({success:true,enabled:true});
});

export const setBlankVirtualLimit = asyncHandler(async(req,res)=>{
 const id=keyFromInput(req.body), limit=unsigned(req.body?.virtualLimit);
 const db=getDB();
 const ref=db.collection(BLANK_COLLECTION).doc(id);
 const row=await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)throw new ApiError(404,"Blank inventory not initialized");
   if(limit<Number(snap.data()?.backorderOpen||0))throw new ApiError(409,"Cannot set capacity below open backorders");
   tx.update(ref,{virtualLimit:limit,updatedAt:nowIso()});
   inventoryMove(tx,db,"virtual_limit_changed",id,limit);
   return {...snap.data(),virtualLimit:limit};
 });
 res.json({success:true,row:{id,...row}});
});

export const receiveBlankStock = asyncHandler(async(req,res)=>{
 const id=keyFromInput(req.body), quantity=unsigned(req.body?.quantity,100000);
 if(!quantity)throw new ApiError(400,"Receipt must be at least one T-shirt");
 const db=getDB(),ref=db.collection(BLANK_COLLECTION).doc(id);
 const onHand=await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)throw new ApiError(404,"Blank inventory not initialized");
   const next=Number(snap.data().onHand||0)+quantity;
   tx.update(ref,{onHand:next,updatedAt:nowIso()});
   inventoryMove(tx,db,"received",id,quantity);
   return next;
 });
 res.json({success:true,id,onHand,message:"Stock received. Allocate pending backorders from the production queue."});
});

export const allocateProductionBlank = asyncHandler(async(req,res)=>{
 const db=getDB(),jobRef=db.collection(JOB_COLLECTION).doc(String(req.params.id));
 await db.runTransaction(async tx=>{
   const jobSnap=await tx.get(jobRef);
   if(!jobSnap.exists)throw new ApiError(404,"Production job not found");
   const job=jobSnap.data();
   if(job.status!=="awaiting_blank" || !Number(job.virtualAllocated))throw new ApiError(409,"Job does not need a blank allocation");
   const blankRef=db.collection(BLANK_COLLECTION).doc(job.blankId), blankSnap=await tx.get(blankRef);
   if(!blankSnap.exists)throw new ApiError(409,"Blank stock is missing");
   const quantity=Number(job.virtualAllocated);
   const available=Number(blankSnap.data().onHand||0)-Number(blankSnap.data().committedPhysical||0);
   if(available<quantity)throw new ApiError(409,"Not enough received blanks; receive stock first");
   if(Number(blankSnap.data().backorderOpen||0)<quantity)throw new ApiError(409,"Backorder counter mismatch");
   tx.update(blankRef,{committedPhysical:Number(blankSnap.data().committedPhysical||0)+quantity,backorderOpen:Number(blankSnap.data().backorderOpen||0)-quantity,updatedAt:nowIso()});
   tx.update(jobRef,{physicalAllocated:Number(job.physicalAllocated||0)+quantity,virtualAllocated:0,status:"to_prepare",updatedAt:nowIso()});
   inventoryMove(tx,db,"backorder_allocated",job.blankId,quantity,{jobId:jobRef.id});
 });
 res.json({success:true});
});

export const startProductionJob = asyncHandler(async(req,res)=>{
 const db=getDB(),jobRef=db.collection(JOB_COLLECTION).doc(String(req.params.id));
 await db.runTransaction(async tx=>{
   const jobSnap=await tx.get(jobRef);
   if(!jobSnap.exists)throw new ApiError(404,"Production job not found");
   const job=jobSnap.data();
   if(job.status!=="to_prepare"||Number(job.virtualAllocated||0)>0)throw new ApiError(409,"Job is not ready for production");
   const blankRef=db.collection(BLANK_COLLECTION).doc(job.blankId),blankSnap=await tx.get(blankRef);
   const quantity=Number(job.physicalAllocated||0);
   if(!blankSnap.exists||Number(blankSnap.data().committedPhysical||0)<quantity||Number(blankSnap.data().onHand||0)<quantity)throw new ApiError(409,"Physical allocation mismatch");
   tx.update(blankRef,{onHand:Number(blankSnap.data().onHand)-quantity,committedPhysical:Number(blankSnap.data().committedPhysical)-quantity,updatedAt:nowIso()});
   tx.update(jobRef,{status:"preparing",startedAt:nowIso(),updatedAt:nowIso()});
   inventoryMove(tx,db,"blank_consumed",job.blankId,quantity,{jobId:jobRef.id});
 });
 res.json({success:true});
});

export const completeProductionJob = asyncHandler(async(req,res)=>{
 if(req.body?.qrChecked!==true||req.body?.printChecked!==true)throw new ApiError(400,"Confirm QR scan and print quality before completion");
 const db=getDB(),ref=db.collection(JOB_COLLECTION).doc(String(req.params.id));
 await db.runTransaction(async tx=>{
   const snap=await tx.get(ref);
   if(!snap.exists)throw new ApiError(404,"Production job not found");
   if(snap.data().status!=="preparing")throw new ApiError(409,"Job must be in production");
   tx.update(ref,{status:"completed",completedAt:nowIso(),qrChecked:true,printChecked:true,updatedAt:nowIso()});
 });
 res.json({success:true});
});

// Verify physical assembly before registering an A3 QR as a finished garment.
// The same QR document is the unique finished unit; it cannot be registered twice.
export const confirmFinishedShirt = asyncHandler(async(req,res)=>{
 if(req.body?.confirm!=="PHYSICALLY_FINISHED")throw new ApiError(400,"Physical print and QR scan confirmation required");
 const source=String(req.body?.source||"");
 if(!["consume_blank","existing_finished"].includes(source))
  throw new ApiError(400,"Choose whether the shirt came from tracked blank stock or existing finished stock");
 const qrId=String(req.body?.qrId||"").trim();
 if(!qrId)throw new ApiError(400,"QR ID is required");
 const db=getDB(),ref=db.collection("qrCodes").doc(qrId);
 const result=await db.runTransaction(async tx=>{
  const snap=await tx.get(ref);
  if(!snap.exists)throw new ApiError(404,"A3 QR not found");
  const qr=snap.data();
  const blankId=keyFromInput(qr.variant||{});
  if(qr.fulfillmentMode!=="preprinted" || qr.status!=="available" ||
    !qr.printFileUrl || qr.physicalAppliedAt || qr.finishedGoodStatus)
    throw new ApiError(409,"QR must be an unassigned A3 transfer not already registered as finished");
  const blankRef=db.collection(BLANK_COLLECTION).doc(blankId);
  const blankSnap=source==="consume_blank"?await tx.get(blankRef):null;
  if(source==="consume_blank" && (!blankSnap?.exists ||
     Number(blankSnap.data().onHand||0)-Number(blankSnap.data().committedPhysical||0)<1))
      throw new ApiError(409,"No unallocated physical blank to convert");
  const at=nowIso();
  if(source==="consume_blank"){
   tx.update(blankRef,{onHand:Number(blankSnap.data().onHand)-1,updatedAt:at});
   inventoryMove(tx,db,"blank_to_finished",blankId,1,{qrId});
  }else inventoryMove(tx,db,"existing_finished_registered",blankId,1,{qrId});
  tx.update(ref,{finishedGoodStatus:"available",physicalAppliedAt:at,finishedSource:source,
    physicalQrChecked:true,updatedAt:at});
  return {qrId,blankId,source};
 });
 res.json({success:true,...result});
});
