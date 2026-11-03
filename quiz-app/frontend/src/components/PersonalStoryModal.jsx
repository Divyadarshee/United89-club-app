import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Play, Pause, ChevronLeft, ChevronRight, Sparkles, Trophy, 
    Crown, Award, Zap, Clock, Calendar, Flame, ShieldCheck, 
    Share2, Download, RotateCcw, Heart, CheckCircle2, Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useSoundManager } from '../hooks/useSoundManager';
import { getAvatarBg, getAvatarEmoji } from './UserNav';
import { FINALE_DATA } from '../data/finaleData';
import { AdminMemberBar, AdminMemberPickerModal } from './AdminMemberControls';

const SLIDE_DURATION_MS = 6500; // 6.5 seconds per slide for relaxed reading

export default function PersonalStoryModal({
    isOpen,
    onClose,
    player,
    photo,
    onDownloadCert,
    onDownloadStory,
    certDataUrl,
    wrappedDataUrl,
    isAdmin = false,
    onSelectMember,
    onPrevMember,
    onNextMember
}) {
    const { playSound } = useSoundManager();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0); // 0 to 100
    const [downloadingCert, setDownloadingCert] = useState(false);
    const [downloadingStory, setDownloadingStory] = useState(false);
    const [showPickerModal, setShowPickerModal] = useState(false);
    const progressIntervalRef = useRef(null);
    const totalSlides = 6;

    // Admin member cycling (Hooks MUST be declared unconditionally before any early return)
    const currentPlayerIdx = useMemo(() => {
        if (!player?.normPhone) return 0;
        const idx = FINALE_DATA.players.findIndex((p) => p.normPhone === player.normPhone);
        return idx >= 0 ? idx : 0;
    }, [player?.normPhone]);

    const handlePrev = useCallback(() => {
        playSound?.('click');
        if (onPrevMember) {
            onPrevMember();
        } else if (onSelectMember) {
            const prevIdx = (currentPlayerIdx - 1 + FINALE_DATA.players.length) % FINALE_DATA.players.length;
            onSelectMember(FINALE_DATA.players[prevIdx].normPhone);
        }
    }, [currentPlayerIdx, onPrevMember, onSelectMember, playSound]);

    const handleNext = useCallback(() => {
        playSound?.('click');
        if (onNextMember) {
            onNextMember();
        } else if (onSelectMember) {
            const nextIdx = (currentPlayerIdx + 1) % FINALE_DATA.players.length;
            onSelectMember(FINALE_DATA.players[nextIdx].normPhone);
        }
    }, [currentPlayerIdx, onNextMember, onSelectMember, playSound]);

    // Trigger celebratory confetti
    const triggerConfetti = useCallback(() => {
        try {
            confetti({
                particleCount: 75,
                spread: 65,
                origin: { y: 0.6 },
                colors: ['#F59E0B', '#EAB308', '#FCD34D', '#FFFFFF', '#6366F1', '#10B981']
            });
        } catch (e) {
            // ignore if confetti blocked
        }
    }, []);

    // Reset slide and progress when modal opens or player changes
    useEffect(() => {
        if (isOpen) {
            setCurrentSlide(0);
            setProgress(0);
            setIsPaused(false);
            setDownloadingCert(false);
            setDownloadingStory(false);
            playSound?.('fanfare');
        }
    }, [isOpen, player?.normPhone, playSound]);

    // Handle slide change effects
    useEffect(() => {
        if (!isOpen) return;
        setProgress(0);
        if (currentSlide === 4 || currentSlide === 5) {
            triggerConfetti();
        }
    }, [currentSlide, isOpen, triggerConfetti]);

    // Auto-advance timer
    useEffect(() => {
        if (!isOpen || isPaused) {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            return;
        }

        const stepMs = 50;
        const increment = (stepMs / SLIDE_DURATION_MS) * 100;

        progressIntervalRef.current = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    if (currentSlide < totalSlides - 1) {
                        setCurrentSlide((s) => s + 1);
                        return 0;
                    } else {
                        setIsPaused(true);
                        return 100;
                    }
                }
                return prev + increment;
            });
        }, stepMs);

        return () => {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        };
    }, [isOpen, isPaused, currentSlide, totalSlides]);

    // Navigation functions
    const nextSlide = useCallback(() => {
        playSound?.('click');
        if (currentSlide < totalSlides - 1) {
            setCurrentSlide((s) => s + 1);
            setProgress(0);
        }
    }, [currentSlide, totalSlides, playSound]);

    const prevSlide = useCallback(() => {
        playSound?.('click');
        if (currentSlide > 0) {
            setCurrentSlide((s) => s - 1);
            setProgress(0);
        }
    }, [currentSlide, playSound]);

    const handleReplay = (e) => {
        e?.stopPropagation?.();
        playSound?.('fanfare');
        setCurrentSlide(0);
        setProgress(0);
        setIsPaused(false);
        triggerConfetti();
    };

    const handleCertClick = async (e) => {
        e?.stopPropagation?.();
        playSound?.('click');
        setDownloadingCert(true);
        try {
            await onDownloadCert?.();
        } catch (err) {
            console.error('Download certificate error:', err);
        } finally {
            setTimeout(() => setDownloadingCert(false), 2200);
        }
    };

    const handleStoryClick = async (e) => {
        e?.stopPropagation?.();
        playSound?.('click');
        setDownloadingStory(true);
        try {
            await onDownloadStory?.();
        } catch (err) {
            console.error('Download story error:', err);
        } finally {
            setTimeout(() => setDownloadingStory(false), 2200);
        }
    };

    if (!isOpen || !player) return null;

    // Derived statistics
    const attendancePct = Math.round((player?.weeksPlayed / 40) * 100);
    const accuracyPct = player?.avgScore 
        ? (player.avgScore * 10).toFixed(1) 
        : ((player?.pureScore / (player?.weeksPlayed * 10 || 1)) * 100).toFixed(1);
    const questionsAnswered = (player?.weeksPlayed || 0) * 10;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
                {/* Backdrop click closes modal */}
                <div 
                    className="absolute inset-0" 
                    onClick={() => {
                        playSound?.('click');
                        onClose();
                    }} 
                />

                {/* Vertical Story Reel Container (9:16 aspect feel, max-w-md) */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 25 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 25 }}
                    transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                    className="relative w-full max-w-[430px] h-[90vh] max-h-[800px] bg-gradient-to-b from-[#0a1428] via-[#091122] to-[#140a24] rounded-3xl border-2 border-antique-gold/60 shadow-[0_0_60px_rgba(251,191,36,0.35)] overflow-hidden flex flex-col justify-between select-none z-10 text-white"
                >
                    {/* Top Segmented Story Progress Bar */}
                    <div className="relative z-40 pt-4 px-4 pb-2 bg-gradient-to-b from-black/60 to-transparent">
                        <div className="flex gap-1.5 mb-3">
                            {Array.from({ length: totalSlides }).map((_, idx) => {
                                const isPast = idx < currentSlide;
                                const isCurrent = idx === currentSlide;
                                const fillWidth = isPast ? '100%' : isCurrent ? `${progress}%` : '0%';
                                return (
                                    <div
                                        key={idx}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCurrentSlide(idx);
                                            setProgress(0);
                                        }}
                                        className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden cursor-pointer"
                                    >
                                        <div
                                            className={`h-full ${
                                                isPast || isCurrent
                                                    ? 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                                                    : ''
                                            }`}
                                            style={{
                                                width: fillWidth,
                                                transition: isCurrent ? 'width 50ms linear' : 'width 150ms ease-out'
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Top Story Header: User Tag, Play/Pause, Close */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-mono text-amber-300 uppercase tracking-widest font-bold">
                                    2026 Wrapped • {currentSlide + 1}/{totalSlides}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsPaused((p) => !p);
                                    }}
                                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-amber-200 transition-colors cursor-pointer"
                                    title={isPaused ? "Resume auto-play" : "Pause auto-play"}
                                >
                                    {isPaused ? <Play size={15} /> : <Pause size={15} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        playSound?.('click');
                                        onClose();
                                    }}
                                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                                    title="Close Story"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Admin Quick Member Switcher Bar for Phone/Desktop testing */}
                        {isAdmin && (
                            <div className="mt-2.5">
                                <AdminMemberBar
                                    selectedPlayer={player}
                                    onPrev={handlePrev}
                                    onNext={handleNext}
                                    onOpenPicker={() => setShowPickerModal(true)}
                                    currentIndex={currentPlayerIdx}
                                    totalCount={FINALE_DATA.players.length}
                                    compact={true}
                                />
                            </div>
                        )}
                    </div>

                    {/* Left & Right Tap Zones: ONLY active on slides 0 to 4 so they NEVER block slide 5 buttons */}
                    {currentSlide < totalSlides - 1 && (
                        <>
                            <div
                                className="absolute inset-y-16 left-0 w-1/3 z-20 cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    prevSlide();
                                }}
                                title="Previous Slide"
                            />
                            <div
                                className="absolute inset-y-16 right-0 w-2/3 z-20 cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    nextSlide();
                                }}
                                title="Next Slide"
                            />
                        </>
                    )}

                    {/* Interactive Slide Content Body */}
                    <div className="relative z-30 flex-1 px-6 py-4 flex flex-col justify-center text-center overflow-y-auto">
                        <AnimatePresence mode="wait">
                            {/* ========================================================
                                SLIDE 0: COVER / PERSONA INTRO
                               ======================================================== */}
                            {currentSlide === 0 && (
                                <motion.div
                                    key="slide-0"
                                    initial={{ opacity: 0, scale: 0.92, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 1.06, y: -15 }}
                                    transition={{ duration: 0.35, ease: 'easeOut' }}
                                    className="space-y-4 my-auto"
                                >
                                    <motion.div
                                        initial={{ y: -18, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.1, duration: 0.4 }}
                                        className="inline-block px-3 py-1 rounded-full bg-antique-gold/20 border border-antique-gold/40 text-[11px] font-mono tracking-widest text-antique-gold uppercase font-semibold"
                                    >
                                        United-89 Quiz Club
                                    </motion.div>

                                    {/* Animated Avatar Medallion with spinning halo and pulsing shadow */}
                                    <motion.div 
                                        initial={{ scale: 0.7, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.15, type: 'spring', damping: 14 }}
                                        className="relative mx-auto w-32 h-32 flex items-center justify-center"
                                    >
                                        <motion.div 
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
                                            className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-300 to-amber-700 opacity-80 blur-[2px]" 
                                        />
                                        <motion.div 
                                            animate={{
                                                boxShadow: [
                                                    '0 0 15px rgba(251,191,36,0.3)',
                                                    '0 0 35px rgba(251,191,36,0.6)',
                                                    '0 0 15px rgba(251,191,36,0.3)'
                                                ]
                                            }}
                                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                            className="relative w-28 h-28 rounded-full border-4 border-antique-gold overflow-hidden bg-black/60 shadow-2xl flex items-center justify-center"
                                        >
                                            {photo ? (
                                                <img src={photo} alt={player.displayName} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className={`w-full h-full bg-gradient-to-br ${getAvatarBg(player.avatar || 'avatar-1')} flex items-center justify-center text-5xl`}>
                                                    {getAvatarEmoji(player.avatar || 'avatar-1')}
                                                </div>
                                            )}
                                        </motion.div>
                                    </motion.div>

                                    <motion.div
                                        initial={{ scale: 0.85, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.25, type: 'spring', damping: 15 }}
                                    >
                                        <h1 className="text-2xl sm:text-3xl font-serif font-black text-white tracking-wide">
                                            {player.displayName}
                                        </h1>
                                        <p className="text-xs font-mono text-amber-300/80 mt-1">
                                            Batch of 1989 • UCE Burla
                                        </p>
                                    </motion.div>

                                    {/* Persona Callout */}
                                    <motion.div 
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.35, duration: 0.4 }}
                                        className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/20 to-amber-500/15 border border-antique-gold/50 shadow-lg"
                                    >
                                        <span className="text-[10px] font-mono uppercase tracking-wider text-amber-300 block mb-0.5 font-bold">
                                            Your Signature Persona
                                        </span>
                                        <span className="text-base font-serif font-bold text-amber-200">
                                            {player.persona || '🌟 Stalwart Contender'}
                                        </span>
                                    </motion.div>

                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.45 }}
                                        className="text-xs text-gray-300 font-sans pt-1"
                                    >
                                        40 Official Quizzes • 400 Questions • Pure Knowledge
                                    </motion.div>

                                    <motion.div 
                                        animate={{ opacity: [0.35, 1, 0.35] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="text-[11px] text-antique-gold font-mono pt-1"
                                    >
                                        Tap to unwrap your season ▶
                                    </motion.div>
                                </motion.div>
                            )}

                            {/* ========================================================
                                SLIDE 1: DEDICATION & ATTENDANCE
                               ======================================================== */}
                            {currentSlide === 1 && (
                                <motion.div
                                    key="slide-1"
                                    initial={{ opacity: 0, scale: 0.92, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 1.06, y: -15 }}
                                    transition={{ duration: 0.35 }}
                                    className="space-y-4 my-auto"
                                >
                                    <motion.div 
                                        initial={{ scale: 0, rotate: -20 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: 'spring', damping: 12 }}
                                        className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-lg"
                                    >
                                        <Calendar size={28} />
                                    </motion.div>

                                    <div>
                                        <span className="text-[11px] font-mono uppercase tracking-widest text-antique-gold font-bold">
                                            The Attendance Check
                                        </span>
                                        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mt-1">
                                            You Showed Up!
                                        </h2>
                                    </div>

                                    {/* Big Stat with animated progress bar */}
                                    <motion.div 
                                        initial={{ scale: 0.7, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.15, type: 'spring', damping: 14 }}
                                        className="p-4 rounded-2xl bg-black/40 border border-antique-gold/30"
                                    >
                                        <div className="text-4xl sm:text-5xl font-serif font-black text-amber-300">
                                            {player.weeksPlayed} <span className="text-2xl font-normal text-amber-200/70">/ 40</span>
                                        </div>
                                        <p className="text-xs font-mono uppercase tracking-wider text-gray-300 mt-1 mb-2.5">
                                            Weeks Played in 2026
                                        </p>

                                        {/* Animated attendance progress bar */}
                                        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${attendancePct}%` }}
                                                transition={{ delay: 0.3, duration: 0.85, ease: 'easeOut' }}
                                                className="h-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                                            />
                                        </div>
                                    </motion.div>

                                    <div className="grid grid-cols-2 gap-3 text-left">
                                        <motion.div 
                                            initial={{ x: -25, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: 0.35 }}
                                            className="p-3 rounded-xl bg-white/5 border border-white/10"
                                        >
                                            <span className="text-[10px] font-mono uppercase text-gray-400 block">Club Attendance</span>
                                            <span className="text-lg font-serif font-bold text-emerald-400">{attendancePct}%</span>
                                        </motion.div>
                                        <motion.div 
                                            initial={{ x: 25, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: 0.35 }}
                                            className="p-3 rounded-xl bg-white/5 border border-white/10"
                                        >
                                            <span className="text-[10px] font-mono uppercase text-gray-400 block">Questions Faced</span>
                                            <span className="text-lg font-serif font-bold text-sky-300">{questionsAnswered}</span>
                                        </motion.div>
                                    </div>

                                    <motion.p 
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.45 }}
                                        className="text-xs text-amber-100/90 font-sans leading-relaxed italic bg-amber-950/30 p-3 rounded-xl border border-amber-500/20"
                                    >
                                        {player.weeksPlayed >= 38
                                            ? "🏆 Ironclad Commitment! You were an unshakeable presence in the club, hardly missing a single Sunday battle!"
                                            : player.weeksPlayed >= 30
                                            ? "⭐ Loyal Stalwart! 30+ weeks of Sunday quiz warfare makes you one of the true pillars of United-89."
                                            : player.weeksPlayed >= 20
                                            ? "🔥 Dedicated Contender! Whenever you entered the arena, your presence made every round exciting."
                                            : "✨ Spirited Alumnus! Every quiz you took brought warmth and energy to our 1989 batch community."}
                                    </motion.p>
                                </motion.div>
                            )}

                            {/* ========================================================
                                SLIDE 2: BRAINPOWER & ACCURACY
                               ======================================================== */}
                            {currentSlide === 2 && (
                                <motion.div
                                    key="slide-2"
                                    initial={{ opacity: 0, scale: 0.92, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 1.06, y: -15 }}
                                    transition={{ duration: 0.35 }}
                                    className="space-y-4 my-auto"
                                >
                                    <motion.div 
                                        initial={{ scale: 0, y: -20 }}
                                        animate={{ scale: 1, y: 0, rotate: [0, -10, 10, 0] }}
                                        transition={{ duration: 0.6 }}
                                        className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-lg"
                                    >
                                        <Trophy size={28} />
                                    </motion.div>

                                    <div>
                                        <span className="text-[11px] font-mono uppercase tracking-widest text-antique-gold font-bold">
                                            Pure Intellect
                                        </span>
                                        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mt-1">
                                            The Brainpower
                                        </h2>
                                    </div>

                                    {/* Pure Score & Rank */}
                                    <motion.div 
                                        initial={{ scale: 0.75, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.15, type: 'spring', damping: 13 }}
                                        className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/60 to-black/60 border border-antique-gold/40"
                                    >
                                        <div className="text-4xl sm:text-5xl font-serif font-black text-amber-300">
                                            {player.pureScore}
                                        </div>
                                        <div className="text-xs font-mono uppercase tracking-wider text-amber-200 mt-1">
                                            Season Score • Club Rank #{player.rank || player.pureRank || '--'}
                                        </div>
                                    </motion.div>

                                    <div className="grid grid-cols-2 gap-3 text-left">
                                        <motion.div 
                                            initial={{ x: -25, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: 0.3 }}
                                            className="p-3 rounded-xl bg-white/5 border border-white/10"
                                        >
                                            <span className="text-[10px] font-mono uppercase text-gray-400 block">Season Accuracy</span>
                                            <span className="text-lg font-serif font-bold text-amber-300">{accuracyPct}%</span>
                                        </motion.div>
                                        <motion.div 
                                            initial={{ x: 25, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: 0.3 }}
                                            className="p-3 rounded-xl bg-white/5 border border-white/10"
                                        >
                                            <span className="text-[10px] font-mono uppercase text-gray-400 block">Perfect 10/10s</span>
                                            <span className="text-lg font-serif font-bold text-emerald-400">{player.count10 || 0} Rounds</span>
                                        </motion.div>
                                    </div>

                                    {/* Best Week Callout */}
                                    {player.bestWeek && (
                                        <motion.div 
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: 0.45 }}
                                            className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-left"
                                        >
                                            <span className="text-[10px] font-mono uppercase text-emerald-400 block font-bold">
                                                🌟 Your Season Peak Moment
                                            </span>
                                            <p className="text-xs text-gray-200 font-sans mt-0.5">
                                                Week {player.bestWeek.quizNum}: scored a brilliant <strong>{player.bestWeek.score}/10</strong> in {player.bestWeek.time}s!
                                            </p>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}

                            {/* ========================================================
                                SLIDE 3: SPEED & REFLEXES
                               ======================================================== */}
                            {currentSlide === 3 && (
                                <motion.div
                                    key="slide-3"
                                    initial={{ opacity: 0, scale: 0.92, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 1.06, y: -15 }}
                                    transition={{ duration: 0.35 }}
                                    className="space-y-4 my-auto"
                                >
                                    <motion.div 
                                        animate={{ scale: [1, 1.25, 1, 1.2, 1] }}
                                        transition={{ duration: 1.4, repeat: Infinity }}
                                        className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-lg"
                                    >
                                        <Zap size={28} />
                                    </motion.div>

                                    <div>
                                        <span className="text-[11px] font-mono uppercase tracking-widest text-antique-gold font-bold">
                                            The Stopwatch
                                        </span>
                                        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mt-1">
                                            Speed & Reflexes
                                        </h2>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-left">
                                        <motion.div 
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: 0.15 }}
                                            className="p-3.5 rounded-xl bg-black/40 border border-antique-gold/30"
                                        >
                                            <span className="text-[10px] font-mono uppercase text-gray-400 block">Avg Response Time</span>
                                            <span className="text-2xl font-serif font-black text-sky-300">
                                                {player.avgTime ? `${player.avgTime}s` : '--'}
                                            </span>
                                            <span className="text-[10px] text-gray-400 block mt-0.5">per 10-Q quiz</span>
                                        </motion.div>
                                        <motion.div 
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: 0.25 }}
                                            className="p-3.5 rounded-xl bg-black/40 border border-antique-gold/30"
                                        >
                                            <span className="text-[10px] font-mono uppercase text-gray-400 block">Fastest Sprint</span>
                                            <span className="text-2xl font-serif font-black text-amber-300">
                                                {player.fastestTime ? `${player.fastestTime}s` : '--'}
                                            </span>
                                            <span className="text-[10px] text-gray-400 block mt-0.5">personal record</span>
                                        </motion.div>
                                    </div>

                                    <motion.div 
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.35 }}
                                        className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-left"
                                    >
                                        <span className="text-[10px] font-mono uppercase text-antique-gold block font-bold mb-1">
                                            ⚡ Reflex Classification
                                        </span>
                                        <p className="text-xs text-gray-200 font-sans leading-relaxed">
                                            {(player.avgTime || 300) < 180
                                                ? "⚡ Lightning Reflexes: Fast, instinctive, and decisive! You submit before others even finish reading."
                                                : (player.avgTime || 300) < 360
                                                ? "🎯 Tactical Precision: Perfect balance of speed and caution, rarely second-guessing yourself."
                                                : "🧘 Zen Strategist: Never rushed, deeply thoughtful, analyzing every nuance of each question."}
                                        </p>
                                    </motion.div>

                                    {/* Podiums / Stumper callout */}
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.45 }}
                                        className="flex items-center justify-center gap-3 text-xs font-mono text-amber-200/90"
                                    >
                                        <span>🥇 {player.gold || 0} Wins</span>
                                        <span>•</span>
                                        <span>🏆 {player.podiums || 0} Podiums</span>
                                        {player.giantSlayerCount > 0 && (
                                            <>
                                                <span>•</span>
                                                <span className="text-emerald-300 font-bold">🧩 {player.giantSlayerCount} Tough Solves</span>
                                            </>
                                        )}
                                    </motion.div>
                                </motion.div>
                            )}

                            {/* ========================================================
                                SLIDE 4: ACCOLADES & HONORS
                               ======================================================== */}
                            {currentSlide === 4 && (
                                <motion.div
                                    key="slide-4"
                                    initial={{ opacity: 0, scale: 0.92, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 1.06, y: -15 }}
                                    transition={{ duration: 0.35 }}
                                    className="space-y-4 my-auto"
                                >
                                    <motion.div 
                                        animate={{ y: [0, -8, 0] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                        className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-lg"
                                    >
                                        <Crown size={28} />
                                    </motion.div>

                                    <div>
                                        <span className="text-[11px] font-mono uppercase tracking-widest text-antique-gold font-bold">
                                            Hall of Fame
                                        </span>
                                        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mt-1">
                                            Your 2026 Accolades
                                        </h2>
                                    </div>

                                    {/* Awards list */}
                                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                                        {player.awards && player.awards.length > 0 ? (
                                            player.awards.map((aw, idx) => (
                                                <motion.div
                                                    key={aw.id}
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.15 + idx * 0.15, duration: 0.4 }}
                                                    className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/60 to-black/70 border border-antique-gold/50 shadow-lg text-left"
                                                >
                                                    <div className="flex items-center justify-between gap-1 mb-1">
                                                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold">
                                                            {aw.tier}
                                                        </span>
                                                        <span className="text-[10px] font-mono text-emerald-300">
                                                            {aw.statsBadge?.split('•')[0]}
                                                        </span>
                                                    </div>
                                                    <h4 className="text-sm font-serif font-bold text-white">
                                                        🏆 {aw.title}
                                                    </h4>
                                                    <p className="text-[11px] text-gray-300 font-sans mt-1 line-clamp-2 leading-relaxed">
                                                        {aw.citation}
                                                    </p>
                                                </motion.div>
                                            ))
                                        ) : (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.2, duration: 0.4 }}
                                                className="p-4 rounded-xl bg-gradient-to-r from-amber-950/60 to-black/70 border border-antique-gold/50 shadow-lg text-left"
                                            >
                                                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold">
                                                    Club Superlative
                                                </span>
                                                <h4 className="text-base font-serif font-bold text-white mt-1">
                                                    🎖️ Distinguished Veteran of United-89
                                                </h4>
                                                <p className="text-xs text-gray-300 font-sans mt-1 leading-relaxed">
                                                    In recognition of exceptional loyalty, camaraderie, and spirited participation in the 40-week 2026 UCE Quiz Season.
                                                </p>
                                            </motion.div>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* ========================================================
                                SLIDE 5: THE GRAND FINALE & ACTION BUTTONS
                               ======================================================== */}
                            {currentSlide === 5 && (
                                <motion.div
                                    key="slide-5"
                                    initial={{ opacity: 0, scale: 0.92, y: 15 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 1.06, y: -15 }}
                                    transition={{ duration: 0.35 }}
                                    className="space-y-4 my-auto relative z-50 pointer-events-auto"
                                >
                                    <motion.div 
                                        animate={{ scale: [1, 1.15, 1, 1.1, 1] }}
                                        transition={{ duration: 1.6, repeat: Infinity }}
                                        className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-lg"
                                    >
                                        <Heart size={28} className="text-rose-400 fill-rose-400" />
                                    </motion.div>

                                    <motion.div
                                        initial={{ y: -15, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.1 }}
                                    >
                                        <span className="text-[11px] font-mono uppercase tracking-widest text-antique-gold font-bold">
                                            Grand Finale
                                        </span>
                                        <h2 className="text-2xl sm:text-3xl font-serif font-black text-white mt-1">
                                            Thank You, {player.displayName.split(' ')[0]}!
                                        </h2>
                                        <p className="text-xs text-amber-200/90 font-sans mt-1">
                                            You are what made the 2026 UCE Quiz Season unforgettable.
                                        </p>
                                    </motion.div>

                                    {/* Summary Medallion Card */}
                                    <motion.div 
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="p-3.5 rounded-2xl bg-black/50 border border-antique-gold/40 text-left flex items-center gap-3"
                                    >
                                        <div className="w-12 h-12 rounded-full border-2 border-antique-gold overflow-hidden bg-black/60 flex-shrink-0 flex items-center justify-center">
                                            {photo ? (
                                                <img src={photo} alt={player.displayName} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className={`w-full h-full bg-gradient-to-br ${getAvatarBg(player.avatar || 'avatar-1')} flex items-center justify-center text-xl`}>
                                                    {getAvatarEmoji(player.avatar || 'avatar-1')}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-serif font-bold text-white truncate">
                                                {player.displayName}
                                            </h4>
                                            <p className="text-[11px] text-amber-300 font-mono">
                                                {player.pureScore} Pts • Rank #{player.rank || player.pureRank} • {player.persona}
                                            </p>
                                        </div>
                                    </motion.div>

                                    {/* Action Buttons: 100% interactive, never intercepted */}
                                    <motion.div 
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.3 }}
                                        className="space-y-2.5 pt-2 relative z-50 pointer-events-auto"
                                    >
                                        <motion.button
                                            type="button"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.96 }}
                                            onClick={handleCertClick}
                                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-[#0b1528] font-serif font-bold text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                                        >
                                            {downloadingCert ? (
                                                <>
                                                    <Check size={16} className="text-emerald-900" />
                                                    <span className="text-emerald-950 font-black">Certificate Downloaded! ✓</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Download size={16} />
                                                    <span>Download Official Certificate</span>
                                                </>
                                            )}
                                        </motion.button>

                                        <motion.button
                                            type="button"
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.96 }}
                                            onClick={handleStoryClick}
                                            className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-serif font-bold text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 border border-emerald-400/40 cursor-pointer transition-all"
                                        >
                                            {downloadingStory ? (
                                                <>
                                                    <Check size={16} className="text-white" />
                                                    <span className="text-white font-black">Story Graphic Downloaded! ✓</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Share2 size={16} />
                                                    <span>Save WhatsApp Story Graphic</span>
                                                </>
                                            )}
                                        </motion.button>

                                        <div className="flex items-center gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={handleReplay}
                                                className="flex-1 py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <RotateCcw size={13} />
                                                <span>Replay Story</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    playSound?.('click');
                                                    onClose();
                                                }}
                                                className="flex-1 py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <X size={13} />
                                                <span>Close</span>
                                            </button>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Bottom Floating Step Nav */}
                    <div className="relative z-40 px-6 py-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-400 font-mono bg-gradient-to-t from-black/60 to-transparent">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                prevSlide();
                            }}
                            disabled={currentSlide === 0}
                            className={`flex items-center gap-1 transition-opacity cursor-pointer ${
                                currentSlide === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:text-amber-300'
                            }`}
                        >
                            <ChevronLeft size={16} />
                            <span>Prev</span>
                        </button>

                        <span className="text-[11px] text-antique-gold/80">
                            {currentSlide + 1} of {totalSlides}
                        </span>

                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                nextSlide();
                            }}
                            disabled={currentSlide === totalSlides - 1}
                            className={`flex items-center gap-1 transition-opacity cursor-pointer ${
                                currentSlide === totalSlides - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:text-amber-300'
                            }`}
                        >
                            <span>Next</span>
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </motion.div>

                {/* Admin Member Picker Modal inside Story Reel */}
                {isAdmin && (
                    <AdminMemberPickerModal
                        isOpen={showPickerModal}
                        onClose={() => setShowPickerModal(false)}
                        selectedNorm={player?.normPhone}
                        onSelect={(normPhone) => {
                            if (onSelectMember) onSelectMember(normPhone);
                        }}
                    />
                )}
            </div>
        </AnimatePresence>
    );
}
