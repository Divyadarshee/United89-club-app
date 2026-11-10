import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Trophy, Award, Crown, Zap, Clock, Shield, Star, Flame, Calendar,
  Download, Upload, Trash2, Sparkles, User, Users, Play, Pause,
  ChevronRight, ChevronLeft, ChevronDown, Copy, Check, Home, BarChart3, Search, Medal, Globe, Edit3
} from 'lucide-react';
import { FINALE_DATA } from '../data/finaleData';
import {
  renderCertificateToDataUrl,
  renderWrappedCardToDataUrl,
} from '../utils/certificateRenderer';
import { useSoundManager } from '../hooks/useSoundManager';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { normalizePhone, isFinaleUnlocked, isFinaleAdmin } from '../utils/featureFlags';
import { AdminMemberBar, AdminMemberPickerModal } from '../components/AdminMemberControls';
import ImageLightboxModal from '../components/ImageLightboxModal';

const STORY_SLIDES = [
  {
    id: 'intro',
    tag: 'SCENE 1 • THE 40-WEEK PHENOMENON',
    title: '40 Weeks. 1 Brotherhood.',
    subtitle: 'January 2026 — November 2026',
    highlight: 'UCE ’87 Ultimate Challenge Experience',
    desc: 'What started in January 2026 as a weekly trivia game turned into a 10-month ritual across India, Singapore, and the USA—uniting the Batch of ’87 every single Monday morning.',
    stats: [
      { label: 'Official Quizzes', value: '40 Weeks' },
      { label: 'Contenders', value: '49 Members' },
      { label: 'Global Reach', value: '🇮🇳 🇸🇬 🇺🇸' },
    ],
  },
  {
    id: 'numbers',
    tag: 'SCENE 2 • THE SEASON IN BIG NUMBERS',
    title: '6,090 Questions Faced.',
    subtitle: '76.0% Club-Wide Accuracy!',
    highlight: '43.8 Hours of Pure Brainpower',
    desc: 'Together, our members submitted 609 official quizzes and answered 4,629 questions correctly. Nearly 1 in every 4 quiz attempts (24.0%) resulted in a flawless 10/10!',
    stats: [
      { label: 'Total Quizzes Played', value: '609' },
      { label: 'Perfect 10/10 Scores', value: '146' },
      { label: 'Elite 9+/10 Scores', value: '261 (42.9%)' },
    ],
  },
  {
    id: 'rituals',
    tag: 'SCENE 3 • SIGNATURE CLUB RITUALS',
    title: 'Early Birds, Night Owls & The Finisher',
    subtitle: 'When Does UCE ’87 Play?',
    highlight: '26/40 Weeks Finished Last by Pm!',
    desc: 'Raghunath Mohapatra (RM) was the very first person in the club to submit in 6 different weeks! Rabindra Nath Dash led our Sunrise Scholars with 14 quizzes before 8 AM—while Priyadarshi Mohanty (Pm) pulled an MS Dhoni, waiting until the weekend to submit LAST in 26 of 40 weeks and winning 18 Golds!',
    stats: [
      { label: 'Sunrise Scholar (#1)', value: 'R.N. Dash (14)' },
      { label: 'Monday Bellwether (#1)', value: 'Raghunath M. (6x 1st)' },
      { label: 'Weekend Finisher (#1)', value: 'P. Mohanty (26x Last)' },
    ],
  },
  {
    id: 'speed',
    tag: 'SCENE 4 • SONIC BOOM VS. PAISA VASOOL',
    title: '41 Seconds vs. 593 Seconds!',
    subtitle: 'Two Ways to Conquer a 10-Minute Timer',
    highlight: '43s Fastest Perfect 10/10 Ever!',
    desc: 'Prabhat Ranjan Barik finished Quiz 33 in 41s and shattered the Perfect 10 record in Quiz 40 in just 43 seconds! Rabinarayan Prusty led the season average at 134.8s, and Subrat Mishra paced 36 weeks within ±26.8s. Meanwhile, Sagar Mohanty (593s) and Prasant Panda (574s) squeezed every drop of Paisa Vasool out of the 600s clock!',
    stats: [
      { label: 'Fastest 10/10 Ever', value: 'P.R. Barik (43s)' },
      { label: 'Fastest Season Avg', value: 'R. Prusty (135s)' },
      { label: 'Buzzer-Beater 10/10', value: 'Sagar M. (593s)' },
    ],
  },
  {
    id: 'slayers',
    tag: 'SCENE 5 • THE TOUGHEST STUMPERS',
    title: 'The Toughest Stumpers of 2026!',
    subtitle: 'Questions That Tripped Up Most Contenders',
    highlight: 'Tripped Up Over 75% of Contenders ❌',
    desc: 'Across 400 questions, a handful of notorious stumpers baffled the vast majority of our players! Like the submerged tunnel and landmark engineering questions that almost everyone got wrong—solved only by a razor-sharp few: Prabhat Ranjan Barik, Praween K Singh, and Rabindra Nath Dash! Rabindra Nath Dash led the club solving 6 of the hardest stumpers!',
    stats: [
      { label: '#1 Stumper Solver', value: 'R.N. Dash (6 Solves)' },
      { label: '5x Stumper Solvers', value: 'SKM • Praween • Suman • Bishnu' },
      { label: 'Hard-Q Accuracy (<50%)', value: 'Rashmi R. Raj (88.1%)' },
    ],
  },
  {
    id: 'comebacks',
    tag: 'SCENE 6 • IRONMEN, STREAKS & SURGES',
    title: 'Grit, Growth & Grand Climaxes',
    subtitle: 'Second-Half Rockets & Unbroken Streaks',
    highlight: '+1.43 Pts/Quiz Surge by Bhakta Nayak!',
    desc: 'Rashmi Ranjan Raj & Priyadarshi Mohanty played all 40 weeks (100%), while Bishnu Behera & Rabindra Dash played 39! T C Sreenath rattled off 25 straight weeks after joining, Suman Mohanty (+1.22) & M.S. Rahman (+1.20) surged, and Subrat Mishra saved his first two 10/10s for Quiz 39 & Quiz 40!',
    stats: [
      { label: 'Most Improved (#1)', value: 'Bhakta Nayak (+1.43)' },
      { label: 'Mid-Season Streak', value: 'T C Sreenath (25 Wks)' },
      { label: 'Wildcard MVP', value: 'SKM (10x 10/10s)' },
    ],
  },
  {
    id: 'podium',
    tag: 'SCENE 7 • THE TORTOISE VS. HARE CHAMPIONSHIP',
    title: 'A 4-Point Photo-Finish After 40 Weeks!',
    subtitle: '383 Pts vs. 379 Pts • A Duel for the Ages',
    highlight: '👑 Champion: Rashmi Ranjan Raj (383/400)',
    desc: 'Dilip Dubey set the all-time record with 27 Perfect 10s (8 in a row!). Dr B K Das claimed 20 weekly podiums without ever dropping below 8/10. Priyadarshi Mohanty won 18 Weekly Golds (379 pts). And Rashmi Ranjan Raj—who won weekly #1 only ONCE due to speed tiebreakers—never scored below 8 in 40 weeks to win the Overall Crown with 383 points!',
    stats: [
      { label: '🥇 #1 Overall', value: 'Rashmi R. Raj (383)' },
      { label: '🥈 #2 Overall (18🥇)', value: 'P. Mohanty (379)' },
      { label: '🥉 #3 & #4 (27x 10s)', value: 'Dr B K Das & Dilip Dubey' },
    ],
  },
];

