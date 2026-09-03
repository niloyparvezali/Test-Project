const normalizeSpaces = value => String(value ?? '').replace(/\s+/g, ' ').trim();

export function sanitizeName(value) {
    const cleaned = String(value ?? '')
        .normalize('NFKC')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/[^\p{L}\p{M}.'’\- ]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();

    return cleaned;
}

export function validateName(value) {
    const clean = sanitizeName(value);
    if (clean.length < 2 || clean.length > 80) return false;
    return /[\p{L}]/u.test(clean);
}

export function sanitizePhoneNumber(value) {
    return String(value ?? '')
        .replace(/\D/g, '')
        .replace(/^880/, '0')
        .replace(/^00+/, '')
        .slice(0, 11);
}

export function sanitizePhone(value) {
    return sanitizePhoneNumber(value);
}

export function validatePhone(value) {
    const digits = sanitizePhoneNumber(value);
    return /^01\d{9}$/.test(digits) && digits.length === 11;
}

export function sanitizeSendMoneyNumber(value) {
    return String(value ?? '').replace(/\D/g, '').slice(0, 11);
}

export function validateSendMoneyNumber(value) {
    const digits = sanitizeSendMoneyNumber(value);
    return digits.length === 11;
}

export function sanitizeTransactionId(value) {
    const cleaned = String(value ?? '')
        .normalize('NFKC')
        .replace(/\s+/g, '')
        .replace(/[^A-Za-z0-9_-]/g, '')
        .slice(0, 30)
        .toUpperCase();

    return cleaned;
}

export function validateTransactionId(value) {
    const clean = sanitizeTransactionId(value);
    return /^[A-Z0-9][A-Z0-9_-]{4,29}$/.test(clean);
}

export function validateCustomerForm(form = {}) {
    const next = {};
    const customerName = sanitizeName(form.customerName);
    if (!validateName(customerName)) next.customerName = 'Please enter your full name.';

    const phone = sanitizePhoneNumber(form.phone);
    if (!validatePhone(phone)) next.phone = 'Enter an 11-digit contact number.';

    return next;
}

export function validatePaymentForm(form = {}) {
    const next = {};
    const sendMoneyNumber = sanitizeSendMoneyNumber(form.sendMoneyNumber);
    if (!validateSendMoneyNumber(sendMoneyNumber)) {
        next.sendMoneyNumber = 'Enter an 11-digit send money number.';
    }

    const transactionId = sanitizeTransactionId(form.transactionId);
    if (!validateTransactionId(transactionId)) {
        next.transactionId = 'Please enter a valid transaction ID.';
    }

    return next;
}

export function sanitizeCustomerForm(form = {}) {
    return {
        ...form,
        customerName: sanitizeName(form.customerName).slice(0, 80),
        phone: sanitizePhoneNumber(form.phone),
    };
}

export function sanitizePaymentForm(form = {}) {
    return {
        ...form,
        sendMoneyNumber: sanitizeSendMoneyNumber(form.sendMoneyNumber),
        transactionId: sanitizeTransactionId(form.transactionId).slice(0, 30),
    };
}

export { normalizeSpaces };