export const BRAND_NAME = 'TestWeb Turf';

export function displayBrand(value) {
  const text = String(value ?? '').trim();
  if (!text || /^(turf\s*club|turfclub)$/i.test(text)) return BRAND_NAME;
  if (/^bason\s+turf(?:\s+city)?$/i.test(text)) return BRAND_NAME;
  return text;
}

export function pageTitle(section = '') {
  return section ? `${BRAND_NAME} — ${section}` : BRAND_NAME;
}
