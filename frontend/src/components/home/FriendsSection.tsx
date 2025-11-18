import { useState, useEffect } from 'react'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { Card } from '../ui/Card'
import { SectionHeader } from '../ui/SectionHeader'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { StatusMessage } from '../ui/StatusMessage'
import { FriendCard, ContactCard } from '../friends'
import { useContactsSearch } from '../../hooks/useContacts'
import type { Friend, FriendAvailabilityEntry, FriendsAvailableNowData } from '../../hooks/useFriends'
import type { ContactEntry, AppUserEntry } from '../../hooks/useContacts'

type FriendsSectionProps = {
  userId: string
  friendsQuery: UseQueryResult<Friend[], Error>
  availableNowQuery: UseQueryResult<FriendsAvailableNowData, Error>
  addFriendMutation: UseMutationResult<Friend, Error, { sourceType: 'contact'; contactId: string } | { sourceType: 'app_user'; appUserId: string }>
  removeFriendMutation: UseMutationResult<{ removed: boolean }, Error, string>
  importContactsMutation: UseMutationResult<{ success: boolean; imported: number; providers: string[] }, Error, { maxConnections?: number } | void>
  friendIds: Set<string>
}

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
  if (!iso) return 'Soon'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Soon'
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

const resolveAvailabilityReason = (reason?: string) => {
  if (!reason) return 'Status unavailable'
  return FRIEND_AVAILABILITY_REASON_MESSAGES[reason] ?? reason
}

export const FriendsSection = ({
  userId,
  friendsQuery,
  availableNowQuery,
  addFriendMutation,
  removeFriendMutation,
  importContactsMutation,
  friendIds,
}: FriendsSectionProps) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [importFeedback, setImportFeedback] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [friendSuccess, setFriendSuccess] = useState<string | null>(null)
  const [friendError, setFriendError] = useState<string | null>(null)
  const [pendingFriendId, setPendingFriendId] = useState<string | null>(null)
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null)

  const trimmedSearch = searchTerm.trim()
  const hasSearch = trimmedSearch.length > 0
  const contactsSearch = useContactsSearch(userId, trimmedSearch)
  const searchResults = contactsSearch.data ?? { contacts: [], appUsers: [] }
  const friends = friendsQuery.data ?? []
  const friendsAvailability = availableNowQuery.data ?? { available: [], busy: [], unknown: [] }

  const handleAddContactFriend = async (contactId: string, displayName: string) => {
    const friendId = `contact#${contactId}`
    if (friendIds.has(friendId)) return
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
    if (friendIds.has(friendId)) return
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

  useEffect(() => {
    if (!friendSuccess && !friendError) return
    const timer = window.setTimeout(() => {
      setFriendSuccess(null)
      setFriendError(null)
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [friendSuccess, friendError])

  const handleImport = async () => {
    setImportFeedback(null)
    setImportError(null)
    try {
      const result = await importContactsMutation.mutateAsync()
      setImportFeedback(
        result.imported > 0
          ? `Imported ${result.imported} contact${result.imported === 1 ? '' : 's'} from Google.`
          : 'No new contacts found to import.',
      )
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to import contacts')
    }
  }

  return (
    <Card className="px-8 py-10">
      <SectionHeader
        label="Friends"
        title="Find people to connect with"
        description="Import your Google contacts or search for friends already using Meaningful. We'll keep this list private until you invite someone."
        action={
          <>
            <Button variant="secondary" onClick={handleImport} disabled={importContactsMutation.isPending}>
              {importContactsMutation.isPending ? 'Importing…' : 'Import from Google'}
            </Button>
            {importFeedback && <StatusMessage type="success" message={importFeedback} className="text-xs" />}
            {importError && <StatusMessage type="error" message={importError} className="text-xs" />}
          </>
        }
      />

      <div className="min-h-[1.25rem] mt-4">
        {friendSuccess && <StatusMessage type="success" message={friendSuccess} className="text-xs" />}
        {friendError && <StatusMessage type="error" message={friendError} className="text-xs" />}
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Saved friends ({friendsQuery.isLoading ? '…' : friends.length})
        </h4>
        {friendsQuery.isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Loading your friends…</p>
        ) : friendsQuery.isError ? (
          <StatusMessage
            type="error"
            message={friendsQuery.error?.message ?? 'We could not load your friends list.'}
            className="mt-2 text-sm"
          />
        ) : friends.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            You haven't added any friends yet. Import contacts or search the directory to get started.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {friends.map((friend) => (
              <FriendCard
                key={friend.friendId}
                displayName={friend.displayName}
                friendType={friend.friendType}
                emails={friend.emails}
                phoneNumbers={friend.phoneNumbers}
                onRemove={() => handleRemoveFriend(friend.friendId, friend.displayName)}
                isRemoving={pendingRemovalId === friend.friendId || removeFriendMutation.isPending}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Friends available right now</h4>
          <button
            onClick={() => availableNowQuery.refetch()}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-400"
            disabled={availableNowQuery.isFetching}
          >
            {availableNowQuery.isFetching ? 'Checking…' : 'Refresh'}
          </button>
        </div>
        {availableNowQuery.isLoading ? (
          <p className="mt-2 text-sm text-slate-500">Checking everyone's calendars…</p>
        ) : availableNowQuery.isError ? (
          <StatusMessage
            type="error"
            message={availableNowQuery.error?.message ?? 'Unable to determine availability right now.'}
            className="mt-2 text-sm"
          />
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
                      {entry.details && <p className="mt-1 text-xs text-emerald-700">{entry.details}</p>}
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
                      <span className="font-medium">{entry.friend.displayName}</span> {resolveAvailabilityReason(entry.reason)}
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
        <Input
          id="contact-search"
          label="Search by name, email, or phone"
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Start typing to find friends…"
        />
      </div>

      <div className="mt-6">
        {!hasSearch && (
          <p className="text-sm text-slate-500">
            Import your contacts to build a list of friends, or search for someone you already know on Meaningful.
          </p>
        )}

        {hasSearch && contactsSearch.isFetching && <p className="text-sm text-slate-500">Searching your contacts…</p>}

        {hasSearch && contactsSearch.isError && (
          <StatusMessage
            type="error"
            message={contactsSearch.error?.message ?? 'We ran into an issue searching your contacts.'}
            className="text-sm"
          />
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
                  const primaryLabel = contact.names[0] || contact.emails[0] || contact.phones[0] || 'Unnamed contact'
                  const contactFriendId = `contact#${contact.contactId}`
                  const alreadyFriend = friendIds.has(contactFriendId)
                  return (
                    <ContactCard
                      key={contact.contactId}
                      displayName={primaryLabel}
                      emails={contact.emails}
                      phones={contact.phones}
                      source="contact"
                      onAdd={() => handleAddContactFriend(contact.contactId, primaryLabel)}
                      isAdding={pendingFriendId === contactFriendId || addFriendMutation.isPending}
                      isAlreadyAdded={alreadyFriend}
                    />
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
                    <ContactCard
                      key={appUser.userId}
                      displayName={label}
                      emails={appUser.email ? [appUser.email] : []}
                      phones={appUser.phoneNumber ? [appUser.phoneNumber] : []}
                      source="app_user"
                      onAdd={() => handleAddAppUserFriend(appUser.userId, label)}
                      isAdding={pendingFriendId === appFriendId || addFriendMutation.isPending}
                      isAlreadyAdded={alreadyFriend}
                    />
                  )
                })}
              </ul>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

