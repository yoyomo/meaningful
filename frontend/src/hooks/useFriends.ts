import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL } from '../constants'

export type Friend = {
  friendId: string
  friendType: 'contact' | 'app_user'
  referenceId: string
  displayName: string
  emails: string[]
  phoneNumbers: string[]
  linkedUserId?: string | null
  createdAt: string
}

type AddFriendPayload =
  | {
      sourceType: 'contact'
      contactId: string
    }
  | {
      sourceType: 'app_user'
      appUserId: string
    }

export type FriendAvailabilityEntry = {
  friend: {
    friendId: string
    displayName: string
    friendType: 'contact' | 'app_user'
    referenceId: string
    linkedUserId?: string | null
  }
  status: 'available' | 'busy' | 'unknown'
  reason?: string
  details?: string
  confidence?: string
  timezone?: string
  availableUntil?: string
  busyUntil?: string
  nextAvailableAt?: string
}

export type FriendsAvailableNowData = {
  available: FriendAvailabilityEntry[]
  busy: FriendAvailabilityEntry[]
  unknown: FriendAvailabilityEntry[]
  generatedAt?: string
}

const ensureStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry): entry is string => typeof entry === 'string')
}

const parseFriendEntry = (input: unknown): Friend | null => {
  if (!input || typeof input !== 'object') {
    return null
  }

  const data = input as Record<string, unknown>
  const friendId =
    typeof data.friend_id === 'string'
      ? data.friend_id
      : typeof data.friendId === 'string'
        ? data.friendId
        : null
  const friendTypeValue = data.friend_type ?? data.friendType
  const friendType =
    friendTypeValue === 'contact' || friendTypeValue === 'app_user' ? friendTypeValue : null
  const referenceId =
    typeof data.reference_id === 'string'
      ? data.reference_id
      : typeof data.referenceId === 'string'
        ? data.referenceId
        : null
  const displayName =
    typeof data.display_name === 'string'
      ? data.display_name
      : typeof data.displayName === 'string'
        ? data.displayName
        : null
  const createdAt =
    typeof data.created_at === 'string'
      ? data.created_at
      : typeof data.createdAt === 'string'
        ? data.createdAt
        : null

  if (!friendId || !friendType || !referenceId || !displayName || !createdAt) {
    return null
  }

  return {
    friendId,
    friendType,
    referenceId,
    displayName,
    emails: ensureStringArray(data.emails),
    phoneNumbers: ensureStringArray(data.phone_numbers ?? data.phoneNumbers),
    linkedUserId:
      typeof data.linked_user_id === 'string'
        ? data.linked_user_id
        : typeof data.linkedUserId === 'string'
          ? data.linkedUserId
          : null,
    createdAt,
  }
}

const parseFriendsResponse = (payload: unknown): Friend[] => {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const data = payload as Record<string, unknown>
  const friends = Array.isArray(data.friends) ? data.friends : []
  return friends.map(parseFriendEntry).filter((entry): entry is Friend => entry !== null)
}

export const useFriends = (userId?: string) => {
  return useQuery<Friend[], Error>({
    queryKey: ['friends', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user ID')
      }
      const response = await fetch(`${API_URL}/users/${userId}/friends`)
      if (!response.ok) {
        throw new Error('Failed to load friends')
      }
      const payload = (await response.json()) as unknown
      return parseFriendsResponse(payload)
    },
    initialData: [],
  })
}

export const useAddFriend = (userId?: string) => {
  const queryClient = useQueryClient()

  return useMutation<Friend, Error, AddFriendPayload>({
    mutationFn: async (payload) => {
      if (!userId) {
        throw new Error('Missing user ID')
      }

      const response = await fetch(`${API_URL}/users/${userId}/friends`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Failed to add friend')
      }

      const data = (await response.json()) as unknown
      const friends = parseFriendsResponse(data)
      // POST returns single friend; reuse parser
      if (friends.length > 0) {
        return friends[0]
      }

      const friendPayload = (data as { friend?: unknown }).friend
      const singleFriend = parseFriendEntry(friendPayload)
      if (!singleFriend) {
        throw new Error('Invalid friend response payload')
      }
      return singleFriend
    },
    onSuccess: (friend) => {
      queryClient.setQueryData<Friend[]>(['friends', userId], (existing) => {
        if (!existing) {
          return [friend]
        }
        const already = existing.some((entry) => entry.friendId === friend.friendId)
        if (already) {
          return existing
        }
        return [friend, ...existing]
      })
      queryClient.invalidateQueries({ queryKey: ['friends', userId] })
    },
  })
}

