import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Import images directly
import bgStudy from '../assets/images/bg-study.jpg';
import bgCampus from '../assets/images/bg-campus.jpg';
import bgTech from '../assets/images/bg-tech.jpg';
import bgFriends from '../assets/images/bg-friends.jpg';

const images = [bgStudy, bgCampus, bgTech, bgFriends];

const BackgroundSlideshow = () => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % images.length);
        }, 12000); // 12 seconds per slide

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden bg-black">
            <AnimatePresence mode="popLayout">
                <motion.img
                    key={index}
                    src={images[index]}
                    alt="Background"
                    initial={{ opacity: 0, scale: 1.0 }}
                    animate={{ opacity: 1, scale: 1.15 }}
                    exit={{ opacity: 0 }}
                    transition={{
                        opacity: { duration: 2.5, ease: "easeInOut" },
                        scale: { duration: 12, ease: "linear" }
                    }}
                    className="absolute inset-0 w-full h-full object-cover"
                />
            </AnimatePresence>

            {/* Nostalgia Filter Layer: Sepia Overlay */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundColor: '#4e342e',
                    mixBlendMode: 'overlay', // or 'soft-light'
                    opacity: 0.6
                }}
            />

            {/* Film Grain Layer */}
            <div
                className="absolute inset-0 pointer-events-none opacity-[0.15]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    mixBlendMode: 'overlay'
                }}
            />

            {/* Vignette for cinematic focus */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-black/60 pointer-events-none" />
        </div>
    );
};

export default BackgroundSlideshow;
