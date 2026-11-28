import React, { useId } from 'react'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helperText?: string
  error?: string
  containerClassName?: string
}

export function Textarea({
  label, helperText, error, containerClassName = '',
  id: idProp, className = '', disabled, required,
  'aria-describedby': describedBy, 'aria-invalid': ariaInvalid, ...rest
}: TextareaProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const helperId = `${id}-helper`
  const errorId = `${id}-error`
  const hasError = !!error
  const description = [describedBy, helperText && helperId, hasError && errorId]
    .filter(Boolean).join(' ') || undefined

  return (
    <div className={`flex flex-col gap-1 ${containerClassName}`}>
      {label && (
        <label htmlFor={id} className="font-body text-sm font-bold text-[var(--text-strong,#073b52)]">
          {label}{required && <span aria-hidden="true" className="ml-1 text-[var(--status-error-text,#8d4034)]">*</span>}
        </label>
      )}
      <textarea
        {...rest}
        id={id}
        disabled={disabled}
        required={required}
        aria-invalid={hasError ? true : ariaInvalid}
        aria-describedby={description}
        className={[
          'w-full min-h-24 px-3 py-2 font-body text-sm text-[var(--text-strong,#073b52)] bg-[var(--surface,#fff)] border rounded-lg transition-colors duration-150 motion-reduce:transition-none',
          'placeholder:text-[var(--text-muted,#526c79)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-on-light,#005aaf)]',
          hasError
            ? 'border-[var(--status-error-text,#8d4034)] bg-[var(--status-error-surface,#faede7)]'
            : 'border-[var(--border-control,#526c79)] focus:border-[var(--focus-on-light,#005aaf)]',
          'disabled:bg-[var(--surface-page,#f4f9fa)] disabled:text-[var(--text-muted,#526c79)] disabled:cursor-not-allowed',
          className,
        ].join(' ')}
      />
      {helperText && <p id={helperId} className="font-body text-xs text-[var(--text-muted,#526c79)]">{helperText}</p>}
      {error && <p id={errorId} role="alert" className="font-body text-xs font-bold text-[var(--status-error-text,#8d4034)]">{error}</p>}
    </div>
  )
}
