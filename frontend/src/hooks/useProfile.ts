import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL } from '../constants'
import type { AuthUser } from './useAuth'

export type UserProfile = {
  id: string
  name: string | null
  email: string | null
  phoneNumber: string | null
}

type UpdateProfilePayload = {
  name?: string | null
  phoneNumber?: string | null
}

const ensureStringOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

const parseProfileResponse = (payload: unknown): UserProfile => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid profile response payload')
  }

  const candidate = payload as Record<string, unknown>
  const profileRaw = candidate.profile
  if (!profileRaw || typeof profileRaw !== 'object') {
    throw new Error('Profile payload missing')
  }

  const profile = profileRaw as Record<string, unknown>
  const id = typeof profile.id === 'string' ? profile.id : null
  if (!id) {
    throw new Error('Profile ID missing')
  }

  return {
    id,
    name: ensureStringOrNull(profile.name),
    email: ensureStringOrNull(profile.email),
    phoneNumber: ensureStringOrNull(profile.phoneNumber),
  }
}

export const useProfile = (userId?: string) => {
  return useQuery<UserProfile, Error>({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user ID')
      }

      const response = await fetch(`${API_URL}/users/${userId}/profile`)
      if (!response.ok) {
        throw new Error('Failed to load profile')
      }

      const payload = (await response.json()) as unknown
      return parseProfileResponse(payload)
    },
  })
}

export const useUpdateProfile = (userId?: string) => {
  const queryClient = useQueryClient()

  return useMutation<UserProfile, Error, UpdateProfilePayload>({
    mutationFn: async (updates) => {
      if (!userId) {
        throw new Error('Missing user ID')
      }

      const response = await fetch(`${API_URL}/users/${userId}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Failed to update profile')
      }

      const payload = (await response.json()) as unknown
      return parseProfileResponse(payload)
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(['profile', userId], profile)
      queryClient.setQueryData<AuthUser | null>(['user'], (existing) => {
        if (!existing || existing.id !== profile.id) {
          return existing
        }
        return {
          ...existing,
          name: profile.name ?? existing.name,
          phoneNumber: profile.phoneNumber,
        }
      })
    },
  })
}


