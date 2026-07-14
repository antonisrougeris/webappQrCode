import QRCode from "qrcode";
import { createCanvas, loadImage, registerFont } from "canvas";
import path from "path";

registerFont(path.join(process.cwd(), "fonts", "DejaVuSans-Bold.ttf"), {
  family: "PrintFont",
});

// Σπάει το text σε γραμμές ώστε καμία να μην ξεπερνάει το maxWidth
function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + " " + words[i];
    const { width: testWidth } = ctx.measureText(testLine);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

export async function generatePrintQrImage(url, config = {}) {
  try {
    const color = config.color || "#000000";
    const text = config.textPrint || config.text || "SCAN ME";
    const textPosition = config.textPosition === "top" ? "top" : "bottom";
    const width = Number(config.size) || 3540;

    const qrBuffer = await QRCode.toBuffer(url, {
      type: "png",
      width,
      margin: 4,
      errorCorrectionLevel: "H",
      color: { dark: color, light: "#00000000" },
    });

    const qrImage = await loadImage(qrBuffer);

    // Μεγαλύτερο text, μικρότερο κενό από το QR
    const fontSize = Math.round(width * 0.1);
    const padding = Math.round(width * 0.05);
    const gap = Math.round(width * 0.012);
    const lineHeight = Math.round(fontSize * 1.15);
    const maxTextWidth = width - padding * 2;

    // Χρειαζόμαστε ένα context ΠΡΙΝ φτιάξουμε το τελικό canvas, για να μετρήσουμε το text
    const measureCanvas = createCanvas(width, 10);
    const measureCtx = measureCanvas.getContext("2d");
    measureCtx.font = `bold ${fontSize}px "PrintFont"`;

    const lines = wrapText(measureCtx, text.toUpperCase(), maxTextWidth);
    const textBlockHeight = lines.length * lineHeight;

    const canvasHeight =
      qrImage.height + padding * 2 + textBlockHeight + gap;

    const canvas = createCanvas(width, canvasHeight);
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, width, canvasHeight);
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px "PrintFont"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const center = width / 2;

    if (textPosition === "top") {
      lines.forEach((line, i) => {
        ctx.fillText(line, center, padding + i * lineHeight);
      });
      ctx.drawImage(qrImage, 0, padding + textBlockHeight + gap);
    } else {
      ctx.drawImage(qrImage, 0, padding);
      const textStartY = padding + qrImage.height + gap;
      lines.forEach((line, i) => {
        ctx.fillText(line, center, textStartY + i * lineHeight);
      });
    }

    const buffer = canvas.toBuffer("image/png");
    console.log("PRINT FINAL IMAGE:", {
      color,
      text,
      textPosition,
      width,
      lines: lines.length,
      bytes: buffer.length,
    });
    return buffer;
  } catch (err) {
    console.error("generatePrintQrImage ERROR:", err);
    throw err;
  }
}