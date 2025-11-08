import AvailabilitySetup from './AvailabilitySetup'
import type { AuthUser } from '../hooks/useAuth'

type SignedInViewProps = {
  user: AuthUser
  onSignOut: () => void
}

const SignedInView = ({ user, onSignOut }: SignedInViewProps) => {
  return <AvailabilitySetup user={user} onSignOut={onSignOut} />
}

export default SignedInView

