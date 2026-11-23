export function normalizePhone(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, n => String('٠١٢٣٤٥٦٧٨٩'.includes(n) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(n) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(n))).replace(/[\s()-]/g,'');
}
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
export function buyerContactProblem(contact: {name: string; company: string; phone: string; email: string}, {emailRequired = true}: {emailRequired?: boolean} = {}): string {
  if (!contact.name.trim()) return 'أدخل اسمك.';
  if (!contact.company.trim()) return 'أدخل اسم الشركة.';
  const email = contact.email.trim();
  if (emailRequired && !email) return 'أدخل بريدك الإلكتروني؛ يصلك عليه رمز التحقق.';
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) return 'صحّح البريد الإلكتروني.';
  if (!/^\+[1-9]\d{7,14}$/.test(normalizePhone(contact.phone))) return 'أدخل رقم WhatsApp مع رمز الدولة، مثل +966…';
  return '';
}
