import QRCode from "qrcode";
import { createCanvas, loadImage, registerFont } from "canvas";
import path from "path";
import {
  colorizeQrImage,
  trimTransparent,
  resolveFillStyle,
  wrapText,
} from "./qrImageHelpers.js";

registerFont(path.join(process.cwd(), "fonts", "DejaVuSans-Bold.ttf"), {
  family: "PrintFont",
});

export async function generatePrintQrImage(url, config = {}) {
  try {
    const qrColor = config.qrColor || config.color || "#000000";
    const textColor = config.textColor || qrColor;
    const text = String(config.textPrint ?? config.text ?? "").trim();
    const textPosition = config.textPosition === "top" ? "top" : "bottom";
    const width = Number(config.size) || 3540;

    const parsedGap = Number(config.gap);
    const gap = Number.isFinite(parsedGap) ? parsedGap : Math.round(width * 0.02);
    const qrRawBuffer = await QRCode.toBuffer(url, {
      type: "png",
      width,
      margin: 4,
      errorCorrectionLevel: "H",
      color: { dark: "#000000", light: "#00000000" },
    });

    let qrCanvas = await loadImage(qrRawBuffer);
    qrCanvas = colorizeQrImage(qrCanvas, qrColor);
    qrCanvas = trimTransparent(qrCanvas);

    // ⚠️ SAFETY: επιβεβαίωσε ότι το QR canvas έχει έγκυρες διαστάσεις
    if (!qrCanvas || !qrCanvas.width || !qrCanvas.height) {
      throw new Error(
        `Invalid QR canvas after colorize/trim (width=${qrCanvas?.width}, height=${qrCanvas?.height}). qrColor was: ${JSON.stringify(qrColor)}`
      );
    }

    const qrW = qrCanvas.width;
    const qrH = qrCanvas.height;

    const fontSize = Math.round(width * 0.1);
    const padding = Math.round(width * 0.01);
    const lineHeight = Math.round(fontSize * 1.15);
    const maxTextWidth = qrW;

    const hasText = text.length > 0;
    const measureCanvas = createCanvas(10, 10);
    const measureCtx = measureCanvas.getContext("2d");
    const lines = hasText ? wrapText(measureCtx, text.toUpperCase(), maxTextWidth) : [];
    const textBlockHeight = hasText ? lines.length * lineHeight : 0;

    const canvasWidth = qrW + padding * 2;
    const canvasHeight = qrH + padding * 2 + (hasText ? textBlockHeight + gap : 0);

    // ⚠️ SAFETY: επιβεβαίωσε έγκυρες διαστάσεις πριν το createCanvas
    if (
      !Number.isFinite(canvasWidth) ||
      !Number.isFinite(canvasHeight) ||
      canvasWidth <= 0 ||
      canvasHeight <= 0
    ) {
      throw new Error(
        `Invalid final canvas dimensions: ${canvasWidth}x${canvasHeight} (qrW=${qrW}, qrH=${qrH}, padding=${padding}, textBlockHeight=${textBlockHeight}, gap=${gap})`
      );
    }

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (hasText) {
      ctx.font = `bold ${fontSize}px "PrintFont"`;
      ctx.textAlign = "center";
      ctx.fillStyle = resolveFillStyle(ctx, textColor, canvasWidth, textBlockHeight);
      ctx.textBaseline = "top";
    }

    const center = canvasWidth / 2;

    if (hasText) {
      if (textPosition === "top") {
        lines.forEach((line, i) => ctx.fillText(line, center, padding + i * lineHeight));
        ctx.drawImage(qrCanvas, padding, padding + textBlockHeight + gap);
      } else {
        ctx.drawImage(qrCanvas, padding, padding);
        const textStartY = padding + qrH + gap;
        lines.forEach((line, i) => ctx.fillText(line, center, textStartY + i * lineHeight));
      }
    } else {
      ctx.drawImage(qrCanvas, padding, padding);
    }

    const buffer = canvas.toBuffer("image/png");
    console.log("PRINT FINAL IMAGE:", {
      qrColor, textColor, text, textPosition,
      canvasWidth, canvasHeight, lines: lines.length, bytes: buffer.length,
    });
    return buffer;
  } catch (err) {
    console.error("generatePrintQrImage ERROR:", err);
    throw err;
  }
}