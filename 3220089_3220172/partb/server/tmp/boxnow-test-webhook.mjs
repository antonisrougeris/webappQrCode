import crypto from "crypto";

const secret = process.env.BOXNOW_WEBHOOK_SECRET;

if (!secret) {
  throw new Error("Missing BOXNOW_WEBHOOK_SECRET");
}

const dataRaw =
  '{"parcelId":"6423451087","parcelState":"new","parcelReferenceNumber":"","parcelName":"Skanare order SK-BOXNOW-TEST-20260929-002","orderNumber":"SK-BOXNOW-TEST-20260929-002","event":"new","time":"2026-09-29T09:30:00.000Z","customer":{"name":"Antonis Rougeris","email":"adminskanare@gmail.com","phoneNumber":"+306909651972"}}';

const signature = crypto
  .createHmac("sha256", secret)
  .update(dataRaw, "utf8")
  .digest("hex");

const payload =
  `{"specversion":"1.0","type":"gr.boxnow.parcel_event_change","source":"https://boxnow.gr/api/v1/webhooks/test","subject":"6423451087","id":"local-test-001","time":"2026-09-29T09:30:01.000Z","datacontenttype":"application/json","datasignature":"${signature}","data":${dataRaw}}`;

console.log(payload);
