import { useEffect, useMemo, useState } from 'react'
import type { Availability, DayKey, TimeRange } from '../shared/availability'
import { DAY_KEYS, TIME_PATTERN } from '../shared/availability'
import { useAvailability } from '../hooks/useAvailability'
import type { AuthUser } from '../hooks/useAuth'

const DAY_SEQUENCE: DayKey[] = [...DAY_KEYS]

const HUMAN_READABLE_DAYS: Array<{ key: DayKey; label: string; short: string }> = [
  { key: 'sunday', label: 'Sunday', short: 'S' },
  { key: 'monday', label: 'Monday', short: 'M' },
  { key: 'tuesday', label: 'Tuesday', short: 'T' },
  { key: 'wednesday', label: 'Wednesday', short: 'W' },
  { key: 'thursday', label: 'Thursday', short: 'T' },
  { key: 'friday', label: 'Friday', short: 'F' },
  { key: 'saturday', label: 'Saturday', short: 'S' },
]

type AvailabilitySetupProps = {
  user: AuthUser
  onSignOut: () => void
  onBack?: () => void
}

const EMPTY_SLOT: TimeRange = { start: '', end: '' }

const AvailabilitySetup = ({ user, onSignOut, onBack }: AvailabilitySetupProps) => {
  const {
    data: availability,
    isLoading,
    isRefetching,
    isSaving,
    saveAvailability,
    saveError,
    wasJustSaved,
    acknowledgeSaved,
  } = useAvailability(user.id)

  const [localAvailability, setLocalAvailability] = useState<Availability>(availability)
  const [isDirty, setIsDirty] = useState(false)
  const [successVisible, setSuccessVisible] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setLocalAvailability(availability)
    setIsDirty(false)
  }, [availability])

  useEffect(() => {
    if (wasJustSaved) {
      setSuccessVisible(true)
      const timer = setTimeout(() => {
        setSuccessVisible(false)
        acknowledgeSaved()
      }, 3000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [acknowledgeSaved, wasJustSaved])

  const validationError = useMemo(() => {
    for (const day of DAY_SEQUENCE) {
      for (const slot of localAvailability.weekly[day]) {
        if (!TIME_PATTERN.test(slot.start) || !TIME_PATTERN.test(slot.end)) {
          return 'Please enter both a start and end time for every slot.'
        }
        if (slot.start >= slot.end) {
          return 'Start time must be earlier than end time for each slot.'
        }
      }
    }
    return null
  }, [localAvailability.weekly])

  const combinedError = formError ?? saveError

  const handleTimezoneChange = (timezone: string) => {
    setLocalAvailability((current) => ({
      ...current,
      timezone,
    }))
    setIsDirty(true)
    setFormError(null)
  }

  const handleSlotChange = (day: DayKey, index: number, field: keyof TimeRange, value: string) => {
    setLocalAvailability((current) => ({
      ...current,
      weekly: {
        ...current.weekly,
        [day]: current.weekly[day].map((slot, slotIndex) =>
          slotIndex === index
            ? {
                ...slot,
                [field]: value,
              }
            : slot,
        ),
      },
    }))
    setIsDirty(true)
    setFormError(null)
  }

  const handleAddSlot = (day: DayKey) => {
    setLocalAvailability((current) => ({
      ...current,
      weekly: {
        ...current.weekly,
        [day]: [...current.weekly[day], { ...EMPTY_SLOT }],
      },
    }))
    setIsDirty(true)
    setFormError(null)
  }

  const handleRemoveSlot = (day: DayKey, index: number) => {
    setLocalAvailability((current) => ({
      ...current,
      weekly: {
        ...current.weekly,
        [day]: current.weekly[day].filter((_, slotIndex) => slotIndex !== index),
      },
    }))
    setIsDirty(true)
    setFormError(null)
  }

  const handleClearDay = (day: DayKey) => {
    setLocalAvailability((current) => ({
      ...current,
      weekly: {
        ...current.weekly,
        [day]: [],
      },
    }))
    setIsDirty(true)
    setFormError(null)
  }

  const handleCopyDayForward = (day: DayKey) => {
    const dayIndex = DAY_SEQUENCE.indexOf(day)
    if (dayIndex === -1) {
      return
    }

    setLocalAvailability((current) => {
      const templateSlots = current.weekly[day].map((slot) => ({ ...slot }))
      const updatedWeekly: Availability['weekly'] = { ...current.weekly }

      for (let i = dayIndex + 1; i < DAY_SEQUENCE.length; i += 1) {
        const targetDay = DAY_SEQUENCE[i]
        updatedWeekly[targetDay] = templateSlots.map((slot) => ({ ...slot }))
      }

      return {
        ...current,
        weekly: updatedWeekly,
      }
    })
    setIsDirty(true)
    setFormError(null)
  }

  const handleSave = async () => {
    const currentError = validationError
    if (currentError) {
      setFormError(currentError)
      return
    }

    try {
      await saveAvailability(localAvailability)
      setFormError(null)
    } catch (error) {
      // error surfaced via saveError
    }
  }

  const unavailableDaysCount = useMemo(
    () => HUMAN_READABLE_DAYS.filter((day) => localAvailability.weekly[day.key].length === 0).length,
    [localAvailability.weekly],
  )

  const isSaveDisabled = isSaving || !isDirty || validationError !== null

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600">
            <img src="/logo.svg" alt="Meaningful" className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Set your availability</h1>
            <p className="text-sm text-slate-500">Hi {user.name}, let’s get your schedule ready.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 focus:outline-none"
            >
              ← Back to home
            </button>
          )}
          <button
            onClick={onSignOut}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <section className="bg-white rounded-3xl shadow-sm border border-slate-100">
          <div className="px-8 py-6 border-b border-slate-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Weekly office hours</p>
                <h2 className="text-2xl font-semibold text-slate-900 mt-2">Let friends know when you’re free</h2>
                <p className="text-slate-500 mt-2">
                  We’ll use this schedule along with your Google Calendar to match the best times for Free Now calls.
                </p>
              </div>
              <div className="text-right">
                <label className="block text-sm font-medium text-slate-600">Timezone</label>
                <input
                  type="text"
                  value={localAvailability.timezone}
                  onChange={(event) => handleTimezoneChange(event.target.value)}
                  className="mt-1 w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="e.g. America/New_York"
                />
              </div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-6">
            {isLoading ? (
              <div className="flex items-center gap-3 text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
                Loading your availability...
              </div>
            ) : (
              HUMAN_READABLE_DAYS.map((day) => {
                const slots = localAvailability.weekly[day.key]
                const isUnavailable = slots.length === 0

                return (
                  <div key={day.key} className="flex items-start gap-5">
                    <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                      {day.short}
                    </div>

                    <div className="flex-1 space-y-2">
                      {isUnavailable ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-slate-500">Unavailable</span>
                          <button
                            onClick={() => handleAddSlot(day.key)}
                            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                          >
                            Add hours
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {slots.map((slot, index) => (
                            <div
                              key={`${day.key}-${index}`}
                              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={slot.start}
                                  onChange={(event) =>
                                    handleSlotChange(day.key, index, 'start', event.target.value)
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                                <span className="text-slate-400">—</span>
                                <input
                                  type="time"
                                  value={slot.end}
                                  onChange={(event) => handleSlotChange(day.key, index, 'end', event.target.value)}
                                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                />
                              </div>
                              <button
                                onClick={() => handleRemoveSlot(day.key, index)}
                                className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 hover:border-red-200 hover:text-red-500"
                              >
                                Remove
                              </button>
                            </div>
                          ))}

                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleAddSlot(day.key)}
                              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                            >
                              + Add slot
                            </button>
                            <button
                              onClick={() => handleClearDay(day.key)}
                              className="text-xs font-medium text-slate-500 hover:text-slate-900"
                            >
                              Mark unavailable
                            </button>
                            <button
                              onClick={() => handleCopyDayForward(day.key)}
                              className="text-xs font-medium text-blue-500 hover:text-blue-700"
                            >
                              Copy forward
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-between px-8 py-6 border-t border-slate-100">
            <div className="space-y-1 text-sm text-slate-500">
              <p>
                {unavailableDaysCount === 0
                  ? 'All week has availability set.'
                  : `${unavailableDaysCount} day${unavailableDaysCount === 1 ? '' : 's'} marked unavailable.`}
              </p>
              {isRefetching && <p className="text-xs text-blue-500">Refreshing availability…</p>}
              {combinedError && <p className="text-xs text-red-500">{combinedError}</p>}
              {successVisible && <p className="text-xs text-emerald-500">Availability saved!</p>}
            </div>

            <button
              onClick={handleSave}
              disabled={isSaveDisabled}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              Save changes
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

export default AvailabilitySetup