export const useRemoveFriend = (userId?: string) => {
  const queryClient = useQueryClient()

  return useMutation<{ removed: boolean }, Error, string>({
    mutationFn: async (friendId) => {
      if (!userId) {
        throw new Error('Missing user ID')
      }

      const response = await fetch(`${API_URL}/users/${userId}/friends/${encodeURIComponent(friendId)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Failed to remove friend')
      }

      const payload = (await response.json()) as unknown
      if (!payload || typeof payload !== 'object') {
        return { removed: true }
      }

      const removed = Boolean((payload as Record<string, unknown>).removed)
      return { removed }
    },
    onSuccess: (_, friendId) => {
      queryClient.setQueryData<Friend[]>(['friends', userId], (existing) => {
        if (!existing) {
          return existing
        }
        return existing.filter((friend) => friend.friendId !== friendId)
      })
      queryClient.invalidateQueries({ queryKey: ['friends', userId] })
    },
  })
}

export const useFriendIdSets = (friends: Friend[] | undefined) => {
  return useMemo(() => {
    const ids = new Set<string>()
    if (!friends) {
      return ids
    }
    for (const friend of friends) {
      ids.add(friend.friendId)
    }
    return ids
  }, [friends])
}

const parseAvailabilityEntry = (input: unknown): FriendAvailabilityEntry | null => {
  if (!input || typeof input !== 'object') {
    return null
  }

  const data = input as Record<string, unknown>
  const friendRaw = data.friend
  if (!friendRaw || typeof friendRaw !== 'object') {
    return null
  }

  const friendData = friendRaw as Record<string, unknown>
  const friendId = typeof friendData.friendId === 'string' ? friendData.friendId : null
  const displayName = typeof friendData.displayName === 'string' ? friendData.displayName : null
  const friendTypeValue = friendData.friendType
  const friendType =
    friendTypeValue === 'contact' || friendTypeValue === 'app_user'
      ? (friendTypeValue as 'contact' | 'app_user')
      : null

  if (!friendId || !displayName || !friendType) {
    return null
  }

  const availabilityEntry: FriendAvailabilityEntry = {
    friend: {
      friendId,
      displayName,
      friendType,
      referenceId:
        typeof friendData.referenceId === 'string'
          ? friendData.referenceId
          : typeof friendData.reference_id === 'string'
            ? friendData.reference_id
            : '',
      linkedUserId:
        typeof friendData.linkedUserId === 'string'
          ? friendData.linkedUserId
          : typeof friendData.linked_user_id === 'string'
            ? friendData.linked_user_id
            : null,
    },
    status:
      data.status === 'available' || data.status === 'busy' || data.status === 'unknown'
        ? (data.status as 'available' | 'busy' | 'unknown')
        : 'unknown',
    reason: typeof data.reason === 'string' ? data.reason : undefined,
    details: typeof data.details === 'string' ? data.details : undefined,
    confidence: typeof data.confidence === 'string' ? data.confidence : undefined,
    timezone: typeof data.timezone === 'string' ? data.timezone : undefined,
    availableUntil: typeof data.availableUntil === 'string' ? data.availableUntil : undefined,
    busyUntil: typeof data.busyUntil === 'string' ? data.busyUntil : undefined,
    nextAvailableAt: typeof data.nextAvailableAt === 'string' ? data.nextAvailableAt : undefined,
  }

  return availabilityEntry
}

const parseAvailableNowResponse = (payload: unknown): FriendsAvailableNowData => {
  if (!payload || typeof payload !== 'object') {
    return { available: [], busy: [], unknown: [] }
  }

  const data = payload as Record<string, unknown>
  const availableRaw = Array.isArray(data.available) ? data.available : []
  const busyRaw = Array.isArray(data.busy) ? data.busy : []
  const unknownRaw = Array.isArray(data.unknown) ? data.unknown : []

  return {
    available: availableRaw.map(parseAvailabilityEntry).filter((entry): entry is FriendAvailabilityEntry => entry !== null),
    busy: busyRaw.map(parseAvailabilityEntry).filter((entry): entry is FriendAvailabilityEntry => entry !== null),
    unknown: unknownRaw.map(parseAvailabilityEntry).filter((entry): entry is FriendAvailabilityEntry => entry !== null),
    generatedAt: typeof data.generatedAt === 'string' ? data.generatedAt : undefined,
  }
}

export const useFriendsAvailableNow = (userId?: string) => {
  return useQuery<FriendsAvailableNowData, Error>({
    queryKey: ['friends-available-now', userId],
    enabled: Boolean(userId),
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user ID')
      }
      const response = await fetch(`${API_URL}/users/${userId}/friends/available-now`)
      if (!response.ok) {
        throw new Error('Failed to evaluate friend availability')
      }
      const payload = (await response.json()) as unknown
      return parseAvailableNowResponse(payload)
    },
    initialData: { available: [], busy: [], unknown: [] },
  })
}


