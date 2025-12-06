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

const AUTH_PENDING_KEY = 'meaningful_auth_pending'
const AUTH_PENDING_MAX_AGE_MS = 5 * 60 * 1000

const readPendingAuth = () => {
  try {
    const raw = sessionStorage.getItem(AUTH_PENDING_KEY)
    if (!raw) {
      return false
    }
    const payload = JSON.parse(raw) as { startedAt: number }
    if (typeof payload.startedAt !== 'number') {
      sessionStorage.removeItem(AUTH_PENDING_KEY)
      return false
    }
    if (Date.now() - payload.startedAt > AUTH_PENDING_MAX_AGE_MS) {
      sessionStorage.removeItem(AUTH_PENDING_KEY)
      return false
    }
    return true
  } catch {
    sessionStorage.removeItem(AUTH_PENDING_KEY)
    return false
  }
}

const collectAuthParams = () => {
  const params = new URLSearchParams(window.location.search)
  const hash = window.location.hash || ''

  const hashPayload = (() => {
    if (!hash) return ''
    const trimmed = hash.startsWith('#') ? hash.substring(1) : hash
    const questionIndex = trimmed.indexOf('?')
    if (questionIndex >= 0) {
      return trimmed.substring(questionIndex + 1)
    }
    return trimmed.includes('=') ? trimmed : ''
  })()

  if (hashPayload) {
    const hashParams = new URLSearchParams(hashPayload)
    hashParams.forEach((value, key) => {
      params.set(key, value)
    })
  }

  return params
}

const readAuthStateFromUrl = (): AuthUrlState & { needsReauth?: boolean } => {
  const urlParams = collectAuthParams()
  const authResult = urlParams.get('auth')
  const userId = urlParams.get('user_id')
  const userName = urlParams.get('name')
  const phoneNumber = urlParams.get('phone')
  const authError = urlParams.get('error')
  const needsReauth = urlParams.get('needs_reauth') === 'true'

  if (authResult === 'success' && userId) {
    return {
      authResult: 'success',
      user: {
        id: userId,
        name: decodeURIComponent(userName || ''),
        phoneNumber: phoneNumber ? decodeURIComponent(phoneNumber) : null,
      },
      error: null,
      needsReauth,
    }
  }

  if (authError) {
    return {
      authResult: 'error',
      user: null,
      error: authError,
      needsReauth: false,
    }
  }

  return {
    authResult: null,
    user: null,
    error: null,
    needsReauth: false,
  }
}

export const useAuth = () => {
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const persistedUser = useMemo(() => readPersistedUser(), [])
  const authUrlState = useMemo(() => readAuthStateFromUrl(), [])
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(authUrlState.user ?? persistedUser)
  const [isInitializing, setIsInitializing] = useState(authUrlState.authResult === 'success')
  const [isRedirectingToGoogle, setIsRedirectingToGoogle] = useState(() => {
    // Check sessionStorage (works for same-tab redirects)
    const hasPendingFlag = readPendingAuth()
    // Also check URL params (works for new-tab redirects)
    const hasAuthParams = authUrlState.authResult !== null || authUrlState.error !== null
    return hasPendingFlag || hasAuthParams
  })

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
    // If we see auth params in URL, we're processing a callback (works for new-tab redirects)
    if (authUrlState.authResult !== null || authUrlState.error !== null) {
      setIsRedirectingToGoogle(true)
    }

    if (authUrlState.authResult === 'success' && authUrlState.user) {
      const userData = authUrlState.user
      
      // If backend indicates we need to re-authenticate (missing refresh token),
      // show error message instead of auto-re-authenticating
      if (authUrlState.needsReauth) {
        setError('Calendar access needs to be re-authorized. Please sign out and sign back in.')
        setIsInitializing(false)
        sessionStorage.removeItem(AUTH_PENDING_KEY)
        setIsRedirectingToGoogle(false)
        return
      }
      
      setCurrentUser(userData)
      queryClient.setQueryData(['user'], userData)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: userData, expiresAt: Date.now() + AUTH_TTL_MS }),
      )
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['user'] })
      setIsInitializing(false)
      sessionStorage.removeItem(AUTH_PENDING_KEY)
      setIsRedirectingToGoogle(false)
    } else if (authUrlState.authResult === 'error' && authUrlState.error) {
      setError(`Authentication failed: ${authUrlState.error}`)
      setIsInitializing(false)
      sessionStorage.removeItem(AUTH_PENDING_KEY)
      setIsRedirectingToGoogle(false)
    } else if (!isInitializing) {
      // No auth params present; ensure initialization flag cleared
      setIsInitializing(false)
    }

    if (authUrlState.authResult || authUrlState.error) {
      const cleanedHash = (() => {
        const currentHash = window.location.hash || ''
        const questionIndex = currentHash.indexOf('?')
        return questionIndex === -1 ? currentHash : currentHash.substring(0, questionIndex)
      })()
      const nextUrl = `${window.location.pathname}${cleanedHash}` || '/'
      window.history.replaceState({}, document.title, nextUrl)
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
  } = useMutation<GoogleAuthResponse, Error, boolean | void>({
    mutationFn: async (forceConsent) => {
      const url = new URL(`${API_URL}/auth/google`)
      if (forceConsent) {
        url.searchParams.set('force_consent', 'true')
      }
      // If we have a current user, pass their ID so backend can check for refresh token
      if (currentUser?.id) {
        url.searchParams.set('user_id', currentUser.id)
      }
      
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error('Auth endpoint error:', response.status, errorText)
        throw new Error(`Failed to get authentication URL: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      if (!data?.auth_url) {
        throw new Error('Invalid response from auth endpoint')
      }
      return data
    },
    onMutate: () => {
      setError('')
      sessionStorage.setItem(AUTH_PENDING_KEY, JSON.stringify({ startedAt: Date.now() }))
      setIsRedirectingToGoogle(true)
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
      sessionStorage.removeItem(AUTH_PENDING_KEY)
      setIsRedirectingToGoogle(false)
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
    isSigningIn: isSigningIn || isRedirectingToGoogle,
    error,
    signOut: handleSignOut,
  }
}

export type { AuthUser }

