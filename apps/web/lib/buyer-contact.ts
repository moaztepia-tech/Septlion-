export function normalizePhone(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, n => String('٠١٢٣٤٥٦٧٨٩'.includes(n) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(n) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(n))).replace(/[\s()-]/g,'');
}
export function buyerContactProblem(contact: {name: string; company: string; phone: string; email: string}): string {
  if (!contact.name.trim()) return 'أدخل اسمك.';
  if (!contact.company.trim()) return 'أدخل اسم الشركة.';
  if (contact.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) return 'صحّح البريد الإلكتروني أو اتركه فارغًا؛ فهو اختياري.';
  if (!/^\+[1-9]\d{7,14}$/.test(normalizePhone(contact.phone))) return 'أدخل رقم WhatsApp مع رمز الدولة، مثل +966…';
  return '';
}
