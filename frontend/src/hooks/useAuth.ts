import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL, AUTH_TTL_MS, STORAGE_KEY } from '../constants'

type AuthUser = {
  id: string
  name: string
}

type GoogleAuthResponse = {
  auth_url?: string
}

export const useAuth = () => {
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const userQuery = useQuery<AuthUser | null>({
    queryKey: ['user'],
    staleTime: AUTH_TTL_MS,
    gcTime: AUTH_TTL_MS,
    queryFn: async () => {
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

        return parsed.user
      } catch (err) {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }
    },
  })

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const authResult = urlParams.get('auth')
    const userId = urlParams.get('user_id')
    const userName = urlParams.get('name')
    const authError = urlParams.get('error')

    if (authResult === 'success' && userId) {
      const userData: AuthUser = {
        id: userId,
        name: decodeURIComponent(userName || ''),
      }

      queryClient.setQueryData(['user'], userData)
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: userData, expiresAt: Date.now() + AUTH_TTL_MS })
      )
      setError('')
    } else if (authError) {
      setError(`Authentication failed: ${authError}`)
    }

    if (authResult || authError) {
      window.history.replaceState({}, document.title, '/')
    }
  }, [queryClient])

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
    setError('')
  }

  return {
    user: userQuery.data,
    isUserLoading: userQuery.isLoading,
    signIn,
    isSigningIn,
    error,
    signOut: handleSignOut,
  }
}

export type { AuthUser }

