export function normalizePhone(p) {
    if (!p) return '';
    let digits = String(p).replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
    return digits;
}

/**
 * Checks if the 2026 Season Finale Showcase is unlocked for the current user.
 * - If config.finale_mode === 'public', unlocked for all members.
 * - Otherwise (default: 'testers_only'), only unlocked for admin (9437555900) or numbers in config.tester_phones.
 */
export function isFinaleUnlocked(user, config) {
    if (config?.finale_mode === 'public') {
        return true;
    }

    const phone = user?.phone || localStorage.getItem('user_id') || '';
    const norm = normalizePhone(phone);

    // Admin always has access
    if (norm === '9437555900' || localStorage.getItem('admin_auth') === 'true') {
        return true;
    }

    // Check tester phones
    const testerPhones = config?.tester_phones || [];
    if (testerPhones.some((tp) => normalizePhone(tp) === norm)) {
        return true;
    }

    return false;
}

/**
 * Checks if current user is the root finale admin (9437555900)
 */
export function isFinaleAdmin(user) {
    if (user?.role === 'admin') return true;
    const phone = user?.phone || user?.user_id || localStorage.getItem('user_id') || '';
    const norm = normalizePhone(phone);
    return norm === '9437555900' || localStorage.getItem('admin_auth') === 'true';
}
