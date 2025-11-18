import type { ReactNode } from 'react'

type SectionHeaderProps = {
  label: string
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export const SectionHeader = ({ label, title, description, action, className = '' }: SectionHeaderProps) => {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-4 ${className}`}>
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-blue-600">{label}</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h3>
        {description && <p className="mt-2 max-w-xl text-sm text-slate-600">{description}</p>}
      </div>
      {action && <div className="flex flex-col items-end gap-2">{action}</div>}
    </div>
  )
}

