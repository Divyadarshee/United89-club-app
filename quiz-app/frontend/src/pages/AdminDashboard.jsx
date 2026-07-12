import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getQuestions, getUsers, deleteQuestion, addQuestion, updateConfig, getConfig, getAdminQuestions, getLeaderboard, getWeeks, generateQuestions, addBatchQuestions, getSubmissionDetails, deleteTesterSubmission, generateTrendingTopics, generateTieredQuestions, regenerateQuestionsWithFeedback } from '../services/api';
import { Trash2, Plus, Settings, Users, FileQuestion, Save, Eye, X, Calendar, Globe, Award, Sparkles, Check, AlertCircle, Loader2, RefreshCw, ChevronRight, Search, MessageSquare } from 'lucide-react';
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

    // NEW: Two-Step Generation States
    const [generationStep, setGenerationStep] = useState(0); // 0=none, 1=topics, 2=questions
    const [trendingTopics, setTrendingTopics] = useState([]);
    const [selectedTopics, setSelectedTopics] = useState([]);
    const [showTopicsModal, setShowTopicsModal] = useState(false);
    const [tieredQuestions, setTieredQuestions] = useState({ easy_questions: [], medium_questions: [], hard_questions: [] });
    const [selectedEasy, setSelectedEasy] = useState([]);
    const [selectedMedium, setSelectedMedium] = useState([]);
    const [selectedHard, setSelectedHard] = useState([]);
    
    // NEW: Session and Feedback States for Regeneration
    const [quizSessionId, setQuizSessionId] = useState(null);
    const [showFeedbackInput, setShowFeedbackInput] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [loaderMode, setLoaderMode] = useState('default'); // 'topics', 'questions', 'regenerate', 'default'

    // NEW: AI Prompter/Custom Theme States
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [activePrompt, setActivePrompt] = useState('');
    const [promptTargetFlow, setPromptTargetFlow] = useState('new'); // 'new' or 'legacy'

    const preGenSuggestions = [
        "General News & Trivia",
        "Sports & Athletics Focus",
        "Science, Tech & Space",
        "Politics & Business",
        "Indian History & Culture",
        "Entertainment & Pop Culture"
    ];

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
                    getLeaderboard(type, selectedWeek, true),
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

    const handleGenerateQuestions = async (promptVal = null) => {
        setActivePrompt(promptVal || '');
        setIsGenerating(true);
        console.log('[AI Generate] Starting question generation with prompt:', promptVal);

        try {
            const result = await generateQuestions(selectedWeek, promptVal);
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

    // ============================================
    // NEW TWO-STEP GENERATION FUNCTIONS
    // ============================================

    const handleStartNewGeneration = async (promptVal = null) => {
        setActivePrompt(promptVal || '');
        setIsGenerating(true);
        setGenerationStep(1);
        setLoaderMode('topics');
        console.log('[Step 1] Fetching trending topics with prompt:', promptVal);

        try {
            const result = await generateTrendingTopics(selectedWeek, promptVal);
            console.log('[Step 1] Trending topics received:', result);
            
            setTrendingTopics(result.topics || []);
            setSelectedTopics([]);
            setShowTopicsModal(true);
        } catch (error) {
            console.error('[Step 1] ERROR:', error);
            setGenerationStep(0);
            
            if (error.response && error.response.status === 403) {
                alert(`⚠️ Cannot generate for past weeks.\n\nPlease select the current week or a future week.`);
            } else {
                alert(`Failed to fetch trending topics. Please try again.`);
            }
        }
        setIsGenerating(false);
    };

    const handleStartNewGenerationClick = () => {
        setPromptTargetFlow('new');
        setCustomPrompt('');
        setShowPromptModal(true);
    };

    const handleGenerateQuestionsClick = () => {
        setPromptTargetFlow('legacy');
        setCustomPrompt('');
        setShowPromptModal(true);
    };

    const triggerPromptGeneration = (promptVal) => {
        setShowPromptModal(false);
        if (promptTargetFlow === 'new') {
            handleStartNewGeneration(promptVal);
        } else {
            handleGenerateQuestions(promptVal);
        }
    };

    const handleTopicToggle = (topic) => {
        setSelectedTopics(prev => {
            if (prev.includes(topic)) {
                return prev.filter(t => t !== topic);
            } else if (prev.length < 5) {
                return [...prev, topic];
            }
            return prev;
        });
    };

    const handleGenerateTieredQuestions = async () => {
        if (selectedTopics.length === 0) {
            alert('Please select at least 1 topic for current affairs questions.');
            return;
        }

        setIsGenerating(true);
        setGenerationStep(2);
        setLoaderMode('questions');
        setShowTopicsModal(false);
        setShowFeedbackInput(false);
        setFeedbackText('');
        console.log('[Step 2] Generating tiered questions with topics:', selectedTopics);

        try {
            const result = await generateTieredQuestions(selectedWeek, selectedTopics);
            console.log('[Step 2] Tiered questions received:', result);

            // Store session ID for regeneration with memory
            if (result.session_id) {
                setQuizSessionId(result.session_id);
                console.log('[Step 2] Session ID stored:', result.session_id);
            }

            // Transform the questions
            const transformQuestion = (q) => {
                const letterToIndex = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
                const answerIndex = letterToIndex[q.correct_answer.toLowerCase()];
                const actualAnswer = q.choices[answerIndex];
                return {
                    text: q.question,
                    options: q.choices,
                    correct_answer: actualAnswer,
                    category: q.category || 'miscellaneous'
                };
            };

            const questions = result.questions || result;
            setTieredQuestions({
                easy_questions: (questions.easy_questions || []).map(transformQuestion),
                medium_questions: (questions.medium_questions || []).map(transformQuestion),
                hard_questions: (questions.hard_questions || []).map(transformQuestion)
            });
            
            // Reset selections
            setSelectedEasy([]);
            setSelectedMedium([]);
            setSelectedHard([]);
            setShowPreviewModal(true);
        } catch (error) {
            console.error('[Step 2] ERROR:', error);
            setGenerationStep(0);
            alert(`Failed to generate questions. Please try again.`);
        }
        setIsGenerating(false);
    };

    const handleRegenerateTieredQuestions = async () => {
        // Regenerate tiered questions with the same selected topics
        if (selectedTopics.length === 0) {
            // If no topics selected (shouldn't happen), go back to topics selection
            setShowPreviewModal(false);
            setShowTopicsModal(true);
            return;
        }

        // If no feedback provided, use a default message
        const feedback = feedbackText.trim() || 'Generate different questions';
        
        setIsGenerating(true);
        setLoaderMode('regenerate');
        setShowFeedbackInput(false);
        console.log('[Regenerate] Regenerating with feedback:', feedback);
        console.log('[Regenerate] Session ID:', quizSessionId);

        try {
            let result;
            
            // Use session-based regeneration if we have a session ID
            if (quizSessionId) {
                result = await regenerateQuestionsWithFeedback(selectedWeek, quizSessionId, feedback);
                console.log('[Regenerate] Used agent memory for regeneration');
            } else {
                // Fallback to fresh generation if no session
                result = await generateTieredQuestions(selectedWeek, selectedTopics);
                console.log('[Regenerate] Fallback: Fresh generation (no session)');
            }
            
            console.log('[Regenerate] New tiered questions received:', result);

            // Update session ID if returned
            if (result.session_id) {
                setQuizSessionId(result.session_id);
            }

            // Transform the questions (same as handleGenerateTieredQuestions)
            const transformQuestion = (q) => {
                const letterToIndex = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
                const answerIndex = letterToIndex[q.correct_answer.toLowerCase()];
                const actualAnswer = q.choices[answerIndex];
                return {
                    text: q.question,
                    options: q.choices,
                    correct_answer: actualAnswer,
                    category: q.category || 'miscellaneous'
                };
            };

            const questions = result.questions || result;
            setTieredQuestions({
                easy_questions: (questions.easy_questions || []).map(transformQuestion),
                medium_questions: (questions.medium_questions || []).map(transformQuestion),
                hard_questions: (questions.hard_questions || []).map(transformQuestion)
            });
            
            // Reset selections and feedback
            setSelectedEasy([]);
            setSelectedMedium([]);
            setSelectedHard([]);
            setFeedbackText('');
        } catch (error) {
            console.error('[Regenerate] ERROR:', error);
            alert(`Failed to regenerate questions. Please try again.`);
        }
        setIsGenerating(false);
    };

    // Quick feedback options for regeneration
    const quickFeedbackOptions = [
        { label: '🔄 Different Questions', value: 'Generate completely different questions on the same topics' },
        { label: '😰 Too Difficult', value: 'The questions are too difficult. Make them easier and more accessible' },
        { label: '😴 Too Easy', value: 'The questions are too easy. Make them more challenging' },
        { label: '🎯 More Current Affairs', value: 'Include more current affairs and recent news questions' },
        { label: '🎬 More Pop Culture', value: 'Include more Bollywood, cricket, and entertainment questions' },
        { label: '🇮🇳 More India-Focused', value: 'Focus more on Indian history, geography, and culture' },
    ];

    const handleQuickFeedback = (feedback) => {
        setFeedbackText(feedback);
    };

    const toggleTieredSelection = (difficulty, index) => {
        const limits = { easy: 5, medium: 3, hard: 2 };
        const setters = { easy: setSelectedEasy, medium: setSelectedMedium, hard: setSelectedHard };
        const current = { easy: selectedEasy, medium: selectedMedium, hard: selectedHard };

        const setter = setters[difficulty];
        const currentSelection = current[difficulty];
        const limit = limits[difficulty];

        setter(prev => {
            if (prev.includes(index)) {
                return prev.filter(i => i !== index);
            } else if (prev.length < limit) {
                return [...prev, index];
            }
            return prev;
        });
    };

    const handleBulkSaveTiered = async () => {
        const totalSelected = selectedEasy.length + selectedMedium.length + selectedHard.length;
        
        if (selectedEasy.length !== 5 || selectedMedium.length !== 3 || selectedHard.length !== 2) {
            alert(`Please select exactly 5 Easy, 3 Medium, and 2 Hard questions.\n\nCurrently: ${selectedEasy.length} Easy, ${selectedMedium.length} Medium, ${selectedHard.length} Hard`);
            return;
        }

        try {
            const allSelected = [
                ...selectedEasy.map((i, order) => ({ ...tieredQuestions.easy_questions[i], order: order + 1, difficulty: 'easy' })),
                ...selectedMedium.map((i, order) => ({ ...tieredQuestions.medium_questions[i], order: order + 6, difficulty: 'medium' })),
                ...selectedHard.map((i, order) => ({ ...tieredQuestions.hard_questions[i], order: order + 9, difficulty: 'hard' }))
            ];

            const questionsToSave = allSelected.map((q, idx) => ({
                id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                text: q.text,
                options: q.options,
                answer: q.correct_answer,
                order: idx + 1,
                week_id: selectedWeek
            }));

            console.log('[Bulk Save] Saving tiered questions:', questionsToSave);
            await addBatchQuestions(questionsToSave);

            setShowPreviewModal(false);
            setGenerationStep(0);
            setTieredQuestions({ easy_questions: [], medium_questions: [], hard_questions: [] });
            setSelectedEasy([]);
            setSelectedMedium([]);
            setSelectedHard([]);
            loadData();
        } catch (error) {
            console.error('[Bulk Save] ERROR:', error);
            alert(`Failed to save questions: ${error.message}`);
        }
    };

    const getCategoryBadgeColor = (category) => {
        const colors = {
            'current_affairs': 'bg-red-100 text-red-800 border-red-200',
            'pop_culture': 'bg-purple-100 text-purple-800 border-purple-200',
            'history_heritage': 'bg-amber-100 text-amber-800 border-amber-200',
            'world_geography': 'bg-blue-100 text-blue-800 border-blue-200',
            'science_technology': 'bg-green-100 text-green-800 border-green-200',
            'miscellaneous': 'bg-gray-100 text-gray-800 border-gray-200'
        };
        return colors[category] || colors['miscellaneous'];
    };

    const getCategoryLabel = (category) => {
        const labels = {
            'current_affairs': '🇮🇳 Current Affairs',
            'pop_culture': '📺 Pop Culture',
            'history_heritage': '🏛️ History',
            'world_geography': '🌍 Geography',
            'science_technology': '🔬 Science',
            'miscellaneous': '🎯 Misc'
        };
        return labels[category] || '🎯 Misc';
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
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleStartNewGenerationClick}
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
                                        <span className="hidden sm:inline">{isGenerating ? 'Generating...' : '✨ AI Generate (New)'}</span>
                                        <span className="sm:hidden">{isGenerating ? '...' : '✨ New'}</span>
                                    </button>
                                    <button
                                        onClick={handleGenerateQuestionsClick}
                                        disabled={isGenerating || isPastWeek}
                                        className={`py-2 px-3 text-xs flex items-center gap-2 transition-all rounded font-serif font-bold whitespace-nowrap shrink-0 opacity-60 ${isPastWeek
                                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                            : 'bg-gray-500 text-white hover:bg-gray-600'
                                            }`}
                                        title="Legacy: Generate without trending topics"
                                    >
                                        <span className="hidden sm:inline">Legacy</span>
                                        <span className="sm:hidden">Old</span>
                                    </button>
                                </div>
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

                            {/* Note about automatic score visibility */}
                            <div className="mb-6 p-4 bg-blue-900/30 rounded border border-blue-500/30">
                                <p className="text-sm text-blue-200">
                                    <strong>📊 Score Visibility:</strong> Leaderboard is always visible.
                                    Scores and answers are automatically hidden for the current week and revealed for past weeks.
                                </p>
                            </div>

                            {/* Tester Phones Section */}
                            <div className="mb-6 p-4 bg-purple-900/30 rounded border border-purple-500/30">
                                <label className="block font-sans text-warm-cream mb-2 font-bold">
                                    🧪 Tester Phone Numbers
                                </label>
                                <p className="text-sm text-gray-400 mb-3">
                                    These phone numbers can submit the quiz multiple times (useful for testing).
                                </p>

                                {/* Tag Display */}
                                {config.tester_phones?.length > 0 && (
                                    <div className="mb-3 flex flex-wrap gap-2">
                                        {config.tester_phones.map((phone, idx) => (
                                            <div
                                                key={idx}
                                                className="bg-purple-700/50 text-purple-200 px-3 py-1 rounded-full text-sm font-mono flex items-center gap-2"
                                            >
                                                {phone}
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        if (window.confirm(`Reset submission for ${phone} in week ${selectedWeek}?`)) {
                                                            try {
                                                                await deleteTesterSubmission(phone, selectedWeek);
                                                                alert(`Submission reset for ${phone}!`);
                                                            } catch (err) {
                                                                alert(err.response?.data?.detail || 'Failed to reset submission');
                                                            }
                                                        }
                                                    }}
                                                    title="Reset this tester's submission"
                                                    className="text-purple-400 hover:text-green-400 transition-colors"
                                                >
                                                    <RefreshCw size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const updated = config.tester_phones.filter((_, i) => i !== idx);
                                                        setConfig({ ...config, tester_phones: updated });
                                                    }}
                                                    title="Remove tester"
                                                    className="text-purple-400 hover:text-red-400 transition-colors"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Add New Phone Input */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        id="new-tester-phone"
                                        placeholder="Enter phone number (e.g., 9876543210)"
                                        className="input-vintage flex-1"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const input = e.target;
                                                const phone = input.value.trim().replace(/\D/g, '');
                                                if (phone && phone.length >= 10) {
                                                    const existing = config.tester_phones || [];
                                                    if (!existing.includes(phone)) {
                                                        setConfig({ ...config, tester_phones: [...existing, phone] });
                                                    }
                                                    input.value = '';
                                                }
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const input = document.getElementById('new-tester-phone');
                                            const phone = input.value.trim().replace(/\D/g, '');
                                            if (phone && phone.length >= 10) {
                                                const existing = config.tester_phones || [];
                                                if (!existing.includes(phone)) {
                                                    setConfig({ ...config, tester_phones: [...existing, phone] });
                                                }
                                                input.value = '';
                                            }
                                        }}
                                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold transition-colors"
                                    >
                                        + Add
                                    </button>
                                </div>
                                <small className="text-gray-500 text-xs mt-1 block">Press Enter or click Add to add a tester phone</small>
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
                                        <th className="p-4 text-left">Phone</th>
                                        <th className="p-4 text-left">Score</th>
                                        {leaderboardType === 'weekly' && <th className="p-4 text-left">Time</th>}
                                        {leaderboardType === 'overall' && <th className="p-4 text-left">Quizzes</th>}
                                        {leaderboardType === 'overall' && <th className="p-4 text-left">Avg Time</th>}
                                        {leaderboardType === 'weekly' && <th className="p-4 text-left">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {loadingLeaderboard ? (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center">
                                                <Loader2 className="animate-spin text-royal-blue mx-auto" size={32} />
                                                <p className="text-gray-500 mt-2">Loading leaderboard...</p>
                                            </td>
                                        </tr>
                                    ) : leaderboard.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-gray-500">
                                                No results found for this selection.
                                            </td>
                                        </tr>
                                    ) : (
                                        leaderboard.map((u, i) => (
                                            <motion.tr
                                                key={u.user_id || i}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className={`hover:bg-warm-cream transition-colors ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                                            >
                                                <td className="p-4 font-bold text-gray-400">#{u.rank}</td>
                                                <td className="p-4 font-bold text-royal-blue">{u.name}</td>
                                                <td className="p-4 font-mono text-gray-600">{u.user_id || '-'}</td>
                                                <td className="p-4 font-bold text-antique-gold text-lg">{u.score}</td>
                                                {leaderboardType === 'weekly' && (
                                                    <td className="p-4 font-mono text-gray-700">{formatTime(u.time_taken)}</td>
                                                )}
                                                {leaderboardType === 'overall' && (
                                                    <td className="p-4 font-mono text-gray-700 whitespace-nowrap">
                                                        {u.weeks_played}{u.total_weeks ? ` / ${u.total_weeks}` : ''}
                                                    </td>
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
                                </tbody>
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

                {/* TRENDING TOPICS MODAL (Step 1) */}
                <AnimatePresence>
                    {showTopicsModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                            <motion.div
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-warm-cream w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl shadow-2xl flex flex-col border-2 border-antique-gold"
                            >
                                <div className="bg-royal-blue p-4 sm:p-6 text-white border-b-4 border-antique-gold">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Search className="text-antique-gold" size={28} />
                                            <div>
                                                <h3 className="text-xl sm:text-2xl font-serif">Step 1: Select Trending Topics</h3>
                                                <p className="text-sm text-gray-300">Choose 1-5 topics for current affairs questions</p>
                                            </div>
                                        </div>
                                        <button onClick={() => { setShowTopicsModal(false); setGenerationStep(0); }} className="hover:text-red-300">
                                            <X size={24} />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-4 sm:p-6 overflow-y-auto space-y-3 bg-paper-texture flex-1">
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-blue-800">
                                        <AlertCircle size={16} />
                                        <span><strong>Tip:</strong> These topics will be used to generate Current Affairs questions (~25% of the quiz).</span>
                                    </div>

                                    {trendingTopics.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500">
                                            <Loader2 className="animate-spin mx-auto mb-4" size={32} />
                                            <p>Loading trending topics...</p>
                                        </div>
                                    ) : (
                                        trendingTopics.map((topic, index) => (
                                            <div
                                                key={index}
                                                onClick={() => handleTopicToggle(topic.topic)}
                                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedTopics.includes(topic.topic)
                                                    ? 'bg-white border-royal-blue shadow-md ring-2 ring-royal-blue/20'
                                                    : 'bg-white/70 border-gray-200 hover:border-antique-gold hover:bg-white'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1 ${selectedTopics.includes(topic.topic) ? 'bg-royal-blue text-white' : 'bg-gray-200 text-gray-400'}`}>
                                                        {selectedTopics.includes(topic.topic) ? <Check size={14} /> : index + 1}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-serif font-bold text-royal-blue text-lg">{topic.topic}</h4>
                                                        <p className="text-gray-600 text-sm mt-1">{topic.description}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="p-4 sm:p-6 border-t-2 border-antique-gold/20 bg-white flex justify-between items-center">
                                    <div className={`px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 ${selectedTopics.length > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                                        {selectedTopics.length > 0 ? <Check size={14} /> : <AlertCircle size={14} />}
                                        {selectedTopics.length} / 5 Topics Selected
                                    </div>
                                    <button
                                        onClick={handleGenerateTieredQuestions}
                                        disabled={selectedTopics.length === 0 || isGenerating}
                                        className={`px-6 py-3 rounded-lg font-serif font-bold transition-all flex items-center gap-2 ${selectedTopics.length > 0
                                            ? 'bg-royal-blue text-white hover:bg-royal-blue/90 shadow-lg'
                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            }`}
                                    >
                                        Generate Questions <ChevronRight size={18} />
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* TIERED QUESTIONS PREVIEW MODAL (Step 2) */}
                <AnimatePresence>
                    {showPreviewModal && generationStep === 2 && (
                        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md">
                            <motion.div
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-warm-cream w-full sm:max-w-6xl h-[95vh] sm:h-[90vh] overflow-hidden rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col border-2 border-antique-gold"
                            >
                                <div className="bg-royal-blue p-3 sm:p-5 text-white border-b-4 border-antique-gold">
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                        <div className="flex items-center gap-3">
                                            <Sparkles className="text-antique-gold" size={24} />
                                            <div>
                                                <h3 className="text-lg sm:text-xl font-serif">Step 2: Select Questions by Difficulty</h3>
                                                <p className="text-xs sm:text-sm text-gray-300">Choose <span className="text-green-300 font-bold">5 Easy</span> + <span className="text-yellow-300 font-bold">3 Medium</span> + <span className="text-red-300 font-bold">2 Hard</span> = 10 questions</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-4">
                                            <div className="flex gap-2 text-xs sm:text-sm">
                                                <span className={`px-2 py-1 rounded ${selectedEasy.length === 5 ? 'bg-green-600' : 'bg-green-900/50'}`}>🟢 {selectedEasy.length}/5</span>
                                                <span className={`px-2 py-1 rounded ${selectedMedium.length === 3 ? 'bg-yellow-600' : 'bg-yellow-900/50'}`}>🟡 {selectedMedium.length}/3</span>
                                                <span className={`px-2 py-1 rounded ${selectedHard.length === 2 ? 'bg-red-600' : 'bg-red-900/50'}`}>🔴 {selectedHard.length}/2</span>
                                            </div>
                                            <button onClick={() => { setShowPreviewModal(false); setGenerationStep(0); }} className="hover:text-red-300">
                                                <X size={24} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6 bg-paper-texture">
                                    {/* EASY QUESTIONS */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 sticky top-0 bg-green-100 p-3 rounded-lg border-2 border-green-300 z-10">
                                            <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">🟢</div>
                                            <div className="flex-1">
                                                <h4 className="font-serif font-bold text-green-800">Easy Questions</h4>
                                                <p className="text-xs text-green-600">Select 5 of {tieredQuestions.easy_questions.length} questions</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedEasy.length === 5 ? 'bg-green-500 text-white' : 'bg-green-200 text-green-700'}`}>
                                                {selectedEasy.length}/5
                                            </span>
                                        </div>
                                        {tieredQuestions.easy_questions.map((q, index) => (
                                            <div
                                                key={`easy-${index}`}
                                                onClick={() => toggleTieredSelection('easy', index)}
                                                className={`p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedEasy.includes(index)
                                                    ? 'bg-green-50 border-green-400 shadow-md'
                                                    : 'bg-white border-gray-200 hover:border-green-300'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${selectedEasy.includes(index) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                                        {selectedEasy.includes(index) ? <Check size={14} /> : index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getCategoryBadgeColor(q.category)}`}>
                                                                {getCategoryLabel(q.category)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm sm:text-base text-gray-800 font-medium mb-2">{q.text}</p>
                                                        {/* OPTIONS */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                                                            {q.options && q.options.map((opt, optIdx) => (
                                                                <div key={optIdx} className={`px-2 py-1 rounded ${opt === q.correct_answer ? 'bg-green-100 text-green-800 font-bold' : 'bg-gray-100 text-gray-600'}`}>
                                                                    <span className="font-bold mr-1">{String.fromCharCode(65 + optIdx)}:</span>{opt}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* MEDIUM QUESTIONS */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 sticky top-0 bg-yellow-100 p-3 rounded-lg border-2 border-yellow-300 z-10">
                                            <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold">🟡</div>
                                            <div className="flex-1">
                                                <h4 className="font-serif font-bold text-yellow-800">Medium Questions</h4>
                                                <p className="text-xs text-yellow-600">Select 3 of {tieredQuestions.medium_questions.length} questions</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedMedium.length === 3 ? 'bg-yellow-500 text-white' : 'bg-yellow-200 text-yellow-700'}`}>
                                                {selectedMedium.length}/3
                                            </span>
                                        </div>
                                        {tieredQuestions.medium_questions.map((q, index) => (
                                            <div
                                                key={`medium-${index}`}
                                                onClick={() => toggleTieredSelection('medium', index)}
                                                className={`p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedMedium.includes(index)
                                                    ? 'bg-yellow-50 border-yellow-400 shadow-md'
                                                    : 'bg-white border-gray-200 hover:border-yellow-300'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${selectedMedium.includes(index) ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                                        {selectedMedium.includes(index) ? <Check size={14} /> : index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getCategoryBadgeColor(q.category)}`}>
                                                                {getCategoryLabel(q.category)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm sm:text-base text-gray-800 font-medium mb-2">{q.text}</p>
                                                        {/* OPTIONS */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                                                            {q.options && q.options.map((opt, optIdx) => (
                                                                <div key={optIdx} className={`px-2 py-1 rounded ${opt === q.correct_answer ? 'bg-green-100 text-green-800 font-bold' : 'bg-gray-100 text-gray-600'}`}>
                                                                    <span className="font-bold mr-1">{String.fromCharCode(65 + optIdx)}:</span>{opt}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* HARD QUESTIONS */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3 sticky top-0 bg-red-100 p-3 rounded-lg border-2 border-red-300 z-10">
                                            <div className="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center font-bold">🔴</div>
                                            <div className="flex-1">
                                                <h4 className="font-serif font-bold text-red-800">Hard Questions</h4>
                                                <p className="text-xs text-red-600">Select 2 of {tieredQuestions.hard_questions.length} questions</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${selectedHard.length === 2 ? 'bg-red-500 text-white' : 'bg-red-200 text-red-700'}`}>
                                                {selectedHard.length}/2
                                            </span>
                                        </div>
                                        {tieredQuestions.hard_questions.map((q, index) => (
                                            <div
                                                key={`hard-${index}`}
                                                onClick={() => toggleTieredSelection('hard', index)}
                                                className={`p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all ${selectedHard.includes(index)
                                                    ? 'bg-red-50 border-red-400 shadow-md'
                                                    : 'bg-white border-gray-200 hover:border-red-300'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${selectedHard.includes(index) ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                                        {selectedHard.includes(index) ? <Check size={14} /> : index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getCategoryBadgeColor(q.category)}`}>
                                                                {getCategoryLabel(q.category)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm sm:text-base text-gray-800 font-medium mb-2">{q.text}</p>
                                                        {/* OPTIONS */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                                                            {q.options && q.options.map((opt, optIdx) => (
                                                                <div key={optIdx} className={`px-2 py-1 rounded ${opt === q.correct_answer ? 'bg-green-100 text-green-800 font-bold' : 'bg-gray-100 text-gray-600'}`}>
                                                                    <span className="font-bold mr-1">{String.fromCharCode(65 + optIdx)}:</span>{opt}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-3 sm:p-5 border-t-2 border-antique-gold/20 bg-white flex flex-col sm:flex-row justify-between items-center gap-3">
                                    <div className="text-sm text-gray-600">
                                        <span className="font-bold">{selectedEasy.length + selectedMedium.length + selectedHard.length}</span> / 10 questions selected
                                    </div>
                                    <div className="flex flex-wrap gap-2 sm:gap-3 justify-center sm:justify-end">
                                        <button
                                            onClick={() => { setShowPreviewModal(false); setShowTopicsModal(true); setShowFeedbackInput(false); }}
                                            className="px-3 sm:px-4 py-2 rounded-lg border-2 border-gray-300 font-serif text-sm font-bold text-gray-600 hover:border-antique-gold hover:text-royal-blue transition-all"
                                        >
                                            ← Topics
                                        </button>
                                        <button
                                            onClick={() => setShowFeedbackInput(!showFeedbackInput)}
                                            disabled={isGenerating}
                                            className={`px-3 sm:px-4 py-2 rounded-lg border-2 font-serif text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50 ${showFeedbackInput ? 'border-royal-blue bg-royal-blue text-white' : 'border-antique-gold text-royal-blue hover:bg-antique-gold hover:text-white'}`}
                                        >
                                            {isGenerating ? (
                                                <Sparkles className="animate-ai-sparkle" size={16} />
                                            ) : (
                                                <MessageSquare size={16} />
                                            )}
                                            <span className="hidden sm:inline">{isGenerating ? 'Regenerating...' : 'Regenerate'}</span>
                                            <span className="sm:hidden">{isGenerating ? '...' : 'Regen'}</span>
                                        </button>
                                        <button
                                            onClick={handleBulkSaveTiered}
                                            disabled={selectedEasy.length !== 5 || selectedMedium.length !== 3 || selectedHard.length !== 2}
                                            className={`px-4 sm:px-6 py-2 rounded-lg font-serif text-sm font-bold transition-all flex items-center gap-2 ${(selectedEasy.length === 5 && selectedMedium.length === 3 && selectedHard.length === 2)
                                                ? 'bg-royal-blue text-white hover:bg-royal-blue/90 shadow-lg'
                                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                }`}
                                        >
                                            <Save size={16} /> Save 10
                                        </button>
                                    </div>
                                </div>

                                {/* FEEDBACK INPUT PANEL */}
                                <AnimatePresence>
                                    {showFeedbackInput && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t-2 border-antique-gold/20 bg-gradient-to-r from-blue-50 to-purple-50 overflow-hidden"
                                        >
                                            <div className="p-3 sm:p-5 space-y-3">
                                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                                    <MessageSquare size={16} className="text-royal-blue" />
                                                    <span className="font-serif font-bold">What would you like to change?</span>
                                                </div>
                                                
                                                {/* Quick Action Buttons */}
                                                <div className="flex flex-wrap gap-2">
                                                    {quickFeedbackOptions.map((option, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleQuickFeedback(option.value)}
                                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${feedbackText === option.value 
                                                                ? 'bg-royal-blue text-white' 
                                                                : 'bg-white border border-gray-300 text-gray-700 hover:border-royal-blue hover:text-royal-blue'
                                                            }`}
                                                        >
                                                            {option.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                
                                                {/* Custom Feedback Input */}
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={feedbackText}
                                                        onChange={(e) => setFeedbackText(e.target.value)}
                                                        placeholder="Or type your own feedback..."
                                                        className="flex-1 px-4 py-2 rounded-lg border-2 border-gray-200 bg-white text-gray-800 focus:border-royal-blue focus:ring-2 focus:ring-royal-blue/20 text-sm placeholder-gray-400"
                                                    />
                                                    <button
                                                        onClick={handleRegenerateTieredQuestions}
                                                        disabled={isGenerating || !feedbackText.trim()}
                                                        className={`px-4 sm:px-6 py-2 rounded-lg font-serif text-sm font-bold transition-all flex items-center gap-2 ${feedbackText.trim() && !isGenerating
                                                            ? 'bg-royal-blue text-white hover:bg-royal-blue/90 shadow-lg'
                                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                        }`}
                                                    >
                                                        {isGenerating ? (
                                                            <>
                                                                <Sparkles className="animate-ai-sparkle" size={16} />
                                                                <span className="hidden sm:inline">Regenerating...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles size={16} />
                                                                <span className="hidden sm:inline">Regenerate</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* AI PREVIEW MODAL (Legacy - only shows when not in tiered mode) */}
                <AnimatePresence>
                    {showPreviewModal && generationStep !== 2 && (
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

                {/* AI Prompter/Custom Theme Modal */}
                <AnimatePresence>
                    {showPromptModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-midnight-blue/95 border border-cyan-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl w-full max-w-md text-white font-sans relative overflow-hidden"
                            >
                                {/* Glow backdrop */}
                                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl bg-cyan-500/20" />
                                <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full blur-3xl bg-violet-500/20" />

                                <div className="relative space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="text-cyan-400" size={24} />
                                            <h3 className="text-xl font-serif text-cyan-300 font-bold">✨ AI Generation Setup</h3>
                                        </div>
                                        <button onClick={() => { setShowPromptModal(false); setCustomPrompt(''); }} className="text-gray-400 hover:text-white transition-colors">
                                            <X size={20} />
                                        </button>
                                    </div>
                                    
                                    <p className="text-sm text-gray-300">
                                        Generate standard trending news questions automatically, or specify a custom theme below.
                                    </p>

                                    {/* Fast path: Auto-Generate (Default) on top */}
                                    <div className="space-y-3">
                                        <button
                                            type="button"
                                            onClick={() => triggerPromptGeneration(null)}
                                            className="w-full py-3 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 text-midnight-blue hover:from-cyan-400 hover:via-blue-400 hover:to-indigo-400 font-serif font-extrabold rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transform hover:-translate-y-0.5 text-center flex items-center justify-center gap-2 cursor-pointer"
                                        >
                                            <Sparkles size={16} className="animate-pulse" />
                                            <span>Auto-Generate (Default)</span>
                                        </button>
                                    </div>

                                    {/* Divider */}
                                    <div className="relative flex py-1 items-center">
                                        <div className="flex-grow border-t border-cyan-500/20"></div>
                                        <span className="flex-shrink mx-4 text-[10px] font-bold tracking-wider text-cyan-500/60 uppercase">Or customize theme</span>
                                        <div className="flex-grow border-t border-cyan-500/20"></div>
                                    </div>

                                    {/* Textarea */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-cyan-400/80">
                                            Describe your theme or prompt
                                        </label>
                                        <textarea
                                            value={customPrompt}
                                            onChange={(e) => setCustomPrompt(e.target.value)}
                                            placeholder="e.g., Focus on space discoveries, Indian start-up news, or Cricket World Cup events..."
                                            className="w-full h-24 p-3 bg-black/40 border border-cyan-500/30 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all resize-none"
                                        />
                                    </div>

                                    {/* Suggestions */}
                                    <div className="space-y-2">
                                        <span className="text-xs font-bold uppercase tracking-wider text-cyan-400/80">Suggestions</span>
                                        <div className="flex flex-wrap gap-2">
                                            {preGenSuggestions.map((pill, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setCustomPrompt(pill)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                                        customPrompt === pill
                                                            ? 'bg-cyan-500 text-midnight-blue font-bold shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                                                            : 'bg-black/30 border border-cyan-500/20 hover:border-cyan-400/60 text-gray-300 hover:text-cyan-200'
                                                    }`}
                                                >
                                                    {pill}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => triggerPromptGeneration(customPrompt)}
                                            disabled={!customPrompt.trim()}
                                            className={`flex-1 py-2.5 rounded-xl font-serif text-sm font-bold transition-all text-center ${
                                                customPrompt.trim()
                                                    ? 'bg-cyan-500 text-midnight-blue hover:bg-cyan-400 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                                                    : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                                            }`}
                                        >
                                            Generate with Prompt
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setShowPromptModal(false); setCustomPrompt(''); }}
                                            className="px-4 py-2.5 rounded-xl border border-gray-600 hover:border-white text-gray-400 hover:text-white transition-all text-sm font-medium cursor-pointer"
                                        >
                                            Cancel
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
                                <AiLoader mode={loaderMode} />
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default AdminDashboard;
