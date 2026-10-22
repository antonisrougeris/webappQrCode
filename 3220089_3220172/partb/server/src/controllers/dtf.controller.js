import { getDB } from "../config/db.js";
import { createCanvas, loadImage } from "canvas";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { createId, nowIso } from "../utils/ids.js";
import { reserveUniqueQrShortId, writeQrShortIdReservation } from "../services/qr-id.service.js";
import { generatePrintQrImage } from "../utils/generatePrintQrImage.js";
import { uploadQrToStorage } from "../utils/uploadQrToStorage.js";
import { generateDtfComponentArtwork } from "../utils/generateDtfComponent.js";
import { componentSpec, getDtfInventory, setPhysicalDtfQuantity, DTF_COLORS } from "../services/dtf-inventory.service.js";
import { sendEmail } from "../services/email.service.js";

const adminNotification = async (subject,html)=>{
  const from=process.env.EMAIL_ORDER || process.env.EMAIL_FROM;
  const to=process.env.ADMIN_EMAIL;
  if (from && to) await sendEmail({from,to,subject,html});
};

const safeQuantity = value=>{
  const n=Number(value);
  if (!Number.isSafeInteger(n) || n<1 || n>100) throw new ApiError(400,"Quantity must be 1-100");
  return n;
};
const safeColor = value=>{
  const c=String(value||"").trim().toLowerCase();
  if (!DTF_COLORS.includes(c)) throw new ApiError(400,"Choose black or white PRINT ink");
  return c;
};
const readSpec = body=>{
  try{return componentSpec(body?.type,safeColor(body?.color),{size:body?.size,text:body?.text});}
  catch(error){throw new ApiError(400,error.message);}
};

export const listDtfStock = asyncHandler(async(req,res)=>{
  const db=getDB();
  const [components, pending]=await Promise.all([
    getDtfInventory(db),
    db.collection("qrCodes").where("fulfillmentMode","==","modular_qr").limit(1000).get(),
  ]);
  res.json({success:true,components,pendingQr:pending.docs.filter(doc=>doc.data().status==="awaiting_print").slice(0,100).map(doc=>({id:doc.id,shortId:doc.data().shortId,printColor:doc.data().modularPrintColor,qrWidthCm:doc.data().modularQrWidthCm,printFileUrl:doc.data().printFileUrl,createdAt:doc.data().createdAt}))});
});

export const generateDtfPrintBatch=asyncHandler(async(req,res)=>{
  const spec=readSpec(req.body);
  const quantity=safeQuantity(req.body?.quantity);
  const bytes=await generateDtfComponentArtwork(spec);
  const item=await uploadQrToStorage(`dtf-${createId("batch")}`,bytes);
  const html=`<h2>SKANARE DTF transfer artwork</h2><p>Component: ${spec.type}</p>
    <p>Print ink: ${spec.color} · Quantity requested: ${quantity}</p>
    <p>Size: ${spec.size||"—"} · Text: ${spec.text||"—"}</p>
    <p><strong>This order does not automatically add physical stock.</strong>
    Once printed and received, update the physical count in Admin.</p>
    <p><a href="${item.url}">Download transparent 300DPI artwork (PNG)</a></p>`;
  await adminNotification(`DTF print request: ${spec.type} / ${spec.color}`,html);
  res.status(201).json({success:true,component:spec,quantity,printUrl:item.url,physicalStockChanged:false});
});

export const updateDtfPhysicalStock=asyncHandler(async(req,res)=>{
  const spec=readSpec(req.body);
  const quantity=Number(req.body?.physicalQuantity);
  try {
    const stock=await setPhysicalDtfQuantity(spec,quantity);
    res.json({success:true,stock});
  }catch(error){throw new ApiError(400,error.message);}
});

