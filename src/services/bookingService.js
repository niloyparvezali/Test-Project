import { auth, db } from '../firebase';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    runTransaction,
    serverTimestamp
} from 'firebase/firestore';
import { addM, displayDate, localDate, mins, timeLabel, validDateInput } from '../utils/dateUtils';
import { generateSlots, slotPriceFromPricing, requiredAdvanceFromSettings } from '../utils/slotUtils';
import { getCurrentAdminActor, logAdminActivity } from './adminActivityService';
const money = n => `৳${Number(n||0).toLocaleString('en-BD',{maximumFractionDigits:3})}`;

async function createBookingClient(slot, form, turf = {}) {
    const settings = (await getDoc(doc(db, 'settings/config'))).data() || {};
    const pricing = (await getDoc(doc(db, 'pricing/current'))).data() || {};
    const duration = Number(settings.slotDuration || slot.duration);
    if (![60, 90].includes(duration)) throw new Error('Slot duration is not configured.');
    const start = String(slot.start);
    const end = addM(start, duration);
    const shift = String(slot.shift);
    const price = slotPriceFromPricing({ duration, shift, start }, pricing, settings);
    if (price <= 0) throw new Error('This slot does not have a configured price.');
    const requiredAdvance = requiredAdvanceFromSettings(price, settings);
    if (!Number.isFinite(requiredAdvance) || requiredAdvance < 0) throw new Error('Advance payment is not configured correctly.');
    const customerName = String(form.customerName || '').trim(),
        phone = String(form.phone || '').trim();
    if (customerName.length < 2) throw new Error('Please enter your name.');
    if (phone.length < 5) throw new Error('Please enter a valid phone number.');
    const paymentMethod = String(form.paymentMethod || '').trim();
    if (!['bKash', 'Nagad', 'Rocket'].includes(paymentMethod)) throw new Error('Please select a payment method.');
    const receiverMap = { bKash: turf.bkashNumber, Nagad: turf.nagadNumber, Rocket: turf.rocketNumber };
    const receiverNumber = String(receiverMap[paymentMethod] || '').trim();
    if (!receiverNumber) throw new Error(`${paymentMethod} payment number is not configured.`);
    const sendMoneyNumber = String(form.sendMoneyNumber || '').trim();
    if (sendMoneyNumber.length < 5) throw new Error('Please enter your send money number.');
    const transactionId = String(form.transactionId || '').trim();
    if (transactionId.length < 5) throw new Error('Please enter your transaction ID.');
    const paymentAmount = Math.round(requiredAdvance * 1000) / 1000;
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error('The required booking advance is not available for this slot.');
    const remainingAmount = Math.round((price - paymentAmount) * 1000) / 1000;
    const slotKey = `${slot.date}_${start.replace(':','')}_${duration}`;
    const lockRef = doc(db, 'slotLocks', slotKey);
    const bookingRef = doc(collection(db, 'bookings'));
    await runTransaction(db, async tx => {
        const lock = await tx.get(lockRef);
        if (lock.exists()) {
            const data = lock.data();
            if (data.status === 'booked' || data.status === 'pending_payment_verification') throw new Error('That slot is no longer available. Please choose another slot.');
        }
        const now = serverTimestamp();
        tx.set(lockRef, { status: 'pending_payment_verification', slotKey, sessionDate: slot.date, slotStart: start, slotEnd: end, slotStartDate: slot.startDate, slotEndDate: slot.endDate, slotStartDateTime: slot.startDateTime, slotEndDateTime: slot.endDateTime, duration, shift, expiresAt: null });
        tx.set(bookingRef, {
            customerName,
            phone,
            date: slot.date,
            sessionDate: slot.date,
            slotStart: start,
            slotEnd: end,
            slotStartDate: slot.startDate,
            slotEndDate: slot.endDate,
            slotStartDateTime: slot.startDateTime,
            slotEndDateTime: slot.endDateTime,
            duration,
            shift,
            slotPrice: price,
            totalAmount: price,
            paidAmount: 0,
            advanceAmount: requiredAdvance,
            remainingAmount,
            dueAmount: remainingAmount,
            paymentMethod,
            receiverNumberSnapshot: receiverNumber,
            sendMoneyNumber,
            transactionId,
            paymentAmount,
            status: 'pending_payment_verification',
            slotKey,
            createdBy: 'public',
            bookingType: 'public_payment_request',
            createdAt: now,
            updatedAt: now,
            expiresAt: null,
            verificationStatus: 'pending'
        });
    });
    return { bookingId: bookingRef.id, slotEnd: end, slotPrice: price, advanceAmount: requiredAdvance, remainingAmount, transactionId, status: 'pending_payment_verification', paymentMethod, paymentAmount };
}

