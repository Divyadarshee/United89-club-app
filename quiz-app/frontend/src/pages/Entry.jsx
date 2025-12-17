import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { registerUser } from '../services/api';
import { useSoundManager } from '../hooks/useSoundManager';

function Entry() {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { playSound } = useSoundManager();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !phone.trim()) return;

        // Validate Phone (10 digits only)
        if (!/^\d{10}$/.test(phone)) {
            alert("Please enter a valid 10-digit phone number.");
            return;
        }

        playSound('click');
        playSound('bgm'); // Start BGM on user interaction
        setLoading(true);
        try {
            const data = await registerUser(name, phone);
            localStorage.setItem('user_id', data.user_id);
            localStorage.setItem('has_submitted', data.has_submitted);

            if (data.resuming && !data.has_submitted) {
                // Optional: Toast or subtle notification
            }
            navigate('/welcome');
        } catch (error) {
            console.error('Entry failed:', error);
            alert(error.response?.data?.detail || 'Entry failed. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    const handleInteraction = () => {
        playSound('bgm');
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="card-vintage text-center max-w-md mx-auto"
            onClick={handleInteraction}
            onFocus={handleInteraction}
        >
            <h1 className="text-4xl font-serif text-amber-50 mb-2 drop-shadow-lg">United 89</h1>
            <h2 className="text-xl text-antique-gold mb-8 font-serif italic">The Reunion Quiz</h2>

            <p className="mb-6 font-sans text-gray-200">Join the celebration to enter.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <input
                    type="text"
                    placeholder="Your Name (Class of '89)"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    className="input-vintage placeholder:text-gray-400"
                />
                <div className="flex flex-col text-left">
                    <input
                        type="tel"
                        placeholder="Phone Number (10 digits)"
                        value={phone}
                        onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, ''); // Allow only numbers
                            setPhone(val);
                        }}
                        maxLength={10}
                        required
                        disabled={loading}
                        className="input-vintage placeholder:text-gray-400 mb-1"
                    />
                    <small className="text-gray-600 font-sans text-xs ml-1">Format: 10 digit number</small>
                </div>
                <button type="submit" disabled={loading} className="btn-vintage w-full mt-2">
                    {loading ? 'Checking Guest List...' : 'Enter'}
                </button>
            </form>
        </motion.div>
    );
}

export default Entry;
