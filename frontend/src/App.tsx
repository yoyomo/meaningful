import { useState, useEffect } from 'react'

const STORAGE_KEY = 'meaningful_user'

const App = () => {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem(STORAGE_KEY)
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (e) {
        // Invalid data, clear it
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // Check for auth result in URL params (after Google redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const authResult = urlParams.get('auth')
    const userId = urlParams.get('user_id')
    const userName = urlParams.get('name')
    const error = urlParams.get('error')

    if (authResult === 'success' && userId) {
      const userData = {
        id: userId,
        name: decodeURIComponent(userName || ''),
      }
      setUser(userData)
      // Save to localStorage for persistence
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
    } else if (error) {
      setError(`Authentication failed: ${error}`)
    }
    
    // Clean up URL
    if (authResult || error) {
      window.history.replaceState({}, document.title, '/')
    }
  }, [])

  const handleSignOut = () => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      setError('')

      // Get Google OAuth URL from backend
      const response = await fetch(`${API_URL}/auth/google`)
      const data = await response.json()

      if (data.auth_url) {
        // Redirect to Google OAuth
        window.location.href = data.auth_url
      } else {
        setError('Failed to get authentication URL')
      }
    } catch (err) {
      setError('Failed to initiate Google sign-in')
    } finally {
      setLoading(false)
    }
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome, {user.name}! 🎉</h1>
            <p className="text-gray-600">
              You're successfully signed in with Google. Calendar access ready!
            </p>
          </div>
          
          <div className="space-y-3">
            <button className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
              View Calendar
            </button>
            <button className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium">
              Schedule Call
            </button>
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Meaningful</h1>
        </div>

        {/* Welcome Message */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-3">Hi Sam!</h2>
          <p className="text-gray-600 leading-relaxed">
            Courtney's hoping to hop on a call with you. Sign up with Google to sync your 
            calendar—Meaningful will help find the best time and drop it right in.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-gray-200 rounded-full hover:border-gray-300 hover:shadow-md transition-all duration-200 font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          <span>{loading ? 'Signing in...' : 'Sign up with Google'}</span>
        </button>
      </div>
    </div>
  )
}

export default App