export default function SeasonRewind() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { playSound } = useSoundManager();
  const { user } = useAuth();
  const { config } = useConfig();

  const isAdmin = isFinaleAdmin(user);
  const finaleUnlocked = isFinaleUnlocked(user, config);

  // Tabs: 'profile' | 'highlights' | 'hallOfFame'
  const initialTab = searchParams.get('tab') || 'profile';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Detect logged-in user or query param
  const loggedInRaw = user?.phone || localStorage.getItem('user_id') || '';
  const loggedInNorm = normalizePhone(loggedInRaw);

  const defaultPlayerNorm = useMemo(() => {
    // Only admin can switch members via URL param or dropdown
    if (isAdmin) {
      const paramPhone = normalizePhone(searchParams.get('member') || '');
      if (paramPhone && FINALE_DATA.players.some((p) => p.normPhone === paramPhone)) {
        return paramPhone;
      }
    }
    if (loggedInNorm && FINALE_DATA.players.some((p) => p.normPhone === loggedInNorm)) {
      return loggedInNorm;
    }
    return FINALE_DATA.players[0]?.normPhone || '';
  }, [isAdmin, loggedInNorm, searchParams]);

  const [selectedNorm, setSelectedNorm] = useState(defaultPlayerNorm);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);

  // Force non-admins strictly to their own profile
  useEffect(() => {
    if (!isAdmin && defaultPlayerNorm) {
      setSelectedNorm(defaultPlayerNorm);
    }
  }, [isAdmin, defaultPlayerNorm]);

  const selectedPlayer = useMemo(() => {
    return (
      FINALE_DATA.players.find((p) => p.normPhone === selectedNorm) ||
      FINALE_DATA.players[0]
    );
  }, [selectedNorm]);

  // Certificate state
  const [certType, setCertType] = useState('award'); // 'award' | 'participation'
  const [selectedAwardIdx, setSelectedAwardIdx] = useState(0);
  const [memberPhotos, setMemberPhotos] = useState({}); // normPhone -> dataUrl
  const [certDataUrl, setCertDataUrl] = useState(null);
  const [wrappedDataUrl, setWrappedDataUrl] = useState(null);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [renderingCert, setRenderingCert] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState(null);
  const fileInputRef = useRef(null);

  // Story Mode state (Auto-Play by default with moving golden line)
  const SLIDE_DURATION = 6500;
  const [storyIdx, setStoryIdx] = useState(0);
  const [storyPlaying, setStoryPlaying] = useState(true);
  const [slideProgress, setSlideProgress] = useState(0);

  // Hall of Fame filter state
  const [awardFilter, setAwardFilter] = useState('ALL');
  const [tableSearch, setTableSearch] = useState('');

  // Auto-switch certType when selecting a player with/without special awards
  useEffect(() => {
    setSelectedAwardIdx(0);
    if (selectedPlayer?.hasSpecialAward) {
      setCertType('award');
    } else {
      setCertType('participation');
    }
  }, [selectedPlayer]);

  // Render Certificate & Wrapped Card previews whenever player, certType, awardIdx, or photo changes
  useEffect(() => {
    let active = true;
    if (!selectedPlayer) return;
    setRenderingCert(true);
    const photoUrl = memberPhotos[selectedPlayer.normPhone] || null;

    Promise.all([
      renderCertificateToDataUrl({
        player: selectedPlayer,
        certType,
        awardIndex: selectedAwardIdx,
        photoDataUrl: photoUrl,
        logoStyle: 'v1-side-portrait',
        signatureStyle: 'sig-udaya-full',
      }),
      renderWrappedCardToDataUrl({
        player: selectedPlayer,
        photoDataUrl: photoUrl,
        logoStyle: 'v1-side-portrait',
      }),
    ])
      .then(([cUrl, wUrl]) => {
        if (!active) return;
        setCertDataUrl(cUrl);
        setWrappedDataUrl(wUrl);
      })
      .catch((err) => console.error('Failed to render certificate canvas:', err))
      .finally(() => {
        if (active) setRenderingCert(false);
      });

    return () => {
      active = false;
    };
  }, [selectedPlayer, certType, selectedAwardIdx, memberPhotos]);

  // Story Mode auto-advance with moving golden line
  useEffect(() => {
    if (!storyPlaying) return;
    const intervalMs = 40;
    const step = (intervalMs / SLIDE_DURATION) * 100;
    const timer = setInterval(() => {
      setSlideProgress((prev) => {
        if (prev + step >= 100) {
          setStoryIdx((cur) => {
            if (cur < STORY_SLIDES.length - 1) {
              return cur + 1;
            } else {
              setStoryPlaying(false);
              confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
              return cur;
            }
          });
          return 0;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [storyPlaying]);

  const handleTabChange = (tab) => {
    playSound?.('click');
    setActiveTab(tab);
    setSearchParams({ tab, member: selectedNorm });
  };

  const handleSelectMember = (norm) => {
    playSound?.('click');
    setSelectedNorm(norm);
    setShowMemberDropdown(false);
    setMemberSearch('');
    setSearchParams({ tab: activeTab, member: norm });
  };

  const [showMemberPickerModal, setShowMemberPickerModal] = useState(false);

  const currentPlayerIdx = useMemo(() => {
    const idx = FINALE_DATA.players.findIndex((p) => p.normPhone === selectedPlayer?.normPhone);
    return idx >= 0 ? idx : 0;
  }, [selectedPlayer?.normPhone]);

  const handlePrevMember = () => {
    const prevIdx = (currentPlayerIdx - 1 + FINALE_DATA.players.length) % FINALE_DATA.players.length;
    handleSelectMember(FINALE_DATA.players[prevIdx].normPhone);
  };

  const handleNextMember = () => {
    const nextIdx = (currentPlayerIdx + 1) % FINALE_DATA.players.length;
    handleSelectMember(FINALE_DATA.players[nextIdx].normPhone);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPlayer) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setMemberPhotos((prev) => ({
        ...prev,
        [selectedPlayer.normPhone]: ev.target.result,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    if (!selectedPlayer) return;
    setMemberPhotos((prev) => {
      const next = { ...prev };
      delete next[selectedPlayer.normPhone];
      return next;
    });
  };

  const triggerDownload = (dataUrl, filename) => {
    if (!dataUrl) return;
    playSound?.('click');
    confetti({ particleCount: 55, spread: 60, origin: { y: 0.7 } });
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyPrompt = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2500);
  };

  const filteredDropdownMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return FINALE_DATA.players;
    return FINALE_DATA.players.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.realName.toLowerCase().includes(q) ||
        p.normPhone.includes(q)
    );
  }, [memberSearch]);

  const filteredAwards = useMemo(() => {
    if (awardFilter === 'ALL') return FINALE_DATA.specialAwards;
    return FINALE_DATA.specialAwards.filter((a) => a.tier === awardFilter);
  }, [awardFilter]);

  const filteredLeaderboard = useMemo(() => {
    const officialOnly = FINALE_DATA.players.filter((p) => p.weeksPlayed > 0);
    const q = tableSearch.trim().toLowerCase();
    if (!q) return officialOnly;
    return officialOnly.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.realName.toLowerCase().includes(q) ||
        p.persona.toLowerCase().includes(q)
    );
  }, [tableSearch]);

  if (!finaleUnlocked) {
    return (
      <div className="w-full max-w-2xl mx-auto py-16 px-4 text-center">
        <div className="card-vintage p-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-400/50 flex items-center justify-center text-3xl mx-auto">
            🔒
          </div>
          <h2 className="text-2xl font-serif font-bold text-white">
            2026 Grand Finale Preview
          </h2>
          <p className="text-sm text-gray-300 font-sans max-w-md mx-auto leading-relaxed">
            The 40-Week Season Finale Showcase, Awards &amp; Certificates are currently in private preview for club testers. The grand reveal will unlock for all members shortly!
          </p>
          <div className="pt-2">
            <button
              onClick={() => navigate('/welcome')}
              className="btn-vintage px-6 py-2 text-sm"
            >
              Back to Lounge
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full text-amber-50 pb-20 px-2 sm:px-4 md:px-8 max-w-6xl mx-auto">
      {/* Top Header Bar */}
      <div className="pt-14 sm:pt-4 pb-3 flex flex-wrap items-center justify-between gap-2 border-b border-antique-gold/30 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/leaderboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-midnight-blue/80 border border-antique-gold/40 text-amber-100 hover:bg-antique-gold/20 text-xs sm:text-sm font-sans transition-all"
          >
            <Trophy size={15} className="text-antique-gold" />
            <span>Weekly LB</span>
          </button>
        </div>

        <div className="text-center flex-1 min-w-[200px]">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-antique-gold/20 border border-antique-gold/50 text-antique-gold text-[10px] sm:text-xs font-bold tracking-widest uppercase">
            <Sparkles size={12} /> 40-Week Grand Finale • 2026
          </div>
          <h1 className="text-xl sm:text-3xl font-serif font-bold text-white tracking-wide mt-0.5">
            UCE ’87 Season Rewind & Hall of Fame
          </h1>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-amber-200/80 font-sans">
          <span>609 Quizzes</span> • <span>40 Weeks</span>
        </div>
      </div>

      {/* Mobile-First Sticky 3-Tab Switcher */}
      <div id="tour-rewind-tabs" className="sticky top-2 z-30 bg-[#09132c]/95 backdrop-blur-md p-1.5 rounded-xl border border-antique-gold/40 shadow-2xl mb-5 grid grid-cols-3 gap-1.5">
        <button
          onClick={() => handleTabChange('profile')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg font-serif font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'profile'
              ? 'bg-gradient-to-r from-amber-500 via-antique-gold to-amber-600 text-midnight-blue shadow-lg scale-[1.01]'
              : 'text-amber-100/80 hover:bg-white/5'
          }`}
        >
          <User size={16} />
          <span className="truncate">My Profile & Certs</span>
        </button>

        <button
          onClick={() => handleTabChange('highlights')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg font-serif font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'highlights'
              ? 'bg-gradient-to-r from-amber-500 via-antique-gold to-amber-600 text-midnight-blue shadow-lg scale-[1.01]'
              : 'text-amber-100/80 hover:bg-white/5'
          }`}
        >
          <Sparkles size={16} />
          <span className="truncate">2026 Highlights</span>
        </button>

        <button
          onClick={() => handleTabChange('hallOfFame')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg font-serif font-bold text-xs sm:text-sm transition-all ${
            activeTab === 'hallOfFame'
              ? 'bg-gradient-to-r from-amber-500 via-antique-gold to-amber-600 text-midnight-blue shadow-lg scale-[1.01]'
              : 'text-amber-100/80 hover:bg-white/5'
          }`}
        >
          <Award size={16} />
          <span className="truncate">Hall of Fame</span>
        </button>
      </div>

      {/* =========================================================
          TAB 1: MY PROFILE (PERSONALIZED CERTS, AWARDS & WRAPPED)
         ========================================================= */}
      {activeTab === 'profile' && selectedPlayer && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Admin Member Switcher Bar for Mobile & Desktop */}
          {isAdmin && (
            <AdminMemberBar
              selectedPlayer={selectedPlayer}
              onPrev={handlePrevMember}
              onNext={handleNextMember}
              onOpenPicker={() => setShowMemberPickerModal(true)}
              currentIndex={currentPlayerIdx}
              totalCount={FINALE_DATA.players.length}
            />
          )}

          {/* Member Switcher Bar */}
          <div className="bg-[#0d1b3a]/90 border border-antique-gold/40 rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg relative">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 flex items-center justify-center text-midnight-blue font-serif font-black text-lg shadow-md flex-shrink-0">
                {selectedPlayer.rank ? `#${selectedPlayer.rank}` : '★'}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] uppercase tracking-wider font-sans text-antique-gold font-semibold">
                    {selectedPlayer.normPhone === loggedInNorm
                      ? '✨ Your Personal 2026 Profile'
                      : 'Alumni Member Profile'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200">
                    {selectedPlayer.persona}
                  </span>
                </div>
                <h2 className="text-lg sm:text-2xl font-serif font-bold text-white">
                  {selectedPlayer.displayName}
                </h2>
              </div>
            </div>
          </div>

          {/* Special Award Spotlight Banner (If Award Holder) */}
          {selectedPlayer.hasSpecialAward && (
            <div className="bg-gradient-to-r from-amber-950/80 via-[#15254e] to-amber-950/80 border-2 border-antique-gold rounded-2xl p-4 sm:p-5 shadow-xl">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-widest text-antique-gold flex items-center gap-1.5">
                  <Crown size={16} /> Official 2026 Special Award Honoree
                </span>
                {selectedPlayer.awards.length > 1 && (
                  <div className="flex gap-1.5">
                    {selectedPlayer.awards.map((aw, idx) => (
                      <button
                        key={aw.id}
                        onClick={() => {
                          setSelectedAwardIdx(idx);
                          setCertType('award');
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                          selectedAwardIdx === idx
                            ? 'bg-antique-gold text-midnight-blue'
                            : 'bg-white/10 text-amber-200'
                        }`}
                      >
                        Award #{idx + 1}: {aw.shortTitle}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {(() => {
                const aw = selectedPlayer.awards[selectedAwardIdx] || selectedPlayer.awards[0];
                return (
                  <div className="text-left space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-antique-gold text-midnight-blue font-bold text-xs">
                        {aw.tier}
                      </span>
                      <span className="text-xs text-amber-300 font-semibold">
                        {aw.statsBadge}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-serif font-bold text-white">
                      🏆 {aw.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-sans">
                      {aw.citation}
                    </p>
                    <div className="pt-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleCopyPrompt(aw.id, aw.aiPrompt)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-midnight-blue/90 border border-antique-gold/50 text-amber-200 hover:bg-antique-gold/20 text-xs font-sans transition-all"
                      >
                        {copiedPromptId === aw.id ? (
                          <>
                            <Check size={14} className="text-emerald-400" />
                            <span className="text-emerald-300">Copied AI Portrait Prompt!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} className="text-antique-gold" />
                            <span>Copy AI Photo-to-Portrait Prompt</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* =====================================================
              CERTIFICATES & SHAREABLE KEEPSAKES STUDIO
             ===================================================== */}
          <div className="bg-[#0b1631]/95 border border-antique-gold/50 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-antique-gold/20 pb-4">
              <div className="text-left">
                <h3 className="text-lg sm:text-xl font-serif font-bold text-white flex items-center gap-2">
                  <Award className="text-antique-gold" size={22} />
                  <span>Personal Certificates & Keepsakes Studio</span>
                </h3>
                <p className="text-xs text-gray-300 font-sans mt-0.5">
                  Customize with an optional photo or AI avatar and download in print-ready HD PNG.
                </p>
              </div>

              {/* Certificate Type Switcher + Photo Upload */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedPlayer.hasSpecialAward && (
                  <div className="flex rounded-lg bg-midnight-blue p-1 border border-antique-gold/40">
                    <button
                      onClick={() => setCertType('award')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        certType === 'award'
                          ? 'bg-antique-gold text-midnight-blue shadow'
                          : 'text-amber-100/80 hover:text-white'
                      }`}
                    >
                      🏆 Special Award Cert
                    </button>
                    <button
                      onClick={() => setCertType('participation')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        certType === 'participation'
                          ? 'bg-antique-gold text-midnight-blue shadow'
                          : 'text-amber-100/80 hover:text-white'
                      }`}
                    >
                      🎖️ Participation Cert
                    </button>
                  </div>
                )}

                <button
                  onClick={() => navigate('/profile?tab=details')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 border border-antique-gold text-amber-200 hover:bg-amber-500/30 text-xs font-sans font-semibold transition-all cursor-pointer"
                  title="Update your official profile picture in Profile"
                >
                  <Edit3 size={14} />
                  <span>Edit Profile Photo</span>
                </button>
              </div>
            </div>

            {/* Live Certificate Preview & Download Buttons */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              {/* Left 2 Cols: Landscape Certificate Preview */}
              <div className="lg:col-span-2 space-y-3">
                <div
                  onClick={() => {
                    if (certDataUrl) {
                      playSound?.('click');
                      setEnlargedImage({
                        src: certDataUrl,
                        alt: `${selectedPlayer.displayName} Certificate`,
                      });
                    }
                  }}
                  title={certDataUrl ? "Click or touch to enlarge" : undefined}
                  className={`relative rounded-xl overflow-hidden border-2 border-antique-gold/60 shadow-2xl bg-[#060b19] aspect-[2000/1414] flex items-center justify-center group ${
                    certDataUrl ? 'cursor-zoom-in hover:border-antique-gold transition-colors' : ''
                  }`}
                >
                  {renderingCert && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-10">
                      <span className="text-xs text-antique-gold font-serif animate-pulse">
                        Rendering High-Resolution Keepsake...
                      </span>
                    </div>
                  )}
                  {certDataUrl ? (
                    <>
                      <img
                        src={certDataUrl}
                        alt={`${selectedPlayer.displayName} Certificate`}
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-md bg-black/75 border border-antique-gold/50 text-[10px] font-sans text-amber-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
                        🔍 Click to enlarge
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400">Preparing Certificate...</div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-gray-400 font-sans">
                    Resolution: 2000 × 1414 px (Print-Ready A4 Landscape)
                  </span>
                  <button
                    onClick={() =>
                      triggerDownload(
                        certDataUrl,
                        `UCE87_2026_${certType === 'award' ? 'Award' : 'Participation'}_Certificate_${selectedPlayer.realName.replace(/\s+/g, '_')}.png`
                      )
                    }
                    disabled={!certDataUrl}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-antique-gold to-amber-600 text-midnight-blue font-serif font-bold text-sm shadow-lg hover:brightness-110 transition-all cursor-pointer"
                  >
                    <Download size={18} />
                    <span>
                      Download {certType === 'award' && selectedPlayer.hasSpecialAward ? 'Special Award' : 'Participation'} Certificate (PNG)
                    </span>
                  </button>
                </div>
              </div>

              {/* Right 1 Col: Vertical WhatsApp Wrapped Share Card */}
              <div className="space-y-3 bg-midnight-blue/60 border border-antique-gold/30 rounded-xl p-3">
                <div className="text-left">
                  <span className="text-[11px] uppercase tracking-wider text-antique-gold font-bold">
                    📱 WhatsApp Story Share Card
                  </span>
                  <p className="text-xs text-gray-300 font-sans">
                    All-in-one vertical summary card formatted for sharing in the UCE ’87 WhatsApp group!
                  </p>
                </div>

                <div
                  onClick={() => {
                    if (wrappedDataUrl) {
                      playSound?.('click');
                      setEnlargedImage({
                        src: wrappedDataUrl,
                        alt: 'WhatsApp Wrapped Card',
                      });
                    }
                  }}
                  title={wrappedDataUrl ? "Click or touch to enlarge" : undefined}
                  className={`relative rounded-lg overflow-hidden border border-antique-gold/50 bg-[#060b19] max-h-[360px] flex items-center justify-center mx-auto group ${
                    wrappedDataUrl ? 'cursor-zoom-in hover:border-antique-gold transition-colors' : ''
                  }`}
                >
                  {wrappedDataUrl ? (
                    <>
                      <img
                        src={wrappedDataUrl}
                        alt="WhatsApp Wrapped Card"
                        className="max-h-[350px] w-auto object-contain"
                      />
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/75 border border-antique-gold/50 text-[10px] font-sans text-amber-200 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md">
                        🔍 Enlarge
                      </div>
                    </>
                  ) : (
                    <div className="py-16 text-xs text-gray-400">Preparing Wrapped Card...</div>
                  )}
                </div>

                <button
                  onClick={() =>
                    triggerDownload(
                      wrappedDataUrl,
                      `UCE87_2026_Wrapped_${selectedPlayer.realName.replace(/\s+/g, '_')}.png`
                    )
                  }
                  disabled={!wrappedDataUrl}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                >
                  <Download size={16} />
                  <span>Download WhatsApp Wrapped Card</span>
                </button>
              </div>
            </div>
          </div>

          {/* =====================================================
              PERSONAL 2026 STATS BENTO GRID & 40-WEEK SPARKLINE
             ===================================================== */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <div className="bg-[#0d1b3a]/90 border border-antique-gold/30 rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-sans">
                Pure Season Score
              </div>
              <div className="text-2xl sm:text-3xl font-serif font-bold text-antique-gold mt-1">
                {selectedPlayer.pureScore}
              </div>
              <div className="text-[11px] text-amber-200/80 mt-0.5">
                {selectedPlayer.rank ? `Overall Rank #${selectedPlayer.rank}` : 'Pilot Pioneer'}
              </div>
            </div>

            <div className="bg-[#0d1b3a]/90 border border-antique-gold/30 rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-sans">
                Quizzes Played
              </div>
              <div className="text-2xl sm:text-3xl font-serif font-bold text-white mt-1">
                {selectedPlayer.weeksPlayed} <span className="text-sm text-gray-400">/ 40</span>
              </div>
              <div className="text-[11px] text-amber-200/80 mt-0.5">
                Max Streak: {selectedPlayer.maxAttStreak} Wks
              </div>
            </div>

            <div className="bg-[#0d1b3a]/90 border border-antique-gold/30 rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-sans">
                Season Average
              </div>
              <div className="text-2xl sm:text-3xl font-serif font-bold text-emerald-400 mt-1">
                {selectedPlayer.avgScore} <span className="text-sm text-gray-400">/ 10</span>
              </div>
              <div className="text-[11px] text-amber-200/80 mt-0.5">
                Best: {selectedPlayer.maxScore}/10
              </div>
            </div>

            <div className="bg-[#0d1b3a]/90 border border-antique-gold/30 rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-sans">
                Average Speed
              </div>
              <div className="text-2xl sm:text-3xl font-serif font-bold text-sky-400 mt-1">
                {selectedPlayer.avgTime}s
              </div>
              <div className="text-[11px] text-amber-200/80 mt-0.5">
                Fastest: {selectedPlayer.fastestTime || selectedPlayer.pilotTime || 0}s
              </div>
            </div>

            <div className="bg-[#0d1b3a]/90 border border-antique-gold/30 rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-sans">
                Perfection Club
              </div>
              <div className="text-2xl sm:text-3xl font-serif font-bold text-amber-300 mt-1">
                {selectedPlayer.count10}x <span className="text-xs">10/10</span>
              </div>
              <div className="text-[11px] text-amber-200/80 mt-0.5">
                {selectedPlayer.count9Plus}x Scored 9+
              </div>
            </div>

            <div className="bg-[#0d1b3a]/90 border border-antique-gold/30 rounded-xl p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-sans">
                Weekly Podiums
              </div>
              <div className="text-2xl sm:text-3xl font-serif font-bold text-yellow-400 mt-1">
                {selectedPlayer.podiums}
              </div>
              <div className="text-[11px] text-amber-200/80 mt-0.5">
                {selectedPlayer.gold}🥇 {selectedPlayer.silver}🥈 {selectedPlayer.bronze}🥉
              </div>
            </div>
          </div>

          {/* 40-Week Interactive Score Chart */}
          {selectedPlayer.weeksPlayed > 0 && (
            <div className="bg-[#0d1b3a]/90 border border-antique-gold/30 rounded-2xl p-4 sm:p-5 text-left space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-base sm:text-lg font-serif font-bold text-white flex items-center gap-2">
                    <BarChart3 size={18} className="text-antique-gold" />
                    <span>40-Week Score & Speed Journey (Quiz 1 to Quiz 40)</span>
                  </h4>
                  <p className="text-xs text-gray-400 font-sans">
                    Tap or hover over any bar to inspect that week&apos;s score, time, and club rank.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-sans">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-400 inline-block"></span> 10/10
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block"></span> 8–9/10
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-sky-400 inline-block"></span> &lt;8/10
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto pb-2">
                <div className="min-w-[640px] h-40 flex items-end gap-1.5 pt-6 px-1 border-b border-white/10">
                  {selectedPlayer.weeklyJourney.map((wj) => {
                    const hPct = wj.played ? Math.max((wj.score / 10) * 100, 12) : 6;
                    const barColor = !wj.played
                      ? 'bg-white/10'
                      : wj.score === 10
                      ? 'bg-emerald-400'
                      : wj.score >= 8
                      ? 'bg-amber-400'
                      : 'bg-sky-400';
                    return (
                      <div
                        key={wj.weekId}
                        className="flex-1 flex flex-col items-center group relative h-full justify-end"
                      >
                        {wj.played && (
                          <span className="text-[9px] text-gray-300 mb-0.5 font-mono">
                            {wj.score}
                          </span>
                        )}
                        <div
                          style={{ height: `${hPct}%` }}
                          className={`w-full rounded-t-sm transition-all group-hover:brightness-125 ${barColor}`}
                          title={
                            wj.played
                              ? `Quiz ${wj.quizNum} (${wj.weekId}): ${wj.score}/10 in ${wj.time}s (Rank #${wj.rank})`
                              : `Quiz ${wj.quizNum}: Did not play`
                          }
                        />
                        <span className="text-[9px] text-gray-400 mt-1 font-mono">
                          Q{wj.quizNum}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Personal Highlights Footnote */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs font-sans">
                {selectedPlayer.bestWeek && (
                  <div className="bg-midnight-blue/70 border border-antique-gold/25 rounded-lg p-2.5">
                    <span className="text-gray-400 block text-[10px] uppercase">
                      Best Single Week
                    </span>
                    <span className="text-white font-bold">
                      Quiz {selectedPlayer.bestWeek.quizNum}: {selectedPlayer.bestWeek.score}/10 in{' '}
                      {selectedPlayer.bestWeek.time}s (Rank #{selectedPlayer.bestWeek.rank})
                    </span>
                  </div>
                )}
                <div className="bg-midnight-blue/70 border border-antique-gold/25 rounded-lg p-2.5">
                  <span className="text-gray-400 block text-[10px] uppercase">
                    Timing Habits (IST)
                  </span>
                  <span className="text-white font-bold">
                    {selectedPlayer.mondaySubs} Mondays • {selectedPlayer.earlySubs} Early AM •{' '}
                    {selectedPlayer.weekendSubs} Weekends
                  </span>
                </div>
                <div className="bg-midnight-blue/70 border border-antique-gold/25 rounded-lg p-2.5">
                  <span className="text-gray-400 block text-[10px] uppercase">
                    Toughest Stumper Solves
                  </span>
                  <span className="text-white font-bold">
                    {selectedPlayer.giantSlayerCount > 0
                      ? `🗡️ Cracked ${selectedPlayer.giantSlayerCount} Hard Stumper Questions!`
                      : 'Contributed to 76.0% Club Accuracy!'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* =========================================================
          TAB 2: 2026 HIGHLIGHTS (YOUTUBE REWIND / STORY MODE)
         ========================================================= */}
      {activeTab === 'highlights' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Interactive 2026 Rewind Story Player */}
          <div className="bg-gradient-to-br from-[#0f1f47] via-[#091229] to-[#1a1230] border-2 border-antique-gold rounded-2xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
            {/* Progress Bars with moving golden line */}
            <div className="flex gap-1.5 mb-4">
              {STORY_SLIDES.map((s, idx) => {
                const isPast = idx < storyIdx;
                const isCurrent = idx === storyIdx;
                const fillWidth = isPast ? '100%' : isCurrent ? `${slideProgress}%` : '0%';
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setStoryIdx(idx);
                      setSlideProgress(0);
                    }}
                    className="flex-1 h-2 rounded-full bg-white/20 overflow-hidden cursor-pointer relative"
                    title={`Jump to ${s.title}`}
                  >
                    <div
                      className={`h-full ${
                        isPast || isCurrent
                          ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.8)]'
                          : ''
                      }`}
                      style={{
                        width: fillWidth,
                        transition: isCurrent ? 'width 40ms linear' : 'width 150ms ease-out',
                      }}
                    />
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-bold tracking-widest uppercase text-antique-gold">
                {STORY_SLIDES[storyIdx].tag}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!storyPlaying) {
                      playSound?.('bgm');
                    }
                    setStoryPlaying((p) => !p);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-antique-gold text-midnight-blue font-bold text-xs shadow hover:brightness-110 transition-all"
                >
                  {storyPlaying ? <Pause size={13} /> : <Play size={13} />}
                  <span>{storyPlaying ? 'Pause Story' : 'Auto-Play Story'}</span>
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={STORY_SLIDES[storyIdx].id}
                initial={{ opacity: 0, x: 25 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -25 }}
                transition={{ duration: 0.35 }}
                className="text-left py-2 space-y-4"
              >
                <div>
                  <div className="inline-block px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold mb-2">
                    {STORY_SLIDES[storyIdx].highlight}
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-serif font-bold text-white">
                    {STORY_SLIDES[storyIdx].title}
                  </h2>
                  <p className="text-sm sm:text-lg font-serif italic text-antique-gold mt-0.5">
                    {STORY_SLIDES[storyIdx].subtitle}
                  </p>
                </div>

                <p className="text-xs sm:text-base text-gray-200 font-sans leading-relaxed max-w-3xl">
                  {STORY_SLIDES[storyIdx].desc}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {STORY_SLIDES[storyIdx].stats.map((st, i) => (
                    <div
                      key={i}
                      className="bg-midnight-blue/80 border border-antique-gold/40 rounded-xl p-3 text-center"
                    >
                      <div className="text-[11px] uppercase tracking-wider text-gray-400">
                        {st.label}
                      </div>
                      <div className="text-lg sm:text-xl font-serif font-bold text-amber-300 mt-1">
                        {st.value}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Story Controls */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10">
              <button
                onClick={() => {
                  setStoryIdx((i) => Math.max(0, i - 1));
                  setSlideProgress(0);
                }}
                disabled={storyIdx === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 disabled:opacity-30 text-xs font-sans hover:bg-white/20"
              >
                <ChevronLeft size={15} /> Previous
              </button>
              <span className="text-xs text-gray-400 font-mono">
                Slide {storyIdx + 1} / {STORY_SLIDES.length}
              </span>
              <button
                onClick={() => {
                  setStoryIdx((i) => Math.min(STORY_SLIDES.length - 1, i + 1));
                  setSlideProgress(0);
                }}
                disabled={storyIdx === STORY_SLIDES.length - 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-antique-gold text-midnight-blue font-bold disabled:opacity-30 text-xs font-sans hover:brightness-110"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Highlight Grid: Speed vs Paisa Vasool & Photo Finishes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Speed Records Card */}
            <div className="bg-[#0d1b3a]/90 border border-antique-gold/40 rounded-2xl p-4 sm:p-5 text-left space-y-3">
              <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                <Zap className="text-amber-400" size={20} />
                <span>⚡ Fastest Single Quiz Records</span>
              </h3>
              <div className="space-y-2 text-xs sm:text-sm font-sans">
                {[
                  { rank: '1', time: '41s', score: '9/10', name: 'Prabhat Ranjan Barik', quiz: 'Quiz 33 (W37)' },
                  { rank: '2', time: '43s', score: '10/10 🏆', name: 'Prabhat Ranjan Barik', quiz: 'Quiz 40 Finale!' },
                  { rank: '3', time: '52s', score: '10/10', name: 'Prabhat Ranjan Barik (2x)', quiz: 'Quiz 34 & Quiz 38' },
                  { rank: '4', time: '54s', score: '10/10', name: 'Priyadarshi Mohanty (Pm)', quiz: 'Quiz 40 Finale!' },
                  { rank: '5', time: '69s', score: '10/10', name: 'Prabhat Ranjan Barik (2x)', quiz: 'Quiz 27 & Quiz 35' },
                  { rank: '6', time: '72s', score: '10/10', name: 'Priyadarshi Mohanty (Pm)', quiz: 'Quiz 25 (W29)' },
                  { rank: '7', time: '79s', score: '7/10', name: 'Rabinarayan Prusty', quiz: 'Quiz 35 (W39)' },
                  { rank: '8', time: '85s', score: '10/10', name: 'Dr B K Das', quiz: 'Quiz 25 (W29)' },
                ].map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-midnight-blue/70 border border-white/10 rounded-lg px-3 py-2"
                  >
                    <div>
                      <span className="font-bold text-amber-300 mr-2">{r.time}</span>
                      <span className="text-white font-semibold">{r.name}</span>
                    </div>
                    <div className="text-right text-xs text-gray-300">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold mr-1.5">
                        {r.score}
                      </span>
                      <span>{r.quiz}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Closest Photo Finishes Card */}
            <div className="bg-[#0d1b3a]/90 border border-antique-gold/40 rounded-2xl p-4 sm:p-5 text-left space-y-3">
              <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                <Clock className="text-antique-gold" size={20} />
                <span>📸 Closest Weekly Photo-Finishes for #1</span>
              </h3>
              <div className="space-y-2 text-xs sm:text-sm font-sans">
                {FINALE_DATA.photoFinishes.slice(0, 8).map((pf, i) => (
                  <div
                    key={i}
                    className="bg-midnight-blue/70 border border-white/10 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="truncate">
                      <span className="text-antique-gold font-bold mr-1.5">
                        Quiz {pf.quizNum}:
                      </span>
                      <span className="text-white font-semibold">{pf.winner}</span>{' '}
                      <span className="text-gray-400 text-xs">({pf.winnerTime}s)</span>
                      <span className="text-gray-400 mx-1">beat</span>
                      <span className="text-gray-200">{pf.runnerUp}</span>{' '}
                      <span className="text-gray-400 text-xs">({pf.runnerUpTime}s)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold text-xs flex-shrink-0">
                      by {pf.gap}s!
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stumper Questions Showcase */}
          <div className="bg-[#0d1b3a]/90 border border-antique-gold/40 rounded-2xl p-4 sm:p-6 text-left space-y-4">
            <div>
              <h3 className="text-lg sm:text-xl font-serif font-bold text-white flex items-center gap-2">
                <Shield className="text-antique-gold" size={20} />
                <span>🧩 The Toughest Stumper Questions of 2026 (When Most Got It Wrong!)</span>
              </h3>
              <p className="text-xs text-gray-300 font-sans mt-0.5">
                The most challenging questions across all 40 weeks that tripped up the vast majority of contenders—and the rare sharp minds who solved them!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FINALE_DATA.giantSlayerQuestions.slice(0, 6).map((gs, idx) => (
                <div
                  key={idx}
                  className="bg-midnight-blue/80 border border-antique-gold/30 rounded-xl p-3.5 space-y-2"
                >
                  <div className="text-xs">
                    <span className="font-bold text-antique-gold">
                      Quiz {gs.quizNum} ({gs.weekId}) • Q{gs.qOrder}
                    </span>
                  </div>
                  <p className="text-xs text-white font-sans line-clamp-2">{gs.question}</p>
                  <div className="text-[11px] text-emerald-300 font-semibold">
                    ✓ Correct Answer: {gs.answer}
                  </div>
                  <div className="text-[11px] text-amber-200/90">
                    <span className="text-gray-400">Rare Solvers: </span>
                    {gs.slayers.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Call to action for Personal 2026 Wrapped */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-purple-500/20 border-2 border-antique-gold/50 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-midnight-blue shadow-lg font-black text-2xl flex-shrink-0">
                🎬
              </div>
              <div>
                <h4 className="text-base font-serif font-bold text-white">
                  Want to see your own 2026 Season Wrapped Story?
                </h4>
                <p className="text-xs text-amber-200/80 font-sans mt-0.5">
                  Watch your personal 6-slide story reel, customize your profile photo, and download your official certificate!
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-[#0b1528] font-serif font-black text-xs sm:text-sm shadow-lg hover:scale-105 transition-transform flex-shrink-0 flex items-center gap-2"
            >
              <span>Play My 2026 Story</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {/* =========================================================
          TAB 3: HALL OF FAME (ALL 24 AWARDS & 40-WEEK STANDINGS)
         ========================================================= */}
      {activeTab === 'hallOfFame' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Download Certs Notice Banner */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/70 via-[#132546]/90 to-amber-950/70 border-2 border-antique-gold/60 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full bg-antique-gold/20 border border-antique-gold/50 flex items-center justify-center text-2xl flex-shrink-0">
                🎓
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-serif font-bold text-amber-200">
                  Looking for your Personal 2026 Wrapped Story &amp; Certificates?
                </h4>
                <p className="text-xs text-gray-300 font-sans mt-0.5">
                  Play your personal 6-slide animated story reel, customize your photo, and download your high-res certificate on <strong>My Profile &amp; Certs</strong>!
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 text-[#0b1528] font-serif font-black text-xs sm:text-sm shadow-lg hover:scale-105 transition-transform flex-shrink-0 flex items-center gap-2"
            >
              <span>Go to My Profile &amp; Certs</span>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Special Awards Filter & Gallery */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-left">
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-white flex items-center gap-2">
                  <Crown className="text-antique-gold" size={24} />
                  <span>2026 Season Hall of Fame Awards</span>
                </h2>
                <p className="text-xs text-gray-300 font-sans">
                  Official season honors celebrating 40 weeks of trivia brilliance, speed, and dedication.
                </p>
              </div>

              {/* Category Dropdown */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-serif text-antique-gold uppercase tracking-wider hidden sm:inline">
                  Filter Category:
                </label>
                <div className="relative">
                  <select
                    value={awardFilter}
                    onChange={(e) => setAwardFilter(e.target.value)}
                    className="bg-[#0b162c] text-amber-100 border-2 border-antique-gold/60 rounded-xl px-4 py-2 text-xs sm:text-sm font-serif font-bold shadow-lg focus:outline-none focus:border-antique-gold cursor-pointer pr-9 appearance-none"
                  >
                    <option value="ALL">🌟 All Honors &amp; Awards (24)</option>
                    <option value="Championship Tier">👑 Championship &amp; Podium Tier</option>
                    <option value="Speed &amp; Wildcard Tier">⚡ Speed, Grit &amp; Wildcard Tier</option>
                    <option value="Club Superlative Tier">🎖️ Club Superlatives &amp; Milestones</option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-antique-gold pointer-events-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAwards.map((aw) => (
                <div
                  key={aw.id}
                  className="bg-[#0d1b3a]/95 border border-antique-gold/40 hover:border-antique-gold rounded-2xl p-4 text-left flex flex-col justify-between gap-3 shadow-lg transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-antique-gold/20 border border-antique-gold/50 text-antique-gold text-[10px] font-bold uppercase tracking-wider">
                        {aw.tier}
                      </span>
                      <span className="text-[11px] text-amber-300 font-semibold">
                        {aw.statsBadge}
                      </span>
                    </div>

                    <h3 className="text-lg font-serif font-bold text-white">
                      🏆 {aw.title}
                    </h3>

                    <div className="text-sm font-serif font-bold text-amber-300">
                      Honoree: {aw.winnerDisplayName}
                    </div>

                    <p className="text-xs text-gray-300 font-sans leading-relaxed">
                      {aw.citation}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <button
                      onClick={() => handleCopyPrompt(aw.id, aw.aiPrompt)}
                      className="inline-flex items-center gap-1.5 text-xs text-amber-200 hover:text-white font-sans"
                    >
                      {copiedPromptId === aw.id ? (
                        <>
                          <Check size={13} className="text-emerald-400" />
                          <span className="text-emerald-300">AI Prompt Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} className="text-antique-gold" />
                          <span>Copy AI Image Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Complete 40-Week Pure Standings Table */}
          <div className="bg-[#0d1b3a]/95 border border-antique-gold/40 rounded-2xl p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-left">
                <h3 className="text-lg sm:text-xl font-serif font-bold text-white flex items-center gap-2">
                  <Trophy className="text-antique-gold" size={20} />
                  <span>Final 40-Week Championship Standings (Pure Quiz Score)</span>
                </h3>
                <p className="text-xs text-gray-300 font-sans">
                  100% pure quiz scores across Quizzes 1–40 (zero wildcard bonus points included).
                </p>
              </div>

              <div className="flex items-center gap-2 bg-midnight-blue border border-antique-gold/40 rounded-lg px-3 py-1.5 w-full sm:w-64">
                <Search size={14} className="text-antique-gold" />
                <input
                  type="text"
                  placeholder="Search contender..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none w-full"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm font-sans">
                <thead>
                  <tr className="border-b border-antique-gold/40 text-antique-gold uppercase text-[11px]">
                    <th className="py-2.5 px-2">Rank</th>
                    <th className="py-2.5 px-2">Member</th>
                    <th className="py-2.5 px-2 text-center">Pure Score</th>
                    <th className="py-2.5 px-2 text-center">Weeks</th>
                    <th className="py-2.5 px-2 text-center">Avg Score</th>
                    <th className="py-2.5 px-2 text-center">Avg Time</th>
                    <th className="py-2.5 px-2 text-center">10/10s</th>
                    <th className="py-2.5 px-2 text-center">Medals (🥇/🥈/🥉)</th>
                    <th className="py-2.5 px-2 text-right">Signature Persona</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredLeaderboard.map((p) => (
                    <tr
                      key={p.normPhone}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="py-2.5 px-2 font-bold text-amber-300">
                        {p.rank === 1
                          ? '🥇 #1'
                          : p.rank === 2
                          ? '🥈 #2'
                          : p.rank === 3
                          ? '🥉 #3'
                          : `#${p.rank}`}
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="font-semibold text-white">{p.displayName}</div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-antique-gold text-base">
                        {p.pureScore}
                      </td>
                      <td className="py-2.5 px-2 text-center text-gray-200">
                        {p.weeksPlayed}/40
                      </td>
                      <td className="py-2.5 px-2 text-center text-emerald-300 font-semibold">
                        {p.avgScore}
                      </td>
                      <td className="py-2.5 px-2 text-center text-sky-300">
                        {p.avgTime}s
                      </td>
                      <td className="py-2.5 px-2 text-center font-semibold text-amber-200">
                        {p.count10}
                      </td>
                      <td className="py-2.5 px-2 text-center text-xs">
                        {p.podiums > 0
                          ? `${p.gold}🥇 ${p.silver}🥈 ${p.bronze}🥉`
                          : '-'}
                      </td>
                      <td className="py-2.5 px-2 text-right text-xs text-gray-300">
                        {p.persona}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Enlarged Certificate / WhatsApp Wrapped Lightbox Modal */}
      <ImageLightboxModal
        src={enlargedImage?.src}
        alt={enlargedImage?.alt}
        onClose={() => {
          playSound?.('click');
          setEnlargedImage(null);
        }}
      />

      {/* Admin Scroll-Locked Member Picker Modal */}
      {isAdmin && (
        <AdminMemberPickerModal
          isOpen={showMemberPickerModal}
          onClose={() => setShowMemberPickerModal(false)}
          selectedNorm={selectedPlayer?.normPhone}
          onSelect={handleSelectMember}
        />
      )}
    </div>
  );
}
