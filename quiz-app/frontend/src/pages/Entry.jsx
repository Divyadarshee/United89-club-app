import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { sendOtp, verifyOtp, loginWithFirebase } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSoundManager } from '../hooks/useSoundManager';
import { AlertTriangle, X, ShieldCheck, ArrowLeft, RefreshCw, KeyRound, Smartphone, Loader2 } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, signInWithPopup } from 'firebase/auth';

function Entry() {
    const [step, setStep] = useState('phone');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [countryCode, setCountryCode] = useState('+91');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState(null);
    const [hint, setHint] = useState(null);
    const [resendCooldown, setResendCooldown] = useState(0);

    // Firebase confirmation result for real SMS confirmation
    const [confirmationResult, setConfirmationResult] = useState(null);
    const recaptchaVerifierRef = useRef(null);

    const navigate = useNavigate();
    const { login, isAuthenticated } = useAuth();
    const { playSound } = useSoundManager();

    // Helper to safely reset and clear Recaptcha DOM & instance
    const clearRecaptcha = () => {
        if (recaptchaVerifierRef.current) {
            try {
                console.log('[PhoneAuth] Clearing previous recaptchaVerifier...');
                recaptchaVerifierRef.current.clear();
            } catch (clearErr) {
                console.warn('[PhoneAuth] Error clearing recaptchaVerifier:', clearErr);
            }
            recaptchaVerifierRef.current = null;
        }
        const container = document.getElementById('recaptcha-container');
        if (container) {
            container.innerHTML = '';
        }
        // Also remove any orphaned badges attached to body
        const badges = document.querySelectorAll('.grecaptcha-badge');
        badges.forEach((b) => b.remove());
    };

    // Cleanup recaptcha on unmount
    useEffect(() => {
        return () => {
            clearRecaptcha();
        };
    }, []);

    // Countdown timer for OTP resend
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => {
            setResendCooldown((prev) => prev - 1);
        }, 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const getFullPhone = () => `${countryCode}${phone}`;

    // Create a fresh invisible Recaptcha for Firebase Phone Auth
    const getFreshRecaptcha = () => {
        console.log('[PhoneAuth] Initializing RecaptchaVerifier on #recaptcha-container...');
        clearRecaptcha();

        const container = document.getElementById('recaptcha-container');
        if (!container) {
            console.error('[PhoneAuth ERROR] #recaptcha-container element NOT found in DOM!');
            throw new Error('Recaptcha container element missing.');
        }

        // Create a brand-new child element each time so grecaptcha never complains
        // that "reCAPTCHA has already been rendered in this element"
        const verifierNode = document.createElement('div');
        container.appendChild(verifierNode);

        try {
            recaptchaVerifierRef.current = new RecaptchaVerifier(auth, verifierNode, {
                size: 'invisible',
                callback: (token) => {
                    console.log('[PhoneAuth Recaptcha] Token solved callback triggered! Token length:', token ? token.length : 0);
                },
                'expired-callback': () => {
                    console.warn('[PhoneAuth Recaptcha] Token expired callback triggered.');
                    clearRecaptcha();
                },
                'error-callback': (err) => {
                    console.error('[PhoneAuth Recaptcha] Error callback triggered:', err);
                }
            });
            console.log('[PhoneAuth] RecaptchaVerifier instance created successfully.');
        } catch (initErr) {
            console.error('[PhoneAuth ERROR] Failed to instantiate RecaptchaVerifier:', initErr);
            throw initErr;
        }

        return recaptchaVerifierRef.current;
    };

    // Step 1: Send Real SMS via Firebase Phone Auth (Google Cloud Blaze)
    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError(null);
        setHint(null);

        if (!name.trim()) {
            setError('Please enter your Name.');
            return;
        }
        if (!phone.trim() || phone.length < 7 || phone.length > 15) {
            setError('Please enter a valid phone number.');
            return;
        }

        const fullPhone = getFullPhone();
        playSound('click');
        playSound('bgm');
        setLoading(true);

        console.group('[PhoneAuth Send OTP]');
        console.log('Phone Target:', fullPhone);
        console.log('Origin URL:', window.location.origin, '| Hostname:', window.location.hostname);
        console.log('Firebase App Config:', {
            projectId: auth.app.options.projectId,
            appId: auth.app.options.appId,
            authDomain: auth.app.options.authDomain,
            storageBucket: auth.app.options.storageBucket,
            apiKeyPrefix: auth.app.options.apiKey ? auth.app.options.apiKey.slice(0, 10) + '...' : 'none'
        });

        try {
            const appVerifier = getFreshRecaptcha();
            console.log('[PhoneAuth] Calling signInWithPhoneNumber(auth,', fullPhone, ', appVerifier)...');
            const confirmation = await signInWithPhoneNumber(auth, fullPhone, appVerifier);
            clearRecaptcha();
            console.log('[PhoneAuth SUCCESS] SMS dispatched! ConfirmationResult received:', confirmation);
            console.groupEnd();
            setConfirmationResult(confirmation);
            setOtp('');
            setStep('otp');
            setResendCooldown(30);
            setHint(`Verification code sent via SMS to ${fullPhone}`);
        } catch (firebaseErr) {
            clearRecaptcha();
            console.error('[PhoneAuth FAILED]', {
                code: firebaseErr.code,
                message: firebaseErr.message,
                customData: firebaseErr.customData,
                stack: firebaseErr.stack
            });
            console.groupEnd();

            if (firebaseErr.code === 'auth/too-many-requests') {
                setError(
                    'Too many SMS attempts for this phone number right now. Please click "Continue with Google" below to sign in instantly via Gmail.'
                );
            } else {
                setError(
                    `Unable to send SMS verification code right now (${firebaseErr.code || 'service unavailable'}). Please click "Continue with Google" below to sign in via Gmail.`
                );
            }
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Verify OTP
    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError(null);

        if (!otp.trim() || otp.length < 4) {
            setError('Please enter the verification code.');
            return;
        }

        const fullPhone = getFullPhone();
        playSound('click');
        setLoading(true);

        console.group('[PhoneAuth Verify OTP]');
        console.log('Verifying for:', fullPhone, 'Code length:', otp.trim().length);
        console.log('ConfirmationResult exists?:', Boolean(confirmationResult));

        try {
            // Case A: Verify with Firebase Phone Auth if confirmationResult exists
            if (confirmationResult) {
                console.log('[PhoneAuth] Verifying code with Firebase Phone Auth...');
                const userCredential = await confirmationResult.confirm(otp.trim());
                console.log('[PhoneAuth SUCCESS] Firebase user verified:', userCredential.user.phoneNumber, userCredential.user.uid);
                const idToken = await userCredential.user.getIdToken();
                console.log('[PhoneAuth] Exchanging Firebase ID token for custom backend JWT...');
                const authData = await loginWithFirebase(idToken, name.trim());
                console.log('[PhoneAuth SUCCESS] Custom JWT issued by backend:', authData.token_type, authData.user?.name);
                console.groupEnd();
                login(authData);
                navigate('/welcome');
                return;
            }

            // Case B: Verify with Backend OTP
            console.log('[PhoneAuth] Verifying code with Backend OTP service...');
            const data = await verifyOtp(fullPhone, otp.trim(), name.trim());
            console.log('[PhoneAuth SUCCESS] Backend OTP verified:', data.user?.name);
            console.groupEnd();
            login(data);
            navigate('/welcome');
        } catch (err) {
            console.error('[PhoneAuth Verify OTP FAILED]:', err);
            console.groupEnd();
            setError(err.response?.data?.detail || err.message || 'Invalid verification code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Resend OTP
    const handleResend = async () => {
        if (resendCooldown > 0 || loading) return;
        playSound('click');
        setLoading(true);
        setError(null);
        try {
            const fullPhone = getFullPhone();
            const appVerifier = getFreshRecaptcha();
            const confirmation = await signInWithPhoneNumber(auth, fullPhone, appVerifier);
            clearRecaptcha();
            setConfirmationResult(confirmation);
            setResendCooldown(30);
            setHint(`Verification code resent via SMS to ${fullPhone}`);
        } catch (err) {
            clearRecaptcha();
            setError(
                'Unable to resend SMS right now. Please click "Verify with Google instead" below to sign in via Gmail.'
            );
        } finally {
            setLoading(false);
        }
    };

    // Alternative / Backup: 1-Click Google Sign-In (linked to Phone ID & Name)
    const handleGoogleSignIn = async () => {
        if (loading || googleLoading) return;
        setError(null);
        setHint(null);

        if (!name.trim()) {
            setError('Please enter your Name first.');
            return;
        }

        if (!phone.trim() || phone.length < 7 || phone.length > 15) {
            setError('Please enter your registered Phone Number first so we can link your club profile.');
            return;
        }

        const fullPhone = getFullPhone();
        const trimmedName = name.trim();
        playSound('click');
        playSound('bgm');
        setGoogleLoading(true);

        console.group('[GoogleAuth Sign-In]');
        console.log('Linking Google Sign-In with Phone ID:', fullPhone, '| Name:', trimmedName);

        try {
            const result = await signInWithPopup(auth, googleProvider);
            const googleUser = result.user;
            console.log('[GoogleAuth SUCCESS] Verified Gmail:', googleUser.email);

            const idToken = await googleUser.getIdToken();
            const authData = await loginWithFirebase(idToken, trimmedName, fullPhone);
            console.log('[GoogleAuth SUCCESS] Custom JWT issued by backend:', authData.user?.name);
            console.groupEnd();
            login(authData);
            navigate('/welcome');
        } catch (err) {
            console.error('[GoogleAuth FAILED]:', err);
            console.groupEnd();
            if (err.code === 'auth/popup-closed-by-user') {
                setError('Google sign-in popup was closed before completing verification.');
            } else {
                setError(
                    err.response?.data?.detail ||
                    err.message ||
                    'Google Sign-In failed. Ensure Google provider is enabled in Firebase Console.'
                );
            }
        } finally {
            setGoogleLoading(false);
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
            className="card-vintage text-center max-w-md mx-auto relative"
            onClick={handleInteraction}
            onFocus={handleInteraction}
        >
            <h1 className="text-4xl font-serif text-amber-50 mb-2 drop-shadow-lg">UCE</h1>
            <h2 className="text-xl text-antique-gold mb-6 font-serif italic">The Ultimate Challenge</h2>

            {/* Error Banner with Direct 1-Click Google Sign-In Prompt */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-900/85 border border-red-500/60 rounded-xl p-3.5 mb-4 text-left shadow-lg"
                >
                    <div className="flex items-start gap-2.5">
                        <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
                        <p className="text-red-200 text-xs font-sans flex-1 leading-relaxed">{error}</p>
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Direct 1-Click Google Sign-In Button on Error */}
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={googleLoading}
                        className="mt-3 w-full py-2 px-3 rounded-lg bg-white hover:bg-gray-100 text-gray-900 font-sans font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer border border-white/40"
                    >
                        {googleLoading ? (
                            <Loader2 className="animate-spin text-gray-700" size={14} />
                        ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                        )}
                        <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google instead'}</span>
                    </button>
                </motion.div>
            )}

            {/* Dev / SMS Status Hint Banner */}
            {hint && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-amber-950/80 border border-antique-gold/50 rounded-lg p-3 mb-4 flex items-center gap-2 text-left"
                >
                    <Smartphone className="text-antique-gold flex-shrink-0" size={16} />
                    <p className="text-amber-200 text-xs font-mono flex-1">{hint}</p>
                </motion.div>
            )}

            <AnimatePresence mode="wait">
                {step === 'phone' ? (
                    /* STEP 1: NAME & PHONE FORM */
                    <motion.form
                        key="phone-step"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onSubmit={handleSendOtp}
                        className="flex flex-col gap-4"
                    >
                        <p className="mb-2 font-sans text-sm text-gray-200">Enter your details to sign in.</p>

                        <input
                            type="text"
                            placeholder="Your Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            disabled={loading}
                            className="input-vintage placeholder:text-gray-400 text-sm"
                        />

                        <div className="flex flex-col text-left">
                            <div className="flex gap-2">
                                <select
                                    value={countryCode}
                                    onChange={(e) => setCountryCode(e.target.value)}
                                    className="input-vintage w-24 px-2 bg-midnight-blue text-amber-50 text-xs"
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
                                        const val = e.target.value.replace(/\D/g, '');
                                        setPhone(val);
                                    }}
                                    required
                                    disabled={loading}
                                    className="input-vintage flex-1 placeholder:text-gray-400 text-sm font-mono"
                                />
                            </div>
                            <small className="text-amber-200/80 font-sans text-xs ml-1 mt-1">
                                Enter your WhatsApp phone number registered with UCE89 Alumni
                            </small>
                        </div>

                        {/* Recaptcha Container for Google Cloud / Firebase - positioned near the button */}
                        <div id="recaptcha-container" className="flex justify-center empty:hidden my-1"></div>

                        <button
                            type="submit"
                            disabled={loading || googleLoading}
                            className="btn-vintage w-full mt-2 text-sm py-2.5 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="animate-spin text-amber-200" size={16} />}
                            <span>{loading ? 'Sending SMS Code...' : 'Send OTP to Phone Number'}</span>
                        </button>

                        {/* Divider: Choose SMS OTP or Google 1-Click Sign-In */}
                        <div className="flex items-center gap-3 my-1">
                            <div className="h-px bg-antique-gold/25 flex-1" />
                            <span className="text-[11px] font-serif uppercase tracking-widest text-antique-gold/80">
                                or verify via gmail
                            </span>
                            <div className="h-px bg-antique-gold/25 flex-1" />
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={loading || googleLoading}
                            className="w-full py-2.5 px-4 rounded bg-white/95 hover:bg-white text-gray-900 font-sans font-semibold text-sm flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition-all border border-antique-gold/40 disabled:opacity-50 cursor-pointer"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
                        </button>
                    </motion.form>
                ) : (
                    /* STEP 2: OTP VERIFICATION FORM */
                    <motion.form
                        key="otp-step"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onSubmit={handleVerifyOtp}
                        className="flex flex-col gap-4 text-left"
                    >
                        <div className="flex items-center justify-between pb-2 border-b border-antique-gold/20">
                            <div>
                                <p className="text-xs font-serif text-antique-gold uppercase tracking-wider">
                                    Verify SMS Code
                                </p>
                                <p className="text-xs text-gray-300 font-mono mt-0.5">{getFullPhone()}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    playSound('click');
                                    clearRecaptcha();
                                    setError(null);
                                    setHint(null);
                                    setOtp('');
                                    setConfirmationResult(null);
                                    setStep('phone');
                                }}
                                className="flex items-center gap-1 text-[11px] text-antique-gold hover:text-white transition-colors"
                            >
                                <ArrowLeft size={12} />
                                <span>Change</span>
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-serif text-amber-100 mb-2">
                                6-Digit SMS Verification Code
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
                            <span>Didn't receive SMS?</span>
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
                                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend SMS'}
                                </span>
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || googleLoading || otp.length < 4}
                            className="btn-vintage w-full mt-2 text-sm py-2.5"
                        >
                            {loading ? 'Verifying Code...' : 'Verify & Enter'}
                        </button>

                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={loading || googleLoading}
                            className="w-full py-2 px-3 rounded bg-white/10 hover:bg-white/20 text-amber-100 font-sans text-xs flex items-center justify-center gap-2 border border-antique-gold/30 transition-all mt-1"
                        >
                            <span>Trouble receiving SMS?</span>
                            <span className="text-antique-gold font-semibold underline">
                                {googleLoading ? 'Opening Google...' : 'Verify with Google instead'}
                            </span>
                        </button>
                    </motion.form>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default Entry;
