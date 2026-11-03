import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, isFinaleAdmin, isFinaleUnlocked } from '../src/utils/featureFlags.js';

test('normalizePhone handles all standard Indian phone formats', () => {
    assert.equal(normalizePhone('9437555900'), '9437555900');
    assert.equal(normalizePhone('+91 94375 55900'), '9437555900');
    assert.equal(normalizePhone('+919437555900'), '9437555900');
    assert.equal(normalizePhone('+91-94375-55900'), '9437555900');
    assert.equal(normalizePhone('(0) 94375 55900'), '09437555900');
    assert.equal(normalizePhone('919437555900'), '9437555900');
    assert.equal(normalizePhone(''), '');
    assert.equal(normalizePhone(null), '');
    assert.equal(normalizePhone(undefined), '');
});

test('isFinaleAdmin recognizes designated admin phone number across variations', () => {
    // Admin by phone number
    assert.equal(isFinaleAdmin({ phone: '9437555900' }), true);
    assert.equal(isFinaleAdmin({ phone: '+91 94375 55900' }), true);
    assert.equal(isFinaleAdmin({ phone: '+91-94375-55900' }), true);
    assert.equal(isFinaleAdmin({ user_id: '9437555900' }), true);

    // Admin by explicit role
    assert.equal(isFinaleAdmin({ role: 'admin', phone: '9876543210' }), true);

    // Regular member is not admin
    assert.equal(isFinaleAdmin({ phone: '9876543210' }), false);
    assert.equal(isFinaleAdmin({ phone: '+91 98765 43210' }), false);
    assert.equal(isFinaleAdmin(null), false);
});

test('isFinaleUnlocked grants access based on public mode, admin, and tester list', () => {
    const regularUser = { phone: '9876543210' };
    const testerUser = { phone: '9123456780' };
    const adminUser = { phone: '+91 94375 55900' };

    // Mode 1: Public mode unlocks for everyone
    const publicConfig = { finale_mode: 'public', tester_phones: [] };
    assert.equal(isFinaleUnlocked(regularUser, publicConfig), true);
    assert.equal(isFinaleUnlocked(adminUser, publicConfig), true);

    // Mode 2: Testers-only mode unlocks for admin and registered testers, but blocks regular members
    const restrictedConfig = {
        finale_mode: 'testers_only',
        tester_phones: ['+91 91234 56780']
    };
    assert.equal(isFinaleUnlocked(adminUser, restrictedConfig), true, 'Admin must always have access');
    assert.equal(isFinaleUnlocked(testerUser, restrictedConfig), true, 'Tester in whitelist must have access');
    assert.equal(isFinaleUnlocked(regularUser, restrictedConfig), false, 'Unwhitelisted member must be blocked');
});
