import { useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { StatusMessage } from '../ui/StatusMessage'
import type { Friend, FriendMatchResponse } from '../../hooks/useFriends'
import { useFriendMatch } from '../../hooks/useFriends'

type FriendMatchPlannerProps = {
  userId: string
  friends: Friend[]
}

const CONFIDENCE_COPY: Record<string, string> = {
  high: 'Great news—both calendars were checked.',
  medium: 'Partially verified via Google Calendar.',
  low: 'Based on saved weekly availability only.',
}

const formatSlotRange = (startIso: string | undefined, endIso: string | undefined) => {
  if (!startIso || !endIso) return 'TBD'
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'TBD'

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })

  return `${dateFormatter.format(start)} · ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`
}

const renderParticipants = (match: FriendMatchResponse, selfFriendId?: string) => {
  if (match.participants.length === 0) return null
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {match.participants.map((participant) => (
        <li key={participant.friend.friendId} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="font-medium text-slate-900">
            {participant.friend.friendId === selfFriendId ? 'You' : participant.friend.displayName ?? 'Friend'}
          </div>
          <div className="text-xs text-slate-500">
            {participant.status === 'ready'
              ? `Timezone: ${participant.timezone ?? 'UTC'}${participant.details ? ` · ${participant.details}` : ''}`
              : participant.details ?? participant.status}
          </div>
        </li>
      ))}
    </ul>
  )
}

const renderMatchResult = (match: FriendMatchResponse) => {
  if (!match) return null
  if (match.status === 'matched' && match.recommendation) {
    const confidenceCopy = CONFIDENCE_COPY[match.recommendation.confidence] ?? 'Availability combined from all sources.'
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-emerald-900">Recommended slot</p>
        <p className="text-base text-emerald-800">{formatSlotRange(match.recommendation.start, match.recommendation.end)}</p>
        <p className="text-xs text-emerald-700">{confidenceCopy}</p>
        {match.alternatives.length > 0 && (
          <div className="mt-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Alternatives</p>
            <ul className="mt-1 space-y-1 text-xs">
              {match.alternatives.map((slot) => (
                <li key={`${slot.start}-${slot.end}`}>{formatSlotRange(slot.start, slot.end)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  if (match.status === 'no_overlap') {
    return (
      <StatusMessage
        type="warning"
        message="No overlapping time blocks in that window. Try a wider search or ask your friends to refresh their availability."
        className="mt-4 text-sm"
      />
    )
  }

  if (match.status === 'needs_setup') {
    return (
      <StatusMessage
        type="warning"
        message="Both participants must connect Meaningful + Google Calendar before we can suggest a time."
        className="mt-4 text-sm"
      />
    )
  }

  return null
}

export const FriendMatchPlanner = ({ userId, friends }: FriendMatchPlannerProps) => {
  const eligibleFriends = useMemo(
    () => friends.filter((friend) => friend.friendType === 'app_user' && Boolean(friend.linkedUserId)),
    [friends],
  )
  const [selectedFriendId, setSelectedFriendId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const matchMutation = useFriendMatch(userId)

  const canSubmit = Boolean(selectedFriendId)
  const isDisabled = !canSubmit || matchMutation.isPending

  const handleSubmit = async () => {
    if (!canSubmit) return
    setError(null)
    try {
      await matchMutation.mutateAsync({
        friendIds: [selectedFriendId],
        daysFromNow: 14,
        windowDays: 7,
        durationMinutes: 60,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to match availability right now.')
    }
  }

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Plan ahead</h4>
        <p className="text-base font-semibold text-slate-900">Pick a time to meet in ~2 weeks</p>
        <p className="text-sm text-slate-600">
          Choose one Meaningful friend (with Google Calendar connected) and we'll align their schedule with yours to suggest
          the earliest overlapping slot about 14 days from now.
        </p>
      </div>

      {eligibleFriends.length < 1 ? (
        <StatusMessage
          type="warning"
          message="Add at least one Meaningful friend (with Google Calendar connected) to use this planner."
          className="mt-4 text-sm"
        />
      ) : (
        <>
          <label className="mt-5 block text-sm font-medium text-slate-700">
            Friend
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={selectedFriendId}
              onChange={(event) => setSelectedFriendId(event.target.value)}
            >
              <option value="">Select friend</option>
              {eligibleFriends.map((friend) => (
                <option key={friend.friendId} value={friend.friendId}>
                  {friend.displayName}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={handleSubmit} disabled={isDisabled}>
              {matchMutation.isPending ? 'Matching…' : 'Find time together'}
            </Button>
            <p className="text-xs text-slate-500">Looks ~14 days ahead for a 60-minute window.</p>
          </div>

          {error && <StatusMessage type="error" message={error} className="mt-3 text-sm" />}
          {matchMutation.data && (
            <div className="mt-5 rounded-2xl bg-white/80 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest result</p>
              {renderMatchResult(matchMutation.data)}
              {renderParticipants(matchMutation.data, `user#${userId}`)}
              {matchMutation.data.notes.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
                  {matchMutation.data.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}


