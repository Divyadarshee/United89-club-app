// 1. Club Lounge Tour (Home / Welcome page)
export const LOUNGE_STEPS = [
    {
        targetId: 'tour-profile',
        title: 'Your Profile & Identity',
        icon: '👤',
        description: 'Tap your circular avatar anytime to open your personal menu. View your certificates, play your 2026 Wrapped story reel, or update your profile photo.',
    },
    {
        targetId: 'tour-quiz-challenge',
        title: 'Weekly Quiz Challenge',
        icon: '⏱️',
        description: 'Each week brings a brand-new quiz challenge. Test your speed and accuracy against the clock to climb the alumni ranks!',
    },
    {
        targetId: 'tour-season-finale',
        title: '2026 Grand Finale (2 Experiences)',
        icon: '🏆',
        description: 'Relive the full 40-week journey! (1) 🎬 Personal Wrapped Story: your personalized 6-slide recap with attendance, records & certificate. (2) 🌍 Club-Wide Rewind: batch trivia records, rituals, and toughest stumpers!',
        fallbackId: 'tour-leaderboard',
    },
    {
        targetId: 'tour-leaderboard',
        title: 'Hall of Fame & Leaderboard',
        icon: '🎖️',
        description: 'Check out weekly champions, fastest buzzer-beater times, club stumper-solvers, and see where you rank among all 49 batch contenders.',
    },
    {
        targetId: 'tour-sound-toggle',
        title: 'Sound & Regional Melodies',
        icon: '🎵',
        description: 'Enjoy authentic regional background tunes (Rath Yatra, patriotic themes) and game sounds. Toggle audio on or off anytime with this button.',
    },
];

// 2. Admin Console Tour (/admin/dashboard)
export const ADMIN_STEPS = [
    {
        targetId: 'tour-admin-week',
        title: 'Active Week & ISO Archives',
        icon: '📅',
        description: 'Select the active week to manage questions and inspect submissions. Past weeks are automatically archive-protected so historical scores stay preserved.',
    },
    {
        targetId: 'tour-admin-quiz-toggle',
        title: 'Quiz Active Switch',
        icon: '⚡',
        description: 'Toggle the quiz ON or OFF with a single tap. When active, members can take the quiz; when paused, submissions are temporarily held.',
        fallbackId: 'tour-admin-tabs',
    },
    {
        targetId: 'tour-admin-timer-count',
        title: 'Timer & Question Count',
        icon: '⏱️',
        description: 'Configure the challenge clock duration (in minutes) and target question count (e.g. 10 or 20 questions) for upcoming challenges.',
        fallbackId: 'tour-admin-tabs',
    },
    {
        targetId: 'tour-admin-ai-btn',
        title: 'Gemini AI Quiz Generation',
        icon: '✨',
        description: 'Generate trending topics with Gemini AI, or craft full multiple-choice questions with verified correct answers in seconds.',
        fallbackId: 'tour-admin-tabs',
    },
    {
        targetId: 'tour-admin-tabs',
        title: 'Leaderboard & Tester Audit',
        icon: '👥',
        description: 'Review live member submissions, inspect submitted answers question-by-question, and reset submissions for tester phone numbers.',
    },
];

// 3. Profile & Certificates Tour (/profile)
export const PROFILE_STEPS = [
    {
        targetId: 'tour-profile-avatar',
        title: 'Profile Photo & Club Icon',
        icon: '📸',
        description: 'Upload your own alumni photo or pick from one of the official UCE89 club icons (Scholar, Lion, Quiz Master, Star).',
    },
    {
        targetId: 'tour-profile-tabs',
        title: '3 Subcategories: Details, Awards, Stats',
        icon: '🎖️',
        description: 'Switch between editing personal details, viewing official 2026 Season Finale awards and downloadable certificates, or analyzing your 40-week quiz journey.',
    },
];

// 4. Season Rewind Tour (/rewind)
export const REWIND_STEPS = [
    {
        targetId: 'tour-rewind-tabs',
        title: '3 Season Finale Experiences',
        icon: '🌍',
        description: 'Explore 3 tabs: (1) 2026 Highlights & Rituals, (2) Hall of Fame & Tough Stumpers, and (3) Your Personal Showcase & high-res certificates!',
    },
];

export function getStepsForRoute(pathname) {
    if (pathname && pathname.startsWith('/admin')) {
        return ADMIN_STEPS;
    }
    if (pathname === '/profile') {
        return PROFILE_STEPS;
    }
    if (pathname === '/rewind') {
        return REWIND_STEPS;
    }
    return LOUNGE_STEPS;
}
