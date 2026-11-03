import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    User, Phone, MapPin, Calendar, Award, Trophy, CheckCircle, 
    Save, LogOut, ShieldCheck, Sparkles, AlertCircle, Edit3,
    Download, Upload, Trash2, Copy, Check, Crown, Medal, Zap, Clock, BarChart3, Search, Camera, Image as ImageIcon, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useSoundManager } from '../hooks/useSoundManager';
import { AVATAR_OPTIONS, getAvatarBg, getAvatarEmoji } from '../components/UserNav';
import { FINALE_DATA } from '../data/finaleData';
import { renderCertificateToDataUrl, renderWrappedCardToDataUrl } from '../utils/certificateRenderer';
import { normalizePhone, isFinaleAdmin, isFinaleUnlocked } from '../utils/featureFlags';
import PersonalStoryModal from '../components/PersonalStoryModal';
import { AdminMemberBar, AdminMemberPickerModal } from '../components/AdminMemberControls';

export default function Profile() {
    const { user, updateProfile, logout, refreshProfile } = useAuth();
    const navigate = useNavigate();
    const { playSound } = useSoundManager();
    const { config } = useConfig();

    // Permissions & Feature Access
    const isAdmin = isFinaleAdmin(user);
    const finaleUnlocked = isFinaleUnlocked(user, config);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [batch, setBatch] = useState('');
    const [city, setCity] = useState('');
    const [bio, setBio] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState('avatar-1');
    const [showAvatarPicker, setShowAvatarPicker] = useState(false);
    const profilePhotoInputRef = useRef(null);

    // Submission states
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    // 2026 Season Finale Personalized Data & Certificate Studio state
    const loggedInPhoneNorm = useMemo(() => {
        const raw = user?.phone || localStorage.getItem('user_id') || '';
        return normalizePhone(raw);
    }, [user?.phone]);

    const [selectedMemberNorm, setSelectedMemberNorm] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [showMemberSwitcher, setShowMemberSwitcher] = useState(false);
    const [showStoryModal, setShowStoryModal] = useState(false);
    const [searchParams] = useSearchParams();
    const [activeSubTab, setActiveSubTab] = useState(() => {
        const tab = searchParams.get('tab');
        if (tab === 'awards' || tab === 'stats' || tab === 'details') return tab;
        if (searchParams.get('playStory') === 'true') return 'awards';
        return 'details';
    });

    // Auto-launch personal story reel if navigated with ?playStory=true
    useEffect(() => {
        if (searchParams.get('playStory') === 'true') {
            setShowStoryModal(true);
            setActiveSubTab('awards');
        }
        const tab = searchParams.get('tab');
        if (tab === 'awards' || tab === 'stats' || tab === 'details') {
            setActiveSubTab(tab);
        }
    }, [searchParams]);

    // Auto-select logged-in member in Finale dataset
    useEffect(() => {
        // If not admin, strictly lock to logged-in user
        if (!isAdmin) {
            if (loggedInPhoneNorm && FINALE_DATA.players.some((p) => p.normPhone === loggedInPhoneNorm)) {
                setSelectedMemberNorm(loggedInPhoneNorm);
                return;
            }
            if (user?.name) {
                const byName = FINALE_DATA.players.find(
                    (p) =>
                        p.displayName.toLowerCase() === user.name.trim().toLowerCase() ||
                        p.realName.toLowerCase() === user.name.trim().toLowerCase()
                );
                if (byName) {
                    setSelectedMemberNorm(byName.normPhone);
                    return;
                }
            }
            setSelectedMemberNorm(loggedInPhoneNorm || FINALE_DATA.players[0]?.normPhone || '');
            return;
        }

        // If admin, default to admin's profile or previous selection
        if (!selectedMemberNorm) {
            if (loggedInPhoneNorm && FINALE_DATA.players.some((p) => p.normPhone === loggedInPhoneNorm)) {
                setSelectedMemberNorm(loggedInPhoneNorm);
            } else {
                setSelectedMemberNorm(FINALE_DATA.players[0]?.normPhone || '');
            }
        }
    }, [isAdmin, loggedInPhoneNorm, user?.name, selectedMemberNorm]);

    const finalePlayer = useMemo(() => {
        return (
            FINALE_DATA.players.find((p) => p.normPhone === selectedMemberNorm) ||
            FINALE_DATA.players[0]
        );
    }, [selectedMemberNorm]);

    const [showMemberPickerModal, setShowMemberPickerModal] = useState(false);

    const currentPlayerIdx = useMemo(() => {
        const idx = FINALE_DATA.players.findIndex((p) => p.normPhone === finalePlayer?.normPhone);
        return idx >= 0 ? idx : 0;
    }, [finalePlayer?.normPhone]);

    const handlePrevMember = useCallback(() => {
        playSound('click');
        const prevIdx = (currentPlayerIdx - 1 + FINALE_DATA.players.length) % FINALE_DATA.players.length;
        setSelectedMemberNorm(FINALE_DATA.players[prevIdx].normPhone);
    }, [currentPlayerIdx, playSound]);

    const handleNextMember = useCallback(() => {
        playSound('click');
        const nextIdx = (currentPlayerIdx + 1) % FINALE_DATA.players.length;
        setSelectedMemberNorm(FINALE_DATA.players[nextIdx].normPhone);
    }, [currentPlayerIdx, playSound]);

    const [certType, setCertType] = useState('award'); // 'award' | 'participation'
    const [selectedAwardIdx, setSelectedAwardIdx] = useState(0);
    const [memberPhotos, setMemberPhotos] = useState({});
    const [certDataUrl, setCertDataUrl] = useState(null);
    const [wrappedDataUrl, setWrappedDataUrl] = useState(null);
    const [renderingCert, setRenderingCert] = useState(false);
    const [copiedPromptId, setCopiedPromptId] = useState(null);
    const photoInputRef = useRef(null);

    // Reset default certificate type when member changes
    useEffect(() => {
        if (finalePlayer?.awards?.length > 0) {
            setCertType('award');
            setSelectedAwardIdx(0);
        } else {
            setCertType('participation');
            setSelectedAwardIdx(0);
        }
    }, [finalePlayer?.normPhone]);

    const currentPhoto = useMemo(() => {
        if (!finalePlayer) return null;
        if (memberPhotos[finalePlayer.normPhone]) {
            return memberPhotos[finalePlayer.normPhone];
        }
        if (selectedAvatar?.startsWith('data:image') || selectedAvatar?.startsWith('http')) {
            return selectedAvatar;
        }
        if (user?.avatar?.startsWith('data:image') || user?.avatar?.startsWith('http')) {
            return user.avatar;
        }
        return null;
    }, [finalePlayer, memberPhotos, selectedAvatar, user?.avatar]);

    const handleProfilePhotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            setSelectedAvatar(dataUrl);
            if (finalePlayer?.normPhone) {
                setMemberPhotos((prev) => ({
                    ...prev,
                    [finalePlayer.normPhone]: dataUrl,
                }));
            }
        };
        reader.readAsDataURL(file);
    };

    // Render Certificate & WhatsApp Wrapped Card whenever selection or photo changes
    useEffect(() => {
        let cancelled = false;
        async function generateVisuals() {
            if (!finalePlayer) return;
            setRenderingCert(true);
            try {
                const activeAward =
                    certType === 'award' && finalePlayer.awards?.length > 0
                        ? finalePlayer.awards[selectedAwardIdx] || finalePlayer.awards[0]
                        : null;
                const [cUrl, wUrl] = await Promise.all([
                    renderCertificateToDataUrl({
                        player: finalePlayer,
                        certType: activeAward ? 'award' : 'participation',
                        award: activeAward,
                        photoDataUrl: currentPhoto,
                    }),
                    renderWrappedCardToDataUrl({
                        player: finalePlayer,
                        photoDataUrl: currentPhoto,
                    }),
                ]);
                if (!cancelled) {
                    setCertDataUrl(cUrl);
                    setWrappedDataUrl(wUrl);
                }
            } catch (e) {
                console.error('Failed to render certificate/wrapped card:', e);
            } finally {
                if (!cancelled) setRenderingCert(false);
            }
        }
        generateVisuals();
        return () => {
            cancelled = true;
        };
    }, [finalePlayer, certType, selectedAwardIdx, currentPhoto]);

    const handlePhotoUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file || !finalePlayer) return;
        const reader = new FileReader();
        reader.onload = () => {
            setMemberPhotos((prev) => ({
                ...prev,
                [finalePlayer.normPhone]: reader.result,
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleDownloadImage = (dataUrl, filename) => {
        if (!dataUrl) return;
        playSound('click');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadCert = async () => {
        let url = certDataUrl;
        if (!url && finalePlayer) {
            const activeAward =
                certType === 'award' && finalePlayer.awards?.length > 0
                    ? finalePlayer.awards[selectedAwardIdx] || finalePlayer.awards[0]
                    : null;
            url = await renderCertificateToDataUrl({
                player: finalePlayer,
                certType: activeAward ? 'award' : 'participation',
                award: activeAward,
                photoDataUrl: currentPhoto,
            });
            setCertDataUrl(url);
        }
        if (url && finalePlayer) {
            handleDownloadImage(url, `UCE_89_Certificate_${finalePlayer.displayName.replace(/\s+/g, '_')}.png`);
        }
    };

    const handleDownloadWrapped = async () => {
        let url = wrappedDataUrl;
        if (!url && finalePlayer) {
            url = await renderWrappedCardToDataUrl({
                player: finalePlayer,
                photoDataUrl: currentPhoto,
            });
            setWrappedDataUrl(url);
        }
        if (url && finalePlayer) {
            handleDownloadImage(url, `UCE_89_Wrapped_${finalePlayer.displayName.replace(/\s+/g, '_')}.png`);
        }
    };

    const handleCopyPrompt = (id, text) => {
        playSound('click');
        navigator.clipboard.writeText(text);
        setCopiedPromptId(id);
        setTimeout(() => setCopiedPromptId(null), 2500);
    };

    const filteredMembers = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        if (!q) return FINALE_DATA.players;
        return FINALE_DATA.players.filter(
            (p) =>
                p.displayName.toLowerCase().includes(q) ||
                p.realName.toLowerCase().includes(q) ||
                p.handle.toLowerCase().includes(q) ||
                p.normPhone.includes(q)
        );
    }, [memberSearch]);

    // Refresh profile from backend on mount
    useEffect(() => {
        if (refreshProfile) {
            refreshProfile();
        }
    }, [refreshProfile]);

    // Initialize form with user data
    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setEmail(user.email || '');
            setBatch(user.batch || '1989');
            setCity(user.city || '');
            setBio(user.bio || '');
            setSelectedAvatar(user.avatar || 'avatar-1');
        }
    }, [user]);

    const handleSave = async (e) => {
        e.preventDefault();
        playSound('click');
        setIsSaving(true);
        setErrorMessage(null);
        setSaveSuccess(false);

        try {
            await updateProfile({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                batch: batch.trim(),
                city: city.trim(),
                bio: bio.trim(),
                avatar: selectedAvatar
            });
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            console.error('Failed to update profile:', err);
            setErrorMessage(err.response?.data?.detail || 'Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogout = () => {
        playSound('click');
        logout();
        navigate('/');
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-3xl mx-auto pt-16 sm:pt-6 pb-8 px-2 sm:px-4 text-amber-50"
        >
            {/* Sticky Top Navigation Bar */}
            <div className="sticky top-16 sm:top-2 z-30 py-2.5 mb-5 bg-[#0a1428]/95 backdrop-blur-md border border-antique-gold/30 px-3 sm:px-4 rounded-xl flex items-center justify-end gap-2 shadow-xl">
                {finaleUnlocked && (
                    <>
                        <button
                            onClick={() => {
                                playSound('fanfare');
                                setShowStoryModal(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif font-black text-[#0b1528] bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 hover:from-amber-200 hover:to-yellow-300 rounded-lg shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        >
                            <Sparkles size={13} />
                            <span>Play My Wrapped</span>
                        </button>

                        <button
                            onClick={() => {
                                playSound('click');
                                navigate('/rewind?tab=highlights');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-serif font-bold text-amber-200 bg-white/10 hover:bg-white/20 border border-antique-gold/40 rounded-lg transition-all cursor-pointer"
                        >
                            <span>🌍 Club Rewind</span>
                        </button>
                    </>
                )}

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-300 hover:text-white bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 rounded-lg transition-all cursor-pointer"
                    title="Sign Out"
                >
                    <LogOut size={13} />
                </button>
            </div>

            {/* Admin Member Switcher Bar (Mobile-First sticky navigation across all tabs) */}
            {isAdmin && (
                <AdminMemberBar
                    selectedPlayer={finalePlayer}
                    onPrev={handlePrevMember}
                    onNext={handleNextMember}
                    onOpenPicker={() => setShowMemberPickerModal(true)}
                    currentIndex={currentPlayerIdx}
                    totalCount={FINALE_DATA.players.length}
                />
            )}

            {/* Main Profile Card */}
            <div className="card-vintage text-left relative overflow-hidden mb-6">
                {/* Vintage Header Accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-antique-gold via-royal-blue to-antique-gold" />

                {/* Profile Hero & Avatar */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-antique-gold/20">
                    <div className="flex flex-col items-center gap-2">
                        <div
                            className={`w-24 h-24 rounded-full ${
                                selectedAvatar?.startsWith('data:image') || selectedAvatar?.startsWith('http')
                                    ? 'bg-black/50'
                                    : `bg-gradient-to-br ${getAvatarBg(selectedAvatar)}`
                            } flex items-center justify-center text-4xl shadow-xl border-2 border-antique-gold overflow-hidden relative`}
                        >
                            {selectedAvatar?.startsWith('data:image') || selectedAvatar?.startsWith('http') ? (
                                <img
                                    src={selectedAvatar}
                                    alt="Profile Avatar"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                getAvatarEmoji(selectedAvatar)
                            )}
                        </div>

                        {/* Hidden file input for profile image */}
                        <input
                            ref={profilePhotoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePhotoUpload}
                            className="hidden"
                        />

                        {/* Image upload and icon picker actions */}
                        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    playSound('click');
                                    profilePhotoInputRef.current?.click();
                                }}
                                className="px-2.5 py-1 text-[11px] font-sans font-semibold rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-antique-gold/40 flex items-center gap-1 transition-all"
                                title="Upload Custom Photo"
                            >
                                <Camera size={12} />
                                <span>{selectedAvatar?.startsWith('data:image') ? 'Change' : 'Upload Photo'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    playSound('click');
                                    setShowAvatarPicker(!showAvatarPicker);
                                }}
                                className="px-2.5 py-1 text-[11px] font-sans font-semibold rounded-md bg-midnight-blue hover:bg-white/10 text-antique-gold border border-antique-gold/30 flex items-center gap-1 transition-all"
                                title="Pick Club Icon"
                            >
                                <Sparkles size={12} />
                                <span>Icon</span>
                            </button>

                            {selectedAvatar?.startsWith('data:image') && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        playSound('click');
                                        setSelectedAvatar('avatar-1');
                                    }}
                                    className="p-1 text-red-300 hover:text-white rounded bg-red-950/40 border border-red-800/40"
                                    title="Reset to default icon"
                                >
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="text-center sm:text-left flex-1">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-wide">
                                {user?.name || name || 'Alumni Member'}
                            </h1>
                            <span className="px-2 py-0.5 text-[11px] font-mono font-semibold uppercase tracking-wider bg-antique-gold/20 text-antique-gold border border-antique-gold/40 rounded-full">
                                Verified Member
                            </span>
                        </div>

                        <p className="text-sm font-sans text-amber-200/80 mb-3 italic">
                            {user?.bio || 'Proud member of the United89 alumni family.'}
                        </p>

                        <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-xs text-gray-300 font-sans">
                            <div className="flex items-center gap-1.5">
                                <Phone size={14} className="text-antique-gold" />
                                <span className="font-mono">{user?.phone || 'No phone'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-antique-gold" />
                                <span>Batch of {batch || '1989'}</span>
                            </div>
                            {city && (
                                <div className="flex items-center gap-1.5">
                                    <MapPin size={14} className="text-antique-gold" />
                                    <span>{city}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Avatar Picker Drawer */}
                <AnimatePresence>
                    {showAvatarPicker && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pt-4 pb-2 border-b border-antique-gold/20"
                        >
                            <p className="text-xs font-serif text-antique-gold uppercase tracking-widest mb-3">
                                Choose Club Avatar:
                            </p>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                {AVATAR_OPTIONS.map((avatar) => (
                                    <button
                                        key={avatar.id}
                                        type="button"
                                        onClick={() => {
                                            playSound('click');
                                            setSelectedAvatar(avatar.id);
                                            setShowAvatarPicker(false);
                                        }}
                                        className={`flex flex-col items-center p-2 rounded-xl transition-all border ${
                                            selectedAvatar === avatar.id
                                                ? 'border-antique-gold bg-white/10 shadow-lg scale-105'
                                                : 'border-white/10 hover:border-antique-gold/50 hover:bg-white/5'
                                        }`}
                                    >
                                        <div
                                            className={`w-12 h-12 rounded-full bg-gradient-to-br ${avatar.bg} flex items-center justify-center text-xl shadow mb-1`}
                                        >
                                            {avatar.emoji}
                                        </div>
                                        <span className="text-[11px] font-sans text-amber-100 truncate w-full text-center">
                                            {avatar.label.split(' ')[1] || avatar.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Subcategory Tab Selector */}
                <div className="flex border-b border-antique-gold/20 my-6 bg-black/40 rounded-xl p-1 gap-1.5 shadow-inner">
                    <button
                        type="button"
                        onClick={() => {
                            playSound('click');
                            setActiveSubTab('details');
                        }}
                        className={`flex-1 py-2 px-2.5 sm:px-3 rounded-lg text-xs sm:text-sm font-serif font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                            activeSubTab === 'details'
                                ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-[#0b1528] shadow-md'
                                : 'text-amber-200/70 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <User size={15} />
                        <span>Profile &amp; Account</span>
                    </button>

                    {finaleUnlocked && finalePlayer && (
                        <button
                            type="button"
                            onClick={() => {
                                playSound('click');
                                setActiveSubTab('awards');
                            }}
                            className={`flex-1 py-2 px-2.5 sm:px-3 rounded-lg text-xs sm:text-sm font-serif font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                                activeSubTab === 'awards'
                                    ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-[#0b1528] shadow-md'
                                    : 'text-amber-200/70 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Award size={15} />
                            <span>Awards &amp; Certs</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            playSound('click');
                            setActiveSubTab('stats');
                        }}
                        className={`flex-1 py-2 px-2.5 sm:px-3 rounded-lg text-xs sm:text-sm font-serif font-bold flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                            activeSubTab === 'stats'
                                ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-[#0b1528] shadow-md'
                                : 'text-amber-200/70 hover:text-white hover:bg-white/5'
                        }`}
                    >
                        <BarChart3 size={15} />
                        <span>Stats &amp; Journey</span>
                    </button>
                </div>

                {/* =====================================================================
                    SUBCATEGORY 1: EDITABLE PROFILE & ACCOUNT DETAILS
                   ===================================================================== */}
                {activeSubTab === 'details' && (
                    <div className="pt-2">
                        <h2 className="text-xs font-serif text-antique-gold uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Edit3 size={14} />
                            <span>Edit Personal Details</span>
                        </h2>

                        {/* Feedback Messages */}
                        {saveSuccess && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-4 p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-lg flex items-center gap-2.5 text-emerald-200 text-xs font-sans"
                            >
                                <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                                <span>Your profile has been updated successfully!</span>
                            </motion.div>
                        )}

                        {errorMessage && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-4 p-3 bg-red-950/70 border border-red-500/50 rounded-lg flex items-center gap-2.5 text-red-200 text-xs font-sans"
                            >
                                <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
                                <span>{errorMessage}</span>
                            </motion.div>
                        )}

                        <form onSubmit={handleSave} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-serif text-antique-gold mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        placeholder="Enter your full name"
                                        className="input-vintage text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-serif text-antique-gold mb-1">
                                        Phone Number (Fixed ID)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={user?.phone || ''}
                                            disabled
                                            className="input-vintage text-sm opacity-60 bg-black/40 cursor-not-allowed font-mono"
                                        />
                                        <ShieldCheck
                                            size={16}
                                            className="absolute right-3 top-3.5 text-antique-gold/70"
                                            title="Primary Account Identifier"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-serif text-antique-gold">
                                        Linked Gmail Account (For 1-Click Google Sign-In)
                                    </label>
                                    {email && (
                                        <button
                                            type="button"
                                            onClick={() => setEmail('')}
                                            className="text-[11px] text-amber-300/80 hover:text-white underline font-sans"
                                        >
                                            Unlink / Clear
                                        </button>
                                    )}
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="e.g. yourname@gmail.com (auto-linked on first Google Sign-In)"
                                    className="input-vintage text-sm font-mono"
                                />
                                <p className="text-[11px] text-amber-200/60 font-sans mt-1">
                                    Locked to your phone number for security. You can change or clear this email here and click Save Profile Changes.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-serif text-antique-gold mb-1">Graduation Batch</label>
                                    <input
                                        type="text"
                                        value={batch}
                                        onChange={(e) => setBatch(e.target.value)}
                                        placeholder="e.g. 1989"
                                        className="input-vintage text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-serif text-antique-gold mb-1">
                                        Current City / Location
                                    </label>
                                    <input
                                        type="text"
                                        value={city}
                                        onChange={(e) => setCity(e.target.value)}
                                        placeholder="e.g. Bhubaneswar, India"
                                        className="input-vintage text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-serif text-antique-gold mb-1">
                                    Bio / Personal Tagline
                                </label>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    rows={2}
                                    placeholder="A brief sentence about yourself..."
                                    className="input-vintage text-sm resize-none"
                                />
                            </div>

                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="btn-vintage flex items-center gap-2 text-sm px-6 py-2.5 cursor-pointer"
                                >
                                    <Save size={16} />
                                    <span>{isSaving ? 'Saving...' : 'Save Profile Changes'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* =====================================================================
                    SUBCATEGORY 2: 2026 SEASON FINALE AWARDS & CERTIFICATES STUDIO
                   ===================================================================== */}
                {activeSubTab === 'awards' && finaleUnlocked && finalePlayer && (
                    <div className="pt-2 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm sm:text-base font-serif font-bold text-amber-300 uppercase tracking-widest flex items-center gap-2">
                                    <Crown size={16} className="text-amber-400" />
                                    <span>2026 Season Finale: My Awards &amp; Certificates</span>
                                </h2>
                                <p className="text-xs text-amber-100/75 font-sans mt-0.5">
                                    Personalized High-Res Certificates &amp; WhatsApp Story Card
                                </p>
                            </div>

                            {/* Member Switcher ONLY for Admin (9437555900) */}
                            {isAdmin ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        playSound('click');
                                        setShowMemberPickerModal(true);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 border border-antique-gold/40 hover:border-antique-gold text-xs font-serif text-amber-100 flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
                                >
                                    <Search size={13} className="text-antique-gold" />
                                    <span>Admin: <strong className="text-amber-300">{finalePlayer.displayName}</strong></span>
                                </button>
                            ) : (
                                <div className="text-xs font-serif text-amber-200/90 bg-black/30 border border-antique-gold/25 px-3 py-1.5 rounded-lg">
                                    <span>Personal 2026 Showcase</span>
                                </div>
                            )}
                        </div>

                        {/* 2026 Wrapped Personal Story Reel Banner */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-purple-500/20 border-2 border-antique-gold/50 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5 text-left">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-midnight-blue shadow-lg font-black text-2xl flex-shrink-0">
                                    🎬
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-bold">
                                            Personalized 2026 Wrapped
                                        </span>
                                    </div>
                                    <h3 className="text-base sm:text-lg font-serif font-bold text-white mt-0.5">
                                        Your 40-Week 2026 Story Reel
                                    </h3>
                                    <p className="text-xs text-amber-200/80 font-sans">
                                        Watch your 6-slide animated Spotify/Instagram-style recap with attendance, records, and honors!
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    playSound('fanfare');
                                    setShowStoryModal(true);
                                }}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 hover:from-amber-200 hover:to-yellow-300 text-[#0b1528] font-serif font-black text-xs sm:text-sm shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer"
                            >
                                <Sparkles size={16} />
                                <span>Play 2026 Story</span>
                            </button>
                        </div>

                        {/* Special Awards Won Section */}
                        {finalePlayer.awards && finalePlayer.awards.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-xs font-serif text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Award size={14} />
                                    <span>Official 2026 Special Awards Earned ({finalePlayer.awards.length})</span>
                                </p>
                                <div className="grid grid-cols-1 gap-3">
                                    {finalePlayer.awards.map((aw, idx) => (
                                        <div
                                            key={aw.id}
                                            className="p-4 rounded-xl bg-gradient-to-br from-[#132546] to-[#091224] border border-antique-gold/40 shadow-lg flex flex-col gap-2"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
                                                    {aw.tier}
                                                </span>
                                                <span className="text-xs font-mono text-emerald-300 font-semibold">
                                                    {aw.statsBadge}
                                                </span>
                                            </div>
                                            <h3 className="text-base sm:text-lg font-serif font-bold text-white">
                                                {aw.title}
                                            </h3>
                                            <p className="text-xs text-gray-300 font-sans leading-relaxed">
                                                {aw.citation}
                                            </p>
                                            <div className="flex flex-wrap items-center gap-2 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        playSound('click');
                                                        setCertType('award');
                                                        setSelectedAwardIdx(idx);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                                        certType === 'award' && selectedAwardIdx === idx
                                                            ? 'bg-antique-gold text-[#0b1528]'
                                                            : 'bg-white/10 text-amber-200 hover:bg-white/20'
                                                    }`}
                                                >
                                                    <Award size={13} />
                                                    <span>Select on Certificate</span>
                                                </button>
                                                {aw.aiPrompt && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyPrompt(aw.id, aw.aiPrompt)}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-sans bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-400/40 text-indigo-200 flex items-center gap-1.5 transition-all cursor-pointer"
                                                    >
                                                        {copiedPromptId === aw.id ? (
                                                            <>
                                                                <Check size={13} className="text-emerald-400" />
                                                                <span className="text-emerald-300">Copied AI Photo Prompt!</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Copy size={13} />
                                                                <span>Copy AI Photo-to-Award Prompt</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Interactive Certificate & WhatsApp Wrapped Studio */}
                        <div className="p-4 rounded-xl bg-black/40 border border-antique-gold/30 space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-serif font-bold text-amber-200 uppercase tracking-wider">
                                        🎓 Personalized Certificate &amp; WhatsApp Status Studio
                                    </h3>
                                    <p className="text-[11px] text-gray-400 font-sans">
                                        Add your photo (optional) to embed it inside the gold portrait frame before downloading!
                                    </p>
                                </div>

                                {/* Photo Upload Controls */}
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={photoInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoUpload}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => photoInputRef.current?.click()}
                                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 text-xs font-serif flex items-center gap-1.5 transition-all cursor-pointer"
                                    >
                                        <Upload size={13} />
                                        <span>{currentPhoto ? 'Change Photo' : 'Add Your Photo'}</span>
                                    </button>
                                    {currentPhoto && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setMemberPhotos((prev) => {
                                                    const next = { ...prev };
                                                    delete next[finalePlayer.normPhone];
                                                    return next;
                                                })
                                            }
                                            className="p-1.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 hover:text-white cursor-pointer"
                                            title="Remove photo"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Certificate Type Switcher */}
                            <div className="flex flex-wrap gap-2">
                                {finalePlayer.awards?.map((aw, idx) => (
                                    <button
                                        key={aw.id}
                                        type="button"
                                        onClick={() => {
                                            setCertType('award');
                                            setSelectedAwardIdx(idx);
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-serif transition-all border cursor-pointer ${
                                            certType === 'award' && selectedAwardIdx === idx
                                                ? 'bg-antique-gold text-[#0b1528] border-antique-gold font-bold shadow'
                                                : 'bg-black/40 text-amber-200 border-antique-gold/30 hover:border-antique-gold'
                                        }`}
                                    >
                                        🏆 {aw.shortTitle || aw.title}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setCertType('participation')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-serif transition-all border cursor-pointer ${
                                        certType === 'participation' || !finalePlayer.awards?.length
                                            ? 'bg-antique-gold text-[#0b1528] border-antique-gold font-bold shadow'
                                            : 'bg-black/40 text-amber-200 border-antique-gold/30 hover:border-antique-gold'
                                    }`}
                                >
                                    📜 40-Week Excellence &amp; Participation Certificate
                                </button>
                            </div>

                            {/* Preview Grid: Certificate + WhatsApp Wrapped Card */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                                {/* Certificate Preview (2 cols) */}
                                <div className="md:col-span-2 space-y-2">
                                    <div className="rounded-xl overflow-hidden border-2 border-antique-gold/50 bg-[#070e1c] shadow-xl relative">
                                        {certDataUrl ? (
                                            <img
                                                src={certDataUrl}
                                                alt="Personalized UCE '89 Certificate"
                                                className="w-full h-auto block"
                                            />
                                        ) : (
                                            <div className="h-56 flex items-center justify-center text-xs text-gray-400">
                                                Rendering High-Res Certificate...
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!certDataUrl || renderingCert}
                                        onClick={() =>
                                            handleDownloadImage(
                                                certDataUrl,
                                                `UCE89_2026_${finalePlayer.displayName.replace(/\s+/g, '_')}_${certType}_Certificate.png`
                                            )
                                        }
                                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 hover:from-amber-300 hover:to-yellow-400 text-[#0b1528] font-serif font-black text-xs sm:text-sm shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                                    >
                                        <Download size={16} />
                                        <span>Download High-Res Certificate (PNG)</span>
                                    </button>
                                </div>

                                {/* WhatsApp 2026 Wrapped Card Preview (1 col) */}
                                <div className="space-y-2">
                                    <div className="rounded-xl overflow-hidden border-2 border-antique-gold/40 bg-[#070e1c] shadow-xl max-w-[220px] mx-auto">
                                        {wrappedDataUrl ? (
                                            <img
                                                src={wrappedDataUrl}
                                                alt="2026 WhatsApp Wrapped Card"
                                                className="w-full h-auto block"
                                            />
                                        ) : (
                                            <div className="h-56 flex items-center justify-center text-xs text-gray-400">
                                                Rendering Wrapped Card...
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!wrappedDataUrl || renderingCert}
                                        onClick={() =>
                                            handleDownloadImage(
                                                wrappedDataUrl,
                                                `UCE89_2026_${finalePlayer.displayName.replace(/\s+/g, '_')}_WhatsApp_Wrapped.png`
                                            )
                                        }
                                        className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-serif font-bold text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                    >
                                        <Download size={15} />
                                        <span>Download WhatsApp Wrapped</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* =====================================================================
                    SUBCATEGORY 3: STATS, STANDINGS & 40-WEEK JOURNEY
                   ===================================================================== */}
                {activeSubTab === 'stats' && (
                    <div className="pt-2 space-y-6">
                        {/* Club / Quiz Stats Section */}
                        <div>
                            <h2 className="text-xs font-serif text-antique-gold uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Trophy size={14} />
                                <span>Club Quiz Standing</span>
                            </h2>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                <div className="bg-black/30 border border-antique-gold/20 rounded-xl p-4 text-center">
                                    <span className="text-[11px] font-sans text-gray-400 uppercase tracking-wider block mb-1">
                                        Total Points
                                    </span>
                                    <span className="text-2xl sm:text-3xl font-serif font-black text-amber-300 drop-shadow">
                                        {user?.cumulative_score !== undefined ? user.cumulative_score : 0}
                                    </span>
                                    <span className="text-[10px] text-gray-400 block mt-0.5 font-sans">Points Earned</span>
                                </div>

                                <div className="bg-black/30 border border-antique-gold/20 rounded-xl p-4 text-center">
                                    <span className="text-[11px] font-sans text-gray-400 uppercase tracking-wider block mb-1">
                                        Challenges Played
                                    </span>
                                    <span className="text-2xl sm:text-3xl font-serif font-black text-white">
                                        {user?.weeks_played !== undefined ? user.weeks_played : 1}
                                    </span>
                                    <span className="text-[10px] text-gray-400 block mt-0.5 font-sans">Active Weeks</span>
                                </div>

                                <div className="bg-black/30 border border-antique-gold/20 rounded-xl p-4 text-center col-span-2 sm:col-span-1">
                                    <span className="text-[11px] font-sans text-gray-400 uppercase tracking-wider block mb-1">
                                        Standing Rank
                                    </span>
                                    <span className="text-2xl sm:text-3xl font-serif font-black text-antique-gold">
                                        {user?.rank || '#--'}
                                    </span>
                                    <span className="text-[10px] text-gray-400 block mt-0.5 font-sans">Leaderboard</span>
                                </div>
                            </div>
                        </div>

                        {/* Finale Pure Stats Grid */}
                        {finaleUnlocked && finalePlayer && (
                            <div className="space-y-4">
                                <p className="text-xs font-serif text-antique-gold uppercase tracking-wider flex items-center gap-1.5">
                                    <Medal size={14} />
                                    <span>2026 Marathon Pure Performance</span>
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-gradient-to-br from-amber-950/60 to-black/50 border border-antique-gold/30 rounded-xl p-3 text-center">
                                        <span className="text-[10px] text-amber-200/70 uppercase tracking-wider block">Pure Rank</span>
                                        <span className="text-xl sm:text-2xl font-serif font-black text-amber-300">
                                            {finalePlayer.pureRank ? `#${finalePlayer.pureRank}` : 'Member'}
                                        </span>
                                        <span className="text-[10px] text-gray-400 block">{finalePlayer.persona}</span>
                                    </div>
                                    <div className="bg-black/40 border border-antique-gold/25 rounded-xl p-3 text-center">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Pure Score</span>
                                        <span className="text-xl sm:text-2xl font-serif font-black text-white">
                                            {finalePlayer.pureScore}
                                        </span>
                                        <span className="text-[10px] text-amber-300/80 block">
                                            Avg {finalePlayer.avgScore}/10 • {finalePlayer.weeksPlayed}/40 Wks
                                        </span>
                                    </div>
                                    <div className="bg-black/40 border border-antique-gold/25 rounded-xl p-3 text-center">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Perfect 10/10s</span>
                                        <span className="text-xl sm:text-2xl font-serif font-black text-emerald-400">
                                            {finalePlayer.count10}
                                        </span>
                                        <span className="text-[10px] text-gray-400 block">
                                            {finalePlayer.count9Plus} scores of 9+
                                        </span>
                                    </div>
                                    <div className="bg-black/40 border border-antique-gold/25 rounded-xl p-3 text-center">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Speed &amp; Podiums</span>
                                        <span className="text-xl sm:text-2xl font-serif font-black text-sky-300">
                                            {finalePlayer.avgTime ? `${finalePlayer.avgTime}s` : '--'}
                                        </span>
                                        <span className="text-[10px] text-amber-300/80 block">
                                            🥇{finalePlayer.gold} • 🏆{finalePlayer.podiums} Podiums
                                        </span>
                                    </div>
                                </div>

                                {/* 40-Week Score Trajectory Chart */}
                                {finalePlayer.weeklyJourney && (
                                    <div className="p-4 rounded-xl bg-black/30 border border-antique-gold/20">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-serif text-antique-gold uppercase tracking-wider flex items-center gap-1.5">
                                                <BarChart3 size={14} />
                                                <span>40-Week Quiz Trajectory (Q1 – Q40)</span>
                                            </span>
                                            <span className="text-[11px] font-mono text-gray-400">
                                                🟢 10/10 • 🔵 8–9/10 • 🟠 &lt;8
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-10 sm:grid-cols-20 gap-1.5 pt-2">
                                            {finalePlayer.weeklyJourney.map((w) => {
                                                const played = w.played && !w.isBonus;
                                                const score = played ? w.score : 0;
                                                const barColor = !played
                                                    ? 'bg-gray-800/60 border-gray-700/40'
                                                    : score === 10
                                                    ? 'bg-emerald-500 border-emerald-300'
                                                    : score >= 8
                                                    ? 'bg-sky-500 border-sky-300'
                                                    : 'bg-amber-500 border-amber-300';
                                                return (
                                                    <div
                                                        key={w.quizNum}
                                                        title={
                                                            played
                                                                ? `Quiz ${w.quizNum} (${w.weekId}): ${w.score}/10 in ${w.time}s (Rank #${w.rank})`
                                                                : `Quiz ${w.quizNum} (${w.weekId}): Did not play`
                                                        }
                                                        className="flex flex-col items-center gap-1 group"
                                                    >
                                                        <div className="w-full h-14 bg-black/40 rounded flex items-end p-0.5 border border-white/5">
                                                            <div
                                                                style={{ height: played ? `${Math.max(score * 10, 15)}%` : '10%' }}
                                                                className={`w-full rounded-sm border-t ${barColor} transition-all`}
                                                            />
                                                        </div>
                                                        <span className="text-[9px] font-mono text-gray-400">
                                                            Q{w.quizNum}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Recent Quiz Submissions History */}
                        {user?.submissions_history && user.submissions_history.length > 0 ? (
                            <div className="pt-4 border-t border-antique-gold/15">
                                <p className="text-[11px] font-serif text-amber-200/80 uppercase tracking-wider mb-2.5">
                                    Recent Weekly Challenges
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {user.submissions_history.slice(0, 6).map((sub) => (
                                        <div
                                            key={sub.week_id}
                                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/40 border border-antique-gold/20 text-xs"
                                        >
                                            <span className="font-mono text-amber-100">{sub.week_id}</span>
                                            <span className="font-serif font-bold text-antique-gold">
                                                {sub.score} pts · {sub.time_taken}s
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="mt-3 text-xs text-amber-200/60 font-sans italic text-center">
                                Complete your first weekly quiz challenge to unlock your live leaderboard rank &amp; score history.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Quick Navigation & Action Footer */}
            {finaleUnlocked && (
                <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-midnight-blue/90 via-black/80 to-midnight-blue/90 border border-antique-gold/40 shadow-xl flex flex-wrap items-center justify-between gap-3 text-left">
                    <div>
                        <h4 className="text-sm font-serif font-bold text-amber-200">
                            Explore More of the 2026 Season Finale
                        </h4>
                        <p className="text-xs text-gray-400 font-sans mt-0.5">
                            Relive the 40-week journey with your alumni friends in the interactive Club Rewind.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                playSound('click');
                                navigate('/rewind?tab=highlights');
                            }}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-[#0b1528] font-serif font-black text-xs shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <Sparkles size={14} />
                            <span>Watch Club Rewind</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Auth Session Transparency Badge */}
            <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-antique-gold/60 py-2">
                <ShieldCheck size={14} />
                <span>Protected with 15m Access Token & 15d Refresh Token</span>
            </div>

            {/* Personalized 2026 Wrapped Story Modal */}
            <PersonalStoryModal
                isOpen={showStoryModal}
                onClose={() => setShowStoryModal(false)}
                player={finalePlayer}
                photo={currentPhoto}
                onDownloadCert={handleDownloadCert}
                onDownloadStory={handleDownloadWrapped}
                certDataUrl={certDataUrl}
                wrappedDataUrl={wrappedDataUrl}
                isAdmin={isAdmin}
                onSelectMember={setSelectedMemberNorm}
                onPrevMember={handlePrevMember}
                onNextMember={handleNextMember}
            />

            {/* Admin Scroll-Locked Member Picker Modal */}
            {isAdmin && (
                <AdminMemberPickerModal
                    isOpen={showMemberPickerModal}
                    onClose={() => setShowMemberPickerModal(false)}
                    selectedNorm={finalePlayer?.normPhone}
                    onSelect={(normPhone) => setSelectedMemberNorm(normPhone)}
                />
            )}
        </motion.div>
    );
}
