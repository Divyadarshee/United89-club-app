import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSoundManager } from '../hooks/useSoundManager';
import { getConfig } from '../services/api';
import { X, Lock, Trophy } from 'lucide-react';

function Welcome() {
    const [showRules, setShowRules] = useState(false);
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { playSound } = useSoundManager();

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const c = await getConfig();
                setConfig(c);
            } catch (error) {
                console.error("Failed to load config", error);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleStartClick = () => {
        playSound('click');
        const hasSubmitted = localStorage.getItem('has_submitted') === 'true';
        if (hasSubmitted) {
            navigate('/thank-you', { state: { alreadySubmitted: true } });
        } else {
            setShowRules(true);
        }
    };

    const confirmStart = () => {
        playSound('click');
        navigate('/quiz');
    };

    // Determine quiz state
    const isQuizClosed = config && config.quiz_active === false;
    const isLeaderboardActive = config && config.leaderboard_active === true;
    return (
        <div className="relative w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="z-10"
            >
                <h1 className="text-5xl md:text-7xl font-serif text-white mb-4 tracking-wide" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)' }}>
                    United 89
                </h1>
                <p className="text-xl md:text-3xl font-serif italic text-antique-gold mb-12 tracking-widest uppercase" style={{ textShadow: '1px 1px 2px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.5)' }}>
                    Quiz Show
                </p>
                <div className="bg-midnight-blue/40 backdrop-blur-sm p-8 rounded-xl border border-white/10 max-w-lg mx-auto mb-12">
                    <p className="font-sans text-lg text-gray-200 leading-relaxed">
                        Celebrating 35+ years of memories.<br />
                        A fun way to test your General Knowledge!
                    </p>
                </div>

                {/* CONDITIONAL CONTENT BASED ON QUIZ STATE */}
                {loading ? (
                    <div className="text-gray-300 animate-pulse">Loading...</div>
                ) : isQuizClosed && isLeaderboardActive ? (
                    // Quiz closed, leaderboard is active - show results link
                    <div className="bg-midnight-blue/60 backdrop-blur-sm p-8 rounded-xl border border-antique-gold/30 max-w-lg mx-auto">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <Trophy className="text-antique-gold" size={32} />
                            <h2 className="text-2xl font-serif text-white">Quiz Closed</h2>
                        </div>
                        <p className="font-sans text-lg text-gray-200 leading-relaxed mb-6">
                            This week's quiz has ended. The results are now available!
                        </p>
                        <button
                            onClick={() => navigate('/leaderboard')}
                            className="btn-vintage text-xl py-4 px-10 shadow-2xl w-full"
                        >
                            View Results
                        </button>
                    </div>
                ) : isQuizClosed && !isLeaderboardActive ? (
                    // Quiz closed, leaderboard not yet active - coming soon
                    <div className="bg-midnight-blue/60 backdrop-blur-sm p-8 rounded-xl border border-white/10 max-w-lg mx-auto">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <Lock className="text-gray-400" size={28} />
                            <h2 className="text-2xl font-serif text-white">Next Quiz Coming Soon</h2>
                        </div>
                        <p className="font-sans text-lg text-gray-300 leading-relaxed">
                            We're preparing the next challenge. Check back soon!
                        </p>
                    </div>
                ) : (
                    // Quiz is open - normal flow
                    <>
                        <button
                            onClick={handleStartClick}
                            className="btn-vintage text-xl py-4 px-10 shadow-2xl border-white/20 mb-6 w-full md:w-auto"
                        >
                            Start the Challenge
                        </button>

                        <div className="mt-4">
                            <button
                                onClick={() => navigate('/leaderboard')}
                                className="text-antique-gold hover:text-white underline font-serif text-lg tracking-wider transition-colors"
                            >
                                View Leaderboard
                            </button>
                        </div>
                    </>
                )}
            </motion.div>

            {/* Rules Modal */}
            <AnimatePresence>
                {showRules && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 50 }}
                            className="bg-warm-cream w-full max-w-lg rounded-lg shadow-2xl overflow-hidden border-4 border-double border-antique-gold text-left"
                        >
                            <div className="bg-royal-blue p-4 flex justify-between items-center border-b border-antique-gold">
                                <h3 className="text-xl font-serif text-antique-gold italic">Game Rules</h3>
                                <button onClick={() => setShowRules(false)} className="text-white/70 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-8 text-text-charcoal font-serif">
                                <ul className="list-disc pl-6 space-y-4 mb-8 text-lg leading-relaxed marker:text-royal-blue">
                                    <li>There are <strong className="text-royal-blue">10 minutes</strong> on the clock.</li>
                                    <li>Once you start, the clock ticks—no pausing.</li>
                                    <li>Each question has one correct answer.</li>
                                    <li>Most correct answers in the least time is the winner!</li>
                                </ul>
                                <button onClick={confirmStart} className="btn-vintage w-full">
                                    I'm Ready to Play
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Welcome;
