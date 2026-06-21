/* 3220089_3220172  2025 */

export function validateRequest(requiredFields = []) {
return (req, res, next) => {
const missing = [];


for (const field of requiredFields) {
if (!req.body?.[field]) {
missing.push(field);
}
}


if (missing.length > 0) {
return res.status(400).json({
error: true,
message: `Missing required fields: ${missing.join(", ")}`,
});
}


next();
};
}