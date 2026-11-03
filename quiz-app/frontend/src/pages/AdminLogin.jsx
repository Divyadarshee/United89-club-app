import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ShieldCheck, KeyRound, AlertTriangle, X, RefreshCw, ArrowLeft } from 'lucide-react';
import { useSoundManager } from '../hooks/useSoundManager';
import { useAuth } from '../context/AuthContext';
import { sendAdminOtp, verifyAdminOtp } from '../services/api';

const DESIGNATED_ADMIN_PHONE = "+919437555900";

function AdminLogin() {
    const { user } = useAuth();
    const [step, setStep] = useState('request'); // 'request' or 'otp'
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hint, setHint] = useState(null);
    const [resendCooldown, setResendCooldown] = useState(0);

    const navigate = useNavigate();
    const { playSound } = useSoundManager();

    // If admin is already authenticated in session/browser cache, bypass login
    useEffect(() => {
        const phone = user?.phone || user?.user_id || localStorage.getItem('user_id') || '';
        const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
        const isAdmin = localStorage.getItem('admin_auth') === 'true' || user?.role === 'admin' || cleanPhone === '9437555900';
        if (isAdmin) {
            navigate('/admin/dashboard', { replace: true });
        }
    }, [user, navigate]);

    // Countdown timer for OTP resend
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError(null);
        setHint(null);
        playSound('click');
        setLoading(true);

        try {
            const response = await sendAdminOtp(DESIGNATED_ADMIN_PHONE);
            setStep('otp');
            setResendCooldown(30);
            if (response.debug_otp) {
                setHint(`Dev Mode: Admin Code is ${response.debug_otp}`);
            } else if (response.message) {
                setHint(response.message);
            }
        } catch (err) {
            console.error('Admin OTP failed:', err);
            setError(err.response?.data?.detail || 'Failed to send admin verification code.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError(null);
        if (!otp.trim() || otp.length < 4) {
            setError('Please enter the verification code.');
            return;
        }

        playSound('click');
        setLoading(true);

        try {
            const data = await verifyAdminOtp(DESIGNATED_ADMIN_PHONE, otp.trim());
            localStorage.setItem('admin_auth', 'true');
            if (data.access_token) {
                localStorage.setItem('admin_token', data.access_token);
            }
            navigate('/admin/dashboard');
        } catch (err) {
            console.error('Verify admin OTP failed:', err);
            setError(err.response?.data?.detail || 'Invalid or expired admin verification code.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0 || loading) return;
        playSound('click');
        setLoading(true);
        setError(null);
        try {
            const response = await sendAdminOtp(DESIGNATED_ADMIN_PHONE);
            setResendCooldown(30);
            if (response.debug_otp) {
                setHint(`Dev Mode: Admin Code is ${response.debug_otp}`);
            } else if (response.message) {
                setHint(response.message);
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Failed to resend code.');
        } finally {
            setLoading(false);
        }
    };

    const handleInteraction = () => {
        playSound('bgm');
    };

    return (
        <div
            className="flex items-center justify-center min-h-[50vh] px-4"
            onClick={handleInteraction}
            onFocus={handleInteraction}
        >
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-vintage w-full max-w-md text-center relative"
            >
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-midnight-blue border border-antique-gold/40 flex items-center justify-center mb-4 shadow-lg">
                        <Lock size={30} className="text-antique-gold" />
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-serif text-amber-50 mb-1">Admin Portal</h2>
                    <p className="text-xs font-sans text-gray-300 mb-6">
                        Designated Admin: <span className="font-mono text-antique-gold">+91 94375 55900</span>
                    </p>

                    {/* Error Banner */}
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-900/80 border border-red-500/50 rounded-lg p-3 mb-4 w-full flex items-start gap-2.5 text-left"
                        >
                            <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                            <p className="text-red-200 text-xs font-sans flex-1">{error}</p>
                            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
                                <X size={14} />
                            </button>
                        </motion.div>
                    )}

                    {/* Hint Banner */}
                    {hint && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-amber-950/80 border border-antique-gold/50 rounded-lg p-3 mb-4 w-full flex items-center gap-2 text-left"
                        >
                            <ShieldCheck className="text-antique-gold flex-shrink-0" size={16} />
                            <p className="text-amber-200 text-xs font-mono flex-1">{hint}</p>
                        </motion.div>
                    )}

                    <AnimatePresence mode="wait">
                        {step === 'request' ? (
                            <motion.form
                                key="step-request"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                onSubmit={handleSendOtp}
                                className="w-full space-y-4"
                            >
                                <div className="p-3 bg-black/30 border border-antique-gold/20 rounded-lg text-xs text-gray-300 font-sans text-left">
                                    <p className="text-amber-100 font-serif mb-1">Secure OTP Verification</p>
                                    <p>An authentication code will be sent to the designated administrator's WhatsApp/SMS.</p>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-vintage w-full text-sm py-2.5"
                                >
                                    {loading ? 'Sending Code...' : 'Send Admin Verification Code'}
                                </button>
                            </motion.form>
                        ) : (
                            <motion.form
                                key="step-otp"
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                onSubmit={handleVerifyOtp}
                                className="w-full space-y-4 text-left"
                            >
                                <div className="flex items-center justify-between pb-2 border-b border-antique-gold/20">
                                    <span className="text-xs font-serif text-antique-gold uppercase tracking-wider">
                                        Enter Admin Code
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setStep('request')}
                                        className="flex items-center gap-1 text-[11px] text-antique-gold hover:text-white"
                                    >
                                        <ArrowLeft size={12} />
                                        <span>Back</span>
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-xs font-serif text-amber-100 mb-2">
                                        6-Digit Security Code
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            maxLength={6}
                                            autoFocus
                                            placeholder="• • • • • •"
                                            value={otp}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '');
                                                setOtp(val);
                                            }}
                                            required
                                            disabled={loading}
                                            className="input-vintage text-center font-mono text-xl tracking-[0.4em] py-3 bg-black/40 border-antique-gold/50"
                                        />
                                        <KeyRound
                                            size={16}
                                            className="absolute right-3 top-3.5 text-antique-gold/50 pointer-events-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-gray-400 font-sans pt-1">
                                    <span>Didn't receive code?</span>
                                    <button
                                        type="button"
                                        onClick={handleResend}
                                        disabled={resendCooldown > 0 || loading}
                                        className={`flex items-center gap-1 text-antique-gold hover:text-white transition-colors ${
                                            resendCooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                    >
                                        <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                                        <span>
                                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                                        </span>
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading || otp.length < 4}
                                    className="btn-vintage w-full text-sm py-2.5 mt-2"
                                >
                                    {loading ? 'Verifying...' : 'Unlock Admin Dashboard'}
                                </button>
                            </motion.form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

export default AdminLogin;
