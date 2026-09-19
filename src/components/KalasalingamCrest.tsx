import React from 'react';

export function KalasalingamCrest({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Kalasalingam University Emblem"
    >
      <defs>
        <radialGradient id="crestSunGlow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="60%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </radialGradient>
        <linearGradient id="crestShieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id="goldRim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#D97706" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
      </defs>

      {/* Outer Golden Border Shield */}
      <path
        d="M50 4 C72 4 88 12 88 32 C88 64 50 94 50 94 C50 94 12 64 12 32 C12 12 28 4 50 4 Z"
        fill="url(#goldRim)"
        stroke="#B45309"
        strokeWidth="1.5"
      />

      {/* Inner Deep Navy Shield */}
      <path
        d="M50 8 C69 8 83 15 83 33 C83 61 50 88 50 88 C50 88 17 61 17 33 C17 15 31 8 50 8 Z"
        fill="url(#crestShieldGrad)"
      />

      {/* Sun Rays & Rising Sun */}
      <circle cx="50" cy="38" r="14" fill="url(#crestSunGlow)" />
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
        <line
          key={deg}
          x1="50"
          y1="38"
          x2={50 + 20 * Math.cos((deg * Math.PI) / 180)}
          y2={38 + 20 * Math.sin((deg * Math.PI) / 180)}
          stroke="#FDE047"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      ))}

      {/* Temple Gopuram / Tower Silhouette */}
      <path
        d="M45 42 L55 42 L53 32 L47 32 Z M47 32 L53 32 L51 26 L49 26 Z M49 26 L51 26 L50 22 Z"
        fill="#FEF3C7"
      />

      {/* Open Book of Knowledge */}
      <path
        d="M32 54 Q48 50 50 56 Q52 50 68 54 L66 68 Q52 64 50 69 Q48 64 34 68 Z"
        fill="#FFFFFF"
        stroke="#1E293B"
        strokeWidth="1"
      />
      <line x1="50" y1="56" x2="50" y2="69" stroke="#94A3B8" strokeWidth="1" />
      <path d="M37 57 Q45 54 48 58" stroke="#64748B" strokeWidth="0.8" fill="none" />
      <path d="M38 61 Q45 58 48 62" stroke="#64748B" strokeWidth="0.8" fill="none" />
      <path d="M52 58 Q55 54 63 57" stroke="#64748B" strokeWidth="0.8" fill="none" />
      <path d="M52 62 Q55 58 62 61" stroke="#64748B" strokeWidth="0.8" fill="none" />

      {/* Sacred Flame / Lamp at Center */}
      <path
        d="M50 46 C47 50 49 53 50 54 C51 53 53 50 50 46 Z"
        fill="#EF4444"
      />
      <path
        d="M50 48 C48.5 51 49.5 53 50 53.5 C50.5 53 51.5 51 50 48 Z"
        fill="#FBBF24"
      />

      {/* Lower Ribbon Banner with University Colors */}
      <path
        d="M20 74 Q50 82 80 74 L82 81 Q50 89 18 81 Z"
        fill="#DC2626"
        stroke="#991B1B"
        strokeWidth="1"
      />
      <text
        x="50"
        y="79"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="5"
        fontWeight="bold"
        letterSpacing="0.5"
      >
        KARE
      </text>
    </svg>
  );
}
