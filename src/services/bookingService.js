import { auth, db } from '../firebase';
import {
    collection,
    doc,
    getDoc,
    runTransaction,
    serverTimestamp
} from 'firebase/firestore';
import { addM, displayDate, localDate, mins, timeLabel, validDateInput } from '../utils/dateUtils';
import { generateSlots, slotPriceFromPricing, requiredAdvanceFromSettings } from '../utils/slotUtils';
import { getCurrentAdminActor, logAdminActivity } from './adminActivityService';
const money = n => `৳${Number(n||0).toLocaleString('en-BD',{maximumFractionDigits:3})}`;

async function createBookingClient(slot, form, turf = {}) {
    const customerName = String(form?.customerName || '').trim();
    const phone = String(form?.phone || '').trim();
    const paymentMethod = String(form?.paymentMethod || '').trim();
    const sendMoneyNumber = String(form?.sendMoneyNumber || '').trim();
    const transactionId = String(form?.transactionId || '').trim();

    if (customerName.length < 2) throw new Error('Please enter your name.');
    if (phone.length < 5) throw new Error('Please enter a valid phone number.');
    if (!['bKash', 'Nagad', 'Rocket'].includes(paymentMethod)) throw new Error('Please select a payment method.');
    if (sendMoneyNumber.length < 5) throw new Error('Please enter your send money number.');
    if (transactionId.length < 5) throw new Error('Please enter your transaction ID.');

    const [settingsSnap, pricingSnap, turfSnap] = await Promise.all([
        getDoc(doc(db, 'settings', 'config')),
        getDoc(doc(db, 'pricing', 'current')),
        getDoc(doc(db, 'turf', 'main'))
    ]);

    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const pricing = pricingSnap.exists() ? pricingSnap.data() : {};
    const turfData = turfSnap.exists() ? turfSnap.data() : turf || {};
    const requestedKey = String(slot?.key || '').trim();
    const date = String(slot?.date || '').trim();
    const start = String(slot?.start || '').trim();
    const duration = Number(slot?.duration || settings?.slotDuration);

    const validSlots = generateSlots(date, settings);
    const selected = validSlots.find(s => s.key === requestedKey && s.start === start && Number(s.duration) === duration);
    if (!selected) throw new Error('This slot is no longer valid. Please select it again.');

    const price = Number(slotPriceFromPricing(selected, pricing, settings) || 0);
    if (price <= 0) throw new Error('This slot does not have a configured price.');

    const requiredAdvance = Number(requiredAdvanceFromSettings(price, settings) || 0);
    if (requiredAdvance <= 0) throw new Error('The required booking advance is not configured.');

    const receiverMap = {
        bKash: turfData?.bkashNumber,
        Nagad: turfData?.nagadNumber,
        Rocket: turfData?.rocketNumber
    };
    const receiverNumber = String(receiverMap[paymentMethod] || '').trim();
    if (!receiverNumber) throw new Error(`${paymentMethod} payment number is not configured.`);

    const bookingRef = doc(collection(db, 'bookings'));
    const lockRef = doc(db, 'slotLocks', selected.key);
    const endDate = selected.endDate || selected.date;
    const now = serverTimestamp();
    const remainingAmount = price - requiredAdvance;

    await runTransaction(db, async tx => {
        const lockSnap = await tx.get(lockRef);
        if (lockSnap.exists()) {
            const status = lockSnap.data()?.status;
            if (status === 'booked' || status === 'pending_payment_verification') {
                throw new Error('That slot is no longer available. Please choose another slot.');
            }
        }

        tx.set(lockRef, {
            status: 'pending_payment_verification',
            slotKey: selected.key,
            sessionDate: selected.date,
            slotStart: selected.start,
            slotEnd: selected.end,
            slotStartDate: selected.startDate,
            slotEndDate: endDate,
            slotStartDateTime: selected.startDateTime,
            slotEndDateTime: selected.endDateTime,
            duration: selected.duration,
            shift: selected.shift,
            expiresAt: null
        });

        tx.set(bookingRef, {
            customerName,
            phone,
            date: selected.date,
            sessionDate: selected.date,
            slotStart: selected.start,
            slotEnd: selected.end,
            slotStartDate: selected.startDate,
            slotEndDate: endDate,
            slotStartDateTime: selected.startDateTime,
            slotEndDateTime: selected.endDateTime,
            duration: selected.duration,
            shift: selected.shift,
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
            paymentAmount: requiredAdvance,
            status: 'pending_payment_verification',
            slotKey: selected.key,
            createdBy: 'public',
            bookingType: 'public_payment_request',
            createdAt: now,
            updatedAt: now,
            expiresAt: null,
            verificationStatus: 'pending'
        });
    });

    return {
        bookingId: bookingRef.id,
        slotEnd: selected.end,
        slotPrice: price,
        advanceAmount: requiredAdvance,
        remainingAmount,
        transactionId,
        status: 'pending_payment_verification',
        paymentMethod,
        paymentAmount: requiredAdvance
    };
}

