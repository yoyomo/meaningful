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

const SignedInView = ({ user, onSignOut, invitation }: SignedInViewProps) => {
  const availabilityState = useAvailability(user.id)
  const [activePage, setActivePage] = useState<'home' | 'availability'>('home')

  const hasSavedAvailability = useMemo(() => {
    if (!availabilityState.data) {
      return false
    }

    if (availabilityState.data.updatedAt) {
      return true
    }

    return computeHasSavedAvailability(availabilityState.data.weekly)
  }, [availabilityState.data])

  useEffect(() => {
    if (!availabilityState.isLoading && !hasSavedAvailability) {
      setActivePage('availability')
    }
  }, [availabilityState.isLoading, hasSavedAvailability])

  useEffect(() => {
    if (hasSavedAvailability) {
      setActivePage((current) => (current === 'availability' ? 'home' : current))
    }
  }, [hasSavedAvailability])

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
      availability={availabilityState.data}
      isAvailabilityLoading={availabilityState.isLoading || availabilityState.isRefetching}
      onEditAvailability={() => setActivePage('availability')}
      onSignOut={onSignOut}
    />
  )
}

export default SignedInView