export const generateModularQrStock=asyncHandler(async(req,res)=>{
  const quantity=safeQuantity(req.body?.quantity);
  const color=safeColor(req.body?.color);
  const widthCm=req.body?.qrWidthCm===27.5 ? 27.5 : req.body?.qrWidthCm===28 ? 28 : Number(req.body?.qrWidthCm || 28);
  if (![27.5,28].includes(widthCm)) throw new ApiError(400,"Choose QR width 27.5cm (S) or 28cm (M-XXL)");
  const db=getDB();
  const publicBase=process.env.QR_PUBLIC_BASE_URL || "https://go.skanare.com";
  const created=[];
  for(let i=0;i<quantity;i++){
    const data=await db.runTransaction(async tx=>{
      const id=createId("qr");
      const {shortId,reservationRef}=await reserveUniqueQrShortId(tx,db);
      const date=nowIso();
      writeQrShortIdReservation(tx,reservationRef,{qrId:id,shortId,createdAt:date});
      tx.set(db.collection("qrCodes").doc(id),{
        id,shortId,status:"generating",modularPrintColor:color,modularQrWidthCm:widthCm,
        printStatus:"pending",fulfillmentMode:"modular_qr",
        targetUrl:"https://skanare.com",linkUrl:"https://skanare.com",
        destinationType:"link",qrConfig:{qrColor:color==="white"?"#ffffff":"#000000",textColor:color==="white"?"#ffffff":"#000000",textPrint:""},
        scans:0,userId:null,guestId:null,orderId:null,createdAt:date,updatedAt:date,
      });
      return {id,shortId,url:`${publicBase}/${shortId}`};
    });
    try {
      // A single, unique, scannable QR for DTF per meter; no slogan/neck/logo.
      const source=await generatePrintQrImage(data.url,{
        qrColor:color==="white"?"#ffffff":"#000000",textPrint:"",size:3540,
      });
      const sourceImage=await loadImage(source);
      const sidePx=Math.round(widthCm/2.54*300);
      const exact=createCanvas(sidePx,sidePx);
      exact.getContext("2d").drawImage(sourceImage,0,0,sidePx,sidePx);
      const uploaded=await uploadQrToStorage(`dtf-qr-${data.id}`,exact.toBuffer("image/png", { resolution: 300 }));
      await db.collection("qrCodes").doc(data.id).set({
        status:"awaiting_print",printStatus:"uploaded",printFileUrl:uploaded.url,
        printGeneratedAt:nowIso(),updatedAt:nowIso(),
      },{merge:true});
      created.push({...data,printUrl:uploaded.url});
    }catch(error){
      await db.collection("qrCodes").doc(data.id).set({status:"generation_failed",printStatus:"failed",printError:String(error.message),updatedAt:nowIso()},{merge:true});
      throw error;
    }
  }
  if(created.length) await adminNotification(
    `DTF unique QR batch: ${color} x${created.length}`,
    `<h2>QR-only DTF batch</h2><p>Unique QR identifiers; do not duplicate one transfer across multiple garments.</p><p>Ink: ${color}, QR transfer width: ${widthCm}cm at 300DPI</p><p><strong>Stock is NOT available until the printed transfers are received and confirmed in Admin.</strong></p>
     ${created.map(q=>`<p>${q.shortId}: <a href="${q.printUrl}">Download print artwork</a></p>`).join("")}`
  );
  res.status(201).json({success:true,count:created.length,created});
});

export const confirmModularQrPrinted=asyncHandler(async(req,res)=>{
  const ids=Array.isArray(req.body?.qrIds)?req.body.qrIds:[req.body?.qrId];
  if(!ids.length||ids.length>100||ids.some(v=>typeof v!=="string"||!/^qr_[a-zA-Z0-9_-]{8,100}$/.test(v))) throw new ApiError(400,"Invalid QR IDs");
  const db=getDB();
  await db.runTransaction(async tx=>{
    const refs=ids.map(id=>db.collection("qrCodes").doc(id));
    const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
    for(const snap of snaps){
      const qr=snap.data();
      if(!snap.exists||qr?.fulfillmentMode!=="modular_qr"||qr.status!=="awaiting_print"||!qr.printFileUrl)
        throw new ApiError(409,"QR must be generated and awaiting physical printing");
    }
    for(const snap of snaps)tx.update(snap.ref,{status:"available",printStatus:"uploaded",physicalConfirmedAt:nowIso(),updatedAt:nowIso()});
  });
  res.json({success:true,confirmed:ids.length});
});
