import React from 'react';

/**
 * Highly polished, traditional representation of Lord Jagannath's Face.
 * Matches the traditional minimalist black background representation with:
 * - Red background mask behind large white circular eyes
 * - Deep black irises and red pupils
 * - Golden/saffron Tilak on forehead
 * - Golden nose ring/nath dot
 * - Elegant smiling mouth line
 */
export const JagannathEyes = ({ className = '', size = 120 }) => {
  const width = size * 1.5;
  const height = size;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 150 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)] ${className}`}
    >
      {/* Black Face Silhouette */}
      <rect x="0" y="0" width="150" height="100" rx="16" fill="#000000" />
      
      {/* Horizontal Red Eye Mask/Band */}
      <path
        d="M 12 48 C 12 36, 138 36, 138 48 C 138 60, 12 60, 12 48 Z"
        fill="#b30000"
      />
      
      {/* Traditional U-shaped Tilak on Forehead */}
      <path
        d="M 70 8 C 70 8, 70 36, 75 36 C 80 36, 80 8, 80 8"
        stroke="#ffd700"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="75" cy="40" r="3.5" fill="#ffd700" />
      <circle cx="75" cy="20" r="3" fill="#b30000" />

      {/* LEFT EYE */}
      <circle cx="42" cy="48" r="18" fill="#ffffff" />
      <circle cx="42" cy="48" r="10" fill="#000000" />
      <circle cx="42" cy="48" r="4.5" fill="#b30000" />
      {/* Reflection shine */}
      <circle cx="38" cy="44" r="2.5" fill="#ffffff" />

      {/* RIGHT EYE */}
      <circle cx="108" cy="48" r="18" fill="#ffffff" />
      <circle cx="108" cy="48" r="10" fill="#000000" />
      <circle cx="108" cy="48" r="4.5" fill="#b30000" />
      {/* Reflection shine */}
      <circle cx="104" cy="44" r="2.5" fill="#ffffff" />

      {/* Golden Nose Pin (Nath) */}
      <circle cx="75" cy="62" r="2.5" fill="#ffd700" />

      {/* Smiling Mouth/Chin Line */}
      <path
        d="M 52 78 Q 75 88 98 78"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
};

/**
 * Traditional Neelachakra Spire Wheel.
 * Redesigned to feature the top spire/crown elements similar to the shared image.
 */
export const Neelachakra = ({ className = '', size = 48 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${className}`}
    >
      {/* Top Spire/Dome Element (Kalasa structure) */}
      <path
        d="M 44 20 C 44 20, 50 2, 50 2 C 50 2, 56 20, 56 20 Z"
        fill="var(--theme-antique-gold)"
      />
      <path
        d="M 38 24 C 38 24, 50 14, 50 14 C 50 14, 62 24, 62 24 Z"
        fill="var(--theme-antique-gold)"
      />
      
      {/* Outer Ring with Wave Crests/Teeth */}
      <circle cx="50" cy="60" r="32" stroke="var(--theme-antique-gold)" strokeWidth="5.5" fill="none" />
      
      {/* Inner Ring */}
      <circle cx="50" cy="60" r="20" stroke="var(--theme-antique-gold)" strokeWidth="3.5" fill="none" />
      
      {/* Center Hub */}
      <circle cx="50" cy="60" r="8" fill="var(--theme-antique-gold)" />

      {/* 8 Spokes radiating to the bottom-centered wheel */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line
          key={angle}
          x1="50"
          y1="60"
          x2={50 + 32 * Math.cos((angle * Math.PI) / 180)}
          y2={60 + 32 * Math.sin((angle * Math.PI) / 180)}
          stroke="var(--theme-antique-gold)"
          strokeWidth="3.5"
        />
      ))}

      {/* Rim Nodes/Teeth matching traditional wheel outer flares */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => (
        <path
          key={`node-${angle}`}
          d={`M ${50 + 32 * Math.cos((angle * Math.PI) / 180)} ${60 + 32 * Math.sin((angle * Math.PI) / 180)} 
             L ${50 + 36 * Math.cos((angle * Math.PI) / 180)} ${60 + 36 * Math.sin((angle * Math.PI) / 180)}`}
          stroke="var(--theme-antique-gold)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
};

/**
 * Traditional Triangular Temple Flag (Patitapabana Bana)
 */
export const TempleFlag = ({ className = '', size = 32 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block ${className}`}
    >
      {/* Flagpole */}
      <line x1="25" y1="10" x2="25" y2="90" stroke="var(--theme-antique-gold)" strokeWidth="4" strokeLinecap="round" />
      
      {/* Triangular Flag */}
      <path
        d="M25,18 L85,38 L25,58 Z"
        fill="#800000"
        stroke="var(--theme-antique-gold)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      
      {/* Sacred Sun Symbol inside the Flag */}
      <circle cx="40" cy="38" r="4" fill="var(--theme-antique-gold)" />
    </svg>
  );
};

// ===== Independence Day Icons =====

export const AshokChakra = ({ size = 60 }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        {/* Outer ring */}
        <circle cx="50" cy="50" r="45" fill="none" stroke="#000080" strokeWidth="3" />
        {/* Inner hub */}
        <circle cx="50" cy="50" r="8" fill="#000080" />
        {/* 24 spokes */}
        {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 15) * (Math.PI / 180);
            const x2 = 50 + 42 * Math.cos(angle);
            const y2 = 50 + 42 * Math.sin(angle);
            return <line key={i} x1="50" y1="50" x2={x2} y2={y2} stroke="#000080" strokeWidth="1.5" />;
        })}
        {/* 24 dots on the rim */}
        {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 15 + 7.5) * (Math.PI / 180);
            const cx = 50 + 42 * Math.cos(angle);
            const cy = 50 + 42 * Math.sin(angle);
            return <circle key={`d${i}`} cx={cx} cy={cy} r="2" fill="#000080" />;
        })}
    </svg>
);

export const TricolorFlag = ({ size = 60 }) => {
    const w = size;
    const h = size * 0.67;
    const stripe = h / 3;
    return (
        <svg width={w} height={h + 10} viewBox={`0 0 ${w} ${h + 10}`} xmlns="http://www.w3.org/2000/svg">
            {/* Flag pole */}
            <rect x="2" y="0" width="3" height={h + 10} fill="#8B4513" rx="1" />
            {/* Saffron stripe */}
            <rect x="6" y="2" width={w - 8} height={stripe} fill="#FF9933" rx="1" />
            {/* White stripe */}
            <rect x="6" y={2 + stripe} width={w - 8} height={stripe} fill="#FFFFFF" />
            {/* Green stripe */}
            <rect x="6" y={2 + stripe * 2} width={w - 8} height={stripe} fill="#138808" rx="1" />
            {/* Mini Ashok Chakra in center */}
            <circle cx={w / 2 + 1} cy={2 + stripe + stripe / 2} r={stripe / 3} fill="none" stroke="#000080" strokeWidth="1" />
            {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 30) * (Math.PI / 180);
                const ccx = w / 2 + 1;
                const ccy = 2 + stripe + stripe / 2;
                const r = stripe / 3 - 1;
                return <line key={i} x1={ccx} y1={ccy} x2={ccx + r * Math.cos(angle)} y2={ccy + r * Math.sin(angle)} stroke="#000080" strokeWidth="0.5" />;
            })}
        </svg>
    );
};
