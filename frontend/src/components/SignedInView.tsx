type SignedInViewProps = {
  userName: string
  onSignOut: () => void
}

const SignedInView = ({ userName, onSignOut }: SignedInViewProps) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome, {userName}! 🎉</h1>
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
            onClick={onSignOut}
            className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export default SignedInView