async function confirmBookingClient(booking) {
    const actor = await getCurrentAdminActor();
    const bookingId = String(booking?.id || '').trim();
    if (!bookingId) throw new Error('Booking request is required.');

    const bookingRef = doc(db, 'bookings', bookingId);
    let accepted = null;

    await runTransaction(db, async tx => {
        const bookingSnap = await tx.get(bookingRef);
        if (!bookingSnap.exists()) throw new Error('Booking request no longer exists.');
        const b = bookingSnap.data() || {};
        if (b.status !== 'pending_payment_verification') throw new Error(`This request is already ${b.status || 'handled'}.`);

        const slotKey = String(b.slotKey || '').trim();
        const txnId = String(b.transactionId || '').trim();
        if (!slotKey || !txnId) throw new Error('The booking request is missing slot or transaction information.');

        const lockRef = doc(db, 'slotLocks', slotKey);
        const paymentRef = doc(db, 'payments', `txn_${encodeURIComponent(txnId).slice(0, 300)}`);
        const transactionRef = doc(db, 'transactions', `txn_${encodeURIComponent(txnId).slice(0, 300)}`);
        const activityRef = doc(collection(db, 'adminActivity'));
        const lockSnap = await tx.get(lockRef);
        if (!lockSnap.exists() || lockSnap.data()?.status !== 'pending_payment_verification') throw new Error('The slot lock is no longer active.');
        const paymentSnap = await tx.get(paymentRef);
        if (paymentSnap.exists()) {
            const existingBookingId = String(paymentSnap.data()?.bookingId || '');
            if (existingBookingId !== bookingId) throw new Error('Transaction ID already used by another confirmed payment.');
            throw new Error('This payment has already been recorded.');
        }

        const amount = Number(b.paymentAmount || b.advanceAmount || 0);
        const total = Number(b.totalAmount || b.slotPrice || 0);
        const required = Number(b.advanceAmount || 0);
        if (!Number.isFinite(amount) || amount <= 0 || amount < required || amount > total) throw new Error('The submitted payment amount is not valid for this booking.');

        const now = serverTimestamp();
        const actorName = actor.actorName || actor.actorEmail || 'Administrator';
        const actorEmail = actor.actorEmail || auth.currentUser?.email || '';
        tx.update(bookingRef, {
            status: 'confirmed', paidAmount: amount, remainingAmount: total - amount, dueAmount: total - amount,
            updatedAt: now, reviewedAt: now, verificationStatus: 'accepted', confirmedAt: now, expiresAt: null,
            confirmedBy: actor.actorUid, confirmedByEmail: actorEmail, confirmedByName: actorName
        });
        tx.update(lockRef, { status: 'booked', expiresAt: null, updatedAt: now });
        tx.set(paymentRef, {
            bookingId, amount, paymentMethod: String(b.paymentMethod || 'Other'), note: 'Public booking payment',
            transactionId: txnId, createdAt: now, createdBy: actor.actorUid,
            actor: { uid: actor.actorUid, email: actorEmail, name: actorName }
        });
        tx.set(transactionRef, {
            type: 'income', amount, category: 'Booking payment', referenceId: bookingId,
            description: `Payment for booking ${bookingId}`, transactionId: txnId, createdAt: now,
            createdBy: actor.actorUid, actorUid: actor.actorUid, actorEmail, actorName,
            paymentMethod: String(b.paymentMethod || 'Other')
        });
        tx.set(activityRef, {
            actorUid: actor.actorUid, actorEmail, actorName, action: 'booking_confirmed',
            targetType: 'booking', targetId: bookingId,
            description: `${actorName} accepted the booking request for ${b.customerName || 'Customer'}`,
            metadata: { customerName: b.customerName || '', sessionDate: b.sessionDate || b.date || '', slotStart: b.slotStart || '', slotEnd: b.slotEnd || '' },
            createdAt: now
        });
        accepted = { bookingId, amount };
    });

    return accepted;
}

