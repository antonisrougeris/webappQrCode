export function healthController(req, res) {
  res.json({
    success: true,
    service: "qr-ecommerce-api",
    status: "ok",
  });
}
