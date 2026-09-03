export const BRAND_NAME = 'Bason Turf City';

export function displayBrand(value) {
  const text = String(value ?? '').trim();
  if (!text || /^(turf\s*club|turfclub)$/i.test(text)) return BRAND_NAME;
  return text;
}

export function pageTitle(section = '') {
  return section ? `${BRAND_NAME} — ${section}` : BRAND_NAME;
}
