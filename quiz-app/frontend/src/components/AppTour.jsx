import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles, Check } from 'lucide-react';
import { useSoundManager } from '../hooks/useSoundManager';
import { 
    LOUNGE_STEPS, 
    ADMIN_STEPS, 
    PROFILE_STEPS, 
    REWIND_STEPS, 
    getStepsForRoute 
} from '../data/tourSteps';

export default function AppTour({ isOpen, onClose }) {
    const location = useLocation();
    const { playSound } = useSoundManager();
    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [targetRect, setTargetRect] = useState(null);

    // Pick appropriate tour steps based on current page
    const activeSteps = useMemo(() => {
        return getStepsForRoute(location.pathname);
    }, [location.pathname]);

    // Reset step index if path changes
    useEffect(() => {
        setCurrentStepIdx(0);
    }, [location.pathname]);

    const step = activeSteps[currentStepIdx] || activeSteps[0];

    // Measure target element on screen
    const updateTargetRect = useCallback(() => {
        if (!isOpen || !step) return;

        let el = document.getElementById(step.targetId);
        if (!el && step.fallbackId) {
            el = document.getElementById(step.fallbackId);
        }

        if (el) {
            const rect = el.getBoundingClientRect();
            setTargetRect({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                bottom: rect.bottom,
                right: rect.right,
            });
        } else {
            setTargetRect(null);
        }
    }, [isOpen, step]);

    // Scroll target into view and update rect with intelligent tab coordination
    useEffect(() => {
        if (!isOpen || !step) return;

        // If this step requests a specific tab, trigger the tab switch immediately
        if (step.tab) {
            window.dispatchEvent(new CustomEvent('tour-switch-tab', { detail: { tab: step.tab } }));
            const tabBtn = document.getElementById(`tab-btn-${step.tab}`);
            if (tabBtn) tabBtn.click();
        }

        let isMounted = true;
        let attempts = 0;
        const maxAttempts = 10;
        let settleTimeout = null;

        const locateAndHighlight = () => {
            if (!isMounted) return;

            let el = document.getElementById(step.targetId);
            if (!el && step.fallbackId) {
                el = document.getElementById(step.fallbackId);
            }

            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
                updateTargetRect();
                // Settle calculation after smooth scroll
                settleTimeout = setTimeout(() => {
                    if (isMounted) updateTargetRect();
                }, 300);
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(locateAndHighlight, 50);
            } else {
                updateTargetRect();
            }
        };

        // Allow a quick tick (80ms if tab switch requested, 10ms otherwise) for React to mount the tab
        const initialTimer = setTimeout(locateAndHighlight, step.tab ? 80 : 10);

        return () => {
            isMounted = false;
            clearTimeout(initialTimer);
            if (settleTimeout) clearTimeout(settleTimeout);
        };
    }, [isOpen, currentStepIdx, step, updateTargetRect]);

    // Recalculate on window resize or scroll
    useEffect(() => {
        if (!isOpen) return;
        window.addEventListener('resize', updateTargetRect);
        window.addEventListener('scroll', updateTargetRect, { passive: true });
        return () => {
            window.removeEventListener('resize', updateTargetRect);
            window.removeEventListener('scroll', updateTargetRect);
        };
    }, [isOpen, updateTargetRect]);

    if (!isOpen) return null;

    const handleNext = () => {
        if (currentStepIdx < activeSteps.length - 1) {
            playSound?.('click');
            setCurrentStepIdx((prev) => prev + 1);
        } else {
            handleFinish();
        }
    };

    const handlePrev = () => {
        if (currentStepIdx > 0) {
            playSound?.('click');
            setCurrentStepIdx((prev) => prev - 1);
        }
    };

    const handleFinish = () => {
        playSound?.('fanfare');
        localStorage.setItem('has_seen_app_tour', 'true');
        setCurrentStepIdx(0);
        onClose();
    };

    const handleSkip = () => {
        playSound?.('click');
        localStorage.setItem('has_seen_app_tour', 'true');
        setCurrentStepIdx(0);
        onClose();
    };

    // Smart Non-Blocking Positioning:
    // If target is in lower 50% of viewport, position card at the TOP.
    // If target is in upper 50% of viewport, position card at the BOTTOM.
    // Never overlaps or blocks the highlighted element!
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const isTargetInBottomHalf = targetRect
        ? (targetRect.top > windowHeight * 0.42 || targetRect.bottom > windowHeight - 260)
        : false;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9990] select-none">
                {/* SVG Cut-out Mask Backdrop */}
                <svg className="fixed inset-0 w-full h-full pointer-events-auto cursor-pointer" onClick={handleNext}>
                    <defs>
                        <mask id="app-tour-spotlight-mask">
                            {/* Everything white is visible (dimmed) */}
                            <rect width="100%" height="100%" fill="white" />
                            {/* Black cutout creates transparent hole for target */}
                            {targetRect && (
                                <rect
                                    x={targetRect.left - 8}
                                    y={targetRect.top - 8}
                                    width={targetRect.width + 16}
                                    height={targetRect.height + 16}
                                    rx="18"
                                    ry="18"
                                    fill="black"
                                />
                            )}
                        </mask>
                    </defs>
                    <rect
                        width="100%"
                        height="100%"
                        fill="rgba(5, 10, 24, 0.82)"
                        mask="url(#app-tour-spotlight-mask)"
                    />
                </svg>

                {/* Glowing Target Ring */}
                {targetRect && (
                    <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            top: `${targetRect.top - 8}px`,
                            left: `${targetRect.left - 8}px`,
                            width: `${targetRect.width + 16}px`,
                            height: `${targetRect.height + 16}px`,
                        }}
                        className="fixed pointer-events-none z-[9995] rounded-2xl border-2 border-amber-400 shadow-[0_0_35px_rgba(251,191,36,0.7)] ring-4 ring-amber-400/25"
                    />
                )}

                {/* Floating Tour Tooltip Card (Positioned dynamically in opposite half to never block target) */}
                <div
                    className={`fixed z-[9999] left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-md ${
                        isTargetInBottomHalf ? 'top-14 sm:top-16' : 'bottom-4 sm:bottom-8'
                    }`}
                >
                    <motion.div
                        key={`${location.pathname}-${currentStepIdx}`}
                        initial={{ opacity: 0, y: isTargetInBottomHalf ? -15 : 15, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: isTargetInBottomHalf ? -15 : 15, scale: 0.96 }}
                        transition={{ duration: 0.2 }}
                        className="w-full p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0c1a36]/98 via-[#0f2042]/98 to-[#091328]/98 border-2 border-antique-gold/70 shadow-[0_25px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl text-amber-50"
                    >
                        {/* Header: Step counter + Skip */}
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-antique-gold/20 mb-3">
                            <div className="flex items-center gap-1.5">
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-[10px] font-mono font-bold text-amber-300 uppercase tracking-wider">
                                    Step {currentStepIdx + 1} of {activeSteps.length}
                                </span>
                                <Sparkles size={13} className="text-antique-gold animate-spin" style={{ animationDuration: '6s' }} />
                            </div>

                            <button
                                onClick={handleSkip}
                                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-xs flex items-center gap-1"
                                title="Exit Tour"
                            >
                                <span className="text-[11px] font-sans">Skip</span>
                                <X size={14} />
                            </button>
                        </div>

                        {/* Step Title & Icon */}
                        <div className="flex items-start gap-2.5 mb-2">
                            <span className="text-2xl flex-shrink-0">{step.icon}</span>
                            <div>
                                <h4 className="font-serif font-bold text-base sm:text-lg text-white leading-tight">
                                    {step.title}
                                </h4>
                            </div>
                        </div>

                        {/* Step Description */}
                        <p className="font-sans text-xs sm:text-sm text-gray-200 leading-relaxed mb-4 pl-1">
                            {step.description}
                        </p>

                        {/* Progress Dots + Navigation Action Buttons */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-antique-gold/20">
                            {/* Progress Dots */}
                            <div className="flex items-center gap-1">
                                {activeSteps.map((_, idx) => (
                                    <span
                                        key={idx}
                                        className={`h-1.5 rounded-full transition-all duration-300 ${
                                            idx === currentStepIdx
                                                ? 'w-5 bg-gradient-to-r from-amber-400 to-yellow-400'
                                                : idx < currentStepIdx
                                                ? 'w-2 bg-antique-gold/70'
                                                : 'w-2 bg-white/20'
                                        }`}
                                    />
                                ))}
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center gap-1.5">
                                {currentStepIdx > 0 && (
                                    <button
                                        type="button"
                                        onClick={handlePrev}
                                        className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-serif font-bold text-amber-200 transition-all cursor-pointer flex items-center gap-1"
                                    >
                                        <ChevronLeft size={14} />
                                        <span>Back</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 active:scale-95 text-[#0b1528] text-xs font-serif font-black shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>
                                        {currentStepIdx === activeSteps.length - 1 ? 'Finish Tour 🎓' : 'Next Step'}
                                    </span>
                                    {currentStepIdx < activeSteps.length - 1 ? (
                                        <ChevronRight size={14} />
                                    ) : (
                                        <Check size={14} />
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </AnimatePresence>
    );
}
