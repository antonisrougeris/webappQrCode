/* 3220089_3220172  2025 */

export function validatePassword(password) {
  const issues = [];
  if (password.length < 8) issues.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) issues.push("1 uppercase letter");
  if (!/[a-z]/.test(password)) issues.push("1 lowercase letter");
  if (!/[0-9]/.test(password)) issues.push("1 number");
  return issues;
}

export function isValidBirthdate(dateStr, minAge = 16) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;

  return age >= minAge;
}
