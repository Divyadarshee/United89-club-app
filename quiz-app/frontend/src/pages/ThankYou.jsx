import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Trophy } from 'lucide-react';
import { useSoundManager } from '../hooks/useSoundManager';
import { useEffect } from 'react';

function ThankYou() {
    const navigate = useNavigate();
    const location = useLocation();
    const { playSound } = useSoundManager();
    const alreadySubmitted = location.state?.alreadySubmitted;
    const score = location.state?.score;
    const timeTaken = location.state?.timeTaken;

    useEffect(() => {
        playSound('fanfare');
    }, []);

    const handleHome = () => {
        // Navigate back to the "Lobby" (Welcome page) without clearing session
        playSound('bgm'); // Restart background music
        navigate('/welcome');
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-vintage text-center max-w-lg mx-auto"
        >
            <h1 className="text-4xl font-serif text-amber-50 mb-4 drop-shadow-md">Thank You</h1>
            <p className="font-sans text-xl text-gray-200 mb-6 leading-relaxed">
                {alreadySubmitted
                    ? "You have already submitted your answers."
                    : "Thanks for playing!"
                }
            </p>

            {score !== undefined && (
                <div className="bg-purple-900/50 border border-purple-400/40 rounded-lg p-4 mb-6 shadow-inner">
                    <p className="text-purple-200 text-lg font-serif">
                        Your Score: <span className="font-bold text-emerald-400 text-2xl">{score}</span>
                    </p>
                    {timeTaken !== undefined && (
                        <p className="text-purple-300 text-sm mt-1">
                            Time Taken: <span className="font-semibold text-white">{timeTaken}s</span>
                        </p>
                    )}
                </div>
            )}

            <div className="bg-midnight-blue/40 rounded-lg p-5 mb-6 border border-antique-gold/30">
                <p className="font-sans text-lg text-gray-300 leading-relaxed">
                    Please keep checking the leaderboard — results will be announced soon!
                </p>
                <button
                    onClick={() => navigate('/leaderboard')}
                    className="mt-4 flex items-center justify-center gap-2 text-antique-gold hover:text-white underline font-serif text-lg transition-colors mx-auto"
                >
                    <Trophy size={20} />
                    View Leaderboard
                </button>
            </div>

            <button onClick={handleHome} className="btn-vintage flex items-center justify-center gap-2 w-full">
                <Home size={20} /> Back to Lobby
            </button>
        </motion.div>
    );
}

export default ThankYou;
