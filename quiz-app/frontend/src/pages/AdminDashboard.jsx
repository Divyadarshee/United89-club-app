import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuestions, getUsers, deleteQuestion, addQuestion, updateConfig, getConfig, getAdminQuestions } from '../services/api';
import { Trash2, Plus, Settings, Users, FileQuestion, Save, Eye, X } from 'lucide-react';

function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('questions');
    const [questions, setQuestions] = useState([]);
    const [users, setUsers] = useState([]);
    const [fullQuestions, setFullQuestions] = useState([]); // For answer checking
    const [config, setConfig] = useState({ timer_duration_minutes: 10 });
    const [selectedUser, setSelectedUser] = useState(null); // For modal

    // New Question Form
    const [newQ, setNewQ] = useState({ text: '', opt1: '', opt2: '', opt3: '', opt4: '', answer: '' });

    useEffect(() => {
        loadData();
    }, [activeTab]);

    const formatTime = (seconds) => {
        if (!seconds && seconds !== 0) return '-';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const loadData = async () => {
        if (activeTab === 'questions') {
            const q = await getQuestions();
            setQuestions(q);
        } else if (activeTab === 'users') {
            const [u, fq] = await Promise.all([getUsers(), getAdminQuestions()]);
            setUsers(u);
            setFullQuestions(fq);
        } else if (activeTab === 'settings') {
            const c = await getConfig();
            setConfig(c);
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
            order: questions.length + 1
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
        await updateConfig({ ...config, quiz_active: true });
        alert('Settings Updated');
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
        <div className="w-full max-w-5xl mx-auto p-4">
            <h1 className="text-4xl font-serif text-white mb-8 drop-shadow-md border-b border-antique-gold/30 pb-4">
                Admin Dashboard
            </h1>

            {/* Tabs */}
            <div className="flex gap-2 mb-0 overflow-x-auto">
                <TabButton id="questions" label="Questions" icon={FileQuestion} />
                <TabButton id="settings" label="Settings" icon={Settings} />
                <TabButton id="users" label="Leaderboard" icon={Users} />
            </div>

            {/* Main Content Card */}
            <div className="card-vintage rounded-tl-none min-h-[600px]">

                {/* QUESTIONS TAB */}
                {activeTab === 'questions' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-serif text-warm-cream mb-4 flex items-center gap-2">
                                <FileQuestion size={24} /> Manage Questions
                            </h2>
                            <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3">
                                {questions.map((q) => (
                                    <div key={q.id} className="bg-white p-4 rounded border border-gray-200 shadow-sm flex justify-between items-center group hover:border-antique-gold transition-colors">
                                        <span className="font-sans text-text-charcoal font-medium">{q.text}</span>
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
                        </div>

                        <div className="border-t-2 border-antique-gold/20 pt-8">
                            <h3 className="text-xl font-serif text-warm-cream mb-4 flex items-center gap-2">
                                <Plus size={20} /> Add New Question
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
                                <button type="submit" className="btn-vintage md:col-span-2 mt-2">Add Question</button>
                            </form>
                        </div>
                    </motion.div>
                )}

                {/* SETTINGS TAB */}
                {activeTab === 'settings' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="text-2xl font-serif text-warm-cream mb-6 flex items-center gap-2">
                            <Settings size={24} /> Quiz Configuration
                        </h2>
                        <form onSubmit={handleUpdateConfig} className="max-w-md">
                            <label className="block font-sans text-warm-cream mb-2 font-bold">Timer Duration (Minutes)</label>
                            <input
                                type="number"
                                value={config.timer_duration_minutes}
                                onChange={e => setConfig({ ...config, timer_duration_minutes: parseInt(e.target.value) })}
                                className="input-vintage text-lg mb-6"
                            />

                            <div className="flex items-center gap-4 mb-2 p-4 bg-midnight-blue/30 rounded border border-antique-gold/30">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={config.leaderboard_active}
                                        onChange={e => setConfig({ ...config, leaderboard_active: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-antique-gold"></div>
                                    <span className="ml-3 font-serif font-bold text-warm-cream">Show Leaderboard to Users</span>
                                </label>
                            </div>
                            <p className="text-sm text-gray-400 mb-6 italic">
                                ⚠️ Enabling this will close the quiz to new submissions
                            </p>

                            <button type="submit" className="btn-vintage flex items-center gap-2">
                                <Save size={20} /> Save Configuration
                            </button>
                        </form>
                    </motion.div>
                )}

                {/* LEADERBOARD TAB */}
                {activeTab === 'users' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <h2 className="text-2xl font-serif text-warm-cream mb-6 flex items-center gap-2">
                            <Users size={24} /> Leaderboard
                        </h2>
                        <div className="overflow-x-auto border rounded-lg border-antique-gold/30">
                            <table className="w-full table-auto">
                                <thead className="bg-royal-blue text-white font-serif">
                                    <tr>
                                        <th className="p-4 text-left">Name</th>
                                        <th className="p-4 text-left">Phone</th>
                                        <th className="p-4 text-left">Score</th>
                                        <th className="p-4 text-left">Time</th>
                                        <th className="p-4 text-left">Status</th>
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
                                    {users.map((u, i) => (
                                        <motion.tr
                                            key={u.user_id}
                                            variants={{
                                                hidden: { opacity: 0, y: 10 },
                                                visible: { opacity: 1, y: 0 }
                                            }}
                                            className={`hover:bg-warm-cream transition-colors ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                                        >
                                            <td className="p-4 font-bold text-royal-blue">{u.name}</td>
                                            <td className="p-4 text-gray-600">{u.phone}</td>
                                            <td className="p-4 font-bold text-antique-gold text-lg">{u.score}</td>
                                            <td className="p-4 font-mono text-gray-700">{formatTime(u.time_taken)}</td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => setSelectedUser(u)}
                                                    className="text-royal-blue hover:text-antique-gold transition-colors"
                                                    title="View Answers"
                                                >
                                                    <Eye size={20} />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    ))}
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
                                        const userAnswer = selectedUser.answers ? selectedUser.answers[q.id] : null;
                                        const isCorrect = userAnswer === q.correct_answer;
                                        const isUnanswered = !userAnswer;

                                        return (
                                            <div key={q.id} className={`p-4 rounded border-l-4 ${isCorrect ? 'border-green-500 bg-green-50' : isUnanswered ? 'border-gray-400 bg-gray-50' : 'border-red-500 bg-red-50'}`}>
                                                <p className="font-serif text-lg text-royal-blue mb-2">
                                                    <span className="font-bold mr-2 text-gray-400">#{index + 1}</span>
                                                    {q.text}
                                                </p>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm font-sans">
                                                    <div className={`${isCorrect ? 'text-green-700 font-bold' : 'text-red-600'}`}>
                                                        User Answer: {userAnswer || <span className="italic text-gray-500">Skipped</span>}
                                                    </div>
                                                    <div className="text-gray-600">
                                                        Correct Answer: <span className="font-bold">{q.correct_answer}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {fullQuestions.length === 0 && <p className="text-center text-gray-500">No questions loaded to compare against.</p>}
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
