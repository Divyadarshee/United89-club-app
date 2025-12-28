import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getLeaderboard, getConfig } from '../services/api';
import { Trophy, Clock, Medal, Home, Lock, Calendar, Award, Crown, Star, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

function Leaderboard() {
    const [weeklyUsers, setWeeklyUsers] = useState([]);
    const [overallUsers, setOverallUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isActive, setIsActive] = useState(false);
    const [activeTab, setActiveTab] = useState('weekly');
    const confettiTriggered = useRef(false);
    const navigate = useNavigate();

    useEffect(() => {
        let mounted = true;
        let interval;

        const fetchData = async () => {
            try {
                const config = await getConfig();

                if (!mounted) return;

                if (config.leaderboard_active) {
                    setIsActive(true);
                    // Fetch both leaderboards with explicit type params
                    const [weeklyData, overallData] = await Promise.all([
                        getLeaderboard('weekly'),
                        getLeaderboard('overall')
                    ]);

                    if (!mounted) return;

                    setWeeklyUsers(weeklyData || []);
                    setOverallUsers(overallData || []);

                    // Trigger confetti on first load
                    if (!confettiTriggered.current && ((weeklyData && weeklyData.length > 0) || (overallData && overallData.length > 0))) {
                        confettiTriggered.current = true;
                        setTimeout(() => triggerConfetti(), 500);
                    }
                } else {
                    setIsActive(false);
                }
            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchData();
        interval = setInterval(fetchData, 30000);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    const triggerConfetti = () => {
        confetti({
            particleCount: 100,
            spread: 80,
            origin: { x: 0.5, y: 0.4 },
            colors: ['#FFD700', '#1e3a5f', '#FFA500', '#FFE066', '#C0C0C0', '#CD7F32']
        });
    };

    const formatTime = (seconds) => {
        if (!seconds && seconds !== 0) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const getRankBadge = (index) => {
        if (index === 0) return <Crown className="text-yellow-400" size={20} />;
        if (index === 1) return <Medal className="text-gray-300" size={18} />;
        if (index === 2) return <Medal className="text-amber-600" size={18} />;
        return <span className="text-gray-400 font-bold text-sm">#{index + 1}</span>;
    };

    const LeaderboardCard = ({ users, type, title, icon: Icon, gradient }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/95 backdrop-blur rounded-xl shadow-xl overflow-hidden flex-1 min-w-0"
        >
            {/* Header */}
            <div className={`p-4 ${gradient} text-white`}>
                <div className="flex items-center justify-center gap-2">
                    <Icon size={22} />
                    <h2 className="text-lg font-serif font-bold">{title}</h2>
                </div>
            </div>

            {/* Table */}
            <div className="max-h-[55vh] overflow-y-auto">
                {users.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <Star className="mx-auto mb-2 opacity-50" size={28} />
                        <p className="text-sm">No rankings yet</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className={`sticky top-0 ${type === 'weekly' ? 'bg-blue-700' : 'bg-amber-600'} text-white text-xs`}>
                            <tr>
                                <th className="p-2 text-center w-12">#</th>
                                <th className="p-2 text-left">Name</th>
                                <th className="p-2 text-center w-16">Pts</th>
                                <th className="p-2 text-center w-16">Avg<space> </space>
                                    <Clock size={12} className="inline" />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {users.map((u, i) => (
                                <motion.tr
                                    key={i}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: i * 0.03 }}
                                    className={`${i === 0 ? 'bg-amber-50' : i % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50 transition-colors`}
                                >
                                    <td className="p-2 text-center">
                                        {getRankBadge(i)}
                                    </td>
                                    <td className="p-2 truncate max-w-[120px]">
                                        <span className={`font-medium ${i === 0 ? 'text-amber-700' : 'text-gray-800'}`}>
                                            {u.name}
                                        </span>
                                    </td>
                                    <td className="p-2 text-center">
                                        <span className={`font-bold ${type === 'weekly' ? 'text-blue-600' : 'text-amber-600'}`}>
                                            {u.score}
                                        </span>
                                    </td>
                                    <td className="p-2 text-center text-gray-500 font-mono text-xs">
                                        {formatTime(type === 'weekly' ? u.time_taken : u.avg_time)}
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </motion.div>
    );

    return (
        <div className="w-full max-w-5xl mx-auto p-4 min-h-screen flex flex-col items-center">

            {/* Header */}
            <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-center mb-6"
            >
                <div className="flex items-center justify-center gap-3 mb-2">
                    <Trophy className="text-antique-gold" size={36} />
                    <h1 className="text-3xl md:text-4xl font-serif text-white drop-shadow-lg">
                        Hall of Fame
                    </h1>
                    <Trophy className="text-antique-gold" size={36} />
                </div>
                <p className="text-antique-gold/80 font-serif italic text-sm flex items-center justify-center gap-1">
                    <Sparkles size={14} /> Top Performers <Sparkles size={14} />
                </p>
            </motion.div>

            {/* Content */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="bg-white/90 rounded-xl p-8 shadow-xl text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-antique-gold border-t-transparent mx-auto mb-3"></div>
                        <p className="text-gray-500 text-sm">Loading...</p>
                    </div>
                </div>
            ) : !isActive ? (
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white/95 rounded-xl p-10 shadow-xl text-center max-w-md"
                >
                    <Lock size={48} className="text-gray-300 mx-auto mb-4" />
                    <h2 className="text-2xl font-serif text-royal-blue mb-3">Results Coming Soon</h2>
                    <p className="text-gray-500">The leaderboard has not been revealed yet.</p>
                </motion.div>
            ) : (
                <>
                    {/* Mobile Tabs */}
                    <div className="md:hidden flex bg-white/20 backdrop-blur rounded-full p-1 mb-4 w-full max-w-xs border border-white/20">
                        <button
                            onClick={() => setActiveTab('weekly')}
                            className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'weekly' ? 'bg-blue-600 text-white' : 'text-white/70'}`}
                        >
                            This Week
                        </button>
                        <button
                            onClick={() => setActiveTab('overall')}
                            className={`flex-1 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'overall' ? 'bg-amber-500 text-white' : 'text-white/70'}`}
                        >
                            All-Time
                        </button>
                    </div>

                    {/* Mobile Single View */}
                    <div className="md:hidden w-full">
                        <AnimatePresence mode="wait">
                            {activeTab === 'weekly' ? (
                                <motion.div key="w" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                                    <LeaderboardCard users={weeklyUsers} type="weekly" title="This Week" icon={Calendar} gradient="bg-gradient-to-r from-blue-600 to-indigo-600" />
                                </motion.div>
                            ) : (
                                <motion.div key="o" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                    <LeaderboardCard users={overallUsers} type="overall" title="All-Time Legends" icon={Award} gradient="bg-gradient-to-r from-amber-500 to-orange-500" />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Desktop Side-by-Side */}
                    <div className="hidden md:flex gap-4 w-full">
                        <LeaderboardCard users={weeklyUsers} type="weekly" title="This Week" icon={Calendar} gradient="bg-gradient-to-r from-blue-600 to-indigo-600" />
                        <LeaderboardCard users={overallUsers} type="overall" title="All-Time Legends" icon={Award} gradient="bg-gradient-to-r from-amber-500 to-orange-500" />
                    </div>

                    {/* Celebrate Button */}
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        onClick={triggerConfetti}
                        className="mt-4 px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
                    >
                        <Sparkles size={16} /> Celebrate! 🎉
                    </motion.button>
                </>
            )}

            {/* Back Button */}
            <motion.button
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => navigate('/welcome')}
                className="mt-6 btn-vintage flex items-center gap-2 px-6 py-2.5 shadow-xl"
            >
                <Home size={18} /> Back to Lobby
            </motion.button>
        </div>
    );
}

export default Leaderboard;
