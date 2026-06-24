import { apiRequest } from "./api";

export interface QrCode {
  id: string;
  productId?: string;
  productTitle?: string;
  targetUrl?: string;
  scans?: number;
  createdAt?: string;
}

export async function getMyQrCodes(): Promise<QrCode[]> {
  return apiRequest<QrCode[]>("/qr");
}

export async function updateQrCode(
  qrId: string,
  targetUrl: string
): Promise<QrCode> {
  return apiRequest<QrCode>(`/qr/${encodeURIComponent(qrId)}`, {
    method: "PATCH",
    body: JSON.stringify({ targetUrl }),
  });
}
