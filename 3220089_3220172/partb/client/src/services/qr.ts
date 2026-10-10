import { apiRequest } from "./api";

export interface QrCode {
  id: string;
  shortId?: string;
  productId?: string;
  productTitle?: string;
  targetUrl?: string;
  linkUrl?: string;
  destinationType?: "link" | "photo";
  photo?: { storagePath: string; contentType: string; sizeBytes: number; updatedAt: string };
  scans?: number;
  createdAt?: string;
}

type QrListResponse = {
  qrCodes: QrCode[];
};

type QrUpdateResponse = {
  qrCode: QrCode;
};

export async function getMyQrCodes(): Promise<QrCode[]> {
  const res = await apiRequest<QrListResponse>("/qr-codes");
  return Array.isArray(res.qrCodes) ? res.qrCodes : [];
}

export async function updateQrCode(
  qrId: string,
  targetUrl: string
): Promise<QrCode> {
  const res = await apiRequest<QrUpdateResponse>(
    `/qr-codes/${encodeURIComponent(qrId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ targetUrl }),
    }
  );

  return res.qrCode;
}

export async function uploadQrPhoto(qrId: string, file: File): Promise<QrCode> {
  const form = new FormData();
  form.append("photo", file);
  const res = await apiRequest<QrUpdateResponse>(
    `/qr-photo/${encodeURIComponent(qrId)}`,
    { method: "POST", body: form }
  );
  return res.qrCode;
}

export async function activateQrPhoto(qrId: string): Promise<QrCode> {
  const res = await apiRequest<QrUpdateResponse>(
    `/qr-codes/${encodeURIComponent(qrId)}`,
    { method: "PATCH", body: JSON.stringify({ destinationType: "photo" }) }
  );
  return res.qrCode;
}
