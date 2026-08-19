/* ============================================================================
   PHONE — shared AU phone number formatting + click-to-call helpers.
   Used anywhere a phone/mobile number is displayed (not typed into a form)
   so numbers look consistent and work as tel: links on mobile/tablet/desktop.
   ========================================================================== */

/** Formats a raw phone string into AU display format. Numbers that don't
 *  match a recognised AU mobile/landline shape are returned unchanged. */
function formatPhoneAU(raw) {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  const local = digits.replace(/^\+?61/, '0');
  if (/^04\d{8}$/.test(local)) {
    return local.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
  }
  if (/^0[2378]\d{8}$/.test(local)) {
    return local.replace(/^0(\d)(\d{4})(\d{4})$/, '(0$1) $2 $3');
  }
  if (/^1[38]00\d{6}$/.test(local)) {
    return local.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3');
  }
  return String(raw).trim();
}

/** Builds a `tel:` href from a raw phone string, preferring E.164 (+61…)
 *  for recognised AU numbers since that dials correctly from any device. */
function telHrefAU(raw) {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  const local = digits.replace(/^\+?61/, '0');
  if (/^0\d{9}$/.test(local)) return `tel:+61${local.slice(1)}`;
  return `tel:${digits}`;
}

function escapePhoneHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Returns a ready-to-insert `<a href="tel:...">formatted number</a>`, or
 *  `fallback` (default empty string) when there's no number to show. */
function phoneLinkHtml(raw, fallback = '') {
  const formatted = formatPhoneAU(raw);
  if (!formatted) return fallback;
  return `<a class="phone-link" href="${telHrefAU(raw)}">${escapePhoneHtml(formatted)}</a>`;
}
