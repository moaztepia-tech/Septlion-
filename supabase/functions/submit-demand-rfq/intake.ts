// Pure validation for submit-demand-rfq (tested in tests/submit-demand-rfq.test.mjs).
// A request needs a company, a contact name, a country, a quantity and at least
// one way to reach the buyer: a WhatsApp number or an email address.

export type Intake = { honeypot?: boolean; error?: string; payload?: Record<string, unknown> };

const text = (v: unknown, max = 500) => typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** "+249 912 345 678", "00249912345678" or "249912345678" -> "+249912345678"; "" when not a full international number. */
export function cleanPhone(v: unknown): string {
  const d = text(v, 40).replace(/[^\d+]/g, "").replace(/^00/, "+");
  const digits = d.replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(digits) ? "+" + digits : "";
}

export function normalizeIntake(body: Record<string, unknown>): Intake {
  if (text(body.website, 200)) return { honeypot: true };
  const companyName = text(body.companyName, 160);
  const contactName = text(body.contactName, 160);
  const email = text(body.email, 200).toLowerCase();
  const phone = cleanPhone(body.phone);
  const country = text(body.country, 120);
  const quantity = text(body.quantity, 120);
  const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
  if (!companyName || !contactName || !country || !quantity) {
    return { error: "Please complete company, contact, country and quantity." };
  }
  if (!emailOk) return { error: "Please check the email address." };
  // Without an email the WhatsApp number is the only way back, so it must be complete.
  if (!email && text(body.phone, 40) && !phone) return { error: "Please write the WhatsApp number with its country code." };
  if (!email && !phone) return { error: "Please add a WhatsApp number or an email address." };
  const channel = text(body.channel, 40);
  return {
    payload: {
      intentSlug: text(body.intentSlug, 220) || "wheat-flour",
      productKey: "wheat_flour",
      product: text(body.product, 300) || "Wheat Flour",
      companyName,
      contactName,
      email: email || null,
      // An email request keeps a loosely typed phone as written, as the form always did.
      phone: phone || text(body.phone, 80) || null,
      country,
      city: text(body.city, 120) || null,
      destinationPort: text(body.destinationPort, 160) || null,
      quantity,
      packing: text(body.packing, 120) || null,
      incoterm: text(body.incoterm, 40) || null,
      deliveryWindow: text(body.deliveryWindow, 160) || null,
      notes: text(body.notes, 2000) || null,
      channel: /^[a-z_.-]{1,40}$/.test(channel) ? channel : "public_intent_form",
    },
  };
}
