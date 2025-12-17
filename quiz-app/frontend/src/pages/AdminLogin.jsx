import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useSoundManager } from '../hooks/useSoundManager';

function AdminLogin() {
    const [password, setPassword] = useState('');
    const navigate = useNavigate();
    const { playSound } = useSoundManager();

    const handleLogin = (e) => {
        e.preventDefault();
        // Simple hardcoded check for MVP
        if (password === 'admin123') {
            localStorage.setItem('admin_auth', 'true');
            navigate('/admin/dashboard');
        } else {
            alert('Invalid Password');
        }
    };

    const handleInteraction = () => {
        playSound('bgm');
    };

    return (
        <div
            className="flex items-center justify-center min-h-[50vh]"
            onClick={handleInteraction}
            onFocus={handleInteraction}
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-vintage w-full max-w-md"
            >
                <div className="flex flex-col items-center">
                    <Lock size={48} className="text-antique-gold mb-4" />
                    <h2 className="text-3xl font-serif text-amber-50 mb-6">Admin Access</h2>

                    <form onSubmit={handleLogin} className="w-full">
                        <input
                            type="password"
                            placeholder="Enter Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-vintage text-center text-lg tracking-widest"
                        />
                        <button type="submit" className="btn-vintage w-full mt-4">
                            Unlock
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}

export default AdminLogin;
