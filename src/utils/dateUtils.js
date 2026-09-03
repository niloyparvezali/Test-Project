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
    const d = new Date(`${v}T12:00:00`);
    if (Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat('en-BD', {...options, timeZone: TZ }).format(d);
}

function dateShift(date, delta) {
    const d = new Date(`${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return localDate();
    d.setDate(d.getDate() + delta);
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
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

function bookingStatusExpired(b) {
    const rawExpiry = b?.expiresAt;
    let exp = 0;

    if (rawExpiry && typeof rawExpiry.toMillis === 'function') {
        exp = rawExpiry.toMillis();
    } else if (rawExpiry instanceof Date) {
        exp = rawExpiry.getTime();
    } else if (typeof rawExpiry === 'number') {
        exp = rawExpiry;
    } else if (typeof rawExpiry === 'string') {
        const parsed = Date.parse(rawExpiry);
        exp = Number.isNaN(parsed) ? Number(rawExpiry) || 0 : parsed;
    }

    return b?.status === 'pending_payment_verification' && exp > 0 && exp <= Date.now();
}

function bookingDisplayStatus(b) {
    return bookingStatusExpired(b) ? 'expired' : (b?.status || '');
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
    money
};
