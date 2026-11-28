import logoHorizontal from '../../../assets/brand/logo-horizontal.png'

export interface LogoProps {
  /** 'white' para fondos oscuros, 'color' para fondos claros. */
  variant?: 'white' | 'color'
  /** Alto del logotipo en píxeles. */
  height?: number
  className?: string
}

export function Logo({ variant = 'color', height = 36, className = '' }: LogoProps) {
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center ${className}`}
      style={variant === 'white' ? { backgroundColor: '#fff', borderRadius: 8, padding: '2px 6px' } : undefined}
    >
      <img src={logoHorizontal} alt="Traveling" height={height} style={{ height, width: 'auto', maxWidth: 'none', flexShrink: 0 }} />
    </span>
  )
}
