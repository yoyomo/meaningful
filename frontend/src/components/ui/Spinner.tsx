type SpinnerProps = {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
}

export const Spinner = ({ size = 'sm', className = '' }: SpinnerProps) => {
  return (
    <span
      className={`${sizeClasses[size]} animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 ${className}`}
    />
  )
}

