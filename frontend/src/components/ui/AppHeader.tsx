import type { ReactNode } from 'react'
import { Button } from './Button'

type AppHeaderProps = {
  title: string
  subtitle?: string
  logo?: boolean
  onSignOut: () => void
  actions?: ReactNode
}

export const AppHeader = ({ title, subtitle, logo = false, onSignOut, actions }: AppHeaderProps) => {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-4">
        {logo && <img src="/logo.svg" alt="Meaningful" className="h-10 w-auto" />}
        <div>
          {logo && <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Meaningful</p>}
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {actions}
        <Button variant="text" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </header>
  )
}

