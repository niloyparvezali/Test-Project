function normalizeDuration(value, fallback = 60) {
    const n = Number(value);
    return n === 60 || n === 90 ? n : fallback;
}

function getActiveDuration(settings, pricing) {
    return normalizeDuration(settings?.slotDuration, normalizeDuration(pricing?.activeDuration, 60));
}

function getActivePricing(pricing = {}, settings = {}) {
    const duration = getActiveDuration(settings, pricing);
    const rules = pricing?.rules || {};
    const legacy = rules?.[String(duration)] || {};
    const metadataMatches = Number(pricing?.duration || pricing?.activeDuration) === duration;
    const dayRate = isValidRate(legacy.day) ?
        Number(legacy.day) :
        metadataMatches && isValidRate(pricing?.dayRate) ? Number(pricing.dayRate) : NaN;
    const nightRate = isValidRate(legacy.night) ?
        Number(legacy.night) :
        metadataMatches && isValidRate(pricing?.nightRate) ? Number(pricing.nightRate) : NaN;
    return {
        duration,
        dayRate: Number.isFinite(dayRate) ? dayRate : null,
        nightRate: Number.isFinite(nightRate) ? nightRate : null,
    };
}

function isValidRate(value) {
    if (value === null || value === undefined || String(value).trim() === '') return false;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0;
}

function activePricingError(pricing = {}, settings = {}) {
    const { duration, dayRate, nightRate } = getActivePricing(pricing, settings);
    if (!isValidRate(dayRate)) return `${duration}-minute Day price is required.`;
    if (!isValidRate(nightRate)) return `${duration}-minute Night price is required.`;
    return '';
}

export { normalizeDuration, getActiveDuration, getActivePricing, activePricingError, isValidRate };