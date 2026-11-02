import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, Trophy, Award, ChevronDown, Sparkles, Home } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useSoundManager } from '../hooks/useSoundManager';
import { isFinaleUnlocked } from '../utils/featureFlags';

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

    // Don't show user nav if not logged in or if on the main entry page without identity
    if (!isAuthenticated || location.pathname === '/') {
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
        <div ref={dropdownRef} className="fixed top-4 left-4 z-40">
            <button
                onClick={() => {
                    playSound('click');
                    setDropdownOpen(!dropdownOpen);
                }}
                className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-midnight-blue/70 backdrop-blur-md border border-antique-gold/40 shadow-lg hover:border-antique-gold hover:bg-midnight-blue transition-all group"
            >
                <div
                    className={`w-7 h-7 rounded-full ${
                        displayAvatar?.startsWith('data:image') || displayAvatar?.startsWith('http')
                            ? 'bg-black/40'
                            : `bg-gradient-to-br ${getAvatarBg(displayAvatar)}`
                    } flex items-center justify-center text-sm shadow-inner border border-antique-gold/30 overflow-hidden`}
                >
                    {displayAvatar?.startsWith('data:image') || displayAvatar?.startsWith('http') ? (
                        <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        getAvatarEmoji(displayAvatar)
                    )}
                </div>
                <div className="flex flex-col text-left">
                    <span className="text-xs font-serif font-bold text-amber-100 max-w-[120px] truncate leading-tight group-hover:text-antique-gold transition-colors">
                        {displayName}
                    </span>
                    <span className="text-[10px] font-sans text-antique-gold/80 leading-tight">
                        {user?.batch ? `Batch '${user.batch.slice(-2)}` : 'Member'}
                    </span>
                </div>
                <ChevronDown
                    size={14}
                    className={`text-antique-gold transition-transform duration-200 ${
                        dropdownOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
                {dropdownOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 mt-2 w-56 rounded-xl bg-midnight-blue/95 backdrop-blur-xl border border-antique-gold/40 shadow-2xl p-2 text-left z-50 font-sans"
                    >
                        {/* Member Card Header */}
                        <div className="px-3 py-2 border-b border-antique-gold/20 mb-1">
                            <p className="font-serif text-sm font-bold text-amber-50 truncate">{displayName}</p>
                            <p className="text-[11px] text-amber-200/60 font-mono truncate">{user?.phone || 'No Phone'}</p>
                            {user?.cumulative_score !== undefined && (
                                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-antique-gold font-serif">
                                    <Trophy size={12} />
                                    <span>Score: {user.cumulative_score} pts</span>
                                    {user.rank && <span className="ml-auto text-amber-300 font-bold">{user.rank}</span>}
                                </div>
                            )}
                        </div>

                        {/* Menu Options */}
                        <button
                            onClick={() => handleNavigate('/welcome')}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-100 hover:bg-white/10 hover:text-antique-gold rounded-lg transition-colors cursor-pointer"
                        >
                            <Home size={15} className="text-antique-gold" />
                            <span>Club Lounge (Home)</span>
                        </button>

                        {finaleUnlocked && (
                            <button
                                onClick={() => handleNavigate('/profile?playStory=true')}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-200 hover:bg-white/10 hover:text-amber-300 rounded-lg transition-colors font-semibold cursor-pointer"
                            >
                                <Sparkles size={15} className="text-amber-400" />
                                <span>🎬 Play My 2026 Wrapped</span>
                            </button>
                        )}

                        <button
                            onClick={() => handleNavigate('/profile')}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-100 hover:bg-white/10 hover:text-antique-gold rounded-lg transition-colors cursor-pointer"
                        >
                            <User size={15} className="text-antique-gold" />
                            <span>{finaleUnlocked ? 'My Profile, Awards & Certs' : 'My Profile & Stats'}</span>
                        </button>

                        {finaleUnlocked && (
                            <>
                                <button
                                    onClick={() => handleNavigate('/rewind?tab=highlights')}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-100 hover:bg-white/10 hover:text-antique-gold rounded-lg transition-colors cursor-pointer"
                                >
                                    <Trophy size={15} className="text-antique-gold" />
                                    <span>🌍 2026 Club Rewind</span>
                                </button>
                                <button
                                    onClick={() => handleNavigate('/rewind?tab=hallOfFame')}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-amber-100 hover:bg-white/10 hover:text-antique-gold rounded-lg transition-colors cursor-pointer"
                                >
                                    <Award size={15} className="text-antique-gold" />
                                    <span>🏛️ Hall of Fame & Standings</span>
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
    );
}
