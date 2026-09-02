import fs from "fs";
import path from "path";

import { connectDB, getDB } from "../src/config/db.js";

import { COLLECTIONS } from "../src/constants/collections.js";
import { createId, nowIso } from "../src/utils/ids.js";

import {
  reserveUniqueQrShortId,
  writeQrShortIdReservation,
} from "../src/services/qr-id.service.js";

const PUBLIC_QR_BASE_URL =
  process.env.QR_PUBLIC_BASE_URL ||
  "https://go.skanare.com";

async function main() {
  const [
    productId,
    quantityArg,
    skuArg,
    sizeArg = "",
    colorArg = "",
  ] = process.argv.slice(2);

  const quantity = Number(quantityArg);

  if (!productId) {
    throw new Error("Missing productId");
  }

  if (!skuArg) {
    throw new Error("Missing SKU");
  }

  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 1000
  ) {
    throw new Error(
      "Quantity must be an integer between 1 and 1000"
    );
  }

  await connectDB();
  const db = getDB();

  const sku = String(skuArg).trim();

  const inventoryKey =
    `${productId}::${sku}`;

  const created = [];

  for (
    let index = 0;
    index < quantity;
    index += 1
  ) {
    const result = await db.runTransaction(
      async (tx) => {
        const qrId = createId("qr");

        const {
          shortId,
          reservationRef,
        } = await reserveUniqueQrShortId(
          tx,
          db
        );

        const createdAt = nowIso();

        const qrRef = db
          .collection(COLLECTIONS.QR_CODES)
          .doc(qrId);

        writeQrShortIdReservation(
          tx,
          reservationRef,
          {
            qrId,
            shortId,
            createdAt,
          }
        );

        tx.set(qrRef, {
          id: qrId,
          shortId,

          status: "available",

          productId,

          sku,

          inventoryKey,

          variant: {
            sku,
            size: sizeArg || "",
            color: colorArg || "",
          },

          userId: null,
          guestId: null,
          orderId: null,

          targetUrl: "https://skanare.com",

          scans: 0,

          fulfillmentMode: "preprinted",

          createdAt,
          updatedAt: createdAt,
        });

        return {
          qrId,
          shortId,
          url:
            `${PUBLIC_QR_BASE_URL}/${shortId}`,
        };
      }
    );

    created.push(result);

    console.log(
      `[${index + 1}/${quantity}] ${result.url}`
    );
  }

  const outputDirectory = path.resolve(
    process.cwd(),
    "exports"
  );

  fs.mkdirSync(
    outputDirectory,
    {
      recursive: true,
    }
  );

  const outputFile = path.join(
    outputDirectory,
    `qr-stock-${productId}-${sku}-${Date.now()}.csv`
  );

  const csv = [
    "qrId,shortId,url,productId,sku,inventoryKey,size,color",

    ...created.map((item) =>
      [
        item.qrId,
        item.shortId,
        item.url,
        productId,
        sku,
        inventoryKey,
        sizeArg,
        colorArg,
      ]
        .map(csvEscape)
        .join(",")
    ),
  ].join("\n");

  fs.writeFileSync(
    outputFile,
    csv,
    "utf8"
  );

  console.log("");
  console.log("===========================");
  console.log("QR STOCK CREATED");
  console.log("===========================");
  console.log(`Product: ${productId}`);
  console.log(`SKU: ${sku}`);
  console.log(`Quantity: ${quantity}`);
  console.log(`Inventory key: ${inventoryKey}`);
  console.log(`CSV: ${outputFile}`);
}

function csvEscape(value) {
  const text = String(value ?? "");

  return `"${text.replaceAll('"', '""')}"`;
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(
      "QR stock generation failed:"
    );

    console.error(error);

    process.exit(1);
  });