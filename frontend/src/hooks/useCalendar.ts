import { useQuery } from '@tanstack/react-query'
import { API_URL } from '../constants'

export type CalendarEvent = {
  id: string
  summary: string
  start: string
  end: string
  htmlLink?: string
  hangoutLink?: string
  attendees: Array<{
    email: string
    displayName?: string
    responseStatus: string
  }>
}

export type CalendarEventsResponse = {
  events: CalendarEvent[]
}

export const useUpcomingEvents = (userId?: string) => {
  return useQuery<CalendarEventsResponse, Error>({
    queryKey: ['calendar-events', userId],
    enabled: Boolean(userId),
    refetchInterval: 60_000, // Refetch every minute
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user ID')
      }
      const response = await fetch(`${API_URL}/users/${userId}/calendar/events`)
      if (!response.ok) {
        throw new Error('Failed to fetch calendar events')
      }
      return (await response.json()) as CalendarEventsResponse
    },
  })
}

