import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage, registerFont } from "canvas";
import { componentSpec, normalizeSize } from "../services/dtf-inventory.service.js";
import { makeSkanareWordmark, resolveNeckPrintAsset } from "./printArtworkAssets.js";
import { generatePrintQrImage } from "./generatePrintQrImage.js";

const DPI = 300;
const PRINT_QR_SOURCE_WIDTH = 3540;
const REFERENCE_QR_WIDTH_CM = 28;
const NECK_WIDTH_CM = 6;
const cmToPx = (cm) => Math.round((cm / 2.54) * DPI);
const output = (canvas) => canvas.toBuffer("image/png", { resolution: DPI });

registerFont(
  fileURLToPath(new URL("../../fonts/DejaVuSans-Bold.ttf", import.meta.url)),
  { family: "DTFSizeFont" }
);

/**
 * Crop alpha-only artwork without changing its actual physical print size.
 * This is intentionally a *tight* PNG: the dimensions in an image viewer may
 * look big, but its PNG 300-DPI metadata remains the DTF print dimensions.
 *
 * sourceScale means A3 physical pixels / original source pixels.
 */
export function cropDtfRegion(image, { x = 0, y = 0, width = image.width, height = image.height, sourceScale = 1, paddingCm = 0.12 } = {}) {
  const regionX = Math.max(0, Math.floor(x));
  const regionY = Math.max(0, Math.floor(y));
  const regionWidth = Math.min(image.width - regionX, Math.ceil(width));
  const regionHeight = Math.min(image.height - regionY, Math.ceil(height));
  if (regionWidth <= 0 || regionHeight <= 0 || !Number.isFinite(sourceScale) || sourceScale <= 0) {
    throw new Error("Invalid source artwork bounds or physical scale");
  }
  const scanCanvas = createCanvas(regionWidth, regionHeight);
  const scanCtx = scanCanvas.getContext("2d");
  scanCtx.drawImage(image, regionX, regionY, regionWidth, regionHeight, 0, 0, regionWidth, regionHeight);
  const pixels = scanCtx.getImageData(0, 0, regionWidth, regionHeight).data;
  let left = regionWidth, right = -1, top = regionHeight, bottom = -1;
  for (let row = 0; row < regionHeight; row++) {
    for (let col = 0; col < regionWidth; col++) {
      if (pixels[(row * regionWidth + col) * 4 + 3] === 0) continue;
      if (col < left) left = col;
      if (col > right) right = col;
      if (row < top) top = row;
      if (row > bottom) bottom = row;
    }
  }
  if (right < left || bottom < top) throw new Error("Print component has no visible ink");

  const srcWidth = right - left + 1;
  const srcHeight = bottom - top + 1;
  const inkWidthPx = Math.max(1, Math.round(srcWidth * sourceScale));
  const inkHeightPx = Math.max(1, Math.round(srcHeight * sourceScale));
  const margin = cmToPx(paddingCm);
  const destCanvas = createCanvas(inkWidthPx + 2 * margin, inkHeightPx + 2 * margin);
  destCanvas.getContext("2d").drawImage(
    image,
    regionX + left, regionY + top, srcWidth, srcHeight,
    margin, margin, inkWidthPx, inkHeightPx
  );
  return output(destCanvas);
}

/**
 * Standalone slogan must be the *same typography* as the QR+A3, not a
 * separately guessed 28cm x 5cm canvas with overlapping baseline positions.
 *
 * Reuse the actual full-QR print renderer with its 3540px source, font, forced
 * two-line breaks and 1.15 line height. Extract only the slogan pixels; scale
 * the extracted ink using exactly the A3's 28cm/full-artwork-width ratio.
 */
async function generateSloganArtwork(safe) {
  const color = safe.color === "white" ? "#ffffff" : "#000000";
  const fullArtwork = await loadImage(await generatePrintQrImage(
    "https://go.skanare.com/REFERENCE",
    { size: PRINT_QR_SOURCE_WIDTH, qrColor: color, textColor: color, textPrint: safe.text, textPosition: "bottom" }
  ));
  const padding = Math.round(PRINT_QR_SOURCE_WIDTH * 0.01);
  const gap = Math.round(PRINT_QR_SOURCE_WIDTH * 0.02);
  const firstTextY = fullArtwork.width - padding + gap;
  if (firstTextY >= fullArtwork.height) throw new Error("QR reference has no slogan section");

  return cropDtfRegion(fullArtwork, {
    y: firstTextY,
    height: fullArtwork.height - firstTextY,
    sourceScale: cmToPx(REFERENCE_QR_WIDTH_CM) / fullArtwork.width,
  });
}

