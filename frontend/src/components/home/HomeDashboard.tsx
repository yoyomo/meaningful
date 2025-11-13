import { useEffect, useMemo, useState } from 'react'
import type { AuthUser } from '../../hooks/useAuth'
import { useContactsSearch, useImportContacts } from '../../hooks/useContacts'
import { useProfile, useUpdateProfile } from '../../hooks/useProfile'
import {
  useAddFriend,
  useFriendIdSets,
  useFriends,
  useFriendsAvailableNow,
  useRemoveFriend,
} from '../../hooks/useFriends'
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

const FRIEND_AVAILABILITY_REASON_MESSAGES: Record<string, string> = {
  outside_availability: 'Outside saved availability window',
  calendar_busy: 'Busy on Google Calendar',
  no_linked_meaningful_account: 'No Meaningful account linked',
  google_calendar_disconnected: 'Google Calendar not connected',
  no_availability: 'No weekly availability set',
  user_not_found: 'User record unavailable',
  calendar_check_failed: 'Calendar check failed',
}

const formatDateTimeForDisplay = (iso?: string, timeZone?: string) => {
  if (!iso) {
    return 'Soon'
  }
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return 'Soon'
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }
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

  const availabilitySlotCount = countAvailabilitySlots(availability)
  const hasAvailabilitySaved = availabilitySlotCount > 0 || Boolean(availability.updatedAt)
  const [searchTerm, setSearchTerm] = useState('')
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [phoneDraft, setPhoneDraft] = useState('')
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [friendSuccess, setFriendSuccess] = useState<string | null>(null)
  const [friendError, setFriendError] = useState<string | null>(null)
  const [pendingFriendId, setPendingFriendId] = useState<string | null>(null)
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null)
  const trimmedSearch = useMemo(() => searchTerm.trim(), [searchTerm])

  const contactsSearch = useContactsSearch(user.id, trimmedSearch)
  const { mutateAsync: importContacts, isPending: isImporting } = useImportContacts(user.id)
  const profileQuery = useProfile(user.id)
  const updateProfile = useUpdateProfile(user.id)
  const friendsQuery = useFriends(user.id)
  const addFriendMutation = useAddFriend(user.id)
  const removeFriendMutation = useRemoveFriend(user.id)
  const availableNowQuery = useFriendsAvailableNow(user.id)

  const searchResults = contactsSearch.data ?? { contacts: [], appUsers: [] }
  const hasSearch = trimmedSearch.length > 0
  const profilePhone = profileQuery.data?.phoneNumber ?? ''
  const phoneDraftNormalized = phoneDraft.trim()
  const profileDirty = phoneDraftNormalized !== (profilePhone ?? '')
  const friends = friendsQuery.data ?? []
  const friendIds = useFriendIdSets(friends)
  const friendsAvailability = availableNowQuery.data ?? { available: [], busy: [], unknown: [] }

  const resolveAvailabilityReason = (reason?: string) => {
    if (!reason) {
      return 'Status unavailable'
    }
    return FRIEND_AVAILABILITY_REASON_MESSAGES[reason] ?? reason
  }

  useEffect(() => {
    if (profileQuery.data) {
      setPhoneDraft(profileQuery.data.phoneNumber ?? '')
    }
  }, [profileQuery.data?.phoneNumber])

  useEffect(() => {
    if (!profileSuccess && !profileError) {
      return
    }
    const timer = window.setTimeout(() => {
      setProfileSuccess(null)
      setProfileError(null)
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [profileSuccess, profileError])

  useEffect(() => {
    if (!friendSuccess && !friendError) {
      return
    }
    const timer = window.setTimeout(() => {
      setFriendSuccess(null)
      setFriendError(null)
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [friendSuccess, friendError])

  const handleSaveProfile = async () => {
    setProfileSuccess(null)
    setProfileError(null)
    try {
      const result = await updateProfile.mutateAsync({
        phoneNumber: phoneDraftNormalized.length > 0 ? phoneDraftNormalized : null,
      })
      setProfileSuccess(
        result.phoneNumber ? 'Phone number updated.' : 'Phone number removed from your profile.',
      )
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Failed to update profile.')
    }
  }

  const handleAddContactFriend = async (contactId: string, displayName: string) => {
    const friendId = `contact#${contactId}`
    if (friendIds.has(friendId)) {
      return
    }
    setFriendSuccess(null)
    setFriendError(null)
    setPendingFriendId(friendId)
    try {
      const friend = await addFriendMutation.mutateAsync({ sourceType: 'contact', contactId })
      setFriendSuccess(`Added ${friend.displayName || displayName} to your friends.`)
    } catch (error) {
      setFriendError(error instanceof Error ? error.message : 'Unable to add friend right now.')
    } finally {
      setPendingFriendId(null)
    }
  }

  const handleAddAppUserFriend = async (appUserId: string, displayName: string) => {
    const friendId = `app_user#${appUserId}`
    if (friendIds.has(friendId)) {
      return
    }
    setFriendSuccess(null)
    setFriendError(null)
    setPendingFriendId(friendId)
    try {
      const friend = await addFriendMutation.mutateAsync({ sourceType: 'app_user', appUserId })
      setFriendSuccess(`Added ${friend.displayName || displayName} to your friends.`)
    } catch (error) {
      setFriendError(error instanceof Error ? error.message : 'Unable to add friend right now.')
    } finally {
      setPendingFriendId(null)
    }
  }

  const handleRemoveFriend = async (friendId: string, displayName: string) => {
    setFriendSuccess(null)
    setFriendError(null)
    setPendingRemovalId(friendId)
    try {
      await removeFriendMutation.mutateAsync(friendId)
      setFriendSuccess(`Removed ${displayName} from your friends.`)
    } catch (error) {
      setFriendError(error instanceof Error ? error.message : 'Unable to remove friend right now.')
    } finally {
      setPendingRemovalId(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4">
          <img src="/logo.svg" alt="Meaningful" className="h-10 w-auto" />
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

        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-10 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Profile</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">Keep your contact info current</h3>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Add a phone number so friends can find you and we can support SMS-based logins and notifications later.
              </p>
            </div>
          </div>

          <div className="mt-8 max-w-lg">
            {profileQuery.isLoading ? (
              <div className="flex items-center gap-3 text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
                Loading your profile…
              </div>
            ) : profileQuery.isError ? (
              <p className="text-sm text-red-600">
                {profileQuery.error?.message ?? 'We could not load your profile just yet.'}
              </p>
            ) : (
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!profileDirty || updateProfile.isPending) {
                    return
                  }
                  void handleSaveProfile()
                }}
              >
                <div>
                  <label className="text-sm font-medium text-slate-700" htmlFor="profile-phone">
                    Phone number
                  </label>
                  <input
                    id="profile-phone"
                    type="tel"
                    value={phoneDraft}
                    onChange={(event) => setPhoneDraft(event.target.value)}
                    placeholder="e.g. +1 415 555 0199"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    We recommend international format (e.g. +1 415 555 0199). Leave blank to remove it.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    disabled={!profileDirty || updateProfile.isPending}
                  >
                    {updateProfile.isPending && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    Save phone
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneDraft(profilePhone ?? '')
                    }}
                    className="text-sm font-medium text-slate-500 hover:text-slate-900"
                    disabled={updateProfile.isPending}
                  >
                    Reset
                  </button>
                </div>

                <div className="min-h-[1.5rem]">
                  {profileSuccess && <p className="text-sm text-emerald-600">{profileSuccess}</p>}
                  {profileError && <p className="text-sm text-red-600">{profileError}</p>}
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white px-8 py-10 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Friends</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">Find people to connect with</h3>
              <p className="mt-2 max-w-xl text-sm text-slate-600">
                Import your Google contacts or search for friends already using Meaningful. We’ll keep this list private
                until you invite someone.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={async () => {
                  setImportFeedback(null)
                  setImportError(null)
                  try {
                    const result = await importContacts()
                    setImportFeedback(
                      result.imported > 0
                        ? `Imported ${result.imported} contact${result.imported === 1 ? '' : 's'} from Google.`
                        : 'No new contacts found to import.',
                    )
                  } catch (error) {
                    setImportError(error instanceof Error ? error.message : 'Failed to import contacts')
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full border border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isImporting}
              >
                {isImporting ? 'Importing…' : 'Import from Google'}
              </button>
              {importFeedback && <p className="text-xs text-green-600">{importFeedback}</p>}
              {importError && <p className="text-xs text-red-600">{importError}</p>}
            </div>
            <div className="min-h-[1.25rem]">
              {friendSuccess && <p className="text-xs text-emerald-600">{friendSuccess}</p>}
              {friendError && <p className="text-xs text-red-600">{friendError}</p>}
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Saved friends ({friendsQuery.isLoading ? '…' : friends.length})
            </h4>
            {friendsQuery.isLoading ? (
              <p className="mt-2 text-sm text-slate-500">Loading your friends…</p>
            ) : friendsQuery.isError ? (
              <p className="mt-2 text-sm text-red-600">
                {friendsQuery.error?.message ?? 'We could not load your friends list.'}
              </p>
            ) : friends.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                You haven’t added any friends yet. Import contacts or search the directory to get started.
              </p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {friends.map((friend) => (
                  <li
                    key={friend.friendId}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                  >
                    <div className="font-semibold text-slate-900">{friend.displayName}</div>
                    <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                      {friend.friendType === 'contact' ? 'Added from Google contacts' : 'Meaningful member'}
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                      {friend.emails.map((email) => (
                        <li key={`${friend.friendId}-email-${email}`}>{email}</li>
                      ))}
                      {friend.phoneNumbers.map((phone) => (
                        <li key={`${friend.friendId}-phone-${phone}`}>{phone}</li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        onClick={() => handleRemoveFriend(friend.friendId, friend.displayName)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 hover:border-red-200 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={pendingRemovalId === friend.friendId || removeFriendMutation.isPending}
                      >
                        {pendingRemovalId === friend.friendId ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Friends available right now
              </h4>
              <button
                onClick={() => availableNowQuery.refetch()}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-400"
                disabled={availableNowQuery.isFetching}
              >
                {availableNowQuery.isFetching ? 'Checking…' : 'Refresh'}
              </button>
            </div>
            {availableNowQuery.isLoading ? (
              <p className="mt-2 text-sm text-slate-500">Checking everyone’s calendars…</p>
            ) : availableNowQuery.isError ? (
              <p className="mt-2 text-sm text-red-600">
                {availableNowQuery.error?.message ?? 'Unable to determine availability right now.'}
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                <div>
                  {friendsAvailability.available.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      None of your friends are free right now based on their saved availability and calendars.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {friendsAvailability.available.map((entry) => (
                        <li
                          key={`${entry.friend.friendId}-available`}
                          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold">{entry.friend.displayName}</span>
                            <span className="text-xs uppercase tracking-wide text-emerald-700">
                              {entry.confidence === 'high' ? 'Verified via Google Calendar' : 'Weekly availability'}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-emerald-800">
                            Available until {formatDateTimeForDisplay(entry.availableUntil, entry.timezone)}
                            {entry.timezone ? ` (${entry.timezone})` : ''}
                          </p>
                          {entry.details && (
                            <p className="mt-1 text-xs text-emerald-700">{entry.details}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {friendsAvailability.busy.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Busy</h5>
                    <ul className="mt-2 space-y-2">
                      {friendsAvailability.busy.map((entry) => (
                        <li
                          key={`${entry.friend.friendId}-busy`}
                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-600"
                        >
                          <span className="font-medium text-slate-800">{entry.friend.displayName}</span>{' '}
                          {resolveAvailabilityReason(entry.reason)}
                          {entry.busyUntil && (
                            <>
                              {' '}
                              until {formatDateTimeForDisplay(entry.busyUntil, entry.timezone)}
                            </>
                          )}
                          {entry.nextAvailableAt && (
                            <span className="block text-slate-500">
                              Next free around {formatDateTimeForDisplay(entry.nextAvailableAt, entry.timezone)}
                              {entry.timezone ? ` (${entry.timezone})` : ''}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {friendsAvailability.unknown.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Needs attention</h5>
                    <ul className="mt-2 space-y-2">
                      {friendsAvailability.unknown.map((entry) => (
                        <li
                          key={`${entry.friend.friendId}-unknown`}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900"
                        >
                          <span className="font-medium">{entry.friend.displayName}</span>{' '}
                          {resolveAvailabilityReason(entry.reason)}
                          {entry.details && <span className="block">{entry.details}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-8">
            <label className="text-sm font-medium text-slate-700" htmlFor="contact-search">
              Search by name, email, or phone
            </label>
            <input
              id="contact-search"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Start typing to find friends…"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div className="mt-6">
            {!hasSearch && (
              <p className="text-sm text-slate-500">
                Import your contacts to build a list of friends, or search for someone you already know on Meaningful.
              </p>
            )}

            {hasSearch && contactsSearch.isFetching && (
              <p className="text-sm text-slate-500">Searching your contacts…</p>
            )}

            {hasSearch && contactsSearch.isError && (
              <p className="text-sm text-red-600">
                {contactsSearch.error?.message ?? 'We ran into an issue searching your contacts.'}
              </p>
            )}

            {hasSearch && !contactsSearch.isFetching && !contactsSearch.isError && (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Google contacts ({searchResults.contacts.length})
                  </h4>
                  <ul className="mt-3 space-y-3">
                    {searchResults.contacts.length === 0 && (
                      <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        No contacts matched that search yet. Try importing or adjusting your search.
                      </li>
                    )}
                    {searchResults.contacts.map((contact) => {
                      const primaryLabel =
                        contact.names[0] || contact.emails[0] || contact.phones[0] || 'Unnamed contact'
                      const contactFriendId = `contact#${contact.contactId}`
                      const alreadyFriend = friendIds.has(contactFriendId)
                      return (
                        <li
                          key={contact.contactId}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                        >
                          <p className="font-semibold text-slate-900">{primaryLabel}</p>
                          <ul className="mt-1 space-y-1 text-xs text-slate-500">
                            {contact.emails.map((email) => (
                              <li key={`${contact.contactId}-email-${email}`}>{email}</li>
                            ))}
                            {contact.phones.map((phone) => (
                              <li key={`${contact.contactId}-phone-${phone}`}>{phone}</li>
                            ))}
                          </ul>
                          <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
                            Imported from Google contacts
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <button
                              onClick={() => handleAddContactFriend(contact.contactId, primaryLabel)}
                              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={
                                alreadyFriend ||
                                pendingFriendId === contactFriendId ||
                                addFriendMutation.isPending
                              }
                            >
                              {alreadyFriend
                                ? 'Already added'
                                : pendingFriendId === contactFriendId
                                  ? 'Adding…'
                                  : 'Add to friends'}
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Meaningful directory ({searchResults.appUsers.length})
                  </h4>
                  <ul className="mt-3 space-y-3">
                    {searchResults.appUsers.length === 0 && (
                      <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        No Meaningful users match that search just yet.
                      </li>
                    )}
                    {searchResults.appUsers.map((appUser) => {
                      const label = appUser.name || appUser.email || appUser.phoneNumber || 'Meaningful member'
                      const appFriendId = `app_user#${appUser.userId}`
                      const alreadyFriend = friendIds.has(appFriendId)
                      return (
                        <li
                          key={appUser.userId}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
                        >
                          <p className="font-semibold text-slate-900">{label}</p>
                          <ul className="mt-1 space-y-1 text-xs text-slate-500">
                            {appUser.username && <li>@{appUser.username}</li>}
                            {appUser.email && <li>{appUser.email}</li>}
                            {appUser.phoneNumber && <li>{appUser.phoneNumber}</li>}
                          </ul>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <button
                              onClick={() => handleAddAppUserFriend(appUser.userId, label)}
                              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={
                                alreadyFriend ||
                                pendingFriendId === appFriendId ||
                                addFriendMutation.isPending
                              }
                            >
                              {alreadyFriend
                                ? 'Already added'
                                : pendingFriendId === appFriendId
                                  ? 'Adding…'
                                  : 'Add to friends'}
                            </button>
                          </div>
                          <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
                            Found in Meaningful directory
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default HomeDashboard
