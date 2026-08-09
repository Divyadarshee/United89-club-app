import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSoundManager } from '../hooks/useSoundManager';
import { getConfig } from '../services/api';
import { X, Lock, Trophy } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { JagannathEyes, AshokChakra } from '../components/ThemedIcons';

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
    const { activeTheme } = useConfig();

    return (
        <div className="relative w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="z-10"
            >
                {activeTheme !== 'default' && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ 
                            opacity: 1, 
                            y: [0, -8, 0] 
                        }}
                        transition={{ 
                            opacity: { duration: 1 },
                            y: { repeat: Infinity, duration: 4, ease: "easeInOut" }
                        }}
                        className="mb-4 flex flex-col items-center gap-2 justify-center"
                    >
                        {activeTheme === 'rath_yatra' && <JagannathEyes size={80} />}
                        {activeTheme === 'independence_day' && <AshokChakra size={80} />}
                        <span className={`px-3 py-1 font-serif font-extrabold text-[10px] sm:text-xs uppercase tracking-widest rounded-full shadow-md border border-antique-gold/30 ${
                            activeTheme === 'independence_day'
                                ? 'bg-orange-600 text-white'
                                : 'bg-emerald-700 text-white'
                        }`}>
                            {activeTheme === 'rath_yatra' && 'Rath Yatra Special'}
                            {activeTheme === 'independence_day' && 'Independence Day Special'}
                        </span>
                    </motion.div>
                )}
                <h1 className="text-5xl md:text-7xl font-serif text-white mb-4 tracking-wide" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(0,0,0,0.5)' }}>
                    UCE
                </h1>
                {activeTheme === 'independence_day' ? (
                    <p className="text-xl md:text-3xl font-serif italic font-extrabold mb-8 tracking-widest uppercase bg-gradient-to-r from-orange-400 via-white to-emerald-400 bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                        Ultimate Challenge Experience
                    </p>
                ) : (
                    <p className="text-xl md:text-3xl font-serif italic text-antique-gold mb-8 tracking-widest uppercase" style={{ textShadow: '1px 1px 2px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.5)' }}>
                        Ultimate Challenge Experience
                    </p>
                )}
                {activeTheme === 'rath_yatra' && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-10 flex justify-center"
                    >
                        <div className="px-6 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-antique-gold/30 shadow-lg">
                            <p className="text-2xl md:text-3xl font-serif text-white tracking-widest font-bold">
                                ଜୟ ଜଗନ୍ନାଥ
                            </p>
                        </div>
                    </motion.div>
                )}
                {activeTheme === 'independence_day' && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-10 flex justify-center"
                    >
                        <div className="px-6 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-antique-gold/30 shadow-lg">
                            <p className="text-2xl md:text-3xl font-serif text-white tracking-widest font-bold">
                                जय हिन्द 🇮🇳
                            </p>
                        </div>
                    </motion.div>
                )}
                <div className="card-vintage max-w-lg mx-auto mb-12">
                    <p className="font-sans text-lg text-gray-200 leading-relaxed">
                        Test your knowledge and compete!<br />
                        A fun way to challenge your General Knowledge.
                    </p>
                </div>

                {/* CONDITIONAL CONTENT BASED ON QUIZ STATE */}
                {loading ? (
                    <div className="text-gray-300 animate-pulse">Loading...</div>
                ) : isQuizClosed && isLeaderboardActive ? (
                    // Quiz closed, leaderboard is active - show results link
                    <div className="card-vintage max-w-lg mx-auto">
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
                    <div className="card-vintage max-w-lg mx-auto">
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
                            className={activeTheme === 'independence_day'
                                ? "text-xl py-4 px-10 mb-6 w-full md:w-auto bg-gradient-to-r from-orange-500 via-white to-emerald-600 hover:from-orange-400 hover:to-emerald-500 text-[#000080] font-serif font-black rounded-lg shadow-2xl border-2 border-blue-950/40 transform hover:-translate-y-0.5 transition-all duration-200"
                                : "btn-vintage text-xl py-4 px-10 shadow-2xl border-white/20 mb-6 w-full md:w-auto"
                            }
                        >
                            {activeTheme === 'independence_day' ? 'Unfurl the Freedom Challenge 🇮🇳' : 'Start the Challenge'}
                        </button>

                        <div className="mt-4">
                            {localStorage.getItem('has_submitted') === 'true' ? (
                                <button
                                    onClick={() => navigate('/leaderboard')}
                                    className="text-antique-gold hover:text-white underline font-serif text-lg tracking-wider transition-colors"
                                >
                                    View Leaderboard
                                </button>
                            ) : (
                                <div className="flex items-center justify-center gap-2 text-gray-400 font-serif text-base tracking-wide">
                                    <Lock size={16} />
                                    <span>Submit quiz to unlock leaderboard</span>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </motion.div>

            {/* Version indicator for testing */}
            <p className="absolute bottom-4 right-4 text-xs text-gray-500/50 font-mono">v1.0.1-uce</p>

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
                                <h3 className="text-xl font-serif text-antique-gold italic">
                                    {activeTheme === 'rath_yatra' ? 'Rath Yatra Special Rules' : activeTheme === 'independence_day' ? 'Independence Day Challenge Rules' : 'Game Rules'}
                                </h3>
                                <button onClick={() => setShowRules(false)} className="text-white/70 hover:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-8 text-text-charcoal font-serif">
                                <ul className="list-disc pl-6 space-y-4 mb-8 text-lg leading-relaxed marker:text-royal-blue">
                                    {activeTheme === 'rath_yatra' ? (
                                        <>
                                            <li>You have <strong className="text-royal-blue">10 minutes</strong> to complete your chariot run!</li>
                                            <li>Once the Yatra starts, the clock ticks continuously—no pausing.</li>
                                        </>
                                    ) : activeTheme === 'independence_day' ? (
                                        <>
                                            <li>You have <strong className="text-royal-blue">10 minutes</strong> to prove your patriotic knowledge!</li>
                                            <li>Once the tricolor is raised, the clock starts—no pausing.</li>
                                        </>
                                    ) : (
                                        <>
                                            <li>There are <strong className="text-royal-blue">10 minutes</strong> on the clock.</li>
                                            <li>Once you start, the clock ticks—no pausing.</li>
                                        </>
                                    )}
                                    <li>Each question has one correct answer.</li>
                                    <li>Most correct answers in the least time is the winner!</li>
                                </ul>
                                <button onClick={confirmStart} className="btn-vintage w-full">
                                    {activeTheme === 'rath_yatra' ? 'Pull the Chariot (Start Quiz)' : activeTheme === 'independence_day' ? 'Raise the Flag (Start Quiz)' : "I'm Ready to Play"}
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
