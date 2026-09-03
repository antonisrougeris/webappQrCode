import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";


export async function generatePrintSheet({
  qrBuffer,
  shirtColor,
}) {
  const qrImage = await loadImage(qrBuffer);

  const normalizedColor = String(shirtColor || "")
    .trim()
    .toLowerCase();

  const isDarkShirt =
    normalizedColor === "black" ||
    normalizedColor === "μαύρο" ||
    normalizedColor === "μαυρο";

  const logoFile = isDarkShirt
    ? "logo-white.png"
    : "logo-black.png";

  const logoPath = path.join(
    process.cwd(),
    "assets",
    "print",
    logoFile
  );

  const neckLabelPath = path.join(
    process.cwd(),
    "assets",
    "print",
    "neck-label.png"
  );

  console.log("PRINT ASSETS:", {
  logoPath,
  logoExists: fs.existsSync(logoPath),
  neckLabelPath,
  neckLabelExists: fs.existsSync(neckLabelPath),
});
const logoBuffer = fs.readFileSync(logoPath);
const neckLabelBuffer = fs.readFileSync(neckLabelPath);

const logoImage = await loadImage(logoBuffer);
const neckLabelImage = await loadImage(neckLabelBuffer);
  // A3 portrait @ 300 DPI
  const A3_WIDTH = 3508;
  const A3_HEIGHT = 4961;

  const canvas = createCanvas(
    A3_WIDTH,
    A3_HEIGHT
  );

  const ctx = canvas.getContext("2d");

  // transparent DTF background
  ctx.clearRect(
    0,
    0,
    A3_WIDTH,
    A3_HEIGHT
  );

  const centerX = A3_WIDTH / 2;

  // =========================
  // MAIN QR
  // =========================

  const qrMaxWidth = 2300;
  const qrScale = Math.min(
    1,
    qrMaxWidth / qrImage.width
  );

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

  const logoScale =
    logoMaxWidth / logoImage.width;

  const logoWidth =
    logoImage.width * logoScale;

  const logoHeight =
    logoImage.height * logoScale;

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

  const neckScale =
    neckMaxWidth / neckLabelImage.width;

  const neckWidth =
    neckLabelImage.width * neckScale;

  const neckHeight =
    neckLabelImage.height * neckScale;

  ctx.drawImage(
    neckLabelImage,
    centerX - neckWidth / 2,
    currentY,
    neckWidth,
    neckHeight
  );

  return canvas.toBuffer("image/png");
}