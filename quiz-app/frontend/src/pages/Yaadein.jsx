import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Camera, Upload, Heart, Share2, Download, CheckCircle2, Clock,
    Trash2, X, ChevronLeft, ChevronRight, Sparkles, ShieldCheck,
    Edit3, Check, Image as ImageIcon, Zap, Film, Play, AlertTriangle
} from 'lucide-react';
import { YAADEIN_SEED_ITEMS } from '../data/yaadeinSeedData';
import {
    getMemories,
    uploadMemory,
    moderateMemory,
    deleteMemory,
    likeMemory,
} from '../services/api';
import {
    compressImageFile,
    processVideoFile,
    formatBytes,
    formatDuration,
    MAX_VIDEO_UPLOAD_BYTES,
} from '../utils/imageCompressor';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useSoundManager } from '../hooks/useSoundManager';
import { isFinaleAdmin, isFinaleUnlocked, normalizePhone } from '../utils/featureFlags';

const LIKED_STORAGE_KEY = 'yaadein_liked_ids_v2';
const SEED_OVERRIDES_STORAGE_KEY = 'yaadein_seed_overrides_v2';

export default function Yaadein() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { config, isLoading: configLoading } = useConfig();
    const { playSound, stopSound } = useSoundManager();
    const [searchParams, setSearchParams] = useSearchParams();

    const userPhone = user?.phone || user?.user_id || localStorage.getItem('user_id') || '';
    const normUserPhone = normalizePhone(userPhone);
    const isAdmin = isFinaleAdmin(user) || localStorage.getItem('admin_auth') === 'true';
    const finaleUnlocked = isFinaleUnlocked(user, config);

    // Dynamic memories from Firestore / Backend + Local fallback
    const [dynamicItems, setDynamicItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mediaFilter, setMediaFilter] = useState('all'); // 'all' | 'photo' | 'video'
    const [adminFilter, setAdminFilter] = useState('all'); // 'all' | 'pending'

    // Local likes & seed caption/like overrides
    const [likedIds, setLikedIds] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(LIKED_STORAGE_KEY) || '[]');
        } catch {
            return [];
        }
    });
    const [seedOverrides, setSeedOverrides] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(SEED_OVERRIDES_STORAGE_KEY) || '{}');
        } catch {
            return {};
        }
    });

    // Upload modal state
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [selectedFilePreview, setSelectedFilePreview] = useState(null);
    const [compressionStats, setCompressionStats] = useState(null);
    const [isCompressing, setIsCompressing] = useState(false);
    const [captionInput, setCaptionInput] = useState('');
    const [uploaderNameInput, setUploaderNameInput] = useState(user?.name || '');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [uploadBanner, setUploadBanner] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef(null);

    // Lightbox state (index into visibleMemories) + Progressive Blur-Up + Admin Lightbox Tag Editor
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [isHighResLoaded, setIsHighResLoaded] = useState(false);
    const [isLightboxEditing, setIsLightboxEditing] = useState(false);
    const [lightboxCaptionDraft, setLightboxCaptionDraft] = useState('');

    useEffect(() => {
        if (user?.name && !uploaderNameInput) {
            setUploaderNameInput(user.name);
        }
    }, [user?.name, uploaderNameInput]);

    // Auto-open upload modal if URL has ?upload=true
    useEffect(() => {
        if (searchParams.get('upload') === 'true') {
            setIsUploadOpen(true);
            searchParams.delete('upload');
            setSearchParams(searchParams, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    // Fetch dynamic memories on mount
    useEffect(() => {
        let cancelled = false;
        async function fetchAll() {
            setLoading(true);
            try {
                const res = await getMemories({ userPhone, isAdmin });
                if (!cancelled) {
                    setDynamicItems(res.items || []);
                    if (res.seed_overrides && Object.keys(res.seed_overrides).length > 0) {
                        setSeedOverrides((prev) => {
                            const merged = { ...prev };
                            for (const [seedId, srvData] of Object.entries(res.seed_overrides)) {
                                merged[seedId] = {
                                    ...(prev[seedId] || {}),
                                    ...srvData,
                                };
                            }
                            localStorage.setItem(SEED_OVERRIDES_STORAGE_KEY, JSON.stringify(merged));
                            return merged;
                        });
                    }
                }
            } catch (err) {
                console.error('[Yaadein] Failed to load memories:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchAll();
        return () => {
            cancelled = true;
        };
    }, [userPhone, isAdmin]);

    // Merge dynamic uploaded memories + curated seed memories
    const allMemories = useMemo(() => {
        const mergedSeeds = YAADEIN_SEED_ITEMS.map((seed) => {
            const override = seedOverrides[seed.id] || {};
            const resolvedLikes =
                override.likes !== undefined
                    ? Math.max(0, Number(override.likes) || 0)
                    : Math.max(0, (seed.likes || 0) + (override.extraLikes || 0));
            return {
                ...seed,
                media_type: seed.media_type || 'photo',
                caption: override.caption !== undefined ? override.caption : seed.caption,
                likes: resolvedLikes,
                hidden: !!override.hidden,
            };
        }).filter((s) => !s.hidden);

        return [...dynamicItems, ...mergedSeeds];
    }, [dynamicItems, seedOverrides]);

    const photoCount = useMemo(
        () => allMemories.filter((m) => (m.media_type || 'photo') !== 'video').length,
        [allMemories]
    );

    const videoCount = useMemo(
        () => allMemories.filter((m) => m.media_type === 'video').length,
        [allMemories]
    );

    const pendingCount = useMemo(
        () => allMemories.filter((m) => m.status === 'pending').length,
        [allMemories]
    );

    const visibleMemories = useMemo(() => {
        let list = allMemories;
        if (isAdmin && adminFilter === 'pending') {
            list = list.filter((m) => m.status === 'pending');
        }
        if (mediaFilter === 'photo') {
            list = list.filter((m) => (m.media_type || 'photo') !== 'video');
        } else if (mediaFilter === 'video') {
            list = list.filter((m) => m.media_type === 'video');
        }
        return list;
    }, [allMemories, isAdmin, adminFilter, mediaFilter]);

    const activeLightboxItem =
        lightboxIndex !== null && visibleMemories[lightboxIndex]
            ? visibleMemories[lightboxIndex]
            : null;

    // Reset Lightbox edit & progressive high-res state when switching items, and pause BGM during video playback
    useEffect(() => {
        setIsLightboxEditing(false);
        setIsHighResLoaded(false);
        if (activeLightboxItem) {
            setLightboxCaptionDraft(activeLightboxItem.caption || '');
            if (activeLightboxItem.media_type === 'video') {
                stopSound?.('bgm');
            }
        }
    }, [lightboxIndex, activeLightboxItem?.id, activeLightboxItem?.media_type, stopSound]);

    // Keyboard navigation for Lightbox (disabled while typing in caption input)
    useEffect(() => {
        if (lightboxIndex === null) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e) => {
            if (isLightboxEditing) {
                if (e.key === 'Escape') setIsLightboxEditing(false);
                return;
            }
            if (e.key === 'Escape') {
                setLightboxIndex(null);
            } else if (e.key === 'ArrowRight') {
                setLightboxIndex((prev) =>
                    prev === null ? null : (prev + 1) % visibleMemories.length
                );
            } else if (e.key === 'ArrowLeft') {
                setLightboxIndex((prev) =>
                    prev === null
                        ? null
                        : (prev - 1 + visibleMemories.length) % visibleMemories.length
                );
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [lightboxIndex, visibleMemories.length, isLightboxEditing]);

    const handleFileChosen = async (file) => {
        if (!file) return;
        setUploadError('');
        setIsCompressing(true);
        try {
            if (file.type?.startsWith('video/')) {
                const result = await processVideoFile(file, {
                    thumbDimension: 640,
                });
                setSelectedFilePreview(result.thumbDataUrl);
                setCompressionStats(result);
            } else {
                const result = await compressImageFile(file, {
                    maxMasterDimension: 1920,
                    thumbDimension: 640,
                });
                setSelectedFilePreview(result.thumbDataUrl || result.dataUrl);
                setCompressionStats(result);
            }
        } catch (err) {
            setSelectedFilePreview(null);
            setCompressionStats(null);
            setUploadError(
                err.message || 'Could not process media file. Please try another photo or video.'
            );
        } finally {
            setIsCompressing(false);
        }
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!compressionStats?.dataUrl) {
            setUploadError('Please select a photo or video first.');
            return;
        }
        playSound('click');
        setIsUploading(true);
        setUploadError('');

        const isVideo = compressionStats.mediaType === 'video';

        try {
            const res = await uploadMemory({
                mediaType: isVideo ? 'video' : 'photo',
                caption:
                    captionInput.trim() ||
                    (isVideo
                        ? 'Shared a cherished video memory with the batch'
                        : 'Shared a cherished memory with the batch'),
                imageDataUrl: isVideo ? '' : compressionStats.dataUrl,
                videoDataUrl: isVideo ? compressionStats.dataUrl : undefined,
                thumbDataUrl: compressionStats.thumbDataUrl,
                uploaderName: (uploaderNameInput || user?.name || 'Club Member').trim(),
                uploaderPhone: normUserPhone || userPhone,
                width: compressionStats?.width,
                height: compressionStats?.height,
                sizeBytes: compressionStats?.compressedSizeBytes,
                durationSeconds: compressionStats?.durationSeconds,
                isAdmin,
            });

            if (res?.memory) {
                setDynamicItems((prev) => [res.memory, ...prev]);
            }

            setUploadBanner(
                isAdmin
                    ? `✨ Your ${isVideo ? 'video' : 'photo'} is now live in the Yaadein album!`
                    : `🎉 Thank you! Your ${isVideo ? 'video' : 'photo'} has been submitted and will appear publicly once approved by the Admin.`
            );
            setSelectedFilePreview(null);
            setCompressionStats(null);
            setCaptionInput('');
            setIsUploadOpen(false);
            setTimeout(() => setUploadBanner(''), 8000);
        } catch (err) {
            setUploadError(
                err.response?.data?.detail ||
                    err.message ||
                    'Failed to upload media. Please try again.'
            );
        } finally {
            setIsUploading(false);
        }
    };

    const handleToggleLike = async (item, e) => {
        e?.stopPropagation();
        playSound('click');
        const alreadyLiked = likedIds.includes(item.id);
        const delta = alreadyLiked ? -1 : 1;

        const nextLiked = alreadyLiked
            ? likedIds.filter((id) => id !== item.id)
            : [...likedIds, item.id];
        setLikedIds(nextLiked);
        localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(nextLiked));

        const optimisticLikes = Math.max(0, (item.likes || 0) + delta);

        if (item.is_seed) {
            const current = seedOverrides[item.id] || {};
            const nextOverrides = {
                ...seedOverrides,
                [item.id]: {
                    ...current,
                    likes: optimisticLikes,
                },
            };
            setSeedOverrides(nextOverrides);
            localStorage.setItem(SEED_OVERRIDES_STORAGE_KEY, JSON.stringify(nextOverrides));
        } else {
            setDynamicItems((prev) =>
                prev.map((m) => (m.id === item.id ? { ...m, likes: optimisticLikes } : m))
            );
        }

        try {
            const res = await likeMemory(item.id, { unlike: alreadyLiked });
            if (typeof res?.likes === 'number') {
                if (item.is_seed) {
                    setSeedOverrides((prev) => {
                        const updated = {
                            ...prev,
                            [item.id]: { ...(prev[item.id] || {}), likes: res.likes },
                        };
                        localStorage.setItem(SEED_OVERRIDES_STORAGE_KEY, JSON.stringify(updated));
                        return updated;
                    });
                } else {
                    setDynamicItems((prev) =>
                        prev.map((m) => (m.id === item.id ? { ...m, likes: res.likes } : m))
                    );
                }
            }
        } catch {
            // optimistic update already applied
        }
    };

    const handleAdminApprove = async (item, e) => {
        e?.stopPropagation();
        if (!isAdmin) return;
        playSound('fanfare');
        try {
            const res = await moderateMemory(item.id, { status: 'approved' }, normUserPhone);
            setDynamicItems((prev) =>
                prev.map((m) =>
                    m.id === item.id ? res?.memory || { ...m, status: 'approved' } : m
                )
            );
        } catch (err) {
            console.error('Failed to approve memory:', err);
        }
    };

    const handleDeleteItem = async (item, e) => {
        e?.stopPropagation();
        if (!isAdmin) return;
        playSound('click');
        if (item.is_seed) {
            const current = seedOverrides[item.id] || {};
            const nextOverrides = {
                ...seedOverrides,
                [item.id]: { ...current, hidden: true },
            };
            setSeedOverrides(nextOverrides);
            localStorage.setItem(SEED_OVERRIDES_STORAGE_KEY, JSON.stringify(nextOverrides));
            setLightboxIndex(null);
            deleteMemory(item.id, normUserPhone).catch(() => {});
            return;
        }
        try {
            await deleteMemory(item.id, normUserPhone);
            setDynamicItems((prev) => prev.filter((m) => m.id !== item.id));
            setLightboxIndex(null);
        } catch (err) {
            console.error('Failed to delete memory:', err);
        }
    };

    const handleSaveLightboxCaption = async (item, e) => {
        e?.stopPropagation();
        if (!isAdmin || !item) return;
        playSound('click');
        const trimmed = lightboxCaptionDraft.trim();
        if (item.is_seed) {
            const current = seedOverrides[item.id] || {};
            const nextOverrides = {
                ...seedOverrides,
                [item.id]: { ...current, caption: trimmed },
            };
            setSeedOverrides(nextOverrides);
            localStorage.setItem(SEED_OVERRIDES_STORAGE_KEY, JSON.stringify(nextOverrides));
            setIsLightboxEditing(false);
            moderateMemory(item.id, { caption: trimmed }, normUserPhone).catch(() => {});
            return;
        }
        try {
            await moderateMemory(item.id, { caption: trimmed }, normUserPhone);
            setDynamicItems((prev) =>
                prev.map((m) => (m.id === item.id ? { ...m, caption: trimmed } : m))
            );
            setIsLightboxEditing(false);
        } catch (err) {
            console.error('Failed to update caption:', err);
        }
    };

    const handleShareWhatsAppInvite = () => {
        playSound('click');
        const url = `${window.location.origin}/yaadein`;
        const text = `📸 *Yaadein (यादें) — UCE ’87 Club Memories Album!*\n\nCome browse our batch photos & videos and upload your favourite memories right from your phone:\n👉 ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleSharePhotoWhatsApp = (item, e) => {
        e?.stopPropagation();
        playSound('click');
        const url = `${window.location.origin}/yaadein`;
        const isVideo = item.media_type === 'video';
        const text = `${isVideo ? '🎬' : '✨'} *Yaadein (यादें)* — "${item.caption || 'Batch Memory'}"\nShared by ${item.uploader_name || 'Club Member'}\n\nView the full album here: ${url}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    const handleDownloadMedia = (item, e) => {
        e?.stopPropagation();
        playSound('click');
        const isVideo = item.media_type === 'video';
        const link = document.createElement('a');
        link.href = isVideo
            ? item.video_url || item.high_res_url
            : item.high_res_url || item.image_url;
        link.download = `${item.id || 'yaadein-memory'}.${isVideo ? 'mp4' : 'jpg'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!configLoading && !finaleUnlocked) {
        return (
            <div className="w-full max-w-2xl mx-auto py-16 px-4 text-center">
                <div className="card-vintage p-8 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-3xl mx-auto">
                        🔒
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-white">
                        Yaadein • यादें Preview
                    </h2>
                    <p className="text-sm text-gray-300 font-sans max-w-md mx-auto leading-relaxed">
                        The Yaadein Batch Memories Album, Finale Showcase &amp; Certificates are currently in private preview for club testers. The grand reveal will unlock for all members shortly!
                    </p>
                    <div className="pt-2">
                        <button
                            onClick={() => navigate('/welcome')}
                            className="btn-vintage px-6 py-2 text-sm cursor-pointer"
                        >
                            Back to Lounge
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full max-w-6xl mx-auto px-3 sm:px-6 pt-16 sm:pt-12 pb-24 text-left z-10">
            {/* Hero Header */}
            <motion.div
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-6"
            >
                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-500/15 border border-antique-gold/50 text-amber-300 font-serif text-xs uppercase tracking-[0.25em] mb-3 shadow-md">
                    <Sparkles size={13} />
                    <span>
                        Golden Nostalgia Archive • {photoCount} Photos • {videoCount} Videos
                    </span>
                    <Sparkles size={13} />
                </div>

                <h1
                    className="text-4xl sm:text-6xl font-serif font-bold text-white tracking-wide mb-2"
                    style={{ textShadow: '2px 2px 6px rgba(0,0,0,0.85)' }}
                >
                    Yaadein <span className="text-antique-gold font-normal">• यादें</span>
                </h1>

                <p className="text-sm sm:text-base text-gray-200 font-sans max-w-xl mx-auto leading-relaxed">
                    Moments of brotherhood, grand celebrations, and cherished memories of our batch.
                    Got a favourite photo or video clip on your phone or laptop? Add it to the wall!
                </p>

                {/* Primary CTA Bar */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            playSound('click');
                            setIsUploadOpen(true);
                        }}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 hover:from-amber-200 hover:to-yellow-300 text-[#0b1528] font-serif font-black text-sm sm:text-base shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <Camera size={18} />
                        <span>📸🎬 Share a Memory (Upload Photo / Video)</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleShareWhatsAppInvite}
                        className="px-4 py-3 rounded-xl bg-[#0a1428]/90 hover:bg-[#132546] text-amber-200 border border-antique-gold/50 font-serif font-bold text-xs sm:text-sm shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <Share2 size={15} className="text-emerald-400" />
                        <span>📲 Invite Friends on WhatsApp</span>
                    </button>
                </div>

                {/* Hybrid Filter Pills: All | Photos | Videos (Cinema Table) */}
                <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-[#091326]/90 border border-antique-gold/40 shadow-xl">
                    <button
                        type="button"
                        onClick={() => {
                            playSound('click');
                            setMediaFilter('all');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-serif font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            mediaFilter === 'all'
                                ? 'bg-gradient-to-r from-amber-300 to-yellow-500 text-[#0b1528] shadow-md'
                                : 'text-amber-100/80 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <Sparkles size={14} />
                        <span>All Memories ({allMemories.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            playSound('click');
                            setMediaFilter('photo');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-serif font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            mediaFilter === 'photo'
                                ? 'bg-gradient-to-r from-amber-300 to-yellow-500 text-[#0b1528] shadow-md'
                                : 'text-amber-100/80 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <Camera size={14} />
                        <span>📸 Photos ({photoCount})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            playSound('click');
                            setMediaFilter('video');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-serif font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            mediaFilter === 'video'
                                ? 'bg-gradient-to-r from-amber-300 to-yellow-500 text-[#0b1528] shadow-md'
                                : 'text-amber-100/80 hover:text-white hover:bg-white/10'
                        }`}
                    >
                        <Film size={14} />
                        <span>🎬 Videos ({videoCount})</span>
                    </button>
                </div>
            </motion.div>

            {/* Upload Success Toast Banner */}
            <AnimatePresence>
                {uploadBanner && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-6 p-4 rounded-xl bg-emerald-950/90 border-2 border-emerald-400/60 text-emerald-100 flex items-center justify-between gap-3 shadow-2xl"
                    >
                        <div className="flex items-center gap-2.5 text-xs sm:text-sm font-sans">
                            <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" />
                            <span>{uploadBanner}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setUploadBanner('')}
                            className="text-emerald-300 hover:text-white"
                        >
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Admin Moderation Bar (Visible ONLY to Admin) */}
            {isAdmin && (
                <div className="mb-6 p-3.5 rounded-xl bg-[#0a1428]/90 border border-antique-gold/50 flex flex-wrap items-center justify-between gap-3 shadow-xl">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-amber-200 font-serif">
                        <ShieldCheck size={18} className="text-amber-400" />
                        <span>
                            <strong>Admin Controls:</strong> Tap any photo or video to enlarge and edit its tag/caption or remove it.
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setAdminFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all cursor-pointer ${
                                adminFilter === 'all'
                                    ? 'bg-antique-gold text-[#0b1528]'
                                    : 'bg-white/10 text-amber-200 hover:bg-white/20'
                            }`}
                        >
                            All ({allMemories.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setAdminFilter('pending')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-serif font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                adminFilter === 'pending'
                                    ? 'bg-amber-400 text-[#0b1528]'
                                    : pendingCount > 0
                                    ? 'bg-amber-500/25 text-amber-200 border border-amber-400/60 animate-pulse'
                                    : 'bg-white/10 text-gray-300'
                            }`}
                        >
                            <Clock size={13} />
                            <span>Pending Approval ({pendingCount})</span>
                        </button>
                    </div>
                </div>
            )}

            {/* =========================================================
                HYBRID VIEW:
                1. When mediaFilter === 'video' -> Dedicated Cinema / Video Table View
                2. When mediaFilter === 'all' or 'photo' -> Masonry Grid (with Play overlay for videos)
               ========================================================= */}
            {loading && visibleMemories.length === 0 ? (
                <div className="text-center py-16 text-amber-200/80 font-serif animate-pulse">
                    Opening the Yaadein Album...
                </div>
            ) : visibleMemories.length === 0 ? (
                <div className="card-vintage max-w-lg mx-auto text-center py-10 px-6">
                    {mediaFilter === 'video' ? (
                        <>
                            <Film size={40} className="text-antique-gold mx-auto mb-3 opacity-90" />
                            <p className="text-xl font-serif font-bold text-white mb-1">
                                No Video Memories Uploaded Yet
                            </p>
                            <p className="text-xs sm:text-sm text-gray-300 font-sans mb-5">
                                Have a reunion clip, campus throwback, or celebration video on your phone?
                                Share the first video memory with the batch!
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    playSound('click');
                                    setIsUploadOpen(true);
                                }}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 text-[#0b1528] font-serif font-black text-xs sm:text-sm shadow-xl inline-flex items-center gap-2 cursor-pointer"
                            >
                                <Film size={16} />
                                <span>+ Upload First Video Memory</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <ImageIcon size={36} className="text-antique-gold mx-auto mb-3 opacity-80" />
                            <p className="text-lg font-serif text-white mb-1">No Matching Memories</p>
                            <p className="text-xs text-gray-300 font-sans">
                                All member-submitted items in this view have been reviewed!
                            </p>
                        </>
                    )}
                </div>
            ) : mediaFilter === 'video' ? (
                /* =========================================================
                   DEDICATED CINEMA / VIDEO TABLE DIRECTORY VIEW
                   ========================================================= */
                <div className="rounded-2xl overflow-hidden bg-gradient-to-b from-[#132546]/95 to-[#091224]/95 border-2 border-antique-gold/60 shadow-2xl">
                    <div className="px-5 py-3.5 bg-black/45 border-b border-antique-gold/30 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-amber-200 font-serif text-sm sm:text-base font-bold">
                            <Film size={18} className="text-antique-gold" />
                            <span>Yaadein Video Theatre ({visibleMemories.length})</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                playSound('click');
                                setIsUploadOpen(true);
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-antique-gold/50 text-amber-200 text-xs font-serif font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                            <Upload size={13} />
                            <span>+ Upload Video</span>
                        </button>
                    </div>

                    {/* Desktop Table Header */}
                    <div className="hidden md:grid md:grid-cols-12 gap-4 px-5 py-2.5 bg-black/25 border-b border-antique-gold/20 text-[11px] font-mono uppercase tracking-wider text-amber-300/80">
                        <div className="col-span-3">Preview</div>
                        <div className="col-span-5">Video Memory &amp; Tag</div>
                        <div className="col-span-2">Shared By</div>
                        <div className="col-span-2 text-right">Actions</div>
                    </div>

                    <div className="divide-y divide-antique-gold/20">
                        {visibleMemories.map((item, idx) => {
                            const isPending = item.status === 'pending';
                            const isLiked = likedIds.includes(item.id);

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => setLightboxIndex(idx)}
                                    className="p-4 sm:px-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center hover:bg-white/[0.04] transition-colors cursor-pointer group"
                                >
                                    {/* Thumbnail + Play Overlay */}
                                    <div className="md:col-span-3 relative rounded-xl overflow-hidden bg-[#060c18] border border-antique-gold/40 aspect-video flex items-center justify-center">
                                        <img
                                            src={item.image_url}
                                            alt={item.caption || 'Video Memory'}
                                            loading="lazy"
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 bg-black/35 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                            <div className="w-11 h-11 rounded-full bg-amber-400/95 text-[#0b1528] flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.7)] group-hover:scale-110 transition-transform">
                                                <Play size={20} className="fill-[#0b1528] ml-0.5" />
                                            </div>
                                        </div>
                                        {item.duration_seconds > 0 && (
                                            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/85 border border-antique-gold/40 text-[11px] font-mono text-amber-200">
                                                {formatDuration(item.duration_seconds)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Caption & Metadata */}
                                    <div className="md:col-span-5 space-y-1.5">
                                        {isPending && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] font-mono uppercase text-amber-300">
                                                <Clock size={11} />
                                                <span>Pending Approval</span>
                                            </span>
                                        )}
                                        <p className="font-serif text-base text-white font-semibold leading-snug">
                                            {item.caption || 'Batch Video Memory'}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-gray-300/80">
                                            <span className="text-amber-300/90">🎬 Video</span>
                                            {item.duration_seconds > 0 && (
                                                <span>• {formatDuration(item.duration_seconds)}</span>
                                            )}
                                            {item.size_bytes > 0 && (
                                                <span>• {formatBytes(item.size_bytes)}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Shared By */}
                                    <div className="md:col-span-2 text-xs text-antique-gold font-sans">
                                        📸 {item.uploader_name || 'Club Member'}
                                    </div>

                                    {/* Actions */}
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="md:col-span-2 flex flex-wrap items-center md:justify-end gap-1.5"
                                    >
                                        {isPending && isAdmin && (
                                            <button
                                                type="button"
                                                onClick={(e) => handleAdminApprove(item, e)}
                                                className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-[#071318] font-sans font-bold text-[11px] flex items-center gap-1 shadow cursor-pointer"
                                            >
                                                <Check size={12} strokeWidth={3} />
                                                <span>Approve</span>
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => setLightboxIndex(idx)}
                                            className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#0b1528] font-serif font-bold text-xs flex items-center gap-1 shadow cursor-pointer"
                                        >
                                            <Play size={12} className="fill-[#0b1528]" />
                                            <span>Play</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={(e) => handleToggleLike(item, e)}
                                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-sans font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                                isLiked
                                                    ? 'bg-rose-600/30 border-rose-400 text-rose-200'
                                                    : 'bg-white/5 hover:bg-rose-500/20 border-antique-gold/30 text-amber-100'
                                            }`}
                                        >
                                            <Heart
                                                size={12}
                                                className={
                                                    isLiked
                                                        ? 'fill-rose-400 text-rose-400'
                                                        : 'text-rose-300'
                                                }
                                            />
                                            <span>{item.likes || 0}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={(e) => handleSharePhotoWhatsApp(item, e)}
                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-600/30 border border-antique-gold/30 text-emerald-300 cursor-pointer"
                                            title="Share on WhatsApp"
                                        >
                                            <Share2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* =========================================================
                   MASONRY VINTAGE ALBUM GRID (PHOTOS + INLINE VIDEOS)
                   ========================================================= */
                <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
                    {visibleMemories.map((item, idx) => {
                        const isPending = item.status === 'pending';
                        const isLiked = likedIds.includes(item.id);
                        const isVideo = item.media_type === 'video';

                        return (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, delay: Math.min(idx * 0.03, 0.35) }}
                                onClick={() => setLightboxIndex(idx)}
                                className={`break-inside-avoid rounded-2xl overflow-hidden bg-gradient-to-b from-[#132546]/95 to-[#091224]/95 border-2 ${
                                    isPending
                                        ? 'border-amber-400/80 shadow-[0_0_25px_rgba(251,191,36,0.2)]'
                                        : 'border-antique-gold/50 hover:border-antique-gold'
                                } shadow-2xl transition-all duration-300 group cursor-pointer flex flex-col`}
                            >
                                {/* Top Pending Status Bar (if pending) */}
                                {isPending && (
                                    <div className="px-3.5 py-2 bg-amber-500/20 border-b border-amber-400/40 flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300">
                                            <Clock size={12} />
                                            <span>
                                                {isAdmin
                                                    ? 'Needs Admin Approval'
                                                    : 'Pending Admin Approval (Visible to You)'}
                                            </span>
                                        </span>

                                        {isAdmin && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleAdminApprove(item, e)}
                                                    className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-[#071318] font-sans font-bold text-[11px] flex items-center gap-1 shadow cursor-pointer"
                                                    title="Approve and publish to all members"
                                                >
                                                    <Check size={12} strokeWidth={3} />
                                                    <span>Approve</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDeleteItem(item, e)}
                                                    className="p-1 rounded-md bg-red-900/70 hover:bg-red-700 text-red-100 cursor-pointer"
                                                    title="Reject / Delete"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Framed Media Container */}
                                <div className="relative p-2.5 pb-0">
                                    <div className="relative rounded-xl overflow-hidden bg-[#060c18] border border-antique-gold/30">
                                        <img
                                            src={item.image_url}
                                            alt={item.caption || 'Yaadein Memory'}
                                            loading={idx < 6 ? 'eager' : 'lazy'}
                                            decoding="async"
                                            className="w-full h-auto object-cover block group-hover:scale-[1.02] transition-transform duration-500"
                                        />

                                        {/* Video Play Button & Duration Overlay */}
                                        {isVideo && (
                                            <>
                                                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/15 transition-colors flex items-center justify-center pointer-events-none">
                                                    <div className="w-14 h-14 rounded-full bg-amber-400/95 text-[#0b1528] border-2 border-white/70 flex items-center justify-center shadow-[0_0_25px_rgba(251,191,36,0.8)] group-hover:scale-110 transition-transform">
                                                        <Play size={24} className="fill-[#0b1528] ml-1" />
                                                    </div>
                                                </div>
                                                <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/80 border border-antique-gold/60 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                                                    <Film size={11} />
                                                    <span>Video</span>
                                                </span>
                                                {item.duration_seconds > 0 && (
                                                    <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/85 border border-antique-gold/40 text-[11px] font-mono text-amber-200">
                                                        {formatDuration(item.duration_seconds)}
                                                    </span>
                                                )}
                                            </>
                                        )}

                                        {/* Subtle Hover Overlay */}
                                        {!isVideo && (
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-end p-2.5 pointer-events-none">
                                                <span className="px-2.5 py-1 rounded-full bg-black/75 border border-antique-gold/50 text-[10px] font-serif text-amber-200">
                                                    {isAdmin ? '🔍 Tap to Enlarge & Edit' : '🔍 Tap to Enlarge'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Caption & Metadata Footer */}
                                <div className="p-3.5 pt-3 flex flex-col gap-2.5">
                                    <p className="font-serif text-sm sm:text-[15px] text-amber-50/95 leading-snug">
                                        {item.caption || 'UCE ’87 Club Memory'}
                                    </p>

                                    <div className="flex items-center justify-between pt-2 border-t border-antique-gold/20 text-xs text-gray-300">
                                        <span className="font-sans text-[11px] text-antique-gold/90 truncate max-w-[60%]">
                                            {isVideo ? '🎬' : '📸'} {item.uploader_name || 'Club Member'}
                                        </span>

                                        <div className="flex items-center gap-1.5">
                                            {/* Like / Heart Reaction */}
                                            <button
                                                type="button"
                                                onClick={(e) => handleToggleLike(item, e)}
                                                className={`px-2.5 py-1 rounded-full border text-[11px] font-sans font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                                                    isLiked
                                                        ? 'bg-rose-600/30 border-rose-400 text-rose-200'
                                                        : 'bg-white/5 hover:bg-rose-500/20 border-antique-gold/30 text-amber-100'
                                                }`}
                                                title={isLiked ? 'Click to remove like' : 'Send Love to this Memory'}
                                            >
                                                <Heart
                                                    size={12}
                                                    className={
                                                        isLiked
                                                            ? 'fill-rose-400 text-rose-400'
                                                            : 'text-rose-300'
                                                    }
                                                />
                                                <span>{item.likes || 0}</span>
                                            </button>

                                            {/* WhatsApp Share */}
                                            <button
                                                type="button"
                                                onClick={(e) => handleSharePhotoWhatsApp(item, e)}
                                                className="p-1.5 rounded-full bg-white/5 hover:bg-emerald-600/30 border border-antique-gold/30 text-emerald-300 transition-colors cursor-pointer"
                                                title="Share on WhatsApp"
                                            >
                                                <Share2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Floating Mobile "+ Add Memory" Button */}
            <div className="fixed bottom-16 right-4 sm:bottom-6 sm:left-6 sm:right-auto z-40">
                <button
                    type="button"
                    onClick={() => {
                        playSound('click');
                        setIsUploadOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0b1528] font-serif font-black text-xs sm:text-sm shadow-2xl border-2 border-white/40 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                >
                    <Upload size={15} />
                    <span>+ Add Photo / Video</span>
                </button>
            </div>

            {/* =========================================================
                FRICTIONLESS UPLOAD MODAL (PHOTOS + VIDEOS WITH SIZE WARNING)
               ========================================================= */}
            {typeof document !== 'undefined' &&
                createPortal(
                    <AnimatePresence>
                        {isUploadOpen && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => !isUploading && setIsUploadOpen(false)}
                                className="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
                            >
                                <motion.div
                                    initial={{ scale: 0.92, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.92, opacity: 0, y: 20 }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full max-w-lg rounded-2xl bg-gradient-to-b from-[#132546] to-[#0a1428] border-2 border-antique-gold shadow-2xl overflow-hidden text-left my-auto"
                                >
                                    {/* Modal Header */}
                                    <div className="px-5 py-4 bg-black/40 border-b border-antique-gold/30 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <Camera className="text-antique-gold" size={20} />
                                            <h3 className="text-lg sm:text-xl font-serif font-bold text-white">
                                                Add Photo or Video to Yaadein
                                            </h3>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsUploadOpen(false)}
                                            className="text-gray-400 hover:text-white p-1"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <form onSubmit={handleUploadSubmit} className="p-5 space-y-4">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*,video/mp4,video/webm,video/quicktime,video/*"
                                            onChange={(e) => handleFileChosen(e.target.files?.[0])}
                                            className="hidden"
                                        />

                                        {/* Dropzone / Preview Box */}
                                        {!selectedFilePreview ? (
                                            <div
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    setIsDragging(true);
                                                }}
                                                onDragLeave={() => setIsDragging(false)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setIsDragging(false);
                                                    handleFileChosen(e.dataTransfer.files?.[0]);
                                                }}
                                                onClick={() => fileInputRef.current?.click()}
                                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                                                    isDragging
                                                        ? 'border-amber-300 bg-amber-500/15'
                                                        : 'border-antique-gold/50 hover:border-antique-gold bg-black/30 hover:bg-black/40'
                                                }`}
                                            >
                                                <div className="w-14 h-14 rounded-full bg-amber-400/15 border border-antique-gold/40 flex items-center justify-center mx-auto mb-3 text-antique-gold">
                                                    <Upload size={26} />
                                                </div>
                                                <p className="font-serif font-bold text-base text-white mb-1">
                                                    {isCompressing
                                                        ? 'Preparing Media & Poster Thumbnail...'
                                                        : 'Tap to Select a Photo or Video'}
                                                </p>
                                                <p className="text-xs text-gray-300 font-sans">
                                                    Photos: Auto Full-HD (~400 KB) • Videos: MP4/MOV clips up to{' '}
                                                    {formatBytes(MAX_VIDEO_UPLOAD_BYTES)}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5">
                                                <div className="relative rounded-xl overflow-hidden bg-black/60 border border-antique-gold/50 max-h-64 flex items-center justify-center">
                                                    {compressionStats?.mediaType === 'video' &&
                                                    compressionStats?.previewObjectUrl ? (
                                                        <video
                                                            src={compressionStats.previewObjectUrl}
                                                            poster={selectedFilePreview}
                                                            controls
                                                            playsInline
                                                            className="max-h-60 w-auto object-contain"
                                                        />
                                                    ) : (
                                                        <img
                                                            src={selectedFilePreview}
                                                            alt="Upload Preview"
                                                            className="max-h-60 w-auto object-contain"
                                                        />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedFilePreview(null);
                                                            setCompressionStats(null);
                                                        }}
                                                        className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-black/80 hover:bg-red-900 text-amber-200 border border-antique-gold/50 text-xs font-sans flex items-center gap-1 cursor-pointer z-10"
                                                    >
                                                        <X size={13} />
                                                        <span>Change File</span>
                                                    </button>
                                                </div>

                                                {/* Media Processing Info Bar */}
                                                {compressionStats && (
                                                    <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-200 font-mono">
                                                        <span className="flex items-center gap-1">
                                                            <Zap size={12} className="text-amber-300" />
                                                            <span>
                                                                {compressionStats.mediaType === 'video'
                                                                    ? `🎬 Video (${compressionStats.durationFormatted || 'Clip'}) • ${compressionStats.width}×${compressionStats.height}`
                                                                    : `📸 Full-HD Ready (${compressionStats.width}×${compressionStats.height})`}
                                                            </span>
                                                        </span>
                                                        <span>
                                                            Size: <strong>{formatBytes(compressionStats.compressedSizeBytes)}</strong>
                                                            {' • '}
                                                            Poster: <strong>{formatBytes(compressionStats.thumbSizeBytes)}</strong>
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Large Video Warning Banner (when video is 10 MB – 20 MB) */}
                                                {compressionStats?.isLargeVideoWarning && (
                                                    <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-400/60 text-amber-100 text-xs font-sans flex items-start gap-2">
                                                        <AlertTriangle
                                                            size={16}
                                                            className="text-amber-400 flex-shrink-0 mt-0.5"
                                                        />
                                                        <span>
                                                            <strong>Large Video Warning ({formatBytes(compressionStats.compressedSizeBytes)}):</strong>{' '}
                                                            Uploading a larger video may take 10–25 seconds depending on your mobile/Wi-Fi speed. Please keep this window open until upload finishes.
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Caption Input */}
                                        <div>
                                            <label className="block text-xs font-serif font-bold text-amber-200 uppercase tracking-wider mb-1">
                                                Memory Caption / Tag (Cannot be changed after upload)
                                            </label>
                                            <input
                                                type="text"
                                                value={captionInput}
                                                onChange={(e) => setCaptionInput(e.target.value)}
                                                maxLength={250}
                                                placeholder="e.g., Hostel 4 rooftop gang in 1986, or Grand Celebration dance!"
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-antique-gold/40 focus:border-antique-gold text-sm text-white font-sans focus:outline-none"
                                            />
                                        </div>

                                        {/* Uploader Name */}
                                        <div>
                                            <label className="block text-xs font-serif font-bold text-amber-200 uppercase tracking-wider mb-1">
                                                Shared By (Your Name)
                                            </label>
                                            <input
                                                type="text"
                                                value={uploaderNameInput}
                                                onChange={(e) => setUploaderNameInput(e.target.value)}
                                                maxLength={80}
                                                placeholder="Your Name"
                                                className="w-full px-3.5 py-2 rounded-xl bg-black/50 border border-antique-gold/40 focus:border-antique-gold text-sm text-white font-sans focus:outline-none"
                                            />
                                        </div>

                                        {/* Moderation Notice */}
                                        <div className="p-3 rounded-xl bg-amber-500/10 border border-antique-gold/30 text-xs text-amber-100/90 font-sans flex items-start gap-2">
                                            <ShieldCheck size={16} className="text-antique-gold flex-shrink-0 mt-0.5" />
                                            <span>
                                                {isAdmin
                                                    ? 'Admin Mode: Your uploaded photo or video will be published immediately to the Yaadein album.'
                                                    : 'Uploaded photos and videos go through quick Admin approval before appearing publicly. Once submitted, only the Admin can edit or remove the tag/media.'}
                                            </span>
                                        </div>

                                        {uploadError && (
                                            <div className="p-3 rounded-xl bg-red-950/80 border border-red-400/60 text-xs text-red-200 font-sans flex items-start gap-2">
                                                <AlertTriangle
                                                    size={16}
                                                    className="text-red-400 flex-shrink-0 mt-0.5"
                                                />
                                                <span>{uploadError}</span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-end gap-2.5 pt-2">
                                            <button
                                                type="button"
                                                onClick={() => setIsUploadOpen(false)}
                                                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-200 text-xs sm:text-sm font-serif cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={!selectedFilePreview || isUploading || isCompressing}
                                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 disabled:opacity-40 text-[#0b1528] font-serif font-black text-xs sm:text-sm shadow-xl cursor-pointer flex items-center gap-2"
                                            >
                                                <Upload size={15} />
                                                <span>
                                                    {isUploading
                                                        ? 'Uploading...'
                                                        : isAdmin
                                                        ? 'Publish to Yaadein'
                                                        : 'Submit Memory'}
                                                </span>
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}

            {/* =========================================================
                FULL-SCREEN HIGH-RES LIGHTBOX MODAL (PHOTOS + VIDEO PLAYER + ADMIN TAG EDITOR)
               ========================================================= */}
            {typeof document !== 'undefined' &&
                createPortal(
                    <AnimatePresence>
                        {activeLightboxItem && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setLightboxIndex(null)}
                                className="fixed inset-0 z-[9999] bg-black/92 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto"
                            >
                                {/* Top Controls */}
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-2 mb-3 px-2"
                                >
                                    <span className="text-xs font-mono text-amber-200/80">
                                        {lightboxIndex + 1} / {visibleMemories.length} •{' '}
                                        {activeLightboxItem.media_type === 'video'
                                            ? '🎬 Video Memory'
                                            : '📸 Photo Memory'}
                                    </span>

                                    <div className="flex items-center gap-2">
                                        {/* Admin-Only Edit & Delete Controls inside Enlarged View */}
                                        {isAdmin && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        playSound('click');
                                                        setLightboxCaptionDraft(activeLightboxItem.caption || '');
                                                        setIsLightboxEditing((prev) => !prev);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full border text-xs font-serif flex items-center gap-1.5 cursor-pointer transition-colors ${
                                                        isLightboxEditing
                                                            ? 'bg-amber-400 text-[#0b1528] border-amber-300 font-bold'
                                                            : 'bg-[#0b1528] hover:bg-amber-500/20 text-amber-300 border-antique-gold/60'
                                                    }`}
                                                    title="Edit Tag / Caption (Admin Only)"
                                                >
                                                    <Edit3 size={13} />
                                                    <span>Edit Tag</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDeleteItem(activeLightboxItem, e)}
                                                    className="px-3 py-1.5 rounded-full bg-red-950/80 hover:bg-red-800 text-red-200 border border-red-500/50 text-xs font-serif flex items-center gap-1.5 cursor-pointer"
                                                    title="Delete Memory (Admin Only)"
                                                >
                                                    <Trash2 size={13} />
                                                    <span className="hidden sm:inline">Delete</span>
                                                </button>
                                            </>
                                        )}

                                        {/* Like / Unlike Toggle inside Enlarged View */}
                                        <button
                                            type="button"
                                            onClick={(e) => handleToggleLike(activeLightboxItem, e)}
                                            className={`px-3 py-1.5 rounded-full border text-xs font-serif flex items-center gap-1.5 cursor-pointer transition-all ${
                                                likedIds.includes(activeLightboxItem.id)
                                                    ? 'bg-rose-600/35 border-rose-400 text-rose-100'
                                                    : 'bg-[#0b1528] hover:bg-rose-950/60 text-amber-100 border-antique-gold/60'
                                            }`}
                                            title={
                                                likedIds.includes(activeLightboxItem.id)
                                                    ? 'Click to remove like'
                                                    : 'Like this memory'
                                            }
                                        >
                                            <Heart
                                                size={14}
                                                className={
                                                    likedIds.includes(activeLightboxItem.id)
                                                        ? 'fill-rose-400 text-rose-400'
                                                        : 'text-rose-300'
                                                }
                                            />
                                            <span>{activeLightboxItem.likes || 0}</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={(e) => handleDownloadMedia(activeLightboxItem, e)}
                                            className="px-3 py-1.5 rounded-full bg-[#0b1528] hover:bg-[#16294c] text-amber-200 border border-antique-gold/60 text-xs font-serif flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Download size={14} />
                                            <span className="hidden sm:inline">Download</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={(e) => handleSharePhotoWhatsApp(activeLightboxItem, e)}
                                            className="px-3 py-1.5 rounded-full bg-[#0b1528] hover:bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-xs font-serif flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Share2 size={14} />
                                            <span className="hidden sm:inline">WhatsApp</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setLightboxIndex(null)}
                                            className="w-9 h-9 rounded-full bg-[#0b1528] hover:bg-red-900 text-amber-200 border-2 border-antique-gold flex items-center justify-center cursor-pointer"
                                            title="Close (Esc)"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Main High-Res Image OR HTTP Byte-Range Video Player + Prev/Next Arrows */}
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="relative flex items-center justify-center max-w-5xl w-full max-h-[68vh]"
                                >
                                    {visibleMemories.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setLightboxIndex(
                                                    (lightboxIndex - 1 + visibleMemories.length) %
                                                        visibleMemories.length
                                                )
                                            }
                                            className="absolute left-1 sm:left-3 z-20 w-10 h-10 rounded-full bg-black/75 hover:bg-[#0b1528] text-amber-200 border border-antique-gold/70 flex items-center justify-center shadow-xl cursor-pointer"
                                            title="Previous Memory"
                                        >
                                            <ChevronLeft size={22} />
                                        </button>
                                    )}

                                    {activeLightboxItem.media_type === 'video' ? (
                                        <video
                                            key={activeLightboxItem.id}
                                            src={
                                                activeLightboxItem.video_url ||
                                                activeLightboxItem.high_res_url
                                            }
                                            poster={activeLightboxItem.image_url}
                                            controls
                                            autoPlay
                                            playsInline
                                            className="max-h-[66vh] max-w-[92vw] w-auto h-auto rounded-xl border-2 border-antique-gold/70 shadow-[0_0_50px_rgba(0,0,0,0.95)] bg-black"
                                        />
                                    ) : (
                                        /* Progressive "Blur-Up" Image Container */
                                        <div className="relative flex items-center justify-center">
                                            {!isHighResLoaded &&
                                                activeLightboxItem.high_res_url &&
                                                activeLightboxItem.high_res_url !==
                                                    activeLightboxItem.image_url && (
                                                    <img
                                                        src={activeLightboxItem.image_url}
                                                        alt={activeLightboxItem.caption || 'Yaadein Memory'}
                                                        className="max-h-[66vh] max-w-[92vw] w-auto h-auto object-contain rounded-xl border-2 border-antique-gold/70 shadow-[0_0_50px_rgba(0,0,0,0.95)] bg-[#070e1c] filter blur-[1.5px] transition-opacity duration-300"
                                                    />
                                                )}

                                            <img
                                                key={activeLightboxItem.id}
                                                src={
                                                    activeLightboxItem.high_res_url ||
                                                    activeLightboxItem.image_url
                                                }
                                                alt={activeLightboxItem.caption || 'Yaadein Memory'}
                                                onLoad={() => setIsHighResLoaded(true)}
                                                className={`max-h-[66vh] max-w-[92vw] w-auto h-auto object-contain rounded-xl border-2 border-antique-gold/70 shadow-[0_0_50px_rgba(0,0,0,0.95)] bg-[#070e1c] transition-opacity duration-300 ${
                                                    !isHighResLoaded &&
                                                    activeLightboxItem.high_res_url &&
                                                    activeLightboxItem.high_res_url !==
                                                        activeLightboxItem.image_url
                                                        ? 'absolute inset-0 m-auto opacity-0'
                                                        : 'opacity-100'
                                                }`}
                                            />
                                        </div>
                                    )}

                                    {visibleMemories.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setLightboxIndex(
                                                    (lightboxIndex + 1) % visibleMemories.length
                                                )
                                            }
                                            className="absolute right-1 sm:right-3 z-20 w-10 h-10 rounded-full bg-black/75 hover:bg-[#0b1528] text-amber-200 border border-antique-gold/70 flex items-center justify-center shadow-xl cursor-pointer"
                                            title="Next Memory"
                                        >
                                            <ChevronRight size={22} />
                                        </button>
                                    )}
                                </div>

                                {/* Caption Footer + Mobile-Friendly Admin Editable Text Bar */}
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="mt-4 max-w-2xl w-full text-center px-3"
                                >
                                    {isAdmin && isLightboxEditing ? (
                                        <div className="p-3.5 rounded-2xl bg-[#0b1528]/95 border-2 border-antique-gold shadow-2xl space-y-2.5 text-left">
                                            <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-300">
                                                ✏️ Admin Tag / Caption Editor
                                            </label>
                                            <input
                                                type="text"
                                                value={lightboxCaptionDraft}
                                                onChange={(e) => setLightboxCaptionDraft(e.target.value)}
                                                maxLength={250}
                                                autoFocus
                                                placeholder="Enter tag or caption for this memory..."
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-black/70 border border-antique-gold/60 focus:border-amber-300 text-sm sm:text-base text-white font-sans focus:outline-none"
                                            />
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsLightboxEditing(false)}
                                                    className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-serif cursor-pointer"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) =>
                                                        handleSaveLightboxCaption(activeLightboxItem, e)
                                                    }
                                                    className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#061217] font-serif font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
                                                >
                                                    <Check size={14} strokeWidth={3} />
                                                    <span>Save Tag</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="font-serif text-base sm:text-lg text-amber-50 mb-1">
                                                {activeLightboxItem.caption}
                                            </p>
                                            <p className="text-xs font-sans text-antique-gold">
                                                {activeLightboxItem.media_type === 'video' ? '🎬' : '📸'} Shared by{' '}
                                                {activeLightboxItem.uploader_name || 'Club Member'}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}
        </div>
    );
}
