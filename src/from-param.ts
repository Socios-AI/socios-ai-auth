const ROOT_DOMAIN = "sociosai.com";

export type FromValidationResult =
  | { valid: true; url: URL }
  | { valid: false };

export function validateFromParam(raw: string | null | undefined): FromValidationResult {
  if (typeof raw !== "string") return { valid: false };
  const trimmed = raw.trim();
  if (!trimmed) return { valid: false };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { valid: false };
  }

  if (url.protocol !== "https:") return { valid: false };
  if (url.username !== "" || url.password !== "") return { valid: false };

  const host = url.hostname.toLowerCase();
  if (host !== ROOT_DOMAIN && !host.endsWith(`.${ROOT_DOMAIN}`)) return { valid: false };

  return { valid: true, url };
}

export function deriveAppName(raw: string | null | undefined): string | null {
  const r = validateFromParam(raw);
  if (!r.valid) return null;
  const host = r.url.hostname.toLowerCase();
  if (host === ROOT_DOMAIN) return "Sócios AI";
  const label = host.slice(0, host.length - `.${ROOT_DOMAIN}`.length);
  return label.toUpperCase();
}
