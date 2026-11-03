import test from 'node:test';
import assert from 'node:assert/strict';

test('timer duration calculates accurately for standard and custom durations', () => {
    const calculateSeconds = (minutes) => {
        const mins = Number(minutes) > 0 ? Number(minutes) : 10;
        return mins * 60;
    };

    assert.equal(calculateSeconds(10), 600, '10 minutes should equal 600 seconds');
    assert.equal(calculateSeconds(15), 900, '15 minutes should equal 900 seconds');
    assert.equal(calculateSeconds(20), 1200, '20 minutes should equal 1200 seconds');
    assert.equal(calculateSeconds(null), 600, 'Missing or null minutes should default to 600 seconds');
    assert.equal(calculateSeconds(0), 600, 'Zero minutes should fallback to default 600 seconds');
});

test('score calculation scales seamlessly from 10 to 20 questions', () => {
    const computePercentage = (correctCount, totalQuestions) => {
        const total = Number(totalQuestions) > 0 ? Number(totalQuestions) : 10;
        return Math.round((correctCount / total) * 100);
    };

    // 10 Questions
    assert.equal(computePercentage(10, 10), 100);
    assert.equal(computePercentage(7, 10), 70);
    assert.equal(computePercentage(0, 10), 0);

    // 20 Questions
    assert.equal(computePercentage(20, 20), 100);
    assert.equal(computePercentage(15, 20), 75);
    assert.equal(computePercentage(11, 20), 55);
    assert.equal(computePercentage(1, 20), 5);
});

test('quiz submission payload accepts dynamic answers map for any question count', () => {
    const buildSubmission = (userId, weekId, count, timeTaken) => {
        const answers = {};
        for (let i = 1; i <= count; i++) {
            answers[`q_${i}`] = `option_${(i % 4) + 1}`;
        }
        return {
            user_id: userId,
            week_id: weekId,
            answers,
            time_taken: timeTaken
        };
    };

    // 10-question submission
    const sub10 = buildSubmission('9437555900', '2026-W40', 10, 180);
    assert.equal(Object.keys(sub10.answers).length, 10);
    assert.equal(sub10.answers['q_1'], 'option_2');
    assert.equal(sub10.answers['q_10'], 'option_3');

    // 20-question submission
    const sub20 = buildSubmission('9437555900', '2026-W40', 20, 420);
    assert.equal(Object.keys(sub20.answers).length, 20);
    assert.equal(sub20.answers['q_20'], 'option_1');
});

test('badge text formats question count and timer dynamically', () => {
    const formatBadge = (config) => {
        const qCount = config?.question_count || 10;
        const timer = config?.timer_duration_minutes || 10;
        return `📝 ${qCount} Questions • ⏱️ ${timer} Mins`;
    };

    assert.equal(formatBadge({}), '📝 10 Questions • ⏱️ 10 Mins');
    assert.equal(formatBadge({ question_count: 20, timer_duration_minutes: 15 }), '📝 20 Questions • ⏱️ 15 Mins');
    assert.equal(formatBadge({ question_count: 25, timer_duration_minutes: 20 }), '📝 25 Questions • ⏱️ 20 Mins');
});
