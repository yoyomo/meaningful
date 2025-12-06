import type { AuthUser } from '../../hooks/useAuth'
import type { Availability } from '../../shared/availability'
import { AppHeader } from '../ui/AppHeader'
import { Card } from '../ui/Card'
import { WelcomeSection, AvailabilityCard } from '../availability'
import { ProfileSection } from './ProfileSection'
import { FriendsSection } from './FriendsSection'
import { UpcomingCallsSection } from './UpcomingCallsSection'

type InvitationDetails = {
  inviterName: string | null
  inviteeName: string | null
}

type HomeDashboardProps = {
  user: AuthUser
  invitation: InvitationDetails
  availability: Availability
  isAvailabilityLoading: boolean
  onEditAvailability: () => void
  onSignOut: () => void
}

const HomeDashboard = ({
  user,
  invitation,
  availability,
  isAvailabilityLoading,
  onEditAvailability,
  onSignOut,
}: HomeDashboardProps) => {
  const greetingTitle = invitation.inviteeName ? `Hi ${invitation.inviteeName}!` : 'Welcome to Meaningful'
  const inviterMessage = invitation.inviterName
    ? `${invitation.inviterName} invited you to plan a Meaningful call.`
    : 'Plan effortless catch-ups and let us sync the calendars for you.'

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader title="Your catch-up hub" logo onSignOut={onSignOut} />

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        <WelcomeSection
          greetingTitle={greetingTitle}
          inviterMessage={inviterMessage}
          userName={user.name}
          showGuide={!invitation.inviterName}
        />

        <section className="grid gap-6 md:grid-cols-2">
          <AvailabilityCard availability={availability} isLoading={isAvailabilityLoading} onEdit={onEditAvailability} />

          <Card variant="dashed" className="p-6">
            <h3 className="text-lg font-semibold text-slate-900">Send your first invite</h3>
            <p className="mt-3 text-sm text-slate-600">
              Once your availability is saved we'll generate a shareable link. Friends can pick a time that fits both
              of you, and we'll handle the calendar invites automatically.
            </p>
            <div className="mt-6 rounded-2xl bg-white p-4 shadow-inner">
              <p className="text-sm font-medium text-slate-700">What's next?</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-500">
                <li>• Set or confirm your weekly availability.</li>
                <li>• Invite a friend with a personalized link.</li>
                <li>• Relax while Meaningful books the best time.</li>
              </ul>
            </div>
          </Card>
        </section>

        <ProfileSection userId={user.id} />

        <UpcomingCallsSection userId={user.id} />

        <FriendsSection userId={user.id} />
      </main>
    </div>
  )
}

export default HomeDashboard
