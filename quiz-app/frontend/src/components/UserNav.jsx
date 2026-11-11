import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Trophy, Award, ChevronDown, Sparkles, Home, Edit3, ShieldCheck, Camera } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useSoundManager } from '../hooks/useSoundManager';
import { isFinaleUnlocked, isFinaleAdmin } from '../utils/featureFlags';

export const AVATAR_OPTIONS = [
    { id: 'avatar-1', label: '🎓 Scholar', bg: 'from-amber-600 to-yellow-800', emoji: '🎓' },
    { id: 'avatar-2', label: '🦁 Royal Lion', bg: 'from-yellow-600 to-amber-900', emoji: '🦁' },
    { id: 'avatar-3', label: '⚡ Quiz Master', bg: 'from-blue-600 to-indigo-900', emoji: '⚡' },
    { id: 'avatar-4', label: '👑 Club Patron', bg: 'from-purple-700 to-indigo-950', emoji: '👑' },
    { id: 'avatar-5', label: '🌟 Star', bg: 'from-orange-500 to-red-800', emoji: '🌟' },
    { id: 'avatar-6', label: '🦅 Eagle', bg: 'from-emerald-600 to-teal-900', emoji: '🦅' },
];

export const getAvatarEmoji = (avatarId) => {
    const found = AVATAR_OPTIONS.find((a) => a.id === avatarId);
    return found ? found.emoji : '🎓';
};

export const getAvatarBg = (avatarId) => {
    const found = AVATAR_OPTIONS.find((a) => a.id === avatarId);
    return found ? found.bg : 'from-amber-600 to-yellow-800';
};

