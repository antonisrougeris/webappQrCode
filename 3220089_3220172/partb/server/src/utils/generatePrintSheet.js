import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";
import { generateDtfComponentArtwork } from "./generateDtfComponent.js";
import { makeSkanareWordmark, resolveNeckPrintAsset } from "./printArtworkAssets.js";

// ============================================================
// PRINT SETTINGS
// ============================================================

const DPI = 300;

// A3 portrait @ 300 DPI
const A3_WIDTH = 3508;
const A3_HEIGHT = 4961;

// QR + TEXT width per shirt size (cm)
const QR_WIDTH_BY_SIZE_CM = {
  S: 27.5,
  M: 28,
  L: 28,
  XL: 28,
  "2XL": 28,
};

// Fixed print sizes (cm)
const LOGO_WIDTH_CM = 7;
const NECK_LABEL_WIDTH_CM = 7;

// Spacing (pixels)
const TOP_MARGIN = 20;
const QR_TO_LOGO_GAP = 20;
const LOGO_TO_NECK_GAP = 35;

// Helpers
const cmToPx = (cm) => (cm / 2.54) * DPI;
const pxToCm = (px) => (px / DPI) * 2.54;

// ============================================================
// NORMALIZE SHIRT COLOR
// ============================================================

function normalizeShirtColor(shirtColor) {
  const normalized = String(shirtColor || "")
    .trim()
    .toLowerCase();

  if (
    normalized === "black" ||
    normalized === "μαύρο" ||
    normalized === "μαυρο"
  ) {
    return "black";
  }

  if (
    normalized === "white" ||
    normalized === "άσπρο" ||
    normalized === "ασπρο" ||
    normalized === "λευκό" ||
    normalized === "λευκο"
  ) {
    return "white";
  }

  throw new Error(
    `Unsupported shirt color: "${shirtColor}"`
  );
}

// ============================================================
// NORMALIZE SHIRT SIZE
// ============================================================

function normalizeShirtSize(shirtSize) {
  const normalized = String(shirtSize || "")
    .trim()
    .toUpperCase();

  // XXL and 2XL are equivalent
  const normalizedSize =
    normalized === "XXL" ? "2XL" : normalized;

  if (!(normalizedSize in QR_WIDTH_BY_SIZE_CM)) {
    throw new Error(
      `Unsupported shirt size: "${shirtSize}"`
    );
  }

  return normalizedSize;
}

// ============================================================
// CONTRAST PRINT COLOR
// ============================================================

function getContrastPrintColor(shirtColor) {
  return shirtColor === "black"
    ? "white"
    : "black";
}

// ============================================================
// SELECT ASSETS
// ============================================================

function getLogoFile(printColor) {
  return `logo-${printColor}.png`;
}

function getNeckLabelFile(printColor, shirtSize) {
  return `neck-label-${printColor}-${shirtSize.toLowerCase()}.png`;
}

