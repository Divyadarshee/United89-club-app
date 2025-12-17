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

  return (
    <>
      <div className="fixed top-5 right-5 z-50">
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
      <SoundProvider>
        <Layout />
      </SoundProvider>
    </Router>
  );
}

export default App;
