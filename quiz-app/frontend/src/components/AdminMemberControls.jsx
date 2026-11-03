import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, ChevronRight, Search, X, Check, Crown, Trophy, 
    Users, Award, Flame, ChevronDown, SlidersHorizontal 
} from 'lucide-react';
import { FINALE_DATA } from '../data/finaleData';
import { useSoundManager } from '../hooks/useSoundManager';

/**
 * Mobile-First Scroll-Locked Member Picker Modal
 * Specifically optimized for phone Chrome and touchscreen testing.
 */
export function AdminMemberPickerModal({
    isOpen,
    onClose,
    selectedNorm,
    onSelect,
    players = FINALE_DATA.players
}) {
    const { playSound } = useSoundManager();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'top10' | 'awards' | 'perfect'
    const inputRef = useRef(null);

    // Strict Scroll Lock on body for mobile Chrome
    useEffect(() => {
        if (!isOpen) return;
        const originalStyle = window.getComputedStyle(document.body).overflow;
        const originalTouchAction = document.body.style.touchAction;
        
        document.body.style.overflow = 'hidden';
        
        // Auto-focus search input after animation
        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 150);

        return () => {
            document.body.style.overflow = originalStyle;
            document.body.style.touchAction = originalTouchAction;
            clearTimeout(timer);
        };
    }, [isOpen]);

    // Reset query & filter when modal closes/opens
    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setActiveFilter('all');
        }
    }, [isOpen]);

    // Filter players based on search query and category pill
    const filteredList = useMemo(() => {
        let list = players;

        // Apply quick category filter
        if (activeFilter === 'top10') {
            list = list.filter((p) => p.rank && p.rank <= 10);
        } else if (activeFilter === 'awards') {
            list = list.filter((p) => p.awards && p.awards.length > 0);
        } else if (activeFilter === 'perfect') {
            list = list.filter((p) => p.weeksPlayed >= 40);
        }

        // Apply textual search
        const q = searchQuery.trim().toLowerCase();
        if (!q) return list;

        return list.filter((p) => {
            const nameMatch = (p.displayName || '').toLowerCase().includes(q);
            const realNameMatch = (p.realName || '').toLowerCase().includes(q);
            const phoneMatch = (p.normPhone || '').includes(q);
            const rankMatch = p.rank ? `#${p.rank}`.includes(q) || String(p.rank) === q : false;
            return nameMatch || realNameMatch || phoneMatch || rankMatch;
        });
    }, [players, activeFilter, searchQuery]);

    if (!isOpen) return null;

    const handleSelect = (normPhone) => {
        playSound?.('click');
        onSelect(normPhone);
        onClose();
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center bg-black/85 backdrop-blur-md">
                {/* Backdrop Click */}
                <div 
                    className="absolute inset-0"
                    onClick={() => {
                        playSound?.('click');
                        onClose();
                    }}
                />

                {/* Modal Container: Fullscreen on mobile, centered dialog on desktop */}
                <motion.div
                    initial={{ opacity: 0, y: '100%' }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    className="relative w-full sm:max-w-lg h-[92vh] sm:h-[85vh] max-h-[780px] bg-[#091222] border-t-2 sm:border-2 border-antique-gold/70 rounded-t-3xl sm:rounded-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.8)] sm:shadow-2xl flex flex-col overflow-hidden z-10 text-white"
                >
                    {/* Top Handle / Drag bar for phone */}
                    <div className="pt-3 pb-1 flex justify-center sm:hidden">
                        <div className="w-12 h-1.5 rounded-full bg-antique-gold/40" />
                    </div>

                    {/* Header */}
                    <div className="px-4 py-3 border-b border-antique-gold/20 flex items-center justify-between bg-black/40">
                        <div className="flex items-center gap-2">
                            <Users className="text-amber-400" size={18} />
                            <h3 className="font-serif font-bold text-base text-amber-100">
                                Select Member ({players.length})
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                playSound?.('click');
                                onClose();
                            }}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-gray-300 hover:text-white transition-all cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="p-3 bg-[#0a1528] border-b border-antique-gold/15">
                        <div className="relative flex items-center">
                            <Search className="absolute left-3 text-antique-gold/60 pointer-events-none" size={16} />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name, rank, or phone..."
                                className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-black/50 border border-antique-gold/30 text-amber-50 placeholder:text-gray-400 text-sm focus:outline-none focus:border-antique-gold font-sans"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 p-1 text-gray-400 hover:text-white"
                                >
                                    <X size={15} />
                                </button>
                            )}
                        </div>

                        {/* Quick Filter Chips */}
                        <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                            <button
                                type="button"
                                onClick={() => {
                                    playSound?.('click');
                                    setActiveFilter('all');
                                }}
                                className={`px-2.5 py-1 rounded-lg font-serif transition-colors whitespace-nowrap cursor-pointer ${
                                    activeFilter === 'all'
                                        ? 'bg-antique-gold text-midnight-blue font-bold shadow'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                                }`}
                            >
                                All ({players.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    playSound?.('click');
                                    setActiveFilter('top10');
                                }}
                                className={`px-2.5 py-1 rounded-lg font-serif transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                                    activeFilter === 'top10'
                                        ? 'bg-amber-400 text-midnight-blue font-bold shadow'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                                }`}
                            >
                                <Crown size={11} />
                                <span>Top 10</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    playSound?.('click');
                                    setActiveFilter('awards');
                                }}
                                className={`px-2.5 py-1 rounded-lg font-serif transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                                    activeFilter === 'awards'
                                        ? 'bg-yellow-400 text-midnight-blue font-bold shadow'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                                }`}
                            >
                                <Trophy size={11} />
                                <span>Awards (24)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    playSound?.('click');
                                    setActiveFilter('perfect');
                                }}
                                className={`px-2.5 py-1 rounded-lg font-serif transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                                    activeFilter === 'perfect'
                                        ? 'bg-emerald-400 text-midnight-blue font-bold shadow'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                                }`}
                            >
                                <Flame size={11} />
                                <span>40 Weeks (11)</span>
                            </button>
                        </div>
                    </div>

                    {/* Member Scroll List with Generous Touch Targets */}
                    <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 overscroll-contain">
                        {filteredList.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 font-serif">
                                <p className="text-sm">No members match "{searchQuery}"</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('');
                                        setActiveFilter('all');
                                    }}
                                    className="mt-2 text-xs text-antique-gold underline"
                                >
                                    Reset filters
                                </button>
                            </div>
                        ) : (
                            filteredList.map((p, idx) => {
                                const isSelected = p.normPhone === selectedNorm;
                                const rank = p.rank || idx + 1;
                                const hasAward = p.awards && p.awards.length > 0;

                                return (
                                    <button
                                        key={p.normPhone}
                                        type="button"
                                        onClick={() => handleSelect(p.normPhone)}
                                        className={`w-full min-h-[52px] text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer border ${
                                            isSelected
                                                ? 'bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-600/25 border-antique-gold text-amber-100 shadow-md ring-1 ring-antique-gold/50'
                                                : 'bg-white/[0.03] hover:bg-white/[0.08] active:bg-white/[0.12] border-white/5 text-gray-200'
                                        }`}
                                    >
                                        {/* Left: Rank Badge + Name */}
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            {/* Rank Badge */}
                                            <span
                                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs flex-shrink-0 shadow ${
                                                    rank === 1
                                                        ? 'bg-gradient-to-br from-yellow-300 to-amber-600 text-midnight-blue'
                                                        : rank === 2
                                                        ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-midnight-blue'
                                                        : rank === 3
                                                        ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-amber-100'
                                                        : rank <= 10
                                                        ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40'
                                                        : 'bg-white/10 text-gray-300'
                                                }`}
                                            >
                                                #{rank}
                                            </span>

                                            {/* Name & Details */}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-serif font-semibold text-sm truncate text-white">
                                                        {p.displayName}
                                                    </span>
                                                    {hasAward && (
                                                        <span title="Award Winner" className="text-xs">🏆</span>
                                                    )}
                                                    {p.weeksPlayed >= 40 && (
                                                        <span title="Perfect 40 Attendance" className="text-xs">🔥</span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-gray-400 font-mono truncate">
                                                    {p.realName && p.realName !== p.displayName ? `${p.realName} • ` : ''}
                                                    {p.weeksPlayed} weeks played
                                                </p>
                                            </div>
                                        </div>

                                        {/* Right: Score & Selection Checkmark */}
                                        <div className="flex items-center gap-2 flex-shrink-0 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-mono font-bold text-xs text-amber-300">
                                                    {p.pureScore} pts
                                                </span>
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    {p.avgScore ? `${p.avgScore.toFixed(1)} avg` : ''}
                                                </span>
                                            </div>

                                            {isSelected && (
                                                <div className="w-5 h-5 rounded-full bg-antique-gold text-midnight-blue flex items-center justify-center shadow">
                                                    <Check size={12} strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Bottom Status Count */}
                    <div className="px-4 py-2 bg-black/60 border-t border-antique-gold/20 text-center text-xs text-gray-400 font-mono flex items-center justify-between">
                        <span>Showing {filteredList.length} of {players.length} alumni</span>
                        <span className="text-antique-gold">UCE '89 Reunion</span>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

/**
 * High-Visibility Admin Member Bar for Mobile & Desktop
 * Features prominent Prev, Next, and Member Picker buttons.
 */
export function AdminMemberBar({
    selectedPlayer,
    onPrev,
    onNext,
    onOpenPicker,
    currentIndex,
    totalCount = FINALE_DATA.players.length,
    compact = false
}) {
    const { playSound } = useSoundManager();

    if (!selectedPlayer) return null;

    const rank = selectedPlayer.rank || (currentIndex !== undefined ? currentIndex + 1 : null);

    if (compact) {
        return (
            <div className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-xl bg-black/60 border border-antique-gold/50 backdrop-blur-md shadow-lg text-white">
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        playSound?.('click');
                        onPrev();
                    }}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-amber-300 transition-all cursor-pointer"
                    title="Previous Member"
                >
                    <ChevronLeft size={16} />
                </button>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        playSound?.('click');
                        onOpenPicker();
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs font-serif text-amber-100 truncate cursor-pointer border border-amber-400/30"
                    title="Tap to switch member"
                >
                    <span className="truncate font-bold">
                        {selectedPlayer.displayName}
                    </span>
                    <ChevronDown size={12} className="text-antique-gold flex-shrink-0" />
                </button>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        playSound?.('click');
                        onNext();
                    }}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-amber-300 transition-all cursor-pointer"
                    title="Next Member"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        );
    }

    return (
        <div className="w-full bg-gradient-to-r from-[#0c1a36] via-[#102245] to-[#0c1a36] border-2 border-antique-gold/60 rounded-2xl p-2.5 sm:p-3 shadow-2xl mb-6">
            {/* Clear Admin Switcher Prompt Banner */}
            <div className="flex items-center justify-between gap-2 px-1 pb-2 border-b border-antique-gold/20 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                    <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-amber-300 truncate">
                        Admin: Switch User Profile
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        playSound?.('click');
                        onOpenPicker();
                    }}
                    className="text-[11px] font-sans font-semibold text-antique-gold hover:text-white flex items-center gap-1 cursor-pointer bg-white/5 hover:bg-white/10 px-2.5 py-0.5 rounded-lg border border-antique-gold/30 transition-all flex-shrink-0"
                    title="Click to search and change user"
                >
                    <span>Change User</span>
                    <ChevronDown size={12} className="text-antique-gold" />
                </button>
            </div>

            <div className="flex items-center justify-between gap-2">
                {/* Previous Member Button */}
                <button
                    type="button"
                    onClick={() => {
                        playSound?.('click');
                        onPrev();
                    }}
                    className="h-10 sm:h-11 px-2.5 sm:px-4 rounded-xl bg-black/40 hover:bg-antique-gold/20 active:bg-antique-gold/30 border border-antique-gold/40 text-amber-200 flex items-center gap-1 font-serif text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex-shrink-0 active:scale-95"
                    title="Previous Member"
                >
                    <ChevronLeft size={18} className="text-antique-gold" />
                    <span className="hidden xs:inline">Prev</span>
                </button>

                {/* Central Member Selector Pill (Shows ONLY Name cleanly, opens picker for full details) */}
                <button
                    type="button"
                    onClick={() => {
                        playSound?.('click');
                        onOpenPicker();
                    }}
                    className="flex-1 min-w-0 h-10 sm:h-11 px-3 rounded-xl bg-black/50 hover:bg-black/70 border border-antique-gold/50 hover:border-antique-gold flex items-center justify-center gap-1.5 text-center transition-all cursor-pointer group shadow-inner"
                    title="Tap to search and switch user"
                >
                    <span className="font-serif font-bold text-xs sm:text-sm md:text-base text-white truncate group-hover:text-amber-200 transition-colors">
                        {selectedPlayer.displayName}
                    </span>
                    <ChevronDown size={14} className="text-antique-gold flex-shrink-0 group-hover:translate-y-0.5 transition-transform" />
                </button>

                {/* Next Member Button */}
                <button
                    type="button"
                    onClick={() => {
                        playSound?.('click');
                        onNext();
                    }}
                    className="h-10 sm:h-11 px-2.5 sm:px-4 rounded-xl bg-black/40 hover:bg-antique-gold/20 active:bg-antique-gold/30 border border-antique-gold/40 text-amber-200 flex items-center gap-1 font-serif text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer flex-shrink-0 active:scale-95"
                    title="Next Member"
                >
                    <span className="hidden xs:inline">Next</span>
                    <ChevronRight size={18} className="text-antique-gold" />
                </button>

                {/* Search Button (Opens Modal Directly) */}
                <button
                    type="button"
                    onClick={() => {
                        playSound?.('click');
                        onOpenPicker();
                    }}
                    className="h-10 sm:h-11 w-10 sm:w-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 hover:from-amber-300 hover:to-yellow-500 text-midnight-blue flex items-center justify-center shadow-lg transition-all cursor-pointer flex-shrink-0 active:scale-95"
                    title={`Browse and search all ${totalCount} members`}
                >
                    <Search size={17} strokeWidth={2.5} />
                </button>
            </div>
            
            {/* Sub-bar showing index and actionable prompt */}
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-sans text-amber-300/80 pt-2 px-1">
                <span className="font-mono text-[10px]">Alumnus {(currentIndex !== undefined ? currentIndex + 1 : 1)} of {totalCount}</span>
                <span className="text-antique-gold font-medium truncate ml-2">
                    👈 Tap name or 🔍 to select any alumnus 👉
                </span>
            </div>
        </div>
    );
}
