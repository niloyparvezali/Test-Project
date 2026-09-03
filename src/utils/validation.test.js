import test from 'node:test';
import assert from 'node:assert/strict';
import {
    sanitizeName,
    sanitizePhone,
    sanitizeSendMoneyNumber,
    sanitizeTransactionId,
    validatePhone,
    validateSendMoneyNumber,
    validateTransactionId,
} from './validation.js';

test('sanitizeName keeps only valid name characters', () => {
    assert.equal(sanitizeName('  John   O\'Connor  '), 'John O\'Connor');
    assert.equal(sanitizeName('Rahim  Uddin'), 'Rahim Uddin');
});

test('phone sanitization and validation are strict', () => {
    assert.equal(sanitizePhone('+880 1712-345678'), '01712345678');
    assert.equal(sanitizePhone('123456789012345'), '12345678901');
    assert.equal(sanitizePhone('01560-0603339999'), '01560060333');
    assert.equal(validatePhone('01712345678'), true);
    assert.equal(validatePhone('0171234567'), false);
    assert.equal(validatePhone('abc123'), false);
});

test('payment fields are sanitized and validated', () => {
    assert.equal(sanitizeSendMoneyNumber('01712ab345678'), '01712345678');
    assert.equal(sanitizeSendMoneyNumber('123456789012345'), '12345678901');
    assert.equal(sanitizeSendMoneyNumber('01560-0603339999'), '01560060333');
    assert.equal(validateSendMoneyNumber('12345678901'), true);
    assert.equal(validateSendMoneyNumber('1234'), false);

    assert.equal(sanitizeTransactionId('tx-12345!!'), 'TX-12345');
    assert.equal(validateTransactionId('TX-12345'), true);
    assert.equal(validateTransactionId('abc'), false);
});