/**
 * Sizes S through XL are already printed at the base of the A3 neck label.
 * Isolate precisely the size glyph from that source, and scale by the same
 * 6cm/A3-neck-width factor. No arbitrary 3 x 2.2cm size canvas.
 */
async function generateSizeArtwork(safe) {
  const size = normalizeSize(safe.size);
  if (size !== "2XL") {
    const labelImage = await loadImage(await fs.readFile(resolveNeckPrintAsset(safe.color, size.toLowerCase())));
    const sizeAreaY = Math.round(labelImage.height * 0.73);
    return cropDtfRegion(labelImage, {
      y: sizeAreaY,
      height: labelImage.height - sizeAreaY,
      sourceScale: cmToPx(NECK_WIDTH_CM) / labelImage.width,
      paddingCm: 0.08,
    });
  }

  // 2XL has no original size-letter asset: render a compact letter at the
  // same visual size as the reference XL image, rather than a slogan-sized XL.
  const referenceImage = await loadImage(await fs.readFile(resolveNeckPrintAsset(safe.color, "xl")));
  const y = Math.round(referenceImage.height * 0.73);
  const referenceCanvas = createCanvas(referenceImage.width, referenceImage.height - y);
  referenceCanvas.getContext("2d").drawImage(referenceImage, 0, y, referenceImage.width, referenceImage.height - y, 0, 0, referenceImage.width, referenceImage.height - y);
  const ref = referenceCanvas.getContext("2d").getImageData(0, 0, referenceCanvas.width, referenceCanvas.height).data;
  let first = referenceCanvas.height, last = -1;
  for (let row = 0; row < referenceCanvas.height; row++) {
    for (let col = 0; col < referenceCanvas.width; col++) {
      if (ref[(row * referenceCanvas.width + col) * 4 + 3]) {
        first = Math.min(first, row);
        last = Math.max(last, row);
      }
    }
  }
  if (last < first) throw new Error("XL reference label has no visible size ink");
  const targetInkHeight = Math.max(1, Math.round((last - first + 1) * cmToPx(NECK_WIDTH_CM) / referenceImage.width));
  const fontPx = Math.round(targetInkHeight / 0.73);
  const tmp = createCanvas(cmToPx(5), targetInkHeight * 3);
  const tmpCtx = tmp.getContext("2d");
  tmpCtx.fillStyle = safe.color === "white" ? "#ffffff" : "#000000";
  tmpCtx.textAlign = "center";
  tmpCtx.textBaseline = "middle";
  tmpCtx.font = `bold ${fontPx}px "DTFSizeFont"`;
  tmpCtx.fillText("2XL", tmp.width / 2, tmp.height / 2);
  return cropDtfRegion(tmp, { paddingCm: 0.08 });
}

export async function generateDtfComponentArtwork(spec) {
  const safe = componentSpec(spec.type, spec.color, { size: spec.size, text: spec.text });

  if (safe.type === "logo") {
    // A3 calls the exact same wordmark helper at 7cm.
    return makeSkanareWordmark(safe.color, 7);
  }

  if (safe.type === "neck") {
    const image = await loadImage(await fs.readFile(resolveNeckPrintAsset(safe.color, "l")));
    // Crop out the size glyph, retaining the original SKANARE/slogan artwork
    // scaled to precisely the same width used in the A3.
    const sourceHeight = Math.round(image.height * 0.73);
    const targetWidth = cmToPx(NECK_WIDTH_CM);
    const targetHeight = Math.ceil((targetWidth * sourceHeight) / image.width);
    const canvas = createCanvas(targetWidth, targetHeight);
    canvas.getContext("2d").drawImage(image, 0, 0, image.width, sourceHeight, 0, 0, targetWidth, targetHeight);
    return output(canvas);
  }

  if (safe.type === "size") return generateSizeArtwork(safe);
  if (safe.type === "text") return generateSloganArtwork(safe);
  throw new Error("Invalid DTF artwork request");
}