async function rejectBookingClient(booking, reason = '') {
    const actor = await getCurrentAdminActor();
    const bookingId = String(booking?.id || '').trim();
    const cleanReason = String(reason || '').trim();
    if (!bookingId) throw new Error('Booking request is required.');
    if (!cleanReason) throw new Error('A rejection reason is required.');

    const bookingRef = doc(db, 'bookings', bookingId);
    await runTransaction(db, async tx => {
        const bookingSnap = await tx.get(bookingRef);
        if (!bookingSnap.exists()) throw new Error('Booking request no longer exists.');
        const b = bookingSnap.data() || {};
        if (b.status !== 'pending_payment_verification') throw new Error(`This request is already ${b.status || 'handled'}.`);

        const now = serverTimestamp();
        const actorName = actor.actorName || actor.actorEmail || 'Administrator';
        const actorEmail = actor.actorEmail || auth.currentUser?.email || '';
        const activityRef = doc(collection(db, 'adminActivity'));
        tx.update(bookingRef, {
            status: 'rejected', verificationStatus: 'rejected', rejectionReason: cleanReason,
            reviewedAt: now, updatedAt: now, rejectedBy: actor.actorUid,
            rejectedByEmail: actorEmail, rejectedByName: actorName
        });
        if (b.slotKey) tx.delete(doc(db, 'slotLocks', String(b.slotKey)));
        tx.set(activityRef, {
            actorUid: actor.actorUid, actorEmail, actorName, action: 'booking_rejected',
            targetType: 'booking', targetId: bookingId,
            description: `${actorName} rejected the booking request for ${b.customerName || 'Customer'}`,
            metadata: { customerName: b.customerName || '', sessionDate: b.sessionDate || b.date || '', slotStart: b.slotStart || '', slotEnd: b.slotEnd || '', reason: cleanReason },
            createdAt: now
        });
    });
}

