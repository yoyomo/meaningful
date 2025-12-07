import { useState } from 'react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { StatusMessage } from './ui/StatusMessage'
import { Spinner } from './ui/Spinner'
import { API_URL } from '../constants'

type PhoneLoginProps = {
  onSuccess: (userId: string, name: string, phoneNumber: string) => void
  onBack: () => void
}

type Step = 'phone' | 'verify'

export const PhoneLogin = ({ onSuccess, onBack }: PhoneLoginProps) => {
  const [step, setStep] = useState<Step>('phone')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [codeSent, setCodeSent] = useState(false)

  const handleSendCode = async () => {
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/auth/phone/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to send verification code')
      }

      const data = await response.json()
      setCodeSent(true)
      setStep('verify')
      // In development, show the code for testing
      if (data.code) {
        console.log('Verification code (dev only):', data.code)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!code.trim() || code.length !== 6) {
      setError('Please enter the 6-digit verification code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/auth/phone/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          code: code.trim(),
        }),
      })

      if (!response.ok) {
        // Handle redirect response
        if (response.redirected || response.status === 302) {
          const url = new URL(response.url)
          const authResult = url.searchParams.get('auth')
          const userId = url.searchParams.get('user_id')
          const name = url.searchParams.get('name') || ''
          const phone = url.searchParams.get('phone') || phoneNumber.trim()

          if (authResult === 'success' && userId) {
            onSuccess(userId, decodeURIComponent(name), decodeURIComponent(phone))
            return
          } else {
            const errorParam = url.searchParams.get('error')
            throw new Error(errorParam ? decodeURIComponent(errorParam) : 'Authentication failed')
          }
        }

        const errorText = await response.text()
        throw new Error(errorText || 'Verification failed')
      }

      // If not redirected, parse JSON response
      const data = await response.json()
      if (data.user) {
        onSuccess(data.user.id, data.user.name || '', data.user.phoneNumber || phoneNumber.trim())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'phone') {
    return (
      <div className="space-y-4">
        <Input
          id="phone-number"
          label="Phone number"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+1 415 555 0199"
          helperText="We'll send you a verification code via SMS"
          disabled={loading}
        />

        {error && <StatusMessage type="error" message={error} />}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onBack} disabled={loading}>
            Back
          </Button>
          <Button onClick={handleSendCode} disabled={loading || !phoneNumber.trim()}>
            {loading ? (
              <>
                <Spinner />
                Sending...
              </>
            ) : (
              'Send code'
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-600 mb-2">
          We sent a verification code to <strong>{phoneNumber}</strong>
        </p>
        <Input
          id="verification-code"
          label="Verification code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          helperText="Enter the 6-digit code from your SMS"
          disabled={loading}
          maxLength={6}
        />
      </div>

      {error && <StatusMessage type="error" message={error} />}

      <div className="flex gap-3">
        <Button variant="secondary" onClick={() => setStep('phone')} disabled={loading}>
          Change number
        </Button>
        <Button onClick={handleVerifyCode} disabled={loading || code.length !== 6}>
          {loading ? (
            <>
              <Spinner />
              Verifying...
            </>
          ) : (
            'Verify'
          )}
        </Button>
      </div>

      <button
        type="button"
        onClick={handleSendCode}
        disabled={loading}
        className="text-sm text-blue-600 hover:text-blue-700 disabled:text-slate-400"
      >
        Resend code
      </button>
    </div>
  )
}

