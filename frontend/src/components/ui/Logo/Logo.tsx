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
      data-variant={variant}
    >
      <img src={logoHorizontal} alt="Traveling" height={height} style={{ height, width: 'auto', maxWidth: 'none', flexShrink: 0 }} />
    </span>
  )
}
