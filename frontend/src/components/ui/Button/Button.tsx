import React from 'react'
import type { ButtonVariant, Size } from '../../../types'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | 'danger'
  size?: Size
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
  children: React.ReactNode
}

const variantClasses: Record<ButtonVariant | 'danger', string> = {
  primary:   'border-[#0878cf] bg-[#0878cf] text-white enabled:hover:bg-[#075eaa] enabled:active:bg-[#064d8b]',
  secondary: 'border-[#79aab9] bg-[#fafdfe] text-[#075675] enabled:hover:bg-[#edf8fa] enabled:active:bg-[#dceff3]',
  outline:   'border-[#79aab9] bg-transparent text-[#075675] enabled:hover:bg-[#edf8fa] enabled:active:bg-[#dceff3]',
  ghost:     'border-transparent bg-transparent text-[#073b52] enabled:hover:bg-[#f0f6f7] enabled:active:bg-[#e2edef]',
  danger:    'border-[#8d4034] bg-[#8d4034] text-white enabled:hover:bg-[#733127] enabled:active:bg-[#5f281f]',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2.5',
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 flex-shrink-0 motion-safe:animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  disabled,
  className = '',
  'aria-busy': ariaBusy,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || isLoading

  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={ariaBusy ?? isLoading}
      className={[
        'relative inline-flex items-center justify-center rounded-[15px] border font-body font-bold',
        'transition-[background-color,border-color,color,box-shadow] duration-150 motion-reduce:transition-none',
        'enabled:hover:shadow-[0_3px_10px_#073b521a] enabled:active:shadow-[inset_0_2px_4px_#073b5220]',
        'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[#005aaf]',
        'disabled:cursor-not-allowed disabled:border-[#d4e3e8] disabled:bg-[#d4e3e8] disabled:text-[#405d69]',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      <span className={`inline-flex items-center justify-center gap-[inherit] ${isLoading ? 'opacity-0' : ''}`}>
        {leftIcon && <span aria-hidden="true" className="inline-flex shrink-0">{leftIcon}</span>}
        {children}
        {rightIcon && <span aria-hidden="true" className="inline-flex shrink-0">{rightIcon}</span>}
      </span>
      {isLoading && <span className="absolute inset-0 flex items-center justify-center"><Spinner /></span>}
    </button>
  )
}
