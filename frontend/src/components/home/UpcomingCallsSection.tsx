import { Card } from '../ui/Card'
import { SectionHeader } from '../ui/SectionHeader'
import { Spinner } from '../ui/Spinner'
import { StatusMessage } from '../ui/StatusMessage'
import { useUpcomingEvents, type CalendarEvent } from '../../hooks/useCalendar'

type UpcomingCallsSectionProps = {
  userId: string
}

const formatEventTime = (dateTimeStr: string): string => {
  try {
    const date = new Date(dateTimeStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }
    
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString()
    if (isTomorrow) {
      return `Tomorrow at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
    }
    
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return dateTimeStr
  }
}

const EventCard = ({ event }: { event: CalendarEvent }) => {
  const attendees = event.attendees.filter((att) => att.responseStatus !== 'declined')
  const otherAttendees = attendees.slice(0, 2) // Show up to 2 other attendees
  
  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-slate-900 truncate">{event.summary}</h4>
          <p className="mt-1 text-sm text-slate-600">{formatEventTime(event.start)}</p>
          {otherAttendees.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              with {otherAttendees.map((att) => att.displayName || att.email.split('@')[0]).join(', ')}
              {attendees.length > 2 && ` +${attendees.length - 2} more`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View
            </a>
          )}
          {event.hangoutLink && (
            <a
              href={event.hangoutLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-green-600 hover:text-green-700"
            >
              Join
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export const UpcomingCallsSection = ({ userId }: UpcomingCallsSectionProps) => {
  const eventsQuery = useUpcomingEvents(userId)

  return (
    <Card className="px-8 py-10">
      <SectionHeader
        label="Upcoming Calls"
        title="Your scheduled meetings"
        description="Calls you've scheduled with friends through Meaningful"
      />

      <div className="mt-8">
        {eventsQuery.isLoading ? (
          <div className="flex items-center gap-3 text-slate-500">
            <Spinner />
            Loading upcoming calls…
          </div>
        ) : eventsQuery.isError ? (
          <StatusMessage
            type="error"
            message={eventsQuery.error?.message ?? 'We could not load your upcoming calls right now.'}
          />
        ) : !eventsQuery.data?.events || eventsQuery.data.events.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">No upcoming calls scheduled yet.</p>
            <p className="text-xs mt-2">Schedule a call with a friend to see it here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {eventsQuery.data.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

