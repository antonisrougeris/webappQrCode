import QRCode from "qrcode";
import { loadImage } from "canvas";
import { colorizeQrImage } from "./qrImageHelpers.js";

export async function generateQrBufferLikeFrontend(url, qrConfig = {}) {
  const color = qrConfig?.color || "#000000";

  const rawBuffer = await QRCode.toBuffer(url, {
    type: "png",
    width: 3540,
    margin: 4,
    color: { dark: "#000000", light: "#00000000" },
    errorCorrectionLevel: "H",
  });

  if (typeof color === "string" && color.toLowerCase() === "#000000") {
    return rawBuffer;
  }

  const img = await loadImage(rawBuffer);
  const colored = colorizeQrImage(img, color);
  return colored.toBuffer("image/png");
}