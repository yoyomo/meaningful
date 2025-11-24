import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, AUTH_TTL_MS, STORAGE_KEY } from '../constants'

type AuthUser = {
  id: string
  name: string
  phoneNumber?: string | null
}

type GoogleAuthResponse = {
  auth_url?: string
}

type AuthUrlState =
  | {
      authResult: 'success'
      user: AuthUser
      error: null
    }
  | {
      authResult: 'error'
      user: null
      error: string
    }
  | {
      authResult: null
      user: null
      error: null
    }

const readPersistedUser = (): AuthUser | null => {
  const savedUser = localStorage.getItem(STORAGE_KEY)
  if (!savedUser) {
    return null
  }

  try {
    const parsed = JSON.parse(savedUser) as { user: AuthUser; expiresAt: number }

    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    const user = parsed.user
    if (!user || typeof user.id !== 'string' || typeof user.name !== 'string') {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return {
      id: user.id,
      name: user.name,
      phoneNumber: typeof user.phoneNumber === 'string' ? user.phoneNumber : null,
    }
  } catch (err) {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

const readAuthStateFromUrl = (): AuthUrlState => {
  const urlParams = new URLSearchParams(window.location.search)
  const authResult = urlParams.get('auth')
  const userId = urlParams.get('user_id')
  const userName = urlParams.get('name')
  const phoneNumber = urlParams.get('phone')
  const authError = urlParams.get('error')

  if (authResult === 'success' && userId) {
    return {
      authResult: 'success',
      user: {
        id: userId,
        name: decodeURIComponent(userName || ''),
        phoneNumber: phoneNumber ? decodeURIComponent(phoneNumber) : null,
      },
      error: null,
    }
  }

  if (authError) {
    return {
      authResult: 'error',
      user: null,
      error: authError,
    }
  }

  return {
    authResult: null,
    user: null,
    error: null,
  }
}

export const useAuth = () => {
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const persistedUser = useMemo(() => readPersistedUser(), [])
  const authUrlState = useMemo(() => readAuthStateFromUrl(), [])
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(authUrlState.user ?? persistedUser)
  const [isInitializing, setIsInitializing] = useState(authUrlState.authResult === 'success')

  const userQuery = useQuery<AuthUser | null>({
    queryKey: ['user'],
    enabled: !isInitializing,
    staleTime: AUTH_TTL_MS,
    gcTime: AUTH_TTL_MS,
    initialData: persistedUser,
    initialDataUpdatedAt: persistedUser ? Date.now() : undefined,
    refetchOnWindowFocus: false,
    queryFn: readPersistedUser,
  })

  useEffect(() => {
    if (authUrlState.authResult === 'success' && authUrlState.user) {
      const userData = authUrlState.user
      setCurrentUser(userData)
      queryClient.setQueryData(['user'], userData)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: userData, expiresAt: Date.now() + AUTH_TTL_MS }),
      )
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['user'] })
      setIsInitializing(false)
    } else if (authUrlState.authResult === 'error' && authUrlState.error) {
      setError(`Authentication failed: ${authUrlState.error}`)
      setIsInitializing(false)
    } else if (!isInitializing) {
      // No auth params present; ensure initialization flag cleared
      setIsInitializing(false)
    }

    if (authUrlState.authResult || authUrlState.error) {
      window.history.replaceState({}, document.title, '/')
    }
  }, [authUrlState, isInitializing, queryClient])

  useEffect(() => {
    if (isInitializing) {
      return
    }

    if (currentUser) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: currentUser, expiresAt: Date.now() + AUTH_TTL_MS }),
      )
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [currentUser, isInitializing])

  const {
    mutate: signIn,
    isPending: isSigningIn,
  } = useMutation<GoogleAuthResponse, Error>({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/auth/google`)

      if (!response.ok) {
        throw new Error('Failed to get authentication URL')
      }

      return response.json()
    },
    onMutate: () => {
      setError('')
    },
    onSuccess: (data) => {
      if (data?.auth_url) {
        window.location.href = data.auth_url
        return
      }

      setError('Failed to get authentication URL')
    },
    onError: () => {
      setError('Failed to initiate Google sign-in')
    },
  })

  const handleSignOut = () => {
    queryClient.setQueryData(['user'], null)
    localStorage.removeItem(STORAGE_KEY)
    setCurrentUser(null)
    setError('')
  }

  return {
    user: currentUser,
    isUserLoading: isInitializing || userQuery.isLoading,
    signIn,
    isSigningIn,
    error,
    signOut: handleSignOut,
  }
}

export type { AuthUser }