async function createManualBookingClient({ slot, customerName, phone, adminNote, advanceAmount }) {
    const actor = await getCurrentAdminActor();
    const cleanName = String(customerName || '').trim();
    const cleanPhone = String(phone || '').trim();
    const cleanNote = String(adminNote || '').trim();
    const advance = Math.round(Number(advanceAmount || 0) * 1000) / 1000;
    if (cleanName.length < 2) throw new Error('Customer or booking name is required.');
    if (cleanNote.length < 2) throw new Error('Admin note is required.');
    if (!Number.isFinite(advance) || advance < 0) throw new Error('Advance payment must be a valid non-negative amount.');

    const [settingsSnap, pricingSnap] = await Promise.all([
        getDoc(doc(db, 'settings', 'config')),
        getDoc(doc(db, 'pricing', 'current'))
    ]);
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const pricing = pricingSnap.exists() ? pricingSnap.data() : {};
    const date = String(slot?.date || '').trim();
    const requestedKey = String(slot?.key || '').trim();
    const duration = Number(slot?.duration || settings?.slotDuration);
    const validSlots = generateSlots(date, settings);
    const selected = validSlots.find(s => s.key === requestedKey && Number(s.duration) === duration);
    if (!selected) throw new Error('This slot is no longer valid. Please select it again.');

    const price = Number(slotPriceFromPricing(selected, pricing, settings) || 0);
    if (price <= 0) throw new Error('Pricing is not configured for this slot.');
    if (advance > price) throw new Error('Advance cannot be greater than the total amount.');

    const bookingRef = doc(collection(db, 'bookings'));
    const lockRef = doc(db, 'slotLocks', selected.key);
    const now = serverTimestamp();
    const endDate = selected.endDate || selected.date;
    const actorName = actor.actorName || actor.actorEmail || 'Administrator';
    const actorEmail = actor.actorEmail || auth.currentUser?.email || '';

    await runTransaction(db, async tx => {
        const lockSnap = await tx.get(lockRef);
        if (lockSnap.exists()) {
            const status = lockSnap.data()?.status;
            if (status === 'booked') throw new Error('That slot is already booked.');
            if (status === 'pending_payment_verification') throw new Error('That slot is currently reserved by a payment request.');
        }

        const fullNote = `${selected.date} · ${selected.start}–${selected.end} · ${cleanNote}`;
        tx.set(lockRef, {
            status: 'booked',
            slotKey: selected.key,
            sessionDate: selected.date,
            slotStart: selected.start,
            slotEnd: selected.end,
            slotStartDate: selected.startDate,
            slotEndDate: endDate,
            slotStartDateTime: selected.startDateTime,
            slotEndDateTime: selected.endDateTime,
            duration: selected.duration,
            shift: selected.shift,
            expiresAt: null,
            updatedAt: now
        });

        tx.set(bookingRef, {
            customerName: cleanName,
            phone: cleanPhone,
            date: selected.date,
            sessionDate: selected.date,
            slotStart: selected.start,
            slotEnd: selected.end,
            duration: selected.duration,
            shift: selected.shift,
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
            slotKey: selected.key,
            createdBy: actor.actorUid,
            bookingType: 'manual_admin',
            bookingSource: 'admin',
            adminNote: fullNote,
            createdAt: now,
            updatedAt: now,
            expiresAt: null,
            confirmedAt: now,
            createdByEmail: actorEmail,
            createdByName: actorName,
            confirmedBy: actor.actorUid,
            confirmedByEmail: actorEmail,
            confirmedByName: actorName
        });

        if (advance > 0) {
            const paymentRef = doc(collection(db, 'payments'));
            const transactionRef = doc(collection(db, 'transactions'));
            tx.set(paymentRef, {
                bookingId: bookingRef.id,
                amount: advance,
                paymentMethod: 'Manual',
                note: 'Manual booking advance payment',
                transactionId: '',
                createdAt: now,
                createdBy: actor.actorUid,
                recordedByUid: actor.actorUid,
                recordedByName: actorName,
                recordedByEmail: actorEmail
            });
            tx.set(transactionRef, {
                type: 'income',
                amount: advance,
                category: 'Booking payment',
                referenceId: bookingRef.id,
                description: `Advance payment for manual booking ${bookingRef.id}`,
                transactionId: '',
                createdAt: now,
                createdBy: actor.actorUid,
                recordedByUid: actor.actorUid,
                recordedByName: actorName,
                recordedByEmail: actorEmail,
                paymentMethod: 'Manual'
            });
        }

        const activityRef = doc(collection(db, 'adminActivity'));
        tx.set(activityRef, {
            actorUid: actor.actorUid,
            actorEmail,
            actorName,
            action: 'manual_booking_created',
            targetType: 'booking',
            targetId: bookingRef.id,
            description: `${actorName} created manual booking for ${cleanName}`,
            metadata: {
                customerName: cleanName,
                sessionDate: selected.date,
                slotStart: selected.start,
                slotEnd: selected.end,
                advance
            },
            createdAt: now
        });
    });

    return {
        bookingId: bookingRef.id,
        slotKey: selected.key,
        totalAmount: price,
        paidAmount: advance,
        dueAmount: price - advance
    };
}

async function recordPaymentClient({ bookingId, amount, paymentMethod, note, transactionId }) {
    const actor = await getCurrentAdminActor();
    const method = String(paymentMethod || '').trim();
    if (!['Cash', 'bKash', 'Nagad', 'Rocket'].includes(method)) throw new Error('Please select a payment method.');
    const bookingRef = doc(db, 'bookings', bookingId);
    const cleanTransactionId = String(transactionId || '').trim();
    const paymentRef = cleanTransactionId
        ? doc(db, 'payments', `txn_${encodeURIComponent(cleanTransactionId).slice(0,300)}`)
        : doc(collection(db, 'payments'));
    const txRef = cleanTransactionId
        ? doc(db, 'transactions', `txn_${encodeURIComponent(cleanTransactionId).slice(0,300)}`)
        : doc(collection(db, 'transactions'));
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
        const cleanTransactionId = String(transactionId || '').trim();
        const paymentCheck = cleanTransactionId ? await tx.get(paymentRef) : null;
        if (paymentCheck?.exists()) {
            throw new Error('Transaction ID has already been recorded.');
        }
        tx.set(paymentRef, { bookingId, amount: n, paymentMethod: method, note: String(note || ''), transactionId: String(transactionId || ''), createdAt: now, createdBy: auth.currentUser.uid, recordedByUid: actor.actorUid, recordedByName: actor.actorName, recordedByEmail: actor.actorEmail });
        tx.set(txRef, { type: 'income', amount: n, category: 'Booking payment', referenceId: bookingId, description: `Payment for booking ${bookingId}`, transactionId: String(transactionId || ''), createdAt: now, createdBy: auth.currentUser.uid, recordedByUid: actor.actorUid, recordedByName: actor.actorName, recordedByEmail: actor.actorEmail, paymentMethod: method });
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