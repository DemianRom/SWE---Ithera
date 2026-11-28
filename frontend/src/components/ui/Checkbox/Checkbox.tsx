import React, { useId } from 'react'

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  helperText?: string
  error?: string
  containerClassName?: string
}

export function Checkbox({
  label, helperText, error, containerClassName = '',
  id: idProp, className = '', disabled, required,
  'aria-describedby': describedBy, 'aria-invalid': ariaInvalid, ...rest
}: CheckboxProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const helperId = `${id}-helper`
  const errorId = `${id}-error`
  const hasError = !!error
  const description = [describedBy, helperText && helperId, hasError && errorId]
    .filter(Boolean).join(' ') || undefined

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      <div className="flex items-start gap-2">
        <input
          {...rest}
          type="checkbox"
          id={id}
          disabled={disabled}
          required={required}
          aria-invalid={hasError ? true : ariaInvalid}
          aria-describedby={description}
          className={[
            'mt-0.5 h-4 w-4 shrink-0 accent-[var(--focus-on-light,#005aaf)]',
            'focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-on-light,#005aaf)]',
            'disabled:cursor-not-allowed',
            className,
          ].join(' ')}
        />
        {label && (
          <label htmlFor={id} className="font-body text-sm font-bold text-[var(--text-strong,#073b52)]">
            {label}{required && <span aria-hidden="true" className="ml-1 text-[var(--status-error-text,#8d4034)]">*</span>}
          </label>
        )}
      </div>
      {helperText && <p id={helperId} className="font-body text-xs text-[var(--text-muted,#526c79)]">{helperText}</p>}
      {error && <p id={errorId} role="alert" className="font-body text-xs font-bold text-[var(--status-error-text,#8d4034)]">{error}</p>}
    </div>
  )
}
