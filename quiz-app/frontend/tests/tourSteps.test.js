import test from 'node:test';
import assert from 'node:assert/strict';
import { 
    LOUNGE_STEPS, 
    ADMIN_STEPS, 
    PROFILE_STEPS, 
    REWIND_STEPS, 
    getStepsForRoute 
} from '../src/data/tourSteps.js';

test('all tour suites exist and have well-formed steps', () => {
    const suites = [
        { name: 'LOUNGE_STEPS', steps: LOUNGE_STEPS, minCount: 4 },
        { name: 'ADMIN_STEPS', steps: ADMIN_STEPS, minCount: 4 },
        { name: 'PROFILE_STEPS', steps: PROFILE_STEPS, minCount: 2 },
        { name: 'REWIND_STEPS', steps: REWIND_STEPS, minCount: 1 },
    ];

    for (const { name, steps, minCount } of suites) {
        assert.ok(Array.isArray(steps), `${name} must be an array`);
        assert.ok(steps.length >= minCount, `${name} must have at least ${minCount} steps`);

        for (const step of steps) {
            assert.ok(step.targetId && typeof step.targetId === 'string', `${name} step missing valid targetId`);
            assert.ok(step.title && typeof step.title === 'string', `${name} step missing valid title`);
            assert.ok(step.description && typeof step.description === 'string', `${name} step missing valid description`);
            assert.ok(step.icon && typeof step.icon === 'string', `${name} step missing valid icon`);
        }
    }
});

test('getStepsForRoute accurately routes each page to its dedicated tour suite', () => {
    assert.equal(getStepsForRoute('/admin'), ADMIN_STEPS);
    assert.equal(getStepsForRoute('/admin/dashboard'), ADMIN_STEPS);
    assert.equal(getStepsForRoute('/profile'), PROFILE_STEPS);
    assert.equal(getStepsForRoute('/rewind'), REWIND_STEPS);
    assert.equal(getStepsForRoute('/welcome'), LOUNGE_STEPS);
    assert.equal(getStepsForRoute('/'), LOUNGE_STEPS);
});

test('tour descriptions remain generic and do NOT hardcode rigid question counts', () => {
    const allSteps = [...LOUNGE_STEPS, ...ADMIN_STEPS, ...PROFILE_STEPS, ...REWIND_STEPS];
    
    for (const step of allSteps) {
        const text = `${step.title} ${step.description}`.toLowerCase();
        // Rigid hardcoded count phrases that break when questions change to 20
        assert.equal(
            text.includes('answer all 10 questions'),
            false,
            `Step '${step.title}' contains rigid 'answer all 10 questions'`
        );
        assert.equal(
            text.includes('10-minute clock'),
            false,
            `Step '${step.title}' contains rigid '10-minute clock'`
        );
    }
});

test('grand finale step explains both distinct experiences: Personal Wrapped and Club Rewind', () => {
    const finaleStep = LOUNGE_STEPS.find(s => s.targetId === 'tour-season-finale');
    assert.ok(finaleStep, 'Lounge steps must contain a Grand Finale tour step');

    const desc = finaleStep.description.toLowerCase();
    assert.ok(desc.includes('personal wrapped'), 'Finale tour step must mention Personal Wrapped Story');
    assert.ok(desc.includes('club-wide rewind') || desc.includes('club rewind'), 'Finale tour step must mention Club Rewind');
});

test('admin tour steps include Quiz Active toggle and Question Count / Timer duration settings', () => {
    const toggleStep = ADMIN_STEPS.find(s => s.targetId === 'tour-admin-quiz-toggle');
    assert.ok(toggleStep, 'Admin steps must contain a Quiz Active toggle step');

    const timerCountStep = ADMIN_STEPS.find(s => s.targetId === 'tour-admin-timer-count');
    assert.ok(timerCountStep, 'Admin steps must contain Timer & Question Count step');
    assert.ok(timerCountStep.description.toLowerCase().includes('question count'));
});
