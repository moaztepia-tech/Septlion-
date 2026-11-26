// Parses the alert recipients kept in the function's secrets.
export function splitEmails(raw: string): string[] {
  return [...new Set(raw.split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)))];
}

// "+249123456789:123456, +966500000000:654321" -> [{phone, apikey}]
export function parseWhatsappTargets(raw: string): { phone: string; apikey: string }[] {
  return raw.split(",").map((part) => {
    const [p, k] = part.split(":").map((s) => (s || "").trim());
    const digits = p.replace(/[\s()-]/g, "").replace(/^\+/, "");
    return /^[1-9]\d{7,14}$/.test(digits) && /^[A-Za-z0-9]{3,64}$/.test(k || "") ? { phone: "+" + digits, apikey: k } : null;
  }).filter((x): x is { phone: string; apikey: string } => x !== null);
}
