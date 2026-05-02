/** Two-character initials for avatars from an email local-part. */
export function initialsFromEmail(email: string): string {
  const safe = email.trim();
  if (!safe) return "?";
  const local = (safe.split("@")[0] ?? safe).trim();
  const alnum = local.replace(/[^a-zA-Z0-9]/g, "");
  if (alnum.length >= 2) return alnum.slice(0, 2).toUpperCase();
  if (alnum.length === 1) return alnum.toUpperCase();
  return safe.slice(0, 2).toUpperCase();
}
