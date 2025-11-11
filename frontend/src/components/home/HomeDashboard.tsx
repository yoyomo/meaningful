import type { AuthUser } from '../../hooks/useAuth'
import type { Availability } from '../../shared/availability'

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

const formatUpdatedAt = (value: string | null) => {
  if (!value) {
    return 'Not saved yet'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Not saved yet'
  }

  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const countAvailabilitySlots = (availability: Availability) =>
  Object.values(availability.weekly).reduce((total, slots) => total + slots.length, 0)

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

  const availabilitySlotCount = countAvailabilitySlots(availability)
  const hasAvailabilitySaved = availabilitySlotCount > 0 || Boolean(availability.updatedAt)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600">
            <img src="/logo.svg" alt="Meaningful" className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-blue-600">Meaningful</p>
            <h1 className="text-xl font-semibold text-slate-900">Your catch-up hub</h1>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        <section className="rounded-3xl bg-white border border-slate-100 px-10 py-12 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Welcome</p>
          <h2 className="mt-3 text-4xl font-semibold text-slate-900">{greetingTitle}</h2>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl">
            {inviterMessage}{' '}
            {!invitation.inviterName && (
              <>
                We’ll guide you through setting your availability and sending invites when you’re ready.
              </>
            )}
          </p>
          <p className="mt-6 text-sm text-slate-400">Signed in as {user.name}</p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Weekly availability</h3>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</span>
            </div>

            <p className="mt-4 text-sm text-slate-500">
              {isAvailabilityLoading
                ? 'Checking your saved schedule...'
                : hasAvailabilitySaved
                  ? `${availabilitySlotCount} time slot${availabilitySlotCount === 1 ? '' : 's'} ready to share.`
                  : 'No availability saved yet. Set it once and reuse it for every invite.'}
            </p>

            <dl className="mt-6 space-y-2 text-sm text-slate-500">
              <div className="flex justify-between">
                <dt>Timezone</dt>
                <dd className="font-medium text-slate-900">{availability.timezone}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Last updated</dt>
                <dd className="font-medium text-slate-900">{formatUpdatedAt(availability.updatedAt)}</dd>
              </div>
            </dl>

            <button
              onClick={onEditAvailability}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              {hasAvailabilitySaved ? 'Edit availability' : 'Set availability'}
            </button>
          </article>

          <article className="rounded-2xl border border-dashed border-slate-200 bg-slate-100/50 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Send your first invite</h3>
            <p className="mt-3 text-sm text-slate-600">
              Once your availability is saved we’ll generate a shareable link. Friends can pick a time that fits both
              of you, and we’ll handle the calendar invites automatically.
            </p>
            <div className="mt-6 rounded-2xl bg-white p-4 shadow-inner">
              <p className="text-sm font-medium text-slate-700">What’s next?</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-500">
                <li>• Set or confirm your weekly availability.</li>
                <li>• Invite a friend with a personalized link.</li>
                <li>• Relax while Meaningful books the best time.</li>
              </ul>
            </div>
          </article>
        </section>
      </main>
    </div>
  )
}

export default HomeDashboard
