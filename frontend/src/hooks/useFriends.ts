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

type FriendsResponse = {
  friends: Friend[]
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
  const friendId = typeof data.friend_id === 'string' ? data.friend_id : typeof data.friendId === 'string' ? data.friendId : null
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


