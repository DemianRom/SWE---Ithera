export interface LogoProps {
  /** 'white' para fondos oscuros, 'color' para fondos claros */
  variant?: 'white' | 'color'
  /** Alto del logotipo en píxeles (el texto escala con él). */
  height?: number
  className?: string
}

/** Marca de Traveling: una ruta entre dos puntos (temporal, hasta tener el logo del equipo). */
export function LogoMark({ size = 36, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="11" fill={onDark ? 'rgba(255,255,255,0.16)' : '#1E6FD9'} />
      <path
        d="M11 28 C 16 17, 24 27, 29 12"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray="0.5 5"
      />
      <circle cx="11" cy="28" r="3.8" fill="#FFFFFF" />
      <circle cx="29" cy="12" r="3.8" fill="#35C56A" />
    </svg>
  )
}

export function Logo({ variant = 'color', height = 36, className = '' }: LogoProps) {
  const onDark = variant === 'white'

  return (
    <span
      role="img"
      aria-label="Traveling"
      className={`inline-flex select-none items-center ${className}`}
      style={{ height, gap: Math.round(height * 0.28) }}
    >
      <LogoMark size={height} onDark={onDark} />
      <span
        aria-hidden="true"
        className="font-heading font-extrabold"
        style={{
          fontSize: Math.round(height * 0.6),
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: onDark ? '#FFFFFF' : '#1E0A4E',
        }}
      >
        Traveling
      </span>
    </span>
  )
}