async function confirmBookingClient(booking) {
    if (!auth.currentUser) throw new Error('Admin session expired. Please sign in again.');
    const txnId = String((booking && booking.transactionId) || '').trim();
    if (!txnId) throw new Error('This request has no transaction ID.');
    const oldPayments = await getDocs(query(collection(db, 'payments'), where('transactionId', '==', txnId)));
    if (!oldPayments.empty) throw new Error('Transaction ID already used for another confirmed payment.');
    const oldBookings = await getDocs(query(collection(db, 'bookings'), where('transactionId', '==', txnId)));
    if (!oldBookings.empty && oldBookings.docs.some(x => x.data().status === 'confirmed')) throw new Error('Transaction ID already used for another confirmed payment.');
    const bookingRef = doc(db, 'bookings', booking.id);
    const lockRef = doc(db, 'slotLocks', booking.slotKey);
    const paymentRef = doc(db, 'payments', `txn_${encodeURIComponent(txnId).slice(0,300)}`);
    const txRef = doc(db, 'transactions', `txn_${encodeURIComponent(txnId).slice(0,300)}`);
    const actor = await getCurrentAdminActor();
    await runTransaction(db, async tx => {
        const snap = await tx.get(bookingRef);
        if (!snap.exists()) throw new Error('Booking request no longer exists.');
        const b = snap.data();
        if (b.status !== 'pending_payment_verification') throw new Error(`This request is already ${b.status||'handled'}.`);
        const lock = await tx.get(lockRef);
        if (!lock.exists() || lock.data().status !== 'pending_payment_verification') throw new Error('The slot lock is no longer active.');
        const paymentCheck = await tx.get(paymentRef);
        if (paymentCheck.exists()) throw new Error('Transaction ID already used for another confirmed payment.');
        const amount = Math.round(Number(b.paymentAmount || b.advanceAmount || 0) * 1000) / 1000;
        const total = Number(b.totalAmount || b.slotPrice || 0);
        const required = Number(b.advanceAmount || 0);
        if (!Number.isFinite(amount) || amount <= 0 || amount < required) throw new Error(`Payment amount is below the required advance of ${money(required)}.`);
        if (amount > total) throw new Error('Payment amount cannot exceed the total booking amount.');
        const now = serverTimestamp();
        tx.update(bookingRef, {
            status: 'confirmed',
            paidAmount: amount,
            remainingAmount: total - amount,
            dueAmount: total - amount,
            updatedAt: now,
            reviewedAt: now,
            verificationStatus: 'accepted',
            confirmedAt: now,
            expiresAt: null,
            confirmedBy: actor.actorUid,
            confirmedByEmail: actor.actorEmail,
            confirmedByName: actor.actorName
        });
        tx.set(lockRef, {...lock.data(), status: 'booked', expiresAt: null, updatedAt: now });
        tx.set(paymentRef, {
            bookingId: booking.id,
            amount,
            paymentMethod: String(b.paymentMethod || 'Other'),
            paymentDate: String(b.sessionDate || b.date || localDate()),
            note: 'Public booking payment',
            transactionId: txnId,
            createdAt: now,
            createdBy: auth.currentUser.uid
        });
        tx.set(txRef, {
            type: 'income',
            amount,
            category: 'Booking payment',
            referenceId: booking.id,
            description: `Payment for booking ${booking.id}`,
            date: String(b.sessionDate || b.date || localDate()),
            transactionId: txnId,
            createdAt: now,
            createdBy: auth.currentUser.uid
        });
    });
    await logAdminActivity({
        action: 'booking_confirmed',
        targetType: 'booking',
        targetId: booking.id,
        description: `${actor.actorName} accepted the booking request for ${booking.customerName || 'Customer'}`,
        metadata: { customerName: booking.customerName || '', sessionDate: booking.sessionDate || booking.date || '', slotStart: booking.slotStart || '', slotEnd: booking.slotEnd || '' }
    });
}

async function rejectBookingClient(booking, reason = '') {
    const actor = await getCurrentAdminActor();
    const bookingRef = doc(db, 'bookings', booking.id);
    const lockRef = booking.slotKey ? doc(db, 'slotLocks', booking.slotKey) : null;
    await runTransaction(db, async tx => {
        const snap = await tx.get(bookingRef);
        if (!snap.exists()) throw new Error('Booking request no longer exists.');
        const b = snap.data();
        if (b.status !== 'pending_payment_verification') throw new Error(`This request is already ${b.status||'handled'}.`);
        const now = serverTimestamp();
        tx.update(bookingRef, {
            status: 'rejected',
            verificationStatus: 'rejected',
            rejectionReason: String(reason || '').trim(),
            reviewedAt: now,
            updatedAt: now,
            rejectedBy: actor.actorUid,
            rejectedByEmail: actor.actorEmail,
            rejectedByName: actor.actorName
        });
        if (lockRef) tx.delete(lockRef);
    });
    await logAdminActivity({
        action: 'booking_rejected',
        targetType: 'booking',
        targetId: booking.id,
        description: `${actor.actorName} rejected the booking request for ${booking.customerName || 'Customer'}`,
        metadata: {
            customerName: booking.customerName || '',
            sessionDate: booking.sessionDate || booking.date || '',
            slotStart: booking.slotStart || '',
            slotEnd: booking.slotEnd || '',
            reason: String(reason || '').trim()
        }
    });
}


