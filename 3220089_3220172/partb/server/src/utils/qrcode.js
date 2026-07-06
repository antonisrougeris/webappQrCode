import QRCode from "qrcode";

export async function generateQrBufferLikeFrontend(url, qrConfig = {}) {
  const color = qrConfig?.color || "#000000";

  return await QRCode.toBuffer(url, {
    type: "png",
    width: 3540, // 30cm @ 300dpi
    margin: 4,
    color: {
      dark: color,
      light: "#00000000", // transparent background
    },
    errorCorrectionLevel: "H",
  });
}