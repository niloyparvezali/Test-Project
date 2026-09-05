import { auth, db } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseFunctions';
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
    try {
        return (await httpsCallable(functions, 'createPublicBooking')({
            slot: { key: slot?.key, date: slot?.date, start: slot?.start, duration: slot?.duration, shift: slot?.shift },
            customerName: form?.customerName, phone: form?.phone, paymentMethod: form?.paymentMethod,
            sendMoneyNumber: form?.sendMoneyNumber, transactionId: form?.transactionId
        })).data;
    } catch (error) {
        throw new Error(error?.message || 'Booking request failed. Please try again.');
    }
}

async function confirmBookingClient(booking) {
    if (!auth.currentUser) throw new Error('Admin session expired. Please sign in again.');
    const bookingId = String(booking?.id || '').trim();
    if (!bookingId) throw new Error('Booking request is required.');
    try {
        await httpsCallable(functions, 'acceptBooking')({ bookingId });
    } catch (error) {
        throw new Error(error?.message || 'Could not confirm this booking request.');
    }
}

async function rejectBookingClient(booking, reason = '') {
    if (!auth.currentUser) throw new Error('Admin session expired. Please sign in again.');
    const bookingId = String(booking?.id || '').trim();
    const cleanReason = String(reason || '').trim();
    if (!bookingId) throw new Error('Booking request is required.');
    if (!cleanReason) throw new Error('A rejection reason is required.');
    try {
        await httpsCallable(functions, 'rejectBooking')({ bookingId, reason: cleanReason });
    } catch (error) {
        throw new Error(error?.message || 'Could not reject this booking request.');
    }
}


async function createManualBookingClient({ slot, customerName, phone, adminNote, advanceAmount }) {
    if (!auth.currentUser) throw new Error('Admin session expired. Please sign in again.');
    try {
        await httpsCallable(functions, 'createManualBooking')({
            slot: { key: slot?.key, date: slot?.date, start: slot?.start, duration: slot?.duration, shift: slot?.shift },
            customerName, phone, adminNote, advanceAmount
        });
    } catch (error) {
        throw new Error(error?.message || 'Could not create the manual booking.');
    }
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