// ============================================================
// FILE VALIDATION
// ============================================================

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${label} file not found: ${filePath}`
    );
  }
}

// ============================================================
// DRAW IMAGE AT EXACT WIDTH
// ============================================================

function drawImageAtWidth({
  ctx,
  image,
  centerX,
  y,
  widthCm,
  label,
}) {
  const widthPx = cmToPx(widthCm);

  const scale = widthPx / image.width;

  const heightPx = image.height * scale;

  // Prevent drawing outside A3 horizontally
  if (widthPx > A3_WIDTH) {
    throw new Error(
      `${label} exceeds A3 width: ${widthCm} cm`
    );
  }

  // Prevent drawing outside A3 vertically
  if (y + heightPx > A3_HEIGHT) {
    throw new Error(
      `${label} exceeds A3 height. ` +
      `Bottom position: ${pxToCm(y + heightPx).toFixed(2)} cm`
    );
  }

  ctx.drawImage(
    image,
    centerX - widthPx / 2,
    y,
    widthPx,
    heightPx
  );

  console.log(`${label} PRINT SIZE:`, {
    widthCm,
    heightCm: pxToCm(heightPx),
    widthPx,
    heightPx,
  });

  return {
    width: widthPx,
    height: heightPx,
  };
}

// ============================================================
// GENERATE A3 PRINT SHEET
// ============================================================

export async function generatePrintSheet({
  qrBuffer,
  shirtColor,
  shirtSize,
}) {

  // ----------------------------------------------------------
  // 1. NORMALIZE PRODUCT VARIANT
  // ----------------------------------------------------------

  const normalizedColor =
    normalizeShirtColor(shirtColor);

  const normalizedSize =
    normalizeShirtSize(shirtSize);

  // ----------------------------------------------------------
  // 2. SELECT QR WIDTH BY SIZE
  // ----------------------------------------------------------

  const QR_WIDTH_CM =
    QR_WIDTH_BY_SIZE_CM[normalizedSize];

  // ----------------------------------------------------------
  // 3. SELECT PRINT COLOR
  // ----------------------------------------------------------

  const printColor =
    getContrastPrintColor(normalizedColor);

  // ----------------------------------------------------------
  // 4. SELECT ASSETS
  // ----------------------------------------------------------

  // The SKANARE wordmark is drawn from text, not from an image path.
  // Neck labels are loaded from packaged backend assets in production.
  const qrImage = await loadImage(qrBuffer);
  const logoImage = await loadImage(makeSkanareWordmark(printColor, LOGO_WIDTH_CM));
  let neckLabelImage;
  if (normalizedSize !== "2XL") {
    const neckLabelPath = resolveNeckPrintAsset(printColor, normalizedSize);
    neckLabelImage = await loadImage(fs.readFileSync(neckLabelPath));
  } else {
    const neck=await loadImage(await generateDtfComponentArtwork({type:"neck",color:printColor}));
    const size=await loadImage(await generateDtfComponentArtwork({type:"size",color:printColor,size:normalizedSize}));
    const combined=createCanvas(neck.width,neck.height+size.height);
    const combinedCtx=combined.getContext("2d");
    combinedCtx.drawImage(neck,0,0);
    combinedCtx.drawImage(size,(combined.width-size.width)/2,neck.height);
    neckLabelImage=await loadImage(combined.toBuffer("image/png",{resolution:DPI}));
  }

  // ----------------------------------------------------------
  // 8. CREATE A3 CANVAS
  // ----------------------------------------------------------

  const canvas = createCanvas(
    A3_WIDTH,
    A3_HEIGHT
  );

  const ctx = canvas.getContext("2d");

  // Transparent background
  ctx.clearRect(
    0,
    0,
    A3_WIDTH,
    A3_HEIGHT
  );

  const centerX = A3_WIDTH / 2;

  let currentY = TOP_MARGIN;

  // ==========================================================
  // MAIN QR + TEXT
  // ==========================================================

  const qrDimensions = drawImageAtWidth({
    ctx,
    image: qrImage,
    centerX,
    y: currentY,
    widthCm: QR_WIDTH_CM,
    label: "QR + TEXT",
  });

  currentY +=
    qrDimensions.height +
    QR_TO_LOGO_GAP;

  // ==========================================================
  // LOGO + NECK LABEL IN ONE ROW (SAVE DTF TRANSFER SPACE)
  // ==========================================================
  const logoWidthPx = cmToPx(LOGO_WIDTH_CM);
  const neckWidthPx = cmToPx(NECK_LABEL_WIDTH_CM);
  const rowWidth = logoWidthPx + LOGO_TO_NECK_GAP + neckWidthPx;
  if (rowWidth > A3_WIDTH) {
    throw new Error("Logo and neck label do not fit A3 width");
  }
  const rowStartX = centerX - rowWidth / 2;
  const logoDimensions = drawImageAtWidth({
    ctx,
    image: logoImage,
    centerX: rowStartX + logoWidthPx / 2,
    y: currentY,
    widthCm: LOGO_WIDTH_CM,
    label: "LOGO",
  });
  const neckDimensions = drawImageAtWidth({
    ctx,
    image: neckLabelImage,
    centerX: rowStartX + logoWidthPx + LOGO_TO_NECK_GAP + neckWidthPx / 2,
    y: currentY,
    widthCm: NECK_LABEL_WIDTH_CM,
    label: "NECK LABEL",
  });
  currentY += Math.max(logoDimensions.height, neckDimensions.height);

  // ==========================================================
  // FINAL VALIDATION
  // ==========================================================

  if (currentY > A3_HEIGHT) {
    throw new Error(
      `Print artwork exceeds A3 height: ` +
      `${pxToCm(currentY).toFixed(2)} cm. ` +
      `Available: ${pxToCm(A3_HEIGHT).toFixed(2)} cm.`
    );
  }

  console.log("A3 PRINT SHEET GENERATED:", {
    shirtColor: normalizedColor,
    shirtSize: normalizedSize,
    printColor,
    qrWidthCm: QR_WIDTH_CM,
    logoWidthCm: LOGO_WIDTH_CM,
    neckLabelWidthCm: NECK_LABEL_WIDTH_CM,
    totalArtworkHeightCm:
      pxToCm(currentY).toFixed(2),
    a3WidthCm:
      pxToCm(A3_WIDTH).toFixed(2),
    a3HeightCm:
      pxToCm(A3_HEIGHT).toFixed(2),
  });

  // ==========================================================
  // RETURN PNG
  // ==========================================================

  return canvas.toBuffer("image/png", { resolution: DPI });
}