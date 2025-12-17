import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getLeaderboard, getConfig } from '../services/api';
import { Trophy, Clock, Medal, Home, Lock } from 'lucide-react';

function Leaderboard() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isActive, setIsActive] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchData = async () => {
            try {
                // First check if leaderboard is active
                const config = await getConfig();

                if (config.leaderboard_active) {
                    setIsActive(true);
                    const data = await getLeaderboard();
                    setUsers(data);
                } else {
                    setIsActive(false);
                }
            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (seconds) => {
        if (!seconds && seconds !== 0) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const getRankIcon = (index) => {
        if (index === 0) return <Medal size={24} className="text-yellow-400 drop-shadow-md" />; // Gold
        if (index === 1) return <Medal size={24} className="text-gray-300 drop-shadow-md" />;   // Silver
        if (index === 2) return <Medal size={24} className="text-amber-600 drop-shadow-md" />;  // Bronze
        return <span className="font-serif text-lg text-gray-400 font-bold">#{index + 1}</span>;
    };

    return (
        <div className="w-full max-w-4xl mx-auto p-4 md:p-8 min-h-screen flex flex-col items-center">

            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center mb-8"
            >
                <h1 className="text-4xl md:text-5xl font-serif text-white mb-2 drop-shadow-lg flex items-center justify-center gap-3">
                    <Trophy className="text-antique-gold" size={40} />
                    Hall of Fame
                    <Trophy className="text-antique-gold" size={40} />
                </h1>
                <p className="text-antique-gold font-serif italic text-xl tracking-wider">Top Performers of the Week</p>
            </motion.div>

            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl overflow-hidden border-2 border-antique-gold/50"
            >
                {/* CONTENT AREA */}
                {loading ? (
                    <div className="p-20 text-center text-gray-500 font-serif text-xl animate-pulse">
                        Checking Records...
                    </div>
                ) : !isActive ? (
                    // LOCKED / COMING SOON STATE
                    <div className="p-16 text-center flex flex-col items-center">
                        <div className="bg-gray-100 p-6 rounded-full mb-6">
                            <Lock size={48} className="text-gray-400" />
                        </div>
                        <h2 className="text-3xl font-serif text-royal-blue mb-4">Results Coming Soon</h2>
                        <p className="font-sans text-gray-600 text-lg max-w-md mx-auto leading-relaxed">
                            The judges are tallying the scores! The leaderboard has not been revealed yet.
                            Please check back later for the official results.
                        </p>
                    </div>
                ) : (
                    // ACTIVE LEADERBOARD TABLE
                    <div className="overflow-x-auto">
                        <table className="w-full table-auto">
                            <thead className="bg-royal-blue text-white font-serif uppercase tracking-widest text-sm">
                                <tr>
                                    <th className="p-5 text-center w-24">Rank</th>
                                    <th className="p-5 text-left">Player</th>
                                    <th className="p-5 text-center">Score</th>
                                    <th className="p-5 text-center">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="p-10 text-center text-gray-500 font-serif text-xl">
                                            No submissions yet. Be the first!
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((u, i) => (
                                        <motion.tr
                                            key={i}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                            className={`
                                                group transition-colors
                                                ${i === 0 ? 'bg-amber-50/50 hover:bg-amber-100/50' : 'hover:bg-blue-50'}
                                            `}
                                        >
                                            <td className="p-4 text-center flex justify-center items-center">
                                                {getRankIcon(i)}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-bold text-royal-blue text-lg font-serif">
                                                    {u.name}
                                                </div>
                                                {u.week_id && (
                                                    <div className="text-xs text-gray-400 font-mono mt-1">
                                                        Week: {u.week_id}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className="inline-block px-3 py-1 bg-antique-gold/20 text-antique-gold-dark rounded-full font-bold">
                                                    {u.score}
                                                </span>
                                            </td>
                                            <td className="p-4 text-center font-mono text-gray-600 flex items-center justify-center gap-2">
                                                <Clock size={16} className="text-gray-400" />
                                                {formatTime(u.time_taken)}
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>

            <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => navigate('/welcome')}
                className="mt-8 btn-vintage flex items-center gap-2 px-8 py-3 shadow-xl hover:scale-105 active:scale-95 transition-transform"
            >
                <Home size={20} />
                Back to Lobby
            </motion.button>

        </div>
    );
}

export default Leaderboard;
