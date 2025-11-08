import { useEffect, useMemo, useState } from 'react'
import { UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL } from '../constants'
import { Availability, createEmptyAvailability, parseAvailabilityResponse } from '../shared/availability'

type UseAvailabilityResult = UseQueryResult<Availability, Error> & {
  data: Availability
  saveAvailability: (availability: Availability) => Promise<Availability>
  isSaving: boolean
  saveError: string | null
  wasJustSaved: boolean
  acknowledgeSaved: () => void
}

const resolveInitialAvailability = () => {
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (browserTimezone) {
    return { ...createEmptyAvailability(), timezone: browserTimezone }
  }
  return createEmptyAvailability()
}

export const useAvailability = (userId?: string): UseAvailabilityResult => {
  const queryClient = useQueryClient()
  const [wasJustSaved, setWasJustSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const availabilityQuery = useQuery<Availability, Error>({
    queryKey: ['availability', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const response = await fetch(`${API_URL}/users/${userId}/availability`)
      if (!response.ok) {
        throw new Error('Failed to load availability')
      }

      const payload = (await response.json()) as unknown
      return parseAvailabilityResponse(payload)
    },
    initialData: resolveInitialAvailability,
  })

  const saveMutation = useMutation<Availability, Error, Availability>({
    mutationFn: async (availability: Availability) => {
      if (!userId) {
        throw new Error('Missing user ID')
      }

      const response = await fetch(`${API_URL}/users/${userId}/availability`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timezone: availability.timezone,
          weeklyAvailability: availability.weekly,
        }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Failed to save availability')
      }

      const payload = (await response.json()) as unknown
      return parseAvailabilityResponse(payload)
    },
    onMutate: () => {
      setSaveError(null)
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['availability', userId], data)
      setWasJustSaved(true)
      setSaveError(null)
    },
    onError: (error: Error) => {
      setSaveError(error.message)
    },
  })

  useEffect(() => {
    if (!saveMutation.isError) {
      return undefined
    }
    const timer = window.setTimeout(() => setSaveError(null), 5000)
    return () => window.clearTimeout(timer)
  }, [saveMutation.isError])

  const availability = availabilityQuery.data ?? resolveInitialAvailability()

  return {
    ...availabilityQuery,
    data: availability,
    saveAvailability: (value) => saveMutation.mutateAsync(value),
    isSaving: saveMutation.isPending,
    saveError,
    wasJustSaved,
    acknowledgeSaved: () => setWasJustSaved(false),
  }
}

