import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";

// ============================================================
// PRINT SETTINGS
// ============================================================

const DPI = 300;

// A3 portrait @ 300 DPI
const A3_WIDTH = 3508;
const A3_HEIGHT = 4961;

// Εδώ αλλάζεις τις πραγματικές διαστάσεις εκτύπωσης
const QR_WIDTH_CM = 27;
const LOGO_WIDTH_CM = 6;
const NECK_LABEL_WIDTH_CM = 4.5;

// Κενά ανάμεσα στα στοιχεία (pixels)
const TOP_MARGIN = 120;

const QR_TO_LOGO_GAP = 250;

const LOGO_TO_NECK_GAP = 250;

// Convert centimeters to pixels
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

  // Accept XXL as an alias for 2XL
  const normalizedSize =
    normalized === "XXL" ? "2XL" : normalized;

  const allowedSizes = [
    "S",
    "M",
    "L",
    "XL",
    "2XL",
  ];

  if (!allowedSizes.includes(normalizedSize)) {
    throw new Error(
      `Unsupported shirt size "${shirtSize}". Allowed sizes: ${allowedSizes.join(", ")}`
    );
  }

  return normalizedSize;
}


// ============================================================
// PRINT COLOR
// ============================================================

/*
 * Black shirt -> White print
 * White shirt -> Black print
 */

function getContrastPrintColor(shirtColor) {
  return shirtColor === "black"
    ? "white"
    : "black";
}


// ============================================================
// SELECT PRINT ASSETS
// ============================================================

function getLogoFile(printColor) {
  return `logo-${printColor}.png`;
}

function getNeckLabelFile(printColor, shirtSize) {
  const sizePart = shirtSize.toLowerCase();

  return `neck-label-${printColor}-${sizePart}.png`;
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
// DRAW IMAGE AT EXACT PRINT WIDTH
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

  // Preserve the original aspect ratio
  const scale = widthPx / image.width;

  const heightPx = image.height * scale;

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
  // 1. LOAD QR
  // ----------------------------------------------------------

  const qrImage = await loadImage(qrBuffer);


  // ----------------------------------------------------------
  // 2. NORMALIZE PRODUCT VARIANT
  // ----------------------------------------------------------

  const normalizedColor =
    normalizeShirtColor(shirtColor);

  const normalizedSize =
    normalizeShirtSize(shirtSize);


  // ----------------------------------------------------------
  // 3. SELECT CONTRAST PRINT COLOR
  // ----------------------------------------------------------

  const printColor =
    getContrastPrintColor(normalizedColor);


  // ----------------------------------------------------------
  // 4. SELECT LOGO AND NECK LABEL
  // ----------------------------------------------------------

  const logoFile =
    getLogoFile(printColor);

  const neckLabelFile =
    getNeckLabelFile(
      printColor,
      normalizedSize
    );


  // ----------------------------------------------------------
  // 5. ASSET PATHS
  // ----------------------------------------------------------

  const assetsBasePath = path.resolve(
    process.cwd(),
    "../client/public/assets/print"
  );

  const logoPath = path.join(
    assetsBasePath,
    logoFile
  );

  const neckLabelPath = path.join(
    assetsBasePath,
    neckLabelFile
  );


  // ----------------------------------------------------------
  // 6. VALIDATE FILES
  // ----------------------------------------------------------

  console.log("PRINT ASSETS:", {
    shirtColor,
    normalizedColor,
    shirtSize,
    normalizedSize,
    printColor,
    logoFile,
    neckLabelFile,
    logoPath,
    logoExists: fs.existsSync(logoPath),
    neckLabelPath,
    neckLabelExists: fs.existsSync(neckLabelPath),
  });

  assertFileExists(
    logoPath,
    "Logo"
  );

  assertFileExists(
    neckLabelPath,
    "Neck label"
  );


  // ----------------------------------------------------------
  // 7. LOAD PRINT IMAGES
  // ----------------------------------------------------------

  const logoImage = await loadImage(
    fs.readFileSync(logoPath)
  );

  const neckLabelImage = await loadImage(
    fs.readFileSync(neckLabelPath)
  );


  // ----------------------------------------------------------
  // 8. CREATE A3 CANVAS
  // ----------------------------------------------------------

  const canvas = createCanvas(
    A3_WIDTH,
    A3_HEIGHT
  );

  const ctx = canvas.getContext("2d");

  // Transparent background for DTF printing
  ctx.clearRect(
    0,
    0,
    A3_WIDTH,
    A3_HEIGHT
  );

  const centerX = A3_WIDTH / 2;

  let currentY = TOP_MARGIN;


  // ==========================================================
  // MAIN QR + SCAN ME
  // ==========================================================

  const qrDimensions = drawImageAtWidth({
    ctx,
    image: qrImage,
    centerX,
    y: currentY,
    widthCm: QR_WIDTH_CM,
    label: "QR",
  });

  currentY +=
    qrDimensions.height +
    QR_TO_LOGO_GAP;


  // ==========================================================
  // SKANARE LOGO
  // ==========================================================

  const logoDimensions = drawImageAtWidth({
    ctx,
    image: logoImage,
    centerX,
    y: currentY,
    widthCm: LOGO_WIDTH_CM,
    label: "LOGO",
  });

  currentY +=
    logoDimensions.height +
    LOGO_TO_NECK_GAP;


  // ==========================================================
  // NECK LABEL — COLOR + SIZE
  // ==========================================================

  const neckDimensions = drawImageAtWidth({
    ctx,
    image: neckLabelImage,
    centerX,
    y: currentY,
    widthCm: NECK_LABEL_WIDTH_CM,
    label: "NECK LABEL",
  });

  currentY += neckDimensions.height;


  // ==========================================================
  // FINAL A3 VALIDATION
  // ==========================================================

  if (currentY > A3_HEIGHT) {
    throw new Error(
      `Print artwork exceeds A3 height: ${pxToCm(currentY).toFixed(2)} cm. ` +
      `Available: ${pxToCm(A3_HEIGHT).toFixed(2)} cm. ` +
      `Reduce print dimensions or spacing.`
    );
  }

  console.log("A3 PRINT SHEET GENERATED:", {
    shirtColor: normalizedColor,
    shirtSize: normalizedSize,
    printColor,
    qrWidthCm: QR_WIDTH_CM,
    logoWidthCm: LOGO_WIDTH_CM,
    neckLabelWidthCm: NECK_LABEL_WIDTH_CM,
    totalArtworkHeightCm: pxToCm(currentY),
    a3WidthCm: pxToCm(A3_WIDTH),
    a3HeightCm: pxToCm(A3_HEIGHT),
  });


  // ==========================================================
  // RETURN PNG
  // ==========================================================

  return canvas.toBuffer("image/png");

}