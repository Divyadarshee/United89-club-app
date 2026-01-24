import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { registerUser } from '../services/api';
import { useSoundManager } from '../hooks/useSoundManager';
import { AlertTriangle, X } from 'lucide-react';

function Entry() {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [countryCode, setCountryCode] = useState('+91');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { playSound } = useSoundManager();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null); // Clear previous errors
        if (!name.trim() || !phone.trim()) return;

        // Validate Phone (Basic length check for international numbers, 7-15 digits)
        if (phone.length < 7 || phone.length > 15) {
            setError("Please enter a valid phone number.");
            return;
        }

        // Combine country code and phone
        // If country code is +91, backend handles stripping it for legacy 10-digit support
        // For others, it keeps the full format e.g. +1415...
        const fullPhone = `${countryCode}${phone}`;

        playSound('click');
        playSound('bgm'); // Start BGM on user interaction
        setLoading(true);
        try {
            const data = await registerUser(name, fullPhone);
            localStorage.setItem('user_id', data.user_id);
            localStorage.setItem('has_submitted', data.has_submitted);
            if (data.week_id) {
                localStorage.setItem('week_id', data.week_id);
            }

            if (data.resuming && !data.has_submitted) {
                // Optional: Toast or subtle notification
            }
            navigate('/welcome');
        } catch (error) {
            console.error('Entry failed:', error);
            setError(error.response?.data?.detail || 'Entry failed. Please check your connection.');
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
            <h1 className="text-4xl font-serif text-amber-50 mb-2 drop-shadow-lg">UCE</h1>
            <h2 className="text-xl text-antique-gold mb-8 font-serif italic">The Ultimate Challenge</h2>

            <p className="mb-6 font-sans text-gray-200">Enter to start the challenge.</p>

            {/* Error Banner */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-900/80 border border-red-500/50 rounded-lg p-4 mb-4 flex items-start gap-3"
                >
                    <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                    <p className="text-red-200 text-sm font-sans text-left flex-1">{error}</p>
                    <button
                        onClick={() => setError(null)}
                        className="text-red-400 hover:text-red-200"
                    >
                        <X size={18} />
                    </button>
                </motion.div>
            )}

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
                    <div className="flex gap-2">
                        <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="input-vintage w-24 px-2 bg-midnight-blue text-amber-50"
                            disabled={loading}
                        >
                            <option value="+91">🇮🇳 +91</option>
                            <option value="+1">🇺🇸 +1</option>
                            <option value="+44">🇬🇧 +44</option>
                            <option value="+971">🇦🇪 +971</option>
                            <option value="+61">🇦🇺 +61</option>
                            <option value="+65">🇸🇬 +65</option>
                            <option value="+49">🇩🇪 +49</option>
                            <option value="+33">🇫🇷 +33</option>
                            <option value="+81">🇯🇵 +81</option>
                            <option value="+86">🇨🇳 +86</option>
                            <option value="+7">🇷🇺 +7</option>
                        </select>
                        <input
                            type="tel"
                            placeholder="Phone Number"
                            value={phone}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, ''); // Allow only numbers
                                setPhone(val);
                            }}
                            required
                            disabled={loading}
                            className="input-vintage flex-1 placeholder:text-gray-400"
                        />
                    </div>
                    <small className="text-gray-600 font-sans text-xs ml-1 mt-1">Select country code & enter number</small>
                </div>

                <button type="submit" disabled={loading} className="btn-vintage w-full mt-2">
                    {loading ? 'Checking Guest List...' : 'Enter'}
                </button>
            </form>
        </motion.div>
    );
}

export default Entry;

