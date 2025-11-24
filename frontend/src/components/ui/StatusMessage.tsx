type StatusMessageProps = {
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  className?: string
}

const typeClasses = {
  success: 'text-emerald-600',
  error: 'text-red-600',
  info: 'text-blue-600',
  warning: 'text-amber-600',
}

export const StatusMessage = ({ type, message, className = '' }: StatusMessageProps) => {
  return <p className={`text-sm ${typeClasses[type]} ${className}`}>{message}</p>
}

