import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";

export async function uploadQrToStorage(orderId, buffer) {
  const bucket = getStorage().bucket();

  const filePath = `orders/${orderId}/qr-${uuidv4()}.png`;
  const file = bucket.file(filePath);

  await file.save(buffer, {
    contentType: "image/png",
    public: false,
    metadata: {
      cacheControl: "private, max-age=0",
    },
  });

  const [url] = await file.getSignedUrl({
  action: "read",
  expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
});

  return { filePath, url };
}