import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { getQuestions, submitAnswers, getConfig } from '../services/api';
import { useSoundManager } from '../hooks/useSoundManager';

function Quiz() {
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [timeLeft, setTimeLeft] = useState(600);
    const [initialTime, setInitialTime] = useState(600);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [startTime, setStartTime] = useState(null);
    const [direction, setDirection] = useState(0);

    const navigate = useNavigate();
    const { playSound, stopSound } = useSoundManager();

    useEffect(() => {
        // Prevent re-entry if already submitted
        if (localStorage.getItem('has_submitted') === 'true') {
            navigate('/thank-you', { replace: true });
            return;
        }

        const fetchData = async () => {
            try {
                const [questionsData, configData] = await Promise.all([
                    getQuestions(),
                    getConfig()
                ]);
                setQuestions(questionsData);
                if (configData.timer_duration_minutes) {
                    const dur = configData.timer_duration_minutes * 60;
                    setTimeLeft(dur);
                    setInitialTime(dur);
                }
            } catch (error) {
                console.error('Failed to load quiz data:', error);
            } finally {
                setLoading(false);
                setStartTime(Date.now());
                playSound('bgm');
            }
        };
        fetchData();
        return () => stopSound('bgm');
    }, []);

    // Prevent back navigation during quiz
    useEffect(() => {
        let isInitialized = false;

        // Push a dummy state to history when quiz starts
        window.history.pushState(null, '', window.location.href);

        // Small delay to ensure we don't catch initial mount triggers
        setTimeout(() => {
            isInitialized = true;
        }, 100);

        const handlePopState = (e) => {
            // Prevent false triggers during initial mount
            if (!isInitialized) {
                window.history.pushState(null, '', window.location.href);
                return;
            }

            // Prevent the navigation
            e.preventDefault();

            // Show confirmation dialog
            const userConfirmed = window.confirm(
                '⚠️ Warning: If you go back, your current answers will be submitted as your final score.\n\nAre you sure you want to leave?'
            );

            if (!userConfirmed) {
                // User wants to stay, push state again to prevent navigation
                window.history.pushState(null, '', window.location.href);
            } else {
                // User confirmed they want to leave - submit their partial answers
                submitQuiz();
            }
        };

        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = 'Your quiz progress will be lost. Are you sure you want to leave?';
            return e.returnValue;
        };

        window.addEventListener('popstate', handlePopState);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('popstate', handlePopState);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [navigate, stopSound]);

    useEffect(() => {
        if (timeLeft <= 0) {
            submitQuiz();
            return;
        }

        if (timeLeft === 10) playSound('ticking');

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [timeLeft]);

    const handleOptionSelect = (questionId, option) => {
        playSound('click');
        setAnswers((prev) => ({
            ...prev,
            [questionId]: option,
        }));
    };

    const handleNext = () => {
        playSound('click');
        setDirection(1);
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            submitQuiz();
        }
    };

    const submitQuiz = async () => {
        if (submitting) return;
        setSubmitting(true);
        stopSound('ticking');
        stopSound('bgm');

        const userId = localStorage.getItem('user_id');
        const duration = Math.round((Date.now() - startTime) / 1000);

        try {
            await submitAnswers(userId, answers, duration);
            localStorage.setItem('has_submitted', 'true');
            navigate('/thank-you');
        } catch (error) {
            console.error('Submission failed:', error);
            alert('Failed to submit. Please try again.');
            setSubmitting(false);
            playSound('bgm');
        }
    };

    // Analog Clock Calculation
    const progress = timeLeft / initialTime;
    const strokeDashoffset = 283 - (283 * progress);

    if (loading) return <div className="text-center font-serif text-antique-gold text-xl">Retrieving Memories...</div>;
    if (questions.length === 0) return <div className="text-center">No questions available.</div>;

    const currentQuestion = questions[currentQuestionIndex];
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    return (
        <div style={{ width: '100%', maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* Header Area */}
            <div className="flex justify-between items-center px-4 bg-black/30 p-2 rounded-lg backdrop-blur-sm border border-white/10">
                <div>
                    <span className="font-serif text-amber-50 italic text-lg tracking-wider drop-shadow-md">Question {currentQuestionIndex + 1} of {questions.length}</span>
                </div>

                {/* Analog Timer Ring */}
                <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90">
                        <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.2)" strokeWidth="4" fill="none" />
                        <circle cx="32" cy="32" r="28" stroke="#c5a059" strokeWidth="4" fill="none"
                            strokeDasharray="176"
                            strokeDashoffset={176 - (176 * progress)}
                            className="transition-all duration-1000 ease-linear"
                        />
                    </svg>
                    <span className={`font-sans font-bold text-sm ${timeLeft < 10 ? 'text-red-400 animate-pulse' : 'text-white'} drop-shadow-md`}>
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                </div>
            </div>

            {/* Question Card */}
            <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                    key={currentQuestion.id}
                    custom={direction}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    className="card-vintage min-h-[400px] flex flex-col justify-between"
                >
                    <div className="mb-8">
                        <h2 className="text-2xl md:text-3xl font-serif text-white mb-6 leading-relaxed drop-shadow-md">
                            <span className="text-antique-gold mr-3">Q{currentQuestionIndex + 1}.</span>
                            {questions[currentQuestionIndex].text}
                        </h2>

                        <div className="grid gap-4">
                            {questions[currentQuestionIndex].options.map((option, index) => (
                                <motion.button
                                    key={index}
                                    whileHover={{ scale: 1.02, x: 5 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleOptionSelect(currentQuestion.id, option)}
                                    className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 font-sans text-lg shadow-sm
                                        ${answers[currentQuestion.id] === option
                                            ? 'bg-royal-blue text-white border-royal-blue shadow-md'
                                            : 'bg-white/95 text-gray-900 border-white/20 hover:border-antique-gold hover:bg-white'
                                        }
                                    `}
                                >
                                    <span className="inline-block w-8 font-bold text-antique-gold">{String.fromCharCode(65 + index)}.</span>
                                    {option}
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end mt-8">
                        <button
                            onClick={handleNext}
                            disabled={!answers[currentQuestion.id]}
                            className="btn-vintage flex items-center gap-2"
                        >
                            {isLastQuestion ? 'Finish' : 'Next'} <ArrowRight size={18} />
                        </button>
                    </div>

                </motion.div>
            </AnimatePresence>
        </div>
    );
}

export default Quiz;
