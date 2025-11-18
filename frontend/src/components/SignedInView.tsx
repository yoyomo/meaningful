import { useEffect, useMemo, useState } from 'react'
import AvailabilitySetup from './AvailabilitySetup'
import HomeDashboard from './home/HomeDashboard'
import { useAvailability } from '../hooks/useAvailability'
import type { AuthUser } from '../hooks/useAuth'
import type { Availability } from '../shared/availability'

type InvitationDetails = {
  inviterName: string | null
  inviteeName: string | null
}

type SignedInViewProps = {
  user: AuthUser
  onSignOut: () => void
  invitation: InvitationDetails
}

const computeHasSavedAvailability = (weeklySlots: Availability['weekly']) => {
  return Object.values(weeklySlots).some((slots) => slots.length > 0)
}

type PageState = 'home' | 'availability' | 'loading'

const SignedInView = ({ user, onSignOut, invitation }: SignedInViewProps) => {
  const {
    data: availability,
    isLoading,
    isRefetching,
  } = useAvailability(user.id)
  const [activePage, setActivePage] = useState<PageState>('loading')

  const hasSavedAvailability = useMemo(() => {
    if (!availability) {
      return false
    }

    if (availability.updatedAt) {
      return true
    }

    return computeHasSavedAvailability(availability.weekly)
  }, [availability])

  useEffect(() => {
    if (isLoading || isRefetching) {
      setActivePage('loading')
      return
    }

    if (hasSavedAvailability) {
      setActivePage('home')
    } else {
      setActivePage('availability')
    }
  }, [isLoading, isRefetching, hasSavedAvailability])

  if (activePage === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
          Loading your workspace…
        </div>
      </div>
    )
  }

  if (activePage === 'availability') {
    return (
      <AvailabilitySetup
        user={user}
        onSignOut={onSignOut}
        onBack={hasSavedAvailability ? () => setActivePage('home') : undefined}
      />
    )
  }

  return (
    <HomeDashboard
      user={user}
      invitation={invitation}
      availability={availability}
      isAvailabilityLoading={isLoading || isRefetching}
      onEditAvailability={() => setActivePage('availability')}
      onSignOut={onSignOut}
    />
  )
}

export default SignedInView