async function createManualBookingClient({ slot, customerName, phone, adminNote, advanceAmount }) {
    const actor = await getCurrentAdminActor();
    const date = String((slot && slot.date) || '');
    const start = String((slot && slot.start) || '');
    const duration = Number(slot && slot.duration);
    if (!validDateInput(date) || !start || ![60, 90].includes(duration)) throw new Error('A valid slot must be selected.');
    const turf = (await getDoc(doc(db, 'turf/main'))).data() || {};
    const settings = (await getDoc(doc(db, 'settings/config'))).data() || {};
    const pricing = (await getDoc(doc(db, 'pricing/current'))).data() || {};
    const generated = generateSlots(date, settings).find(s => s.key === slot.key);
    if (!generated) throw new Error('This slot is no longer part of the current operating schedule.');
    const price = slotPriceFromPricing(generated, pricing, settings);
    if (price <= 0) throw new Error('Pricing is not configured for this slot.');
    const cleanName = String(customerName || '').trim();
    const cleanPhone = String(phone || '').trim();
    const cleanNote = String(adminNote || '').trim();
    const advance = Math.round(Number(advanceAmount || 0) * 1000) / 1000;
    if (cleanName.length < 2) throw new Error('Customer or booking name is required.');
    if (cleanNote.length < 2) throw new Error('Admin note is required.');
    if (!Number.isFinite(advance) || advance < 0) throw new Error('Advance payment must be a valid non-negative amount.');
    if (advance > price) throw new Error('Advance cannot be greater than the total amount.');
    const requiredAdvance = requiredAdvanceFromSettings(price, settings);
    const end = generated.end;
    const slotKey = generated.key;
    const lockRef = doc(db, 'slotLocks', slotKey),
        bookingRef = doc(collection(db, 'bookings'));
    const notePrefix = `${displayDate(date,{day:'2-digit',month:'short',year:'numeric'})} · ${timeLabel(generated.start)}–${timeLabel(generated.end)}`;
    const fullNote = `${notePrefix} · ${cleanNote}`;
    await runTransaction(db, async tx => {
        const lock = await tx.get(lockRef);
        if (lock.exists()) {
            const data = lock.data();
            if (data.status === 'booked') throw new Error('That slot is already booked.');
            if (data.status === 'pending_payment_verification') throw new Error('That slot is currently reserved by a payment request.');
        }
        const now = serverTimestamp();
        tx.set(lockRef, { status: 'booked', slotKey, sessionDate: date, slotStart: generated.start, slotEnd: end, slotStartDate: generated.startDate, slotEndDate: generated.endDate, slotStartDateTime: generated.startDateTime, slotEndDateTime: generated.endDateTime, duration, shift: generated.shift, expiresAt: null, updatedAt: now });
        tx.set(bookingRef, {
            customerName: cleanName,
            phone: cleanPhone,
            date,
            sessionDate: date,
            slotStart: generated.start,
            slotEnd: end,
            slotStartDate: generated.startDate,
            slotEndDate: generated.endDate,
            slotStartDateTime: generated.startDateTime,
            slotEndDateTime: generated.endDateTime,
            duration,
            shift: generated.shift,
            slotPrice: price,
            totalAmount: price,
            paidAmount: advance,
            advanceAmount: advance,
            remainingAmount: price - advance,
            dueAmount: price - advance,
            paymentMethod: 'Manual',
            receiverNumberSnapshot: '',
            sendMoneyNumber: '',
            transactionId: '',
            paymentAmount: advance,
            status: 'confirmed',
            slotKey,
            createdBy: auth.currentUser.uid,
            bookingType: 'manual_admin',
            bookingSource: 'admin',
            adminNote: fullNote,
            createdAt: now,
            updatedAt: now,
            confirmedAt: now,
            createdByEmail: actor.actorEmail,
            createdByName: actor.actorName,
            confirmedBy: actor.actorUid,
            confirmedByEmail: actor.actorEmail,
            confirmedByName: actor.actorName
        });
        if (advance > 0) {
            const paymentRef = doc(collection(db, 'payments'));
            const txRef = doc(collection(db, 'transactions'));
            tx.set(paymentRef, {
                bookingId: bookingRef.id,
                amount: advance,
                paymentMethod: 'Manual',
                paymentDate: date,
                note: 'Manual booking advance payment',
                transactionId: '',
                createdAt: now,
                createdBy: auth.currentUser.uid
            });
            tx.set(txRef, {
                type: 'income',
                amount: advance,
                category: 'Booking payment',
                referenceId: bookingRef.id,
                description: `Advance payment for manual booking ${bookingRef.id}`,
                date,
                transactionId: '',
                createdAt: now,
                createdBy: auth.currentUser.uid
            });
        }
    });
    await logAdminActivity({
        action: 'manual_booking_created',
        targetType: 'booking',
        targetId: bookingRef.id,
        description: `${actor.actorName} created manual booking for ${cleanName}`,
        metadata: { customerName: cleanName, sessionDate: date, slotStart: generated.start, slotEnd: end }
    });
}


