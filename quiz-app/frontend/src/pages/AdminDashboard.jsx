import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuestions, getUsers, deleteQuestion, addQuestion, updateConfig, getConfig, getAdminQuestions, getLeaderboard, getWeeks, generateQuestions, addBatchQuestions, getSubmissionDetails } from '../services/api';
import { Trash2, Plus, Settings, Users, FileQuestion, Save, Eye, X, Calendar, Globe, Award, Sparkles, Check, AlertCircle, Loader2 } from 'lucide-react';
import AiLoader from '../components/AiLoader';

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
    const [userSubmission, setUserSubmission] = useState(null); // Full submission data with answers
    const [loadingSubmission, setLoadingSubmission] = useState(false);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

    // New Question Form
    const [newQ, setNewQ] = useState({ text: '', opt1: '', opt2: '', opt3: '', opt4: '', answer: '' });

    // AI Generation States
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewQuestions, setPreviewQuestions] = useState([]);
    const [selectedIndices, setSelectedIndices] = useState([]);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const currentWeekId = weeks.find(w => w.is_current)?.week_id || '';
    const isPastWeek = selectedWeek && currentWeekId && selectedWeek < currentWeekId;

    // Initial Load
    useEffect(() => {
        loadWeeks();
        // Load initial config
        getConfig().then(setConfig);
    }, []);

    // Watchers - triggers when tab, week, or leaderboard type changes
    useEffect(() => {
        if (selectedWeek) {
            loadData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                setLoadingLeaderboard(true);
                const type = leaderboardType;
                console.log('Fetching leaderboard:', { type, selectedWeek });

                const [lb, fq] = await Promise.all([
                    getLeaderboard(type, selectedWeek),
                    getAdminQuestions(selectedWeek)
                ]);

                console.log('Leaderboard response:', lb);
                setLeaderboard(lb || []); // Ensure it's always an array
                setFullQuestions(fq || []);
                setLoadingLeaderboard(false);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            // Reset to empty arrays on error to prevent stale data
            if (activeTab === 'users') {
                setLeaderboard([]);
                setLoadingLeaderboard(false);
            }
        }
    };

    const handleGenerateQuestions = async () => {
        setIsGenerating(true);
        console.log('[AI Generate] Starting question generation...');

        try {
            const result = await generateQuestions(selectedWeek);
            console.log('[AI Generate] Raw backend response:', result);

            // Transform backend schema to frontend schema
            // Backend: {question, choices, correct_answer: 'a'/'b'/'c'/'d'}
            // Frontend: {text, options, correct_answer: actual_text}
            const transformed = result.map((q, idx) => {
                console.log(`[AI Generate] Transforming question ${idx + 1}:`, q);

                // Convert letter index to actual answer text
                const letterToIndex = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
                const answerIndex = letterToIndex[q.correct_answer.toLowerCase()];
                const actualAnswer = q.choices[answerIndex];

                return {
                    text: q.question,
                    options: q.choices,
                    correct_answer: actualAnswer
                };
            });

            console.log('[AI Generate] Transformed questions:', transformed);
            setPreviewQuestions(transformed);
            setSelectedIndices([]); // Start with none selected
            setShowPreviewModal(true);
            console.log('[AI Generate] Modal opened successfully');
        } catch (error) {
            console.error('[AI Generate] ERROR:', error);
            setIsGenerating(false); // Stop the loader BEFORE showing alert

            // Check for 403 Forbidden (past week protection)
            if (error.response && error.response.status === 403) {
                alert(`⚠️ Cannot generate questions for past weeks.\n\nPlease select the current week or a future week.`);
            } else {
                alert(`AI Generation failed. Please try again.`);
            }
            return; // Exit early
        }
        setIsGenerating(false);
    };

    const toggleSelection = (index) => {
        setSelectedIndices(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : (prev.length < 10 ? [...prev, index] : prev)
        );
    };

    const handleUpdatePreviewQuestion = (index, field, value) => {
        const updated = [...previewQuestions];
        if (field === 'options') {
            updated[index].options = value;
        } else {
            updated[index][field] = value;
        }
        setPreviewQuestions(updated);
    };

    const handleBulkSave = async () => {
        console.log('[Bulk Save] Starting save process...');
        console.log('[Bulk Save] Selected indices:', selectedIndices);

        if (selectedIndices.length !== 10) {
            console.warn('[Bulk Save] Invalid selection count:', selectedIndices.length);
            alert("Please select exactly 10 questions.");
            return;
        }

        try {
            const selected = selectedIndices.map((i, idx) => {
                const q = previewQuestions[i];
                return {
                    id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    text: q.text,
                    options: q.options,
                    answer: q.correct_answer,
                    order: idx + 1, // Add explicit order for the batch
                    week_id: selectedWeek
                };
            });

            console.log('[Bulk Save] Sending questions to backend:', selected);
            await addBatchQuestions(selected);
            console.log('[Bulk Save] Successfully saved to database');

            setShowPreviewModal(false);
            setPreviewQuestions([]);
            setSelectedIndices([]);
            loadData();

            console.log('[Bulk Save] Complete! Reloading questions list.');
        } catch (error) {
            console.error('[Bulk Save] ERROR:', error);
            console.error('[Bulk Save] Error stack:', error.stack);
            alert(`Failed to save questions: ${error.message}`);
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

    const handleViewUserAnswers = async (user) => {
        setSelectedUser(user);
        setUserSubmission(null);
        setLoadingSubmission(true);

        try {
            // user.user_id comes from the leaderboard response
            const submission = await getSubmissionDetails(user.user_id, selectedWeek);
            setUserSubmission(submission);
        } catch (error) {
            console.error('Failed to fetch submission details:', error);
            setUserSubmission({ error: true });
        } finally {
            setLoadingSubmission(false);
        }
    };

    const closeUserModal = () => {
        setSelectedUser(null);
        setUserSubmission(null);
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
                        {isPastWeek && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="bg-red-900/40 border-2 border-red-500 rounded-lg p-4 flex items-center gap-4 text-red-100 mb-6"
                            >
                                <AlertCircle className="text-red-400 shrink-0" size={28} />
                                <div className="font-sans">
                                    <p className="font-bold text-lg">Past Week Protected</p>
                                    <p className="text-sm opacity-90">Questions for <strong>{selectedWeek}</strong> cannot be modified. Please select the current or a future week to add or generate questions.</p>
                                </div>
                            </motion.div>
                        )}
                        <div>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                                <h2 className="text-xl sm:text-2xl font-serif text-warm-cream flex items-center gap-2 flex-wrap">
                                    <FileQuestion size={24} className="shrink-0" /> Manage Questions for <span className="text-antique-gold">{selectedWeek}</span>
                                </h2>
                                <button
                                    onClick={handleGenerateQuestions}
                                    disabled={isGenerating || isPastWeek}
                                    className={`py-2 px-3 sm:px-4 text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg rounded font-serif font-bold whitespace-nowrap shrink-0 ${isPastWeek
                                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                                        : 'btn-vintage bg-gradient-to-r from-antique-gold to-yellow-600 border-none hover:from-yellow-600 hover:to-antique-gold'
                                        }`}
                                >
                                    {isGenerating ? (
                                        <Sparkles className="animate-ai-sparkle" size={16} />
                                    ) : (
                                        <Sparkles size={16} />
                                    )}
                                    <span className="hidden sm:inline">{isGenerating ? 'Generating...' : 'AI Generate (Choose 10)'}</span>
                                    <span className="sm:hidden">{isGenerating ? 'Generating...' : 'AI Generate'}</span>
                                </button>
                            </div>

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
                                            {!isPastWeek && (
                                                <button
                                                    onClick={() => handleDeleteQuestion(q.id)}
                                                    className="text-red-400 hover:text-red-600 p-2 rounded hover:bg-red-50 transition-colors"
                                                    title="Delete Question"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {!isPastWeek && (
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
                        )}
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

                            {/* Tester Phones Section */}
                            <div className="mb-6 p-4 bg-purple-900/30 rounded border border-purple-500/30">
                                <label className="block font-sans text-warm-cream mb-2 font-bold">
                                    🧪 Tester Phone Numbers
                                </label>
                                <p className="text-sm text-gray-400 mb-3">
                                    These phone numbers can submit the quiz multiple times (useful for testing).
                                </p>
                                <input
                                    type="text"
                                    value={config.tester_phones?.join(', ') || ''}
                                    onChange={e => {
                                        const phones = e.target.value
                                            .split(',')
                                            .map(p => p.trim())
                                            .filter(p => p.length > 0);
                                        setConfig({ ...config, tester_phones: phones });
                                    }}
                                    placeholder="Enter phone numbers separated by commas (e.g., 9876543210, 9123456789)"
                                    className="input-vintage w-full"
                                />
                                {config.tester_phones?.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {config.tester_phones.map((phone, idx) => (
                                            <span key={idx} className="bg-purple-700/50 text-purple-200 px-2 py-1 rounded text-sm font-mono">
                                                {phone}
                                            </span>
                                        ))}
                                    </div>
                                )}
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
                                    {loadingLeaderboard ? (
                                        <tr>
                                            <td colSpan="5" className="p-8 text-center">
                                                <Loader2 className="animate-spin text-royal-blue mx-auto" size={32} />
                                                <p className="text-gray-500 mt-2">Loading leaderboard...</p>
                                            </td>
                                        </tr>
                                    ) : leaderboard.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="p-8 text-center text-gray-500">
                                                No results found for this selection.
                                            </td>
                                        </tr>
                                    ) : (
                                        leaderboard.map((u, i) => (
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
                                                            onClick={() => handleViewUserAnswers(u)}
                                                            className="text-royal-blue hover:text-antique-gold transition-colors"
                                                            title="View Answers"
                                                        >
                                                            <Eye size={20} />
                                                        </button>
                                                    </td>
                                                )}
                                            </motion.tr>
                                        ))
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
                                        <span className="text-sm ml-3 opacity-75">
                                            (Score: {selectedUser.score} | Time: {formatTime(selectedUser.time_taken)})
                                        </span>
                                    </h3>
                                    <button onClick={closeUserModal} className="hover:text-red-300">
                                        <X size={24} />
                                    </button>
                                </div>

                                <div className="p-6 overflow-y-auto space-y-4">
                                    {loadingSubmission ? (
                                        <div className="flex items-center justify-center py-12">
                                            <Loader2 className="animate-spin text-royal-blue" size={32} />
                                            <span className="ml-3 text-gray-600">Loading answers...</span>
                                        </div>
                                    ) : userSubmission?.error ? (
                                        <div className="text-center py-8 text-red-500">
                                            <AlertCircle className="mx-auto mb-2" size={32} />
                                            <p>Failed to load submission details.</p>
                                        </div>
                                    ) : (
                                        fullQuestions.map((q, index) => {
                                            const userAnswer = userSubmission?.answers?.[q.id];
                                            const isCorrect = userAnswer === q.correct_answer;

                                            return (
                                                <div
                                                    key={q.id}
                                                    className={`p-4 rounded border-2 ${isCorrect
                                                        ? 'border-green-300 bg-green-50'
                                                        : 'border-red-300 bg-red-50'
                                                        }`}
                                                >
                                                    <p className="font-serif text-lg text-royal-blue mb-3">
                                                        <span className="font-bold mr-2 text-gray-400">#{index + 1}</span>
                                                        {q.text}
                                                    </p>
                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                        <div>
                                                            <span className="text-gray-500">User's Answer:</span>
                                                            <span className={`ml-2 font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                                                {userAnswer || '(No answer)'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500">Correct:</span>
                                                            <span className="ml-2 font-bold text-green-700">{q.correct_answer}</span>
                                                        </div>
                                                    </div>
                                                    <div className="mt-2 text-right">
                                                        {isCorrect ? (
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
                                            );
                                        })
                                    )}
                                </div>

                                <div className="p-4 border-t bg-gray-50 flex justify-end">
                                    <button onClick={closeUserModal} className="btn-vintage py-2 px-6">Close</button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* AI PREVIEW MODAL */}
                <AnimatePresence>
                    {showPreviewModal && (
                        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md">
                            <motion.div
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-warm-cream w-full sm:max-w-5xl h-[90vh] sm:h-[80vh] overflow-hidden rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col border-2 border-antique-gold"
                            >
                                <div className="bg-royal-blue p-3 sm:p-6 flex flex-col sm:flex-row justify-between sm:items-center text-white border-b-4 border-antique-gold gap-2 sm:gap-0">
                                    <div className="flex items-start sm:items-center gap-2 sm:gap-3">
                                        <Sparkles className="text-antique-gold shrink-0 mt-1 sm:mt-0" size={24} />
                                        <div>
                                            <h3 className="text-lg sm:text-2xl font-serif leading-tight">AI Generated Questions Preview</h3>
                                            <p className="text-xs sm:text-sm text-gray-300 font-sans">Choose exactly <span className="text-antique-gold font-bold">10</span> questions to add to <span className="text-antique-gold font-bold">{selectedWeek}</span></p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
                                        <div className={`px-2 sm:px-4 py-1 sm:py-2 rounded-full font-bold font-sans border flex items-center gap-1 sm:gap-2 text-xs sm:text-base ${selectedIndices.length === 10 ? 'bg-green-600 border-green-400' : 'bg-red-900/50 border-red-500'}`}>
                                            {selectedIndices.length === 10 ? <Check size={14} /> : <AlertCircle size={14} />}
                                            {selectedIndices.length} / 10 Selected
                                        </div>
                                        <button onClick={() => setShowPreviewModal(false)} className="hover:text-red-300 transition-colors">
                                            <X size={24} />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-3 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 bg-paper-texture">
                                    {/* Helper Text - Not sticky on mobile to avoid blocking content */}
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-3 mb-2 sm:mb-4 flex items-start sm:items-center gap-2 text-xs sm:text-sm text-blue-800">
                                        <AlertCircle size={14} className="shrink-0 mt-0.5 sm:mt-0" />
                                        <span className="font-sans"><strong>Tip:</strong> <span className="hidden sm:inline">Click anywhere on a card to select/deselect. Click on question text or options to edit them inline before saving.</span><span className="sm:hidden">Tap card to select. Tap text to edit.</span></span>
                                    </div>
                                    {previewQuestions.map((q, index) => (
                                        <div
                                            key={index}
                                            className={`p-3 sm:p-5 rounded-lg border-2 transition-all cursor-pointer relative group ${selectedIndices.includes(index)
                                                ? 'bg-white border-royal-blue shadow-md'
                                                : 'bg-white/50 border-gray-200 hover:border-antique-gold'
                                                }`}
                                            onClick={() => toggleSelection(index)}
                                        >
                                            {/* Unified layout for all screen sizes */}
                                            <div className="space-y-3">
                                                {/* Header row: Number/Checkbox + Question count indicator */}
                                                <div className="flex items-center gap-3">
                                                    {/* Combined Number + Selection indicator */}
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm transition-all ${selectedIndices.includes(index) ? 'bg-royal-blue text-white ring-2 ring-royal-blue ring-offset-2' : 'bg-gray-200 text-gray-600'}`}>
                                                        {selectedIndices.includes(index) ? <Check size={18} /> : index + 1}
                                                    </div>
                                                    <span className="text-xs text-gray-400 uppercase tracking-wider">Question {index + 1}</span>
                                                </div>

                                                {/* Question Content - Full width */}
                                                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                                                    {/* Question Text Edit - Increased rows for longer text */}
                                                    <textarea
                                                        className="w-full bg-transparent border-none focus:ring-2 focus:ring-royal-blue rounded p-2 font-serif text-sm sm:text-base text-royal-blue resize-none hover:bg-blue-50/30 transition-colors"
                                                        value={q.text}
                                                        onChange={(e) => handleUpdatePreviewQuestion(index, 'text', e.target.value)}
                                                        rows={6}
                                                        title="Click to edit question text"
                                                        placeholder="Question text..."
                                                    />

                                                    {/* Options - Vertical stack to prevent overflow */}
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {q.options.map((opt, optIdx) => (
                                                            <div key={optIdx} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-300 hover:border-royal-blue hover:bg-blue-50/20 transition-colors">
                                                                <span className="text-royal-blue font-bold text-sm shrink-0">{String.fromCharCode(65 + optIdx)}:</span>
                                                                <input
                                                                    className="flex-1 min-w-0 bg-transparent border-none focus:ring-1 focus:ring-royal-blue text-sm text-gray-800 font-medium placeholder-gray-400"
                                                                    value={opt}
                                                                    onChange={(e) => {
                                                                        const newOpts = [...q.options];
                                                                        newOpts[optIdx] = e.target.value;
                                                                        handleUpdatePreviewQuestion(index, 'options', newOpts);
                                                                    }}
                                                                    title="Click to edit this option"
                                                                    placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Correct Answer Selection - Wrapped properly */}
                                                    <div className="flex flex-wrap items-center gap-2 pt-1">
                                                        <span className="font-bold text-gray-500 uppercase tracking-widest text-xs shrink-0">Correct:</span>
                                                        <select
                                                            className="bg-green-50 text-green-800 font-bold border border-green-200 rounded px-2 py-1.5 focus:ring-2 focus:ring-green-500 text-xs w-full sm:w-auto sm:max-w-xs"
                                                            value={q.correct_answer}
                                                            onChange={(e) => handleUpdatePreviewQuestion(index, 'correct_answer', e.target.value)}
                                                        >
                                                            {q.options.map((opt, optIdx) => (
                                                                <option key={optIdx} value={opt}>{String.fromCharCode(65 + optIdx)}: {opt.length > 40 ? opt.substring(0, 40) + '...' : opt}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="p-3 sm:p-6 border-t-2 border-antique-gold/20 bg-white flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                                    <div className="text-gray-500 font-serif italic text-xs sm:text-base text-center sm:text-left">
                                        {selectedIndices.length} items ready to be added to <span className="text-royal-blue font-bold">{selectedWeek}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                                        <button
                                            onClick={async () => {
                                                setShowPreviewModal(false);
                                                await handleGenerateQuestions();
                                            }}
                                            disabled={isGenerating}
                                            className="px-4 sm:px-8 py-2 sm:py-3 rounded-lg border-2 border-antique-gold font-serif font-bold text-royal-blue hover:bg-antique-gold hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                                        >
                                            {isGenerating ? (
                                                <Sparkles className="animate-ai-sparkle" size={16} />
                                            ) : (
                                                <Sparkles size={16} />
                                            )}
                                            <span className="hidden sm:inline">{isGenerating ? 'Generating...' : 'Regenerate New Set'}</span>
                                            <span className="sm:hidden">{isGenerating ? 'Generating...' : 'Regenerate'}</span>
                                        </button>
                                        <button
                                            onClick={handleBulkSave}
                                            disabled={selectedIndices.length !== 10}
                                            className={`px-6 sm:px-10 py-2 sm:py-3 rounded-lg font-serif font-bold transition-all shadow-xl flex items-center justify-center gap-2 text-sm sm:text-base ${selectedIndices.length === 10
                                                ? 'bg-royal-blue text-white hover:scale-105 active:scale-95'
                                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                }`}
                                        >
                                            <Save size={18} />
                                            Save Selected 10
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* AI Generation Loading Overlay */}
                <AnimatePresence>
                    {isGenerating && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-midnight-blue/90 border border-cyan-500/30 rounded-2xl p-4 sm:p-8 shadow-2xl w-full max-w-xs sm:max-w-sm"
                            >
                                <AiLoader />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default AdminDashboard;
