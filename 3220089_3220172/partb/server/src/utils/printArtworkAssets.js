import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, registerFont } from "canvas";

export const PRINT_DPI = 300;
export const cmToPrintPx = (cm) => Math.round((cm / 2.54) * PRINT_DPI);

// Backend artifacts include fonts and assets; do not depend on client/public
// existing on the production server (only client/dist is deployed).
const bundledPrintDir = fileURLToPath(new URL("../../assets/print/", import.meta.url));
const sourcePrintDir = fileURLToPath(new URL("../../../client/public/assets/print/", import.meta.url));
const fontPath = fileURLToPath(new URL("../../fonts/DejaVuSans-Bold.ttf", import.meta.url));
registerFont(fontPath, { family: "SKANAREPrintWordmark" });

export function resolveNeckPrintAsset(printColor, shirtSize = "l") {
  const color = String(printColor || "").toLowerCase();
  const size = String(shirtSize || "").toLowerCase();
  if (!["black", "white"].includes(color) || !["s", "m", "l", "xl"].includes(size)) {
    throw new Error("Unsupported neck print color or size");
  }
  const filename = `neck-label-${color}-${size}.png`;
  for (const dir of [bundledPrintDir, sourcePrintDir]) {
    const file = path.join(dir, filename);
    if (fs.existsSync(file)) return file;
  }
  throw new Error(`Bundled neck label missing: ${filename}. Check backend print asset packaging.`);
}

// The original SKANARE logo is a typographic wordmark, not an image asset.
// Render a transparent 7cm-wide transfer at 300DPI for both the full A3 and
// separately printed logo stock, using the exact same drawing routine.
export function makeSkanareWordmark(printColor, widthCm = 7) {
  if (!["white", "black"].includes(printColor)) {
    throw new Error("Invalid SKANARE print ink color");
  }
  const width = cmToPrintPx(widthCm);
  const height = Math.round((width * 112) / 590);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = printColor === "white" ? "#ffffff" : "#000000";

  const lettering = [..."SKANARE"];
  const fontSize = Math.round(height * 0.73);
  ctx.font = `bold ${fontSize}px "SKANAREPrintWordmark"`;
  ctx.textBaseline = "middle";

  // Modest letter-spacing gives the existing minimal wordmark its appearance.
  const glyphWidths = lettering.map((letter) => ctx.measureText(letter).width);
  const naturalGap = fontSize * 0.085;
  const naturalWidth = glyphWidths.reduce((total, glyphWidth) => total + glyphWidth, 0)
    + naturalGap * (lettering.length - 1);
  const scale = Math.min(1, (width * 0.95) / naturalWidth);
  const totalWidth = naturalWidth * scale;

  ctx.save();
  ctx.translate((width - totalWidth) / 2, height * 0.53);
  ctx.scale(scale, 1);
  let x = 0;
  for (let i = 0; i < lettering.length; i++) {
    ctx.fillText(lettering[i], x, 0);
    x += glyphWidths[i] + naturalGap;
  }
  ctx.restore();
  return canvas.toBuffer("image/png", { resolution: PRINT_DPI });
}