async function recordPaymentClient({ bookingId, amount, paymentMethod, paymentDate, note, transactionId }) {
    const actor = await getCurrentAdminActor();
    const method = String(paymentMethod || '').trim();
    if (!['Cash', 'bKash', 'Nagad', 'Rocket'].includes(method)) throw new Error('Please select a payment method.');
    const bookingRef = doc(db, 'bookings', bookingId),
        paymentRef = doc(collection(db, 'payments')),
        txRef = doc(collection(db, 'transactions'));
    const n = Math.round(Number(amount || 0) * 1000) / 1000;
    if (n <= 0) throw new Error('Payment must be greater than zero.');
    await runTransaction(db, async tx => {
        const snap = await tx.get(bookingRef);
        if (!snap.exists()) throw new Error('Booking not found.');
        const b = snap.data();
        if (b.status === 'cancelled') throw new Error('Cancelled bookings cannot receive payments.');
        const total = Number(b.totalAmount || b.slotPrice || 0),
            paid = Number(b.paidAmount || 0);
        if (paid + n > total) throw new Error('Payment exceeds the remaining due.');
        const now = serverTimestamp(),
            newPaid = paid + n;
        tx.update(bookingRef, { paidAmount: newPaid, advanceAmount: Number(b.advanceAmount || 0), remainingAmount: total - newPaid, dueAmount: total - newPaid, updatedAt: now, updatedBy: actor.actorUid, updatedByEmail: actor.actorEmail });
        tx.set(paymentRef, { bookingId, amount: n, paymentMethod: method, paymentDate: String(paymentDate || b.sessionDate), note: String(note || ''), transactionId: String(transactionId || ''), createdAt: now, createdBy: auth.currentUser.uid, recordedByUid: actor.actorUid, recordedByName: actor.actorName, recordedByEmail: actor.actorEmail });
        tx.set(txRef, { type: 'income', amount: n, category: 'Booking payment', referenceId: bookingId, description: `Payment for booking ${bookingId}`, date: String(paymentDate || b.sessionDate), transactionId: String(transactionId || ''), createdAt: now, createdBy: auth.currentUser.uid, recordedByUid: actor.actorUid, recordedByName: actor.actorName, recordedByEmail: actor.actorEmail, paymentMethod: method });
    });
    await logAdminActivity({
        action: 'payment_recorded',
        targetType: 'booking',
        targetId: bookingId,
        description: `${actor.actorName} recorded a payment`,
        metadata: { amount: n, paymentMethod: method, transactionId: String(transactionId || '') }
    });
}

async function cancelBookingClient(bookingId) {
    const actor = await getCurrentAdminActor();
    const bookingRef = doc(db, 'bookings', bookingId);
    let snapshotData = null;
    await runTransaction(db, async tx => {
        const snap = await tx.get(bookingRef);
        if (!snap.exists()) throw new Error('Booking not found.');
        const b = snap.data();
        if (b.status === 'cancelled') throw new Error('This booking is already cancelled.');
        if (b.status !== 'confirmed') throw new Error(`Only confirmed bookings can be cancelled.`);
        snapshotData = b;
        const now = serverTimestamp();
        tx.update(bookingRef, {
            status: 'cancelled',
            updatedAt: now,
            cancelledAt: now,
            cancelledBy: actor.actorUid,
            cancelledByEmail: actor.actorEmail,
            cancelledByName: actor.actorName
        });
        if (b.slotKey) tx.delete(doc(db, 'slotLocks', b.slotKey));
    });
    await logAdminActivity({
        action: 'booking_cancelled',
        targetType: 'booking',
        targetId: bookingId,
        description: `${actor.actorName} cancelled confirmed booking for ${(snapshotData && snapshotData.customerName) || 'Customer'}`,
        metadata: { customerName: snapshotData?.customerName || '', sessionDate: snapshotData?.sessionDate || snapshotData?.date || '', slotStart: snapshotData?.slotStart || '', slotEnd: snapshotData?.slotEnd || '' }
    });
}


export { createBookingClient, confirmBookingClient, rejectBookingClient, createManualBookingClient, recordPaymentClient, cancelBookingClient };