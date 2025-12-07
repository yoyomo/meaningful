import { useMemo } from 'react'
import SignedInView from './components/SignedInView'
import SignedOutView from './components/SignedOutView'
import { useAuth } from './hooks/useAuth'

const decodeParam = (value: string | null) => {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const App = () => {
  const { user, isUserLoading, error, signIn, isSigningIn, signOut, setUser } = useAuth()
  const invitation = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      inviterName: decodeParam(params.get('from')),
      inviteeName: decodeParam(params.get('to')),
    }
  }, [])

  const handlePhoneSignIn = (userId: string, name: string, phoneNumber: string) => {
    // Set user directly from phone auth
    setUser({
      id: userId,
      name: name || phoneNumber,
      phoneNumber: phoneNumber,
    })
  }

  if (isUserLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          <span>Loading your experience...</span>
        </div>
      </div>
    )
  }

  if (isSigningIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          <span>Redirecting you to Google…</span>
        </div>
      </div>
    )
  }

  if (user) {
    return <SignedInView user={user} onSignOut={signOut} invitation={invitation} />
  }

  return (
    <SignedOutView
      loading={isSigningIn}
      error={error}
      onSignIn={signIn}
      onPhoneSignIn={handlePhoneSignIn}
      invitation={invitation}
    />
  )
}

export default App