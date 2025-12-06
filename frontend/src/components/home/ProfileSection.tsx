import { useEffect, useState } from 'react'
import { Card } from '../ui/Card'
import { SectionHeader } from '../ui/SectionHeader'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { StatusMessage } from '../ui/StatusMessage'
import { useProfile, useUpdateProfile } from '../../hooks/useProfile'

type ProfileSectionProps = {
  userId: string
}

export const ProfileSection = ({ userId }: ProfileSectionProps) => {
  const profileQuery = useProfile(userId)
  const updateProfile = useUpdateProfile(userId)
  const [phoneDraft, setPhoneDraft] = useState('')
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profileQuery.data) {
      // Update phone draft when profile data loads or changes
      const phone = profileQuery.data.phoneNumber
      setPhoneDraft(phone && typeof phone === 'string' ? phone : '')
    }
  }, [profileQuery.data])

  useEffect(() => {
    if (!success && !error) return
    const timer = window.setTimeout(() => {
      setSuccess(null)
      setError(null)
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [success, error])

  const phoneDraftNormalized = phoneDraft.trim()
  const profilePhone = profileQuery.data?.phoneNumber ?? ''
  const isDirty = phoneDraftNormalized !== (profilePhone ?? '')

  const handleSave = async () => {
    setSuccess(null)
    setError(null)
    try {
      const result = await updateProfile.mutateAsync({
        phoneNumber: phoneDraftNormalized.length > 0 ? phoneDraftNormalized : null,
      })
      setSuccess(result.phoneNumber ? 'Phone number updated.' : 'Phone number removed from your profile.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.')
    }
  }

  return (
    <Card className="px-8 py-10">
      <SectionHeader
        label="Profile"
        title="Keep your contact info current"
        description="Add a phone number so friends can find you and we can support SMS-based logins and notifications later."
      />

      <div className="mt-8 max-w-lg">
        {profileQuery.isLoading ? (
          <div className="flex items-center gap-3 text-slate-500">
            <Spinner />
            Loading your profile…
          </div>
        ) : profileQuery.isError ? (
          <StatusMessage type="error" message={profileQuery.error?.message ?? 'We could not load your profile just yet.'} />
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (!isDirty) return
              void handleSave()
            }}
          >
            <Input
              id="profile-phone"
              label="Phone number"
              type="tel"
              value={phoneDraft}
              onChange={(event) => setPhoneDraft(event.target.value)}
              placeholder="e.g. +1 415 555 0199"
              helperText="We recommend international format (e.g. +1 415 555 0199). Leave blank to remove it."
            />

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={!isDirty}>
                Save phone
              </Button>
              <button
                type="button"
                onClick={() => setPhoneDraft(profilePhone ?? '')}
                className="text-sm font-medium text-slate-500 hover:text-slate-900"
              >
                Reset
              </button>
            </div>

            <div className="min-h-[1.5rem]">
              {success && <StatusMessage type="success" message={success} />}
              {error && <StatusMessage type="error" message={error} />}
            </div>
          </form>
        )}
      </div>
    </Card>
  )
}

