import React, { useId } from 'react'
import type { Size } from '../../../types'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  helperText?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  size?: Size
  containerClassName?: string
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-3 text-sm',
  lg: 'h-12 px-4 text-base',
}

export function Input({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  size = 'md',
  containerClassName = '',
  id: idProp,
  className = '',
  disabled,
  required,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...rest
}: InputProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const helperId = `${id}-helper`
  const errorId = `${id}-error`
  const hasError = !!error
  const description = [describedBy, helperText && helperId, hasError && errorId]
    .filter(Boolean)
    .join(' ') || undefined

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {label && (
        <label htmlFor={id} className="font-body text-sm font-bold text-[#073b52]">
          {label}{required && <span aria-hidden="true" className="ml-1 text-[#8d4034]">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          {...rest}
          id={id}
          disabled={disabled}
          required={required}
          aria-invalid={hasError ? true : ariaInvalid}
          aria-describedby={description}
          className={[
            'w-full font-body text-[#073b52] bg-white border rounded-lg transition-colors duration-150 motion-reduce:transition-none',
            'placeholder:text-[#647b84] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#006bb5]',
            hasError
              ? 'border-[#a44735] bg-[#fffaf8]'
              : 'border-[#a0bbc3] focus:border-[#006bb5]',
            sizeClasses[size],
            'disabled:bg-[#edf4f5] disabled:text-[#536e78] disabled:cursor-not-allowed',
            leftIcon ? 'pl-10' : '',
            rightIcon ? 'pr-10' : '',
            className,
          ].join(' ')}
        />
        {rightIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {rightIcon}
          </span>
        )}
      </div>
      {helperText && <p id={helperId} className="font-body text-xs text-[#476975]">{helperText}</p>}
      {error && <p id={errorId} role="alert" className="font-body text-xs font-bold text-[#8d4034]">{error}</p>}
    </div>
  )
}
