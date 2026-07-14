import QRCode from "qrcode";
import { createCanvas, loadImage, registerFont } from "canvas";
import path from "path";

// module-level, τρέχει μία φορά
registerFont(path.join(process.cwd(), "fonts", "DejaVuSans-Bold.ttf"), {
  family: "PrintFont",
});

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

    const fontSize = Math.round(width * 0.08);
    const padding = Math.round(width * 0.05);
    const gap = Math.round(width * 0.03);
    const canvasHeight = qrImage.height + padding * 2 + fontSize + gap;

    const canvas = createCanvas(width, canvasHeight);
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, width, canvasHeight);
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px "PrintFont"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const center = width / 2;

    if (textPosition === "top") {
      ctx.fillText(text, center, padding);
      ctx.drawImage(qrImage, 0, padding + fontSize + gap);
    } else {
      ctx.drawImage(qrImage, 0, padding);
      ctx.fillText(text, center, padding + qrImage.height + gap);
    }

    const buffer = canvas.toBuffer("image/png");
    console.log("PRINT FINAL IMAGE:", { color, text, textPosition, width, bytes: buffer.length });
    return buffer;
  } catch (err) {
    console.error("generatePrintQrImage ERROR:", err);
    throw err;
  }
}