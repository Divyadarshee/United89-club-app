import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuestions, getUsers, deleteQuestion, addQuestion, updateConfig, getConfig, getAdminQuestions, getLeaderboard, getWeeks } from '../services/api';
import { Trash2, Plus, Settings, Users, FileQuestion, Save, Eye, X, Calendar, Globe, Award } from 'lucide-react';

function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('questions');

    // Data States
    const [weeks, setWeeks] = useState([]);
    const [selectedWeek, setSelectedWeek] = useState('');
    const [questions, setQuestions] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [fullQuestions, setFullQuestions] = useState([]); // For answer checking
    const [config, setConfig] = useState({ timer_duration_minutes: 10, quiz_active: true, leaderboard_active: false });

    // UI States
    const [leaderboardType, setLeaderboardType] = useState('weekly'); // 'weekly' or 'overall'
    const [selectedUser, setSelectedUser] = useState(null); // For modal

    // New Question Form
    const [newQ, setNewQ] = useState({ text: '', opt1: '', opt2: '', opt3: '', opt4: '', answer: '' });

    // Initial Load
    useEffect(() => {
        loadWeeks();
        // Load initial config
        getConfig().then(setConfig);
    }, []);

    // Watchers
    useEffect(() => {
        if (selectedWeek) {
            loadData();
        }
    }, [activeTab, selectedWeek, leaderboardType]);

    const loadWeeks = async () => {
        try {
            const w = await getWeeks();
            setWeeks(w);
            // Default to current week if available, else first in list
            const current = w.find(x => x.is_current);
            if (current) setSelectedWeek(current.week_id);
            else if (w.length > 0) setSelectedWeek(w[0].week_id);
        } catch (e) {
            console.error("Failed to load weeks", e);
        }
    };

    const loadData = async () => {
        if (!selectedWeek) return;

        console.log('loadData called:', { activeTab, selectedWeek, leaderboardType });

        try {
            if (activeTab === 'questions') {
                const q = await getAdminQuestions(selectedWeek);
                setQuestions(q);
            } else if (activeTab === 'users') {
                // Leaderboard logic
                const type = leaderboardType;
                console.log('Fetching leaderboard:', { type, selectedWeek });

                const [lb, fq] = await Promise.all([
                    getLeaderboard(type, selectedWeek),
                    getAdminQuestions(selectedWeek)
                ]);

                console.log('Leaderboard response:', lb);
                setLeaderboard(lb);
                setFullQuestions(fq);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const handleAddQuestion = async (e) => {
        e.preventDefault();
        const id = `q${Date.now()}`;
        const questionData = {
            id,
            text: newQ.text,
            options: [newQ.opt1, newQ.opt2, newQ.opt3, newQ.opt4],
            answer: newQ.answer,
            order: questions.length + 1,
            week_id: selectedWeek
        };
        await addQuestion(questionData);
        setNewQ({ text: '', opt1: '', opt2: '', opt3: '', opt4: '', answer: '' });
        loadData();
    };

    const handleDeleteQuestion = async (id) => {
        if (confirm('Are you sure?')) {
            await deleteQuestion(id);
            loadData();
        }
    };

    const handleUpdateConfig = async (e) => {
        e.preventDefault();
        await updateConfig({ ...config });
        alert('Settings Updated');
    };

    const formatTime = (seconds) => {
        if (!seconds && seconds !== 0) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const TabButton = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`
                flex items-center gap-2 px-6 py-3 rounded-t-lg font-serif font-bold transition-all
                ${activeTab === id
                    ? 'bg-warm-cream text-royal-blue border-t-2 border-x-2 border-antique-gold'
                    : 'bg-midnight-blue/40 text-gray-400 hover:text-white hover:bg-midnight-blue/60'
                }
            `}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    return (
        <div className="w-full max-w-6xl mx-auto p-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-antique-gold/30 pb-4">
                <h1 className="text-4xl font-serif text-white drop-shadow-md">
                    Admin Dashboard
                </h1>

                {/* Week Selector */}
                <div className="flex items-center gap-3 bg-white/95 p-3 rounded-lg border-2 border-antique-gold shadow-lg">
                    <Calendar className="text-royal-blue" size={24} />
                    <div className="flex flex-col">
                        <label className="text-xs text-royal-blue font-sans uppercase tracking-wider font-bold">Active Week</label>
                        <select
                            value={selectedWeek}
                            onChange={(e) => setSelectedWeek(e.target.value)}
                            className="bg-transparent text-royal-blue font-serif font-bold focus:outline-none cursor-pointer"
                        >
                            {weeks.map(w => (
                                <option key={w.week_id} value={w.week_id} className="text-royal-blue">
                                    {w.week_id} {w.is_current ? '(Current)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-0 overflow-x-auto">
                <TabButton id="questions" label="Questions" icon={FileQuestion} />
                <TabButton id="settings" label="Global Settings" icon={Settings} />
                <TabButton id="users" label="Leaderboard" icon={Users} />
            </div>

            {/* Main Content Card */}
            <div className="card-vintage rounded-tl-none min-h-[600px]">

                {/* QUESTIONS TAB */}
                {activeTab === 'questions' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-serif text-warm-cream mb-4 flex items-center gap-2">
                                <FileQuestion size={24} /> Manage Questions for <span className="text-antique-gold">{selectedWeek}</span>
                            </h2>

                            {questions.length === 0 ? (
                                <div className="p-8 text-center border-2 border-dashed border-gray-600 rounded-lg text-gray-400">
                                    No questions yet for this week. Add one below!
                                </div>
                            ) : (
                                <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3">
                                    {questions.map((q) => (
                                        <div key={q.id} className="bg-white p-4 rounded border border-gray-200 shadow-sm flex justify-between items-center group hover:border-antique-gold transition-colors">
                                            <div className="flex-1">
                                                <span className="font-sans text-text-charcoal font-medium block">{q.text}</span>
                                                <span className="text-xs text-gray-500">Answer: {q.correct_answer}</span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteQuestion(q.id)}
                                                className="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition-colors"
                                                title="Delete Question"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t-2 border-antique-gold/20 pt-8">
                            <h3 className="text-xl font-serif text-warm-cream mb-4 flex items-center gap-2">
                                <Plus size={20} /> Add New Question ({selectedWeek})
                            </h3>
                            <form onSubmit={handleAddQuestion} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input className="input-vintage md:col-span-2" placeholder="Question Text" value={newQ.text} onChange={e => setNewQ({ ...newQ, text: e.target.value })} required />
                                <input className="input-vintage" placeholder="Option A" value={newQ.opt1} onChange={e => setNewQ({ ...newQ, opt1: e.target.value })} required />
                                <input className="input-vintage" placeholder="Option B" value={newQ.opt2} onChange={e => setNewQ({ ...newQ, opt2: e.target.value })} required />
                                <input className="input-vintage" placeholder="Option C" value={newQ.opt3} onChange={e => setNewQ({ ...newQ, opt3: e.target.value })} required />
                                <input className="input-vintage" placeholder="Option D" value={newQ.opt4} onChange={e => setNewQ({ ...newQ, opt4: e.target.value })} required />
                                <select
                                    value={newQ.answer}
                                    onChange={e => setNewQ({ ...newQ, answer: e.target.value })}
                                    required
                                    className="input-vintage md:col-span-2"
                                >
                                    <option value="">Select Correct Answer</option>
                                    <option value={newQ.opt1}>Option A</option>
                                    <option value={newQ.opt2}>Option B</option>
                                    <option value={newQ.opt3}>Option C</option>
                                    <option value={newQ.opt4}>Option D</option>
                                </select>
                                <button type="submit" className="btn-vintage md:col-span-2 mt-2">Add Question to {selectedWeek}</button>
                            </form>
                        </div>
                    </motion.div>
                )}

                {/* SETTINGS TAB */}
                {activeTab === 'settings' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="text-2xl font-serif text-warm-cream mb-6 flex items-center gap-2">
                            <Settings size={24} /> Global Configuration
                        </h2>
                        <form onSubmit={handleUpdateConfig} className="max-w-md">
                            <label className="block font-sans text-warm-cream mb-2 font-bold">Timer Duration (Minutes)</label>
                            <input
                                type="number"
                                value={config.timer_duration_minutes}
                                onChange={e => setConfig({ ...config, timer_duration_minutes: parseInt(e.target.value) })}
                                className="input-vintage text-lg mb-6"
                            />

                            {/* Quiz Active Toggle */}
                            <div className="flex items-center gap-4 mb-4 p-4 bg-green-900/30 rounded border border-green-500/30">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.quiz_active}
                                        onChange={e => setConfig({ ...config, quiz_active: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                    <span className="ml-3 font-serif font-bold text-warm-cream">Quiz Active (Allow Submissions)</span>
                                </label>
                            </div>

                            {/* Leaderboard Active Toggle */}
                            <div className="flex items-center gap-4 mb-6 p-4 bg-midnight-blue/30 rounded border border-antique-gold/30">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.leaderboard_active}
                                        onChange={e => setConfig({ ...config, leaderboard_active: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-antique-gold"></div>
                                    <span className="ml-3 font-serif font-bold text-warm-cream">Show Leaderboard (Reveal Results)</span>
                                </label>
                            </div>

                            <button type="submit" className="btn-vintage flex items-center gap-2">
                                <Save size={20} /> Save Configuration
                            </button>
                        </form>
                    </motion.div>
                )}

                {/* LEADERBOARD TAB */}
                {activeTab === 'users' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-serif text-warm-cream flex items-center gap-2">
                                <Users size={24} /> Results
                            </h2>

                            {/* Toggle Type */}
                            <div className="flex bg-midnight-blue rounded-lg p-1 border border-antique-gold/30">
                                <button
                                    onClick={() => setLeaderboardType('weekly')}
                                    className={`px-4 py-2 rounded font-bold text-sm transition-all flex items-center gap-2 ${leaderboardType === 'weekly' ? 'bg-antique-gold text-royal-blue shadow-md' : 'text-gray-400 hover:text-white'}`}
                                >
                                    <Calendar size={14} /> Weekly ({selectedWeek})
                                </button>
                                <button
                                    onClick={() => setLeaderboardType('overall')}
                                    className={`px-4 py-2 rounded font-bold text-sm transition-all flex items-center gap-2 ${leaderboardType === 'overall' ? 'bg-antique-gold text-royal-blue shadow-md' : 'text-gray-400 hover:text-white'}`}
                                >
                                    <Award size={14} /> Overall (All-Time)
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto border rounded-lg border-antique-gold/30">
                            <table className="w-full table-auto">
                                <thead className="bg-royal-blue text-white font-serif">
                                    <tr>
                                        <th className="p-4 text-left">Rank</th>
                                        <th className="p-4 text-left">Name</th>
                                        <th className="p-4 text-left">Score</th>
                                        {leaderboardType === 'weekly' && <th className="p-4 text-left">Time</th>}
                                        {leaderboardType === 'overall' && <th className="p-4 text-left">Avg Time</th>}
                                        {leaderboardType === 'weekly' && <th className="p-4 text-left">Actions</th>}
                                    </tr>
                                </thead>
                                <motion.tbody
                                    initial="hidden"
                                    animate="visible"
                                    variants={{
                                        hidden: { opacity: 0 },
                                        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
                                    }}
                                    className="bg-white divide-y divide-gray-100"
                                >
                                    {leaderboard.map((u, i) => (
                                        <motion.tr
                                            key={i}
                                            variants={{
                                                hidden: { opacity: 0, y: 10 },
                                                visible: { opacity: 1, y: 0 }
                                            }}
                                            className={`hover:bg-warm-cream transition-colors ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                                        >
                                            <td className="p-4 font-bold text-gray-400">#{u.rank}</td>
                                            <td className="p-4 font-bold text-royal-blue">{u.name}</td>
                                            <td className="p-4 font-bold text-antique-gold text-lg">{u.score}</td>
                                            {leaderboardType === 'weekly' && (
                                                <td className="p-4 font-mono text-gray-700">{formatTime(u.time_taken)}</td>
                                            )}
                                            {leaderboardType === 'overall' && (
                                                <td className="p-4 font-mono text-gray-700">{formatTime(u.avg_time)}</td>
                                            )}
                                            {leaderboardType === 'weekly' && (
                                                <td className="p-4">
                                                    <button
                                                        onClick={() => setSelectedUser(u)}
                                                        className="text-royal-blue hover:text-antique-gold transition-colors"
                                                        title="View Answers"
                                                    >
                                                        <Eye size={20} />
                                                    </button>
                                                </td>
                                            )}
                                        </motion.tr>
                                    ))}
                                    {leaderboard.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="p-8 text-center text-gray-500">
                                                No results found for this selection.
                                            </td>
                                        </tr>
                                    )}
                                </motion.tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* USER DETAILS MODAL */}
                <AnimatePresence>
                    {selectedUser && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-lg shadow-2xl flex flex-col"
                            >
                                <div className="bg-royal-blue p-4 flex justify-between items-center text-white">
                                    <h3 className="text-xl font-serif">
                                        Answer Sheet: <span className="text-antique-gold">{selectedUser.name}</span>
                                    </h3>
                                    <button onClick={() => setSelectedUser(null)} className="hover:text-red-300">
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto space-y-6">
                                    {fullQuestions.map((q, index) => {
                                        // Note: Weekly submissions might not store answers in user root, handled in API or context
                                        // For now assuming we are only viewing standard answer view
                                        // Need to handle missing 'answers' in the selectedUser object if it came from leaderboard API which might be lean
                                        // The current API implementation for LB does NOT include answers map. 
                                        // LIMITATION: Detailed review might need an extra fetch for the submission details.
                                        // For this iteration, we will rely on selectedUser having data if we modified the API, 
                                        // BUT we saw the API only returns name/score/time.
                                        // QUICK FIX: If answers missing, show message

                                        // Since we didn't update API to return answers in LB list (for perf), we can't show them here yet without another call.
                                        // We will conditionally show "Not available in this view"

                                        return (
                                            <div key={q.id} className="p-4 rounded border border-gray-200">
                                                <p className="font-serif text-lg text-royal-blue mb-2">
                                                    <span className="font-bold mr-2 text-gray-400">#{index + 1}</span>
                                                    {q.text}
                                                </p>
                                                <div className="text-gray-600">
                                                    Correct Answer: <span className="font-bold text-green-700">{q.correct_answer}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <p className="text-center text-red-400 italic mt-4">
                                        Note: Detailed user answer review requires fetching specific submission data.
                                    </p>
                                </div>

                                <div className="p-4 border-t bg-gray-50 flex justify-end">
                                    <button onClick={() => setSelectedUser(null)} className="btn-vintage py-2 px-6">Close</button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default AdminDashboard;
