import { useAvailability } from '../hooks/useAvailability'
import type { AuthUser } from '../hooks/useAuth'
import { AppHeader } from './ui/AppHeader'
import { Button } from './ui/Button'
import { AvailabilityForm } from './availability/AvailabilityForm'

type AvailabilitySetupProps = {
  user: AuthUser
  onSignOut: () => void
  onBack?: () => void
}

const AvailabilitySetup = ({ user, onSignOut, onBack }: AvailabilitySetupProps) => {
  const {
    data: availability,
    isLoading,
    isSaving,
    saveAvailability,
    saveError,
    wasJustSaved,
  } = useAvailability(user.id)

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        title="Set your availability"
        subtitle={`Hi ${user.name}, let's get your schedule ready.`}
        logo
        onSignOut={onSignOut}
        actions={
          onBack ? (
            <Button variant="text" onClick={onBack} className="text-blue-600 hover:text-blue-700">
              ← Back to home
            </Button>
          ) : undefined
        }
      />

      <main className="max-w-3xl mx-auto px-6 py-10">
        <AvailabilityForm
          availability={availability}
          isLoading={isLoading}
          isSaving={isSaving}
          saveError={saveError}
          wasJustSaved={wasJustSaved}
          onSave={saveAvailability}
        />
      </main>
    </div>
  )
}

export default AvailabilitySetup
