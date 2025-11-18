import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
  variant?: 'default' | 'dashed'
}

const variantClasses = {
  default: 'rounded-2xl border border-slate-100 bg-white shadow-sm',
  dashed: 'rounded-2xl border border-dashed border-slate-200 bg-slate-100/50',
}

export const Card = ({ children, className = '', variant = 'default' }: CardProps) => {
  return <div className={`${variantClasses[variant]} ${className}`}>{children}</div>
}