export default function UserNav() {
    const { user, isAuthenticated, logout } = useAuth();
    const { config } = useConfig();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const { playSound } = useSoundManager();
    const finaleUnlocked = isFinaleUnlocked(user, config);
    const isAdmin = isFinaleAdmin(user);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Don't show user nav if not logged in, on entry page, or during active quiz
    if (!isAuthenticated || location.pathname === '/' || location.pathname === '/quiz') {
        return null;
    }

    const handleLogout = () => {
        playSound('click');
        setDropdownOpen(false);
        logout();
        navigate('/');
    };

    const handleNavigate = (path) => {
        playSound('click');
        setDropdownOpen(false);
        navigate(path);
    };

    const displayName = user?.name || 'Club Member';
    const displayAvatar = user?.avatar || 'avatar-1';

    return (
        <div ref={dropdownRef} className="fixed top-3 left-3 sm:top-4 sm:left-4 z-40 flex items-center">
            <div id="tour-profile" className="relative">
                <button
                    onClick={() => {
                        playSound('click');
                        setDropdownOpen(!dropdownOpen);
                    }}
                    className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2.5 p-1 sm:px-3 sm:py-1.5 rounded-2xl sm:rounded-full bg-midnight-blue/80 backdrop-blur-md border border-antique-gold/50 shadow-xl hover:border-antique-gold hover:bg-midnight-blue transition-all group cursor-pointer active:scale-95"
                    title="Open Profile Menu"
                >
                    {/* Circular Avatar with mobile indicator */}
                    <div className="relative">
                        <div
                            className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full ${
                                displayAvatar?.startsWith('data:image') || displayAvatar?.startsWith('http')
                                    ? 'bg-black/40'
                                    : `bg-gradient-to-br ${getAvatarBg(displayAvatar)}`
                            } flex items-center justify-center text-base sm:text-sm shadow-inner border border-antique-gold/40 overflow-hidden group-hover:border-antique-gold transition-colors`}
                        >
                            {displayAvatar?.startsWith('data:image') || displayAvatar?.startsWith('http') ? (
                                <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                getAvatarEmoji(displayAvatar)
                            )}
                        </div>

                        {/* Mobile Indicator Badge */}
                        <div className="sm:hidden absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0a1428] border border-antique-gold/70 flex items-center justify-center text-[8px] text-antique-gold font-bold shadow">
                            ▾
                        </div>
                    </div>

                    {/* Mobile Label Below Circle */}
                    <span className="sm:hidden text-[9px] font-serif font-bold text-amber-200 tracking-tight leading-none drop-shadow">
                        Profile
                    </span>

                    {/* Desktop Inline Name & Batch */}
                    <div className="hidden sm:flex flex-col text-left">
                        <span className="text-xs font-serif font-bold text-amber-100 max-w-[120px] truncate leading-tight group-hover:text-antique-gold transition-colors">
                            {displayName}
                        </span>
                        <span className="text-[10px] font-sans text-antique-gold/80 leading-tight">
                            {user?.batch ? `Batch '${user.batch.slice(-2)}` : 'Member'}
                        </span>
                    </div>

                    <ChevronDown
                        size={14}
                        className={`hidden sm:inline-block text-antique-gold transition-transform duration-200 ${
                            dropdownOpen ? 'rotate-180' : ''
                        }`}
                    />
                </button>

                {/* Dropdown Menu - strictly anchored below the button */}
                <AnimatePresence>
                    {dropdownOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -6, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6, scale: 0.96 }}
                            transition={{ duration: 0.15 }}
                            className="absolute left-0 top-full mt-2 w-60 max-h-[calc(100vh-80px)] overflow-y-auto rounded-xl bg-midnight-blue/95 backdrop-blur-xl border border-antique-gold/40 shadow-2xl p-2 text-left z-50 font-sans"
                        >
                            {/* Member Card Header */}
                            <div className="px-3 py-2 border-b border-antique-gold/20 mb-1">
                                <div className="flex items-center justify-between gap-1">
                                    <p className="font-serif text-sm font-bold text-amber-50 truncate">{displayName}</p>
                                    {isAdmin && (
                                        <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold flex-shrink-0">
                                            Admin
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-amber-200/60 font-mono truncate">{user?.phone || 'No Phone'}</p>
                                {user?.cumulative_score !== undefined && (
                                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-antique-gold font-serif">
                                        <Trophy size={12} />
                                        <span>Score: {user.cumulative_score} pts</span>
                                        {user.rank && <span className="ml-auto text-amber-300 font-bold">{user.rank}</span>}
                                    </div>
                                )}
                            </div>

                            {/* Menu Options: Streamlined to Core Destinations */}
                            <button
                                onClick={() => handleNavigate('/welcome')}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-100 hover:bg-white/10 hover:text-antique-gold rounded-lg transition-colors cursor-pointer"
                            >
                                <Home size={15} className="text-antique-gold" />
                                <span>Club Lounge (Home)</span>
                            </button>

                            <button
                                onClick={() => handleNavigate('/profile')}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-100 hover:bg-white/10 hover:text-antique-gold rounded-lg transition-colors cursor-pointer"
                            >
                                <User size={15} className="text-antique-gold" />
                                <span>My Profile &amp; Awards</span>
                            </button>

                            <button
                                onClick={() => handleNavigate('/profile?tab=details')}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-100 hover:bg-white/10 hover:text-antique-gold rounded-lg transition-colors cursor-pointer"
                            >
                                <Edit3 size={15} className="text-antique-gold" />
                                <span>Edit Profile &amp; Photo</span>
                            </button>

                            {finaleUnlocked && (
                                <>
                                    <button
                                        onClick={() => handleNavigate('/rewind?tab=highlights')}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-100 hover:bg-white/10 hover:text-antique-gold rounded-lg transition-colors cursor-pointer"
                                    >
                                        <Trophy size={15} className="text-antique-gold" />
                                        <span>2026 Season Rewind</span>
                                    </button>

                                    <button
                                        onClick={() => handleNavigate('/yaadein')}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-100 hover:bg-white/10 hover:text-antique-gold rounded-lg transition-colors cursor-pointer"
                                    >
                                        <Camera size={15} className="text-antique-gold" />
                                        <span>Yaadein • यादें (Album)</span>
                                    </button>
                                </>
                            )}

                            <button
                                onClick={() => handleNavigate('/leaderboard')}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-100 hover:bg-white/10 hover:text-antique-gold rounded-lg transition-colors cursor-pointer"
                            >
                                <Award size={15} className="text-antique-gold" />
                                <span>Weekly Leaderboard</span>
                            </button>

                            {/* Admin Dashboard Option for Admins */}
                            {isAdmin && (
                                <button
                                    onClick={() => handleNavigate('/admin/dashboard')}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/20 hover:text-white rounded-lg transition-colors cursor-pointer border border-amber-500/30 font-semibold my-0.5"
                                >
                                    <ShieldCheck size={15} className="text-amber-400" />
                                    <span>Admin Dashboard</span>
                                </button>
                            )}

                            {/* App Walkthrough Tour Option */}
                            <button
                                onClick={() => {
                                    playSound('click');
                                    setDropdownOpen(false);
                                    if (location.pathname !== '/welcome') {
                                        navigate('/welcome');
                                    }
                                    setTimeout(() => {
                                        window.dispatchEvent(new CustomEvent('start-app-tour'));
                                    }, 200);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-300 hover:bg-amber-500/20 hover:text-white rounded-lg transition-colors cursor-pointer border border-amber-400/30 my-0.5 font-medium"
                            >
                                <Sparkles size={15} className="text-amber-400" />
                                <span>Take App Tour (Tutorial)</span>
                            </button>

                            <div className="h-px bg-antique-gold/20 my-1" />

                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-300 hover:bg-red-950/40 hover:text-red-200 rounded-lg transition-colors"
                            >
                                <LogOut size={15} className="text-red-400" />
                                <span>Sign Out</span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
