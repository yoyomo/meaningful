import SignedInView from './components/SignedInView'
import SignedOutView from './components/SignedOutView'
import { useAuth } from './hooks/useAuth'

const App = () => {
  const { user, isUserLoading, error, signIn, isSigningIn, signOut } = useAuth()

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

  if (user) {
    return <SignedInView userName={user.name} onSignOut={signOut} />
  }

  return <SignedOutView loading={isSigningIn} error={error} onSignIn={signIn} />
}

export default App