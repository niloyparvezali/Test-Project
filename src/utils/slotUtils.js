import {
    dateTimeParts,
    getOperatingInterval,
    mins,
} from './dateUtils';

import { getActivePricing } from './pricingUtils';

function slotPriceFromPricing(slot, pricing, settings) {
    settings = settings || {};

    var activePricing = getActivePricing(pricing, settings);
    var duration = activePricing.duration;

    var slotDuration =
        slot && slot.duration != null
            ? Number(slot.duration)
            : Number(duration);

    var shift =
        slot && slot.shift != null
            ? String(slot.shift)
            : 'day';

    var direct = null;

    if (slotDuration === duration) {
        if (
            pricing &&
            pricing.rules &&
            pricing.rules[String(duration)]
        ) {
            direct = pricing.rules[String(duration)][shift];
            if (direct == null) {
                direct = null;
            }
        }
    }

    if (
        direct != null &&
        Number.isFinite(Number(direct)) &&
        Number(direct) >= 0
    ) {
        return Number(direct);
    }

    var activeForSlot = getActivePricing(pricing, {
        ...settings,
        slotDuration: slotDuration,
    });

    var activeRate =
        shift === 'night'
            ? activeForSlot.nightRate
            : activeForSlot.dayRate;

    if (activeRate != null) {
        return Number(activeRate) || 0;
    }

    var ranges =
        pricing && Array.isArray(pricing.timeRanges)
            ? pricing.timeRanges
            : [];

    var range = ranges.find(function (x) {
        return (
            x &&
            Number(x.duration) === slotDuration &&
            slot &&
            mins(slot.start) >= mins(x.start) &&
            mins(slot.start) < mins(x.end)
        );
    });

    return range ? Number(range.price) || 0 : 0;
}

function generateSlots(date, settings) {
    settings = settings || {};

    var duration = Number(settings.slotDuration);

    if (duration !== 60 && duration !== 90) {
        return [];
    }

    var open = settings.openingTime || '06:00';
    var close = settings.closingTime || '04:00';

    var dayBoundary =
        settings.dayBoundary ||
        (duration === 60 ? '18:00' : '16:30');

    var interval = getOperatingInterval(
        date,
        open,
        close
    );

    var openingMinutes = mins(open);
    var boundaryBase = mins(dayBoundary);

    var boundaryMinutes =
        boundaryBase <= openingMinutes
            ? boundaryBase + 1440
            : boundaryBase;

    var out = [];

    for (
        var elapsed = 0;
        elapsed + duration <= interval.durationMinutes;
        elapsed += duration
    ) {
        var startMinutes = openingMinutes + elapsed;
        var endMinutes = startMinutes + duration;

        var startParts = dateTimeParts(
            date,
            startMinutes
        );

        var endParts = dateTimeParts(
            date,
            endMinutes
        );

        var shift =
            startMinutes < boundaryMinutes
                ? 'day'
                : 'night';

        out.push({
            date: date,
            start: startParts.time,
            end: endParts.time,
            startDate: startParts.date,
            endDate: endParts.date,
            startDateTime: startParts.dateTime,
            endDateTime: endParts.dateTime,
            duration: duration,
            shift: shift,
            key:
                date +
                '_' +
                startParts.time.replace(':', '') +
                '_' +
                duration,
        });
    }

    return out;
}

function requiredAdvanceFromSettings(price, settings) {
    settings = settings || {};

    var advanceType =
        settings.advanceType === 'fixed'
            ? 'fixed'
            : 'percentage';

    var advanceValue = Number(
        settings.advanceValue != null
            ? settings.advanceValue
            : advanceType === 'fixed'
                ? 0
                : 30
    );

    if (
        !Number.isFinite(advanceValue) ||
        advanceValue < 0
    ) {
        return 0;
    }

    var totalPrice = Number(price) || 0;

    var calculatedAdvance =
        advanceType === 'fixed'
            ? advanceValue
            : (totalPrice * advanceValue) / 100;

    return Math.min(
        totalPrice,
        Math.round(calculatedAdvance * 1000) / 1000
    );
}

export {
    generateSlots,
    slotPriceFromPricing,
    requiredAdvanceFromSettings,
};
