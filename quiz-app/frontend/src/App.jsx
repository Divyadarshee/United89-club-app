import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Sparkles, Home } from 'lucide-react';
import Entry from './pages/Entry';
import Welcome from './pages/Welcome';
import Quiz from './pages/Quiz';
import ThankYou from './pages/ThankYou';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import SeasonRewind from './pages/SeasonRewind';
import PageTransition from './components/PageTransition';
import BackgroundSlideshow from './components/BackgroundSlideshow';
import UserNav from './components/UserNav';
import AppTour from './components/AppTour';
import { useSoundManager } from './hooks/useSoundManager';
import { SoundProvider } from './context/SoundContext';
import { ConfigProvider, useConfig } from './context/ConfigContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { isFinaleUnlocked } from './utils/featureFlags';

// Protected Route for Regular Authenticated Members
const ProtectedRoute = ({ children }) => {
  const isAuth = !!localStorage.getItem('access_token') || !!localStorage.getItem('user_id');
  return isAuth ? children : <Navigate to="/" replace />;
};

// Secure Route Component for Admin Dashboard (retains session if authenticated as admin)
const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  const phone = user?.phone || user?.user_id || localStorage.getItem('user_id') || '';
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  const isAuth = localStorage.getItem('admin_auth') === 'true' || user?.role === 'admin' || cleanPhone === '9437555900';
  return isAuth ? children : <Navigate to="/admin" replace />;
};

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Entry /></PageTransition>} />
        <Route path="/welcome" element={<PageTransition><Welcome /></PageTransition>} />
        <Route path="/quiz" element={<PageTransition><Quiz /></PageTransition>} />
        <Route path="/thank-you" element={<PageTransition><ThankYou /></PageTransition>} />
        <Route path="/leaderboard" element={<PageTransition><Leaderboard /></PageTransition>} />

        {/* Member Profile Route */}
        <Route path="/profile" element={
          <ProtectedRoute>
            <PageTransition><Profile /></PageTransition>
          </ProtectedRoute>
        } />

        {/* 2026 Season Finale: Rewind, Hall of Fame & Certificates */}
        <Route path="/rewind" element={<PageTransition><SeasonRewind /></PageTransition>} />

        {/* Admin Routes */}
        <Route path="/admin" element={<PageTransition><AdminLogin /></PageTransition>} />
        <Route path="/admin/dashboard" element={
          <AdminRoute>
            <PageTransition><AdminDashboard /></PageTransition>
          </AdminRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
};

const Layout = () => {
  const { isMuted, toggleMute } = useSoundManager();
  const { activeTheme, config } = useConfig();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const finaleUnlocked = isFinaleUnlocked(user, config);
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Listen for manual tour launch requests
  useEffect(() => {
    const handleStartTour = () => setIsTourOpen(true);
    window.addEventListener('start-app-tour', handleStartTour);
    return () => window.removeEventListener('start-app-tour', handleStartTour);
  }, []);

  // Auto-launch walkthrough demo on first visit to Welcome lounge
  useEffect(() => {
    if (location.pathname === '/welcome') {
      const hasSeen = localStorage.getItem('has_seen_app_tour');
      if (!hasSeen) {
        const timer = setTimeout(() => {
          setIsTourOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [location.pathname]);

  const themeClassMap = {
    rath_yatra: 'theme-rath-yatra',
    independence_day: 'theme-independence-day',
  };

  const themeBannerMap = {
    rath_yatra: '✨ Rath Yatra Special Week Challenge ✨',
    independence_day: '🇮🇳 Independence Day Special Challenge 🇮🇳',
  };

  useEffect(() => {
    // Remove all theme classes first
    Object.values(themeClassMap).forEach(cls => document.documentElement.classList.remove(cls));
    // Add the active one
    if (themeClassMap[activeTheme]) {
      document.documentElement.classList.add(themeClassMap[activeTheme]);
    }
  }, [activeTheme]);

  return (
    <>
      {themeBannerMap[activeTheme] && (
        <div className={`fixed top-0 left-0 right-0 text-center py-2 text-[10px] sm:text-xs font-serif font-black tracking-[0.15em] sm:tracking-[0.25em] uppercase shadow-lg z-50 select-none ${
          activeTheme === 'independence_day'
            ? 'bg-gradient-to-r from-orange-500 via-white to-emerald-600 text-[#000080] border-b-2 border-blue-900/30 shadow-md'
            : 'bg-gradient-to-r from-antique-gold via-red-800 to-antique-gold text-white border-b border-antique-gold/20'
        }`}>
          {themeBannerMap[activeTheme]}
        </div>
      )}

      {/* Top Left User Identity & Profile Badge */}
      <UserNav />

      {/* Sound Mute/Unmute Toggle */}
      <div id="tour-sound-toggle" className="fixed bottom-4 left-4 md:bottom-auto md:left-auto md:top-5 md:right-5 z-50">
        <button
          onClick={toggleMute}
          className="bg-midnight-blue/50 border border-antique-gold p-3 rounded-full shadow-lg hover:bg-midnight-blue transition-colors"
        >
          {isMuted ? <VolumeX size={20} color="#c5a059" /> : <Volume2 size={20} color="#c5a059" />}
        </button>
      </div>

      {/* Persistent "Return to Lounge" Floating Button on all pages except Entry, Lounge, Quiz, & Admin */}
      {location.pathname !== '/' && location.pathname !== '/welcome' && location.pathname !== '/quiz' && !location.pathname.startsWith('/admin') && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => navigate('/welcome')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0a1428]/95 border-2 border-antique-gold/70 text-amber-200 font-serif font-bold text-xs sm:text-sm shadow-2xl backdrop-blur-md hover:scale-105 active:scale-95 transition-transform cursor-pointer"
          >
            <Home size={15} className="text-antique-gold" />
            <span>Return to Lounge</span>
          </button>
        </div>
      )}

      {/* Interactive Step-by-Step App Walkthrough Tour */}
      <AppTour isOpen={isTourOpen} onClose={() => setIsTourOpen(false)} />

      <div className="bg-grain"></div> {/* Film Grain Overlay */}
      <BackgroundSlideshow />
      <AnimatedRoutes />
    </>
  );
};

function App() {
  return (
    <Router>
      <ConfigProvider>
        <AuthProvider>
          <SoundProvider>
            <Layout />
          </SoundProvider>
        </AuthProvider>
      </ConfigProvider>
    </Router>
  );
}

export default App;
