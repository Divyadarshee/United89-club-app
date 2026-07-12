import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX } from 'lucide-react';
import Entry from './pages/Entry';
import Welcome from './pages/Welcome';
import Quiz from './pages/Quiz';
import ThankYou from './pages/ThankYou';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Leaderboard from './pages/Leaderboard';
import PageTransition from './components/PageTransition';
import BackgroundSlideshow from './components/BackgroundSlideshow';
import { useSoundManager } from './hooks/useSoundManager';
import { SoundProvider } from './context/SoundContext';
import { ConfigProvider, useConfig } from './context/ConfigContext';

// Secure Route Component
const AdminRoute = ({ children }) => {
  const isAuth = localStorage.getItem('admin_auth') === 'true';
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
  const { activeTheme } = useConfig();

  useEffect(() => {
    if (activeTheme === 'rath_yatra') {
      document.documentElement.classList.add('theme-rath-yatra');
    } else {
      document.documentElement.classList.remove('theme-rath-yatra');
    }
  }, [activeTheme]);

  return (
    <>
      {activeTheme === 'rath_yatra' && (
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-antique-gold via-red-800 to-antique-gold text-white text-center py-2 text-[10px] sm:text-xs font-serif font-bold tracking-[0.15em] sm:tracking-[0.25em] uppercase shadow-lg z-50 border-b border-antique-gold/20 select-none">
          ✨ Rath Yatra Special Week Challenge ✨
        </div>
      )}
      <div className="fixed bottom-4 left-4 md:bottom-auto md:left-auto md:top-5 md:right-5 z-50">
        <button
          onClick={toggleMute}
          className="bg-midnight-blue/50 border border-antique-gold p-3 rounded-full shadow-lg hover:bg-midnight-blue transition-colors"
        >
          {isMuted ? <VolumeX size={20} color="#c5a059" /> : <Volume2 size={20} color="#c5a059" />}
        </button>
      </div>
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
        <SoundProvider>
          <Layout />
        </SoundProvider>
      </ConfigProvider>
    </Router>
  );
}

export default App;
