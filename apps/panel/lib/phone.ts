// Teléfonos argentinos tal como los escribe la gente → formato internacional de WhatsApp.
// "11 5555-1234" → "+5491155551234". Con "+" adelante se respeta tal cual.
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (raw.startsWith('+')) {
    const d = raw.replace(/\D/g, '');
    return /^[1-9][0-9]{7,14}$/.test(d) ? `+${d}` : null;
  }
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) {
    d = d.slice(2);
    if (d.startsWith('9')) d = d.slice(1);
  }
  if (d.startsWith('0')) d = d.slice(1);
  // Saca el 15 de celulares escritos a la antigua: "11 15 5555 1234".
  const m = /^(\d{2,4})15(\d{6,8})$/.exec(d);
  if (m && m[1].length + m[2].length === 10) d = m[1] + m[2];
  return /^\d{10}$/.test(d) ? `+549${d}` : null;
}
