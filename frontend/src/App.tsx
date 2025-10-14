import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Meaningful
        </h1>
        <p className="text-gray-600 mb-6">
          Schedule meaningful calls with your friends
        </p>
        <div className="flex items-center gap-4">
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            onClick={() => setCount((count) => count + 1)}
          >
            Count: {count}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App