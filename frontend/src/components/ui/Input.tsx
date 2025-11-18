import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  helperText?: string
}

export const Input = ({ label, error, helperText, className = '', id, ...props }: InputProps) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`
  const baseClasses =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200'
  const errorClasses = error ? 'border-red-300 focus:border-red-500 focus:ring-red-200' : ''

  return (
    <div>
      {label && (
        <label className="text-sm font-medium text-slate-700" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`${baseClasses} ${errorClasses} ${className} ${label ? 'mt-2' : ''}`}
        {...props}
      />
      {helperText && !error && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

