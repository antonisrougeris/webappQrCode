import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";

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

  return "white";
}

function normalizeShirtSize(shirtSize) {
  const normalized = String(shirtSize || "")
    .trim()
    .toUpperCase();

  const allowedSizes = ["S", "M", "L", "XL", "2XL"];

  if (!allowedSizes.includes(normalized)) {
    throw new Error(
      `Unsupported shirt size "${shirtSize}". Allowed sizes: ${allowedSizes.join(", ")}`
    );
  }

  return normalized;
}

function getLogoFileByColor(normalizedColor) {
  return normalizedColor === "black"
    ? "logo-white.png"
    : "logo-black.png";
}

function getNeckLabelFileByColorAndSize(normalizedColor, normalizedSize) {
  const sizePart = normalizedSize.toLowerCase(); // s, m, l, xl, 2xl

  // π.χ. neck-label-white-s.png ή neck-label-black-xl.png
  return `neck-label-${normalizedColor}-${sizePart}.png`;
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} file not found: ${filePath}`);
  }
}

export async function generatePrintSheet({
  qrBuffer,
  shirtColor,
  shirtSize,
}) {
  const qrImage = await loadImage(qrBuffer);

  const normalizedColor = normalizeShirtColor(shirtColor);
  const normalizedSize = normalizeShirtSize(shirtSize);

  const logoFile = getLogoFileByColor(normalizedColor);
  const neckLabelFile = getNeckLabelFileByColorAndSize(
    normalizedColor,
    normalizedSize
  );

const assetsBasePath = path.resolve(
  process.cwd(),
  "../client/public/assets/print"
);
  const logoPath = path.join(assetsBasePath, logoFile);
  const neckLabelPath = path.join(assetsBasePath, neckLabelFile);

  console.log("PRINT ASSETS:", {
    shirtColor,
    normalizedColor,
    shirtSize,
    normalizedSize,
    logoPath,
    logoExists: fs.existsSync(logoPath),
    neckLabelPath,
    neckLabelExists: fs.existsSync(neckLabelPath),
  });

  assertFileExists(logoPath, "Logo");
  assertFileExists(neckLabelPath, "Neck label");

  const logoBuffer = fs.readFileSync(logoPath);
  const neckLabelBuffer = fs.readFileSync(neckLabelPath);

  const logoImage = await loadImage(logoBuffer);
  const neckLabelImage = await loadImage(neckLabelBuffer);

  // A3 portrait @ 300 DPI
  const A3_WIDTH = 3508;
  const A3_HEIGHT = 4961;

  const canvas = createCanvas(A3_WIDTH, A3_HEIGHT);
  const ctx = canvas.getContext("2d");

  // transparent DTF background
  ctx.clearRect(0, 0, A3_WIDTH, A3_HEIGHT);

  const centerX = A3_WIDTH / 2;

  // =========================
  // MAIN QR
  // =========================
  const qrMaxWidth = 2300;
  const qrScale = Math.min(1, qrMaxWidth / qrImage.width);
  const qrWidth = qrImage.width * qrScale;
  const qrHeight = qrImage.height * qrScale;

  let currentY = 150;

  ctx.drawImage(
    qrImage,
    centerX - qrWidth / 2,
    currentY,
    qrWidth,
    qrHeight
  );

  currentY += qrHeight + 180;

  // =========================
  // LOGO
  // =========================
  const logoMaxWidth = 900;
  const logoScale = logoMaxWidth / logoImage.width;
  const logoWidth = logoImage.width * logoScale;
  const logoHeight = logoImage.height * logoScale;

  ctx.drawImage(
    logoImage,
    centerX - logoWidth / 2,
    currentY,
    logoWidth,
    logoHeight
  );

  currentY += logoHeight + 160;

  // =========================
  // NECK LABEL
  // =========================
  const neckMaxWidth = 1100;
  const neckScale = neckMaxWidth / neckLabelImage.width;
  const neckWidth = neckLabelImage.width * neckScale;
  const neckHeight = neckLabelImage.height * neckScale;

  ctx.drawImage(
    neckLabelImage,
    centerX - neckWidth / 2,
    currentY,
    neckWidth,
    neckHeight
  );

  return canvas.toBuffer("image/png");
}