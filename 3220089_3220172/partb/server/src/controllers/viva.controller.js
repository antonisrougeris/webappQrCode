import { asyncHandler } from "../utils/asyncHandler.js";
import { getVivaWebhookVerificationKey } from "../services/viva.service.js";
import { markOrderPaidFromVivaWebhook } from "../services/payment.service.js";

export const verifyVivaWebhook = asyncHandler(async (_req, res) => {
  const key = await getVivaWebhookVerificationKey();
  return res.status(200).json(key);
});

export const handleVivaWebhook = asyncHandler(async (req, res) => {
  console.log("========== VIVA WEBHOOK ==========");
  console.log(JSON.stringify(req.body, null, 2));
  console.log("==================================");

  await markOrderPaidFromVivaWebhook(req.body);

  return res.status(200).json({ message: "ok" });
});
