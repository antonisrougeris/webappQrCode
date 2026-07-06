import QRCode from "qrcode";

export async function generateQrBufferLikeFrontend(url) {
  return await QRCode.toBuffer(url, {
    type: "png",
    width: 3540, // 30cm @ 300dpi
    margin: 4,   // σημαντικό για scanability σε print
    color: {
      dark: "#000000ff",
      light: "#00000000", // transparent background
    },
    errorCorrectionLevel: "H",
    scale: 1,
  });
}