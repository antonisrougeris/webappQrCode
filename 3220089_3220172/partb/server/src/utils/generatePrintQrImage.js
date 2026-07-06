import QRCode from "qrcode";
import { createCanvas, loadImage } from "canvas";

export async function generatePrintQrImage(url, config = {}) {
  const {
    color = "#000000",
    text = "SCAN ME",
    textPosition = "bottom",
    fontSize = 120,
    width = 3540,
  } = config;

  // 1. QR (transparent background)
  const qrBuffer = await QRCode.toBuffer(url, {
    type: "png",
    width,
    margin: 4,
    color: {
      dark: color,
      light: "#00000000",
    },
    errorCorrectionLevel: "H",
  });

  const qrImage = await loadImage(qrBuffer);

  // 2. Canvas setup
  const padding = 200;
  const textHeight = fontSize + 80;

  const height = qrImage.height + textHeight + padding;

  const canvas = createCanvas(qrImage.width, height);
  const ctx = canvas.getContext("2d");

  // transparent background
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // text styling
  ctx.fillStyle = "#000000";
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = "center";

  const x = canvas.width / 2;

  if (textPosition === "top") {
    ctx.fillText(text, x, fontSize + 40);
    ctx.drawImage(qrImage, 0, textHeight, qrImage.width, qrImage.height);
  } else {
    ctx.drawImage(qrImage, 0, 0, qrImage.width, qrImage.height);
    ctx.fillText(text, x, qrImage.height + fontSize);
  }

  return canvas.toBuffer("image/png");
}