import { bookingSlotDate, TZ } from './dateUtils';

/**
 * Resolve the single public operational state for a slot.
 * Priority: confirmed booking -> active pending request -> available.
 * Returns only: available | pending | booked.
 */
function getSlotStatus(slot, booking = null, slotLock = null) {
    if (booking?.status === 'confirmed') return 'booked';

    const pendingBooking = booking?.status === 'pending_payment_verification';
    if (pendingBooking) return 'pending';

    if (slotLock?.status === 'booked') return 'booked';

    if (slotLock?.status === 'pending_payment_verification') return 'pending';

    return 'available';
}

function zonedSlotStartMs(sessionDate, slotStart, timeZone = TZ) {
    const date = String(sessionDate || '').trim();
    const time = String(slotStart || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return 0;

    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    if (![year, month, day, hours, minutes].every(Number.isFinite)) return 0;

    // Convert the turf's local wall-clock slot start to an absolute timestamp
    // using Intl timezone data already supported by the application.
    let guess = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
    for (let i = 0; i < 3; i += 1) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23'
        }).formatToParts(new Date(guess));
        const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
        const represented = Date.UTC(
            Number(map.year), Number(map.month) - 1, Number(map.day),
            Number(map.hour), Number(map.minute), Number(map.second)
        );
        const target = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
        guess -= represented - target;
    }
    return guess;
}

function bookingHistoryCutoffMs(booking, timeZone = TZ) {
    const start = zonedSlotStartMs(bookingSlotDate(booking), booking?.slotStart, timeZone);
    return start ? start + 7 * 24 * 60 * 60 * 1000 : 0;
}

function isBookingHistoryRetained(booking, nowMs = Date.now(), timeZone = TZ) {
    const cutoff = bookingHistoryCutoffMs(booking, timeZone);
    if (!cutoff) return false;
    return nowMs <= cutoff;
}

export { getSlotStatus, zonedSlotStartMs, bookingHistoryCutoffMs, isBookingHistoryRetained };