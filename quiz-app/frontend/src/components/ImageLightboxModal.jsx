import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function ImageLightboxModal({ src, alt, onClose }) {
    useEffect(() => {
        if (!src) return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [src, onClose]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <AnimatePresence>
            {src && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={onClose}
                    className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative inline-flex items-center justify-center max-w-[94vw] max-h-[88vh] cursor-default"
                    >
                        {/* Top-Right Close Cross Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close enlarged image"
                            title="Close"
                            className="absolute -top-3.5 -right-3.5 sm:-top-4 sm:-right-4 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#0b1528] text-amber-200 hover:text-white hover:bg-red-900 border-2 border-antique-gold shadow-2xl flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95"
                        >
                            <X size={20} strokeWidth={2.5} />
                        </button>

                        {/* Enlarged Image */}
                        <img
                            src={src}
                            alt={alt || 'Enlarged Preview'}
                            className="max-w-[92vw] max-h-[85vh] w-auto h-auto object-contain rounded-xl border-2 border-antique-gold/70 shadow-[0_0_50px_rgba(0,0,0,0.9)] select-none block bg-[#070e1c]"
                        />
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
