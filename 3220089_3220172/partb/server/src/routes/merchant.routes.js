import { Router } from "express";
import { getMerchantFeed } from "../services/merchant-feed.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.get("/feed.xml", asyncHandler(async (_req, res) => {
  const xml = await getMerchantFeed();
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=900");
  res.status(200).send(xml);
}));
export default router;
