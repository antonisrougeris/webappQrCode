import { createCanvas } from "canvas";

export function resolveFillStyle(ctx, colorConfig, w, h) {
  if (typeof colorConfig === "string") return colorConfig;

  // Δέξου είτε array ["#a","#b"] είτε object { type, colors, angle }
  const isArray = Array.isArray(colorConfig);
  const type = isArray ? "linear" : (colorConfig.type || "linear");
  const colors = isArray ? colorConfig : (colorConfig.colors || ["#000000", "#000000"]);
  const angle = isArray ? 0 : (colorConfig.angle || 0);

  if (!colors || colors.length < 2) return typeof colors?.[0] === "string" ? colors[0] : "#000000";

  if (type === "radial") {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
    colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
    return grad;
  }

  const rad = (angle * Math.PI) / 180;
  const x1 = w / 2 - (Math.cos(rad) * w) / 2;
  const y1 = h / 2 - (Math.sin(rad) * h) / 2;
  const x2 = w / 2 + (Math.cos(rad) * w) / 2;
  const y2 = h / 2 + (Math.sin(rad) * h) / 2;

  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  colors.forEach((c, i) => grad.addColorStop(i / (colors.length - 1), c));
  return grad;
}

export function colorizeQrImage(qrImage, colorConfig) {
  const canvas = createCanvas(qrImage.width, qrImage.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(qrImage, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = resolveFillStyle(ctx, colorConfig, qrImage.width, qrImage.height);
  ctx.fillRect(0, 0, qrImage.width, qrImage.height);
  ctx.globalCompositeOperation = "source-over";

  return canvas;
}

export function trimTransparent(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  let top = 0, bottom = height - 1, left = 0, right = width - 1;

  const hasOpaqueInRow = (y) => {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] !== 0) return true;
    }
    return false;
  };
  const hasOpaqueInCol = (x) => {
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4 + 3] !== 0) return true;
    }
    return false;
  };

  while (top < height && !hasOpaqueInRow(top)) top++;
  while (bottom > top && !hasOpaqueInRow(bottom)) bottom--;
  while (left < width && !hasOpaqueInCol(left)) left++;
  while (right > left && !hasOpaqueInCol(right)) right--;

  const trimmedW = right - left + 1;
  const trimmedH = bottom - top + 1;

  // ⚠️ SAFETY: αν δεν βρέθηκε κανένα opaque pixel, μην επιστρέψεις 0-size canvas
  if (
    trimmedW <= 0 ||
    trimmedH <= 0 ||
    !Number.isFinite(trimmedW) ||
    !Number.isFinite(trimmedH)
  ) {
    console.warn(
      "trimTransparent: no opaque pixels found (fully transparent QR), returning original canvas untouched"
    );
    return canvas;
  }

  const trimmed = createCanvas(trimmedW, trimmedH);
  trimmed.getContext("2d").drawImage(
    canvas,
    left, top, trimmedW, trimmedH,
    0, 0, trimmedW, trimmedH
  );

  return trimmed;
}

export function wrapText(ctx, text, maxWidth) {
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