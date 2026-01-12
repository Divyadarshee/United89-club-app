import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getLeaderboard, getConfig, getMySubmission, getWeeks } from '../services/api';
import { Trophy, Clock, Medal, Home, Calendar, Award, Crown, Star, Sparkles, Eye, X, Check, Loader2, ChevronDown, History, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';

function Leaderboard() {
    const [weeklyUsers, setWeeklyUsers] = useState([]);
    const [lastWeekUsers, setLastWeekUsers] = useState([]);
    const [overallUsers, setOverallUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('thisWeek'); // 'lastWeek' | 'thisWeek' | 'overall'
    const confettiTriggered = useRef(false);
    const pastWeeksDropdownRef = useRef(null);
    const navigate = useNavigate();

    // Past weeks state
    const [weeks, setWeeks] = useState([]);
    const [currentWeekId, setCurrentWeekId] = useState('');
    const [lastWeekId, setLastWeekId] = useState('');
    const [showPastWeeksDropdown, setShowPastWeeksDropdown] = useState(false);
    const [selectedPastWeek, setSelectedPastWeek] = useState(null);
    const [pastWeekUsers, setPastWeekUsers] = useState([]);
    const [loadingPastWeek, setLoadingPastWeek] = useState(false);

    // Modal state for viewing user's own answers
    const [showAnswersModal, setShowAnswersModal] = useState(false);
    const [mySubmission, setMySubmission] = useState(null);
    const [loadingAnswers, setLoadingAnswers] = useState(false);
    const [answersError, setAnswersError] = useState(null);

    // Check if user has submitted (from localStorage)
    const userId = localStorage.getItem('user_id');
    const hasSubmitted = localStorage.getItem('has_submitted') === 'true';

    // Calculate week IDs
    const getWeekId = (weeksOffset = 0) => {
        const now = new Date();
        now.setDate(now.getDate() + weeksOffset * 7);
        const year = now.getFullYear();
        // Get ISO week number
        const startOfYear = new Date(year, 0, 1);
        const days = Math.floor((now - startOfYear) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
        return `${year}-W${weekNum.toString().padStart(2, '0')}`;
    };

    // Get date range label for a week ID
    const getWeekDateRange = (weekId) => {
        if (!weekId) return '';
        const match = weekId.match(/(\d{4})-W(\d{2})/);
        if (!match) return weekId;
        const [, year, week] = match;
        // Calculate first day of ISO week
        const jan4 = new Date(parseInt(year), 0, 4);
        const dayOfWeek = jan4.getDay() || 7;
        const firstMonday = new Date(jan4);
        firstMonday.setDate(jan4.getDate() - dayOfWeek + 1 + (parseInt(week) - 1) * 7);
        const sunday = new Date(firstMonday);
        sunday.setDate(firstMonday.getDate() + 6);
        const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${formatDate(firstMonday)} - ${formatDate(sunday)}`;
    };

    useEffect(() => {
        let mounted = true;
        let interval;

        const fetchData = async () => {
            try {
                // Load weeks for past weeks dropdown
                const weeksData = await getWeeks();
                if (!mounted) return;
                setWeeks(weeksData || []);

                const current = weeksData?.find(w => w.is_current);
                const currentId = current?.week_id || getWeekId(0);
                setCurrentWeekId(currentId);

                // Calculate last week ID
                const lastId = getWeekId(-1);
                setLastWeekId(lastId);

                // Fetch all leaderboards: this week, last week, overall
                const [thisWeekData, lastWeekData, overallData] = await Promise.all([
                    getLeaderboard('weekly', currentId),
                    getLeaderboard('weekly', lastId),
                    getLeaderboard('overall')
                ]);

                if (!mounted) return;

                setWeeklyUsers(thisWeekData || []);
                setLastWeekUsers(lastWeekData || []);
                setOverallUsers(overallData || []);

                // Trigger confetti on first load
                if (!confettiTriggered.current && ((thisWeekData && thisWeekData.length > 0) || (overallData && overallData.length > 0))) {
                    confettiTriggered.current = true;
                    setTimeout(() => triggerConfetti(), 500);
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

    // Click outside handler for past weeks dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pastWeeksDropdownRef.current && !pastWeeksDropdownRef.current.contains(event.target)) {
                setShowPastWeeksDropdown(false);
            }
        };

        if (showPastWeeksDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPastWeeksDropdown]);

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

    // Determine which week_id to use based on active tab
    const getActiveWeekId = useCallback(() => {
        switch (activeTab) {
            case 'lastWeek':
                return lastWeekId;
            case 'thisWeek':
                return currentWeekId;
            case 'pastWeek':
                return selectedPastWeek;
            case 'overall':
                return null; // Overall doesn't have a specific week
            default:
                return currentWeekId;
        }
    }, [activeTab, lastWeekId, currentWeekId, selectedPastWeek]);

    // Check if "View My Answers" should be shown
    // Users can only access leaderboard after submitting (restricted at Welcome page)
    // So we just hide for "overall" tab which has no specific week
    const shouldShowViewAnswers = () => {
        // For overall tab, don't show the button (no specific week)
        if (activeTab === 'overall') {
            return false;
        }
        // For all weekly tabs (thisWeek, lastWeek, pastWeek), show the button
        return true;
    };

    const handleViewMyAnswers = async () => {
        if (!userId) {
            setAnswersError("Please register first to view your answers.");
            return;
        }

        const weekIdToFetch = getActiveWeekId();
        if (!weekIdToFetch) {
            setAnswersError("Please select a specific week to view answers.");
            return;
        }

        setShowAnswersModal(true);
        setLoadingAnswers(true);
        setAnswersError(null);

        try {
            const data = await getMySubmission(userId, weekIdToFetch);
            setMySubmission(data);
        } catch (error) {
            console.error("Failed to fetch submission:", error);
            if (error.response?.status === 404) {
                setAnswersError(`You didn't participate in ${weekIdToFetch}. No answers to show.`);
            } else {
                setAnswersError("Failed to load your answers. Please try again.");
            }
        } finally {
            setLoadingAnswers(false);
        }
    };

    const closeAnswersModal = () => {
        setShowAnswersModal(false);
        setMySubmission(null);
        setAnswersError(null);
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
            ) : (
                <>
                    {/* Tab Navigation - Works on all screens */}
                    <div className="flex flex-wrap justify-center gap-2 mb-4 w-full max-w-2xl">
                        <div className="flex bg-white/20 backdrop-blur rounded-full p-1 border border-white/20">
                            <button
                                onClick={() => { setActiveTab('lastWeek'); setShowPastWeeksDropdown(false); }}
                                className={`px-3 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-1 ${activeTab === 'lastWeek' ? 'bg-indigo-600 text-white' : 'text-white/70 hover:text-white'}`}
                            >
                                <History size={14} />
                                <span className="hidden sm:inline">Last Week</span>
                                <span className="sm:hidden">Prev</span>
                            </button>
                            <button
                                onClick={() => { setActiveTab('thisWeek'); setShowPastWeeksDropdown(false); }}
                                className={`px-3 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-1 ${activeTab === 'thisWeek' ? 'bg-blue-600 text-white' : 'text-white/70 hover:text-white'}`}
                            >
                                <Calendar size={14} />
                                <span>This Week</span>
                            </button>
                            <button
                                onClick={() => { setActiveTab('overall'); setShowPastWeeksDropdown(false); }}
                                className={`px-3 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-1 ${activeTab === 'overall' ? 'bg-amber-500 text-white' : 'text-white/70 hover:text-white'}`}
                            >
                                <Award size={14} />
                                <span>All-Time</span>
                            </button>
                        </div>

                        {/* Past Weeks Dropdown */}
                        <div className="relative" ref={pastWeeksDropdownRef}>
                            <button
                                onClick={() => setShowPastWeeksDropdown(!showPastWeeksDropdown)}
                                className="px-3 py-2 bg-white/20 backdrop-blur rounded-full text-xs sm:text-sm font-bold text-white/70 hover:text-white border border-white/20 flex items-center gap-1 transition-all"
                            >
                                <History size={14} />
                                <span className="hidden sm:inline">Past Weeks</span>
                                <ChevronDown size={14} className={`transition-transform ${showPastWeeksDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {showPastWeeksDropdown && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[180px] z-20"
                                    >
                                        {weeks.filter(w => !w.is_current && w.week_id < currentWeekId).slice(0, 6).map(week => (
                                            <button
                                                key={week.week_id}
                                                onClick={async () => {
                                                    setSelectedPastWeek(week.week_id);
                                                    setActiveTab('pastWeek');
                                                    setShowPastWeeksDropdown(false);
                                                    setLoadingPastWeek(true);
                                                    try {
                                                        const data = await getLeaderboard('weekly', week.week_id);
                                                        setPastWeekUsers(data || []);
                                                    } catch (e) {
                                                        console.error('Failed to load past week:', e);
                                                        setPastWeekUsers([]);
                                                    } finally {
                                                        setLoadingPastWeek(false);
                                                    }
                                                }}
                                                className={`w-full px-4 py-2 text-left text-sm hover:bg-blue-50 transition-colors ${selectedPastWeek === week.week_id ? 'bg-blue-100 text-blue-700' : 'text-gray-700'}`}
                                            >
                                                <span className="font-bold">{week.week_id}</span>
                                                <span className="text-xs text-gray-500 block">{getWeekDateRange(week.week_id)}</span>
                                            </button>
                                        ))}
                                        {weeks.filter(w => !w.is_current && w.week_id < currentWeekId).length === 0 && (
                                            <p className="px-4 py-2 text-sm text-gray-400">No past weeks available</p>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Week Date Range Label */}
                    <p className="text-white/60 text-xs mb-4 font-mono">
                        {activeTab === 'lastWeek' && `${lastWeekId} (${getWeekDateRange(lastWeekId)})`}
                        {activeTab === 'thisWeek' && `${currentWeekId} (${getWeekDateRange(currentWeekId)})`}
                        {activeTab === 'overall' && 'Cumulative Rankings'}
                        {activeTab === 'pastWeek' && selectedPastWeek && `${selectedPastWeek} (${getWeekDateRange(selectedPastWeek)})`}
                    </p>

                    {/* Leaderboard Card - Single view based on tab */}
                    <div className="w-full max-w-lg">
                        <AnimatePresence mode="wait">
                            {activeTab === 'lastWeek' && (
                                <motion.div key="lw" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                                    <LeaderboardCard users={lastWeekUsers} type="weekly" title="Last Week" icon={History} gradient="bg-gradient-to-r from-indigo-600 to-purple-600" />
                                </motion.div>
                            )}
                            {activeTab === 'thisWeek' && (
                                <motion.div key="tw" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                                    <LeaderboardCard users={weeklyUsers} type="weekly" title="This Week" icon={Calendar} gradient="bg-gradient-to-r from-blue-600 to-indigo-600" />
                                </motion.div>
                            )}
                            {activeTab === 'overall' && (
                                <motion.div key="ov" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                    <LeaderboardCard users={overallUsers} type="overall" title="All-Time Legends" icon={Award} gradient="bg-gradient-to-r from-amber-500 to-orange-500" />
                                </motion.div>
                            )}
                            {activeTab === 'pastWeek' && (
                                <motion.div key="pw" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                    {loadingPastWeek ? (
                                        <div className="bg-white/90 rounded-xl p-8 shadow-xl text-center">
                                            <Loader2 className="animate-spin text-royal-blue mx-auto" size={32} />
                                            <p className="text-gray-500 mt-2 text-sm">Loading {selectedPastWeek}...</p>
                                        </div>
                                    ) : (
                                        <LeaderboardCard users={pastWeekUsers} type="weekly" title={selectedPastWeek || 'Past Week'} icon={History} gradient="bg-gradient-to-r from-gray-600 to-slate-600" />
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex flex-wrap gap-3 mt-4 justify-center">
                        {/* View My Answers Button - conditionally shown */}
                        {shouldShowViewAnswers() && (
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                onClick={handleViewMyAnswers}
                                className="px-5 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-full text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
                            >
                                <Eye size={16} /> View My Answers
                            </motion.button>
                        )}

                        {/* Celebrate Button */}
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                            onClick={triggerConfetti}
                            className="px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-sm font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
                        >
                            <Sparkles size={16} /> Celebrate! 🎉
                        </motion.button>
                    </div>
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

            {/* My Answers Modal */}
            <AnimatePresence>
                {showAnswersModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl shadow-2xl flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4 flex justify-between items-center text-white">
                                <div>
                                    <h3 className="text-xl font-serif flex items-center gap-2">
                                        <Eye size={20} /> My Answer Sheet
                                    </h3>
                                    {mySubmission && (
                                        <p className="text-sm opacity-90 mt-1">
                                            Score: <span className="font-bold">{mySubmission.score}/{mySubmission.questions?.length || 0}</span>
                                            <span className="mx-2">•</span>
                                            Time: <span className="font-bold">{formatTime(mySubmission.time_taken)}</span>
                                        </p>
                                    )}
                                </div>
                                <button onClick={closeAnswersModal} className="hover:text-red-300 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto space-y-4 flex-1">
                                {loadingAnswers ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="animate-spin text-green-600" size={32} />
                                        <span className="ml-3 text-gray-600">Loading your answers...</span>
                                    </div>
                                ) : answersError ? (
                                    <div className="text-center py-8">
                                        <Lock className="mx-auto mb-3 text-gray-400" size={40} />
                                        <p className="text-gray-600">{answersError}</p>
                                    </div>
                                ) : mySubmission?.questions ? (
                                    mySubmission.questions.map((q, index) => (
                                        <div
                                            key={q.id}
                                            className={`p-4 rounded-lg border-2 ${q.is_correct
                                                ? 'border-green-300 bg-green-50'
                                                : 'border-red-300 bg-red-50'
                                                }`}
                                        >
                                            <p className="font-serif text-lg text-gray-800 mb-3">
                                                <span className="font-bold mr-2 text-gray-500">#{index + 1}</span>
                                                {q.text}
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Your Answer:</span>
                                                    <span className={`ml-2 font-bold ${q.is_correct ? 'text-green-700' : 'text-red-700'}`}>
                                                        {q.user_answer || '(No answer)'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Correct:</span>
                                                    <span className="ml-2 font-bold text-green-700">{q.correct_answer}</span>
                                                </div>
                                            </div>
                                            <div className="mt-2 text-right">
                                                {q.is_correct ? (
                                                    <span className="text-green-600 font-bold flex items-center justify-end gap-1">
                                                        <Check size={16} /> Correct
                                                    </span>
                                                ) : (
                                                    <span className="text-red-600 font-bold flex items-center justify-end gap-1">
                                                        <X size={16} /> Wrong
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : null}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t bg-gray-50 flex justify-end">
                                <button onClick={closeAnswersModal} className="btn-vintage py-2 px-6">Close</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default Leaderboard;
