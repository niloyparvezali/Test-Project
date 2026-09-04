const TZ =
    import.meta.env.VITE_TURF_TIMEZONE || 'Asia/Dhaka';

const pad = n => String(n).padStart(2, '0');
const mins = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
const addM = (t, n) => { let x = (mins(t) + n) % 1440; return `${pad(Math.floor(x/60))}:${pad(x%60)}`; };
const absM = t => mins(t) + (mins(t) < mins('06:00') ? 1440 : 0);

function dateTimeParts(date, totalMinutes) {
    const dayOffset = Math.floor(totalMinutes / 1440);
    const timeMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    const [year, month, day] = String(date).split('-').map(Number);
    const value = new Date(Date.UTC(year, month - 1, day + dayOffset, 12));
    const dateValue = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(value);
    const timeValue = `${pad(Math.floor(timeMinutes / 60))}:${pad(timeMinutes % 60)}`;
    return { date: dateValue, time: timeValue, dateTime: `${dateValue}T${timeValue}:00` };
}

function getOperatingInterval(selectedDate, openingTime = '06:00', closingTime = '04:00') {
    const openingMinutes = mins(openingTime);
    const closingMinutes = mins(closingTime);
    const endMinutes = closingMinutes > openingMinutes
        ? closingMinutes
        : closingMinutes === openingMinutes
            ? openingMinutes + 1440
            : closingMinutes + 1440;

    const start = dateTimeParts(selectedDate, openingMinutes);
    const end = dateTimeParts(selectedDate, endMinutes);

    return {
        startDate: start.date,
        endDate: end.date,
        startTime: start.time,
        endTime: end.time,
        startDateTime: start.dateTime,
        endDateTime: end.dateTime,
        durationMinutes: endMinutes - openingMinutes,
    };
}

const localDate = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
}).format(new Date());

const timeLabel = t => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    return `${h%12||12}:${pad(m)} ${h>=12?'PM':'AM'}`;
};

function displayDate(v, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
    if (!v) return '—';
    const [year, month, day] = String(v).split('-').map(Number);
    if (![year, month, day].every(Number.isFinite)) return String(v);
    const d = new Date(Date.UTC(year, month - 1, day, 12));
    return new Intl.DateTimeFormat('en-BD', { ...options, timeZone: TZ }).format(d);
}

function dateShift(date, delta) {
    if (!validDateInput(date)) return localDate();
    const [year, month, day] = String(date).split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day + Number(delta || 0), 12));
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d);
}

function validDateInput(v) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
}

function bookingDate(b) {
    return b?.sessionDate || b?.date || '';
}

function bookingSlotDate(b) {
    return String(b?.slotStartDate || bookingDate(b));
}

function bookingStatusExpired() {
    // Public requests never expire by time. Kept as a compatibility shim for
    // existing callers while the final business rule is permanent.
    return false;
}

function bookingDisplayStatus(b) {
    return b?.status || '';
}

function timestampToMs(value) {
    if (!value) return 0;
    if (typeof value?.toMillis === 'function') {
        const ms = value.toMillis();
        return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof value?.toDate === 'function') {
        const ms = value.toDate().getTime();
        return Number.isFinite(ms) ? ms : 0;
    }
    if (value instanceof Date) {
        const ms = value.getTime();
        return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof value === 'number') {
        const ms = value < 1e12 ? value * 1000 : value;
        return Number.isFinite(ms) ? ms : 0;
    }
    const parsed = Date.parse(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
}

function transactionDateKey(value) {
    const ms = timestampToMs(value);
    if (!ms) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date(ms));
    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
}

function transactionDateTimeLabel(value) {
    const ms = timestampToMs(value);
    if (!ms) return '—';
    const d = new Date(ms);
    const date = new Intl.DateTimeFormat('en-BD', {
        day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ
    }).format(d);
    const time = new Intl.DateTimeFormat('en-BD', {
        hour: 'numeric', minute: '2-digit', hour12: true, timeZone: TZ
    }).format(d);
    return `${date} · ${time}`;
}

const money = n => `৳${Number(n||0).toLocaleString('en-BD',{maximumFractionDigits:3})}`;

export {
    TZ,
    pad,
    mins,
    addM,
    absM,
    dateTimeParts,
    getOperatingInterval,
    localDate,
    timeLabel,
    displayDate,
    dateShift,
    validDateInput,
    bookingDate,
    bookingSlotDate,
    bookingStatusExpired,
    bookingDisplayStatus,
    timestampToMs,
    transactionDateKey,
    transactionDateTimeLabel,
    money
};
