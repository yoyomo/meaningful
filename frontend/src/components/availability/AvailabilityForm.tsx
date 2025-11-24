import { useEffect, useMemo, useState } from 'react'
import type { Availability, DayKey } from '../../shared/availability'
import { DAY_KEYS, TIME_PATTERN } from '../../shared/availability'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { StatusMessage } from '../ui/StatusMessage'
import { DaySlotEditor } from './DaySlotEditor'

const HUMAN_READABLE_DAYS: Array<{ key: DayKey; label: string }> = [
  { key: 'sunday', label: 'Sunday' },
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
]

type AvailabilityFormProps = {
  availability: Availability
  isLoading: boolean
  isSaving: boolean
  isRefetching: boolean
  saveError: string | null
  wasJustSaved: boolean
<<<<<<< HEAD
  onSave: (availability: Availability) => Promise<void>
=======
  onSave: (availability: Availability) => Promise<Availability>
>>>>>>> 700ad1848d828870a08e4b78f3058a7e190b7ee6
}

export const AvailabilityForm = ({
  availability,
  isLoading,
  isSaving,
  isRefetching,
  saveError,
  wasJustSaved,
  onSave,
}: AvailabilityFormProps) => {
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
      }, 3000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [wasJustSaved])

  const validationError = useMemo(() => {
    for (const day of DAY_KEYS) {
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

  const unavailableDaysCount = useMemo(
    () => HUMAN_READABLE_DAYS.filter((day) => localAvailability.weekly[day.key].length === 0).length,
    [localAvailability.weekly],
  )

  const handleTimezoneChange = (timezone: string) => {
    setLocalAvailability((current) => ({ ...current, timezone }))
    setIsDirty(true)
    setFormError(null)
  }

  const handleSlotChange = (day: DayKey, index: number, slot: { start: string; end: string }) => {
    setLocalAvailability((current) => ({
      ...current,
      weekly: {
        ...current.weekly,
        [day]: current.weekly[day].map((s, i) => (i === index ? slot : s)),
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
        [day]: [...current.weekly[day], { start: '', end: '' }],
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
        [day]: current.weekly[day].filter((_, i) => i !== index),
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
    const dayIndex = DAY_KEYS.indexOf(day)
    if (dayIndex === -1) return

    setLocalAvailability((current) => {
      const templateSlots = current.weekly[day].map((slot) => ({ ...slot }))
      const updatedWeekly: Availability['weekly'] = { ...current.weekly }

      for (let i = dayIndex + 1; i < DAY_KEYS.length; i += 1) {
        updatedWeekly[DAY_KEYS[i]] = templateSlots.map((slot) => ({ ...slot }))
      }

      return { ...current, weekly: updatedWeekly }
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
      await onSave(localAvailability)
      setFormError(null)
    } catch {
      // error surfaced via saveError
    }
  }

  const combinedError = formError ?? saveError
  const isSaveDisabled = isSaving || !isDirty || validationError !== null

  return (
    <Card className="bg-white rounded-3xl shadow-sm border border-slate-100">
      <div className="px-8 py-6 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Weekly office hours</p>
            <h2 className="text-2xl font-semibold text-slate-900 mt-2">Let friends know when you're free</h2>
            <p className="text-slate-500 mt-2">
              We'll use this schedule along with your Google Calendar to match the best times for Free Now calls.
            </p>
          </div>
          <div className="text-right">
            <Input
              label="Timezone"
              type="text"
              value={localAvailability.timezone}
              onChange={(event) => handleTimezoneChange(event.target.value)}
              placeholder="e.g. America/New_York"
              className="mt-1 w-56"
            />
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center gap-3 text-slate-500">
            <Spinner />
            Loading your availability...
          </div>
        ) : (
          HUMAN_READABLE_DAYS.map((day) => (
            <DaySlotEditor
              key={day.key}
              day={day.key}
              slots={localAvailability.weekly[day.key]}
              onSlotChange={(index, slot) => handleSlotChange(day.key, index, slot)}
              onAddSlot={() => handleAddSlot(day.key)}
              onRemoveSlot={(index) => handleRemoveSlot(day.key, index)}
              onClearDay={() => handleClearDay(day.key)}
              onCopyForward={() => handleCopyDayForward(day.key)}
            />
          ))
        )}
      </div>

      <div className="flex items-center justify-between px-8 py-6 border-t border-slate-100">
        <div className="space-y-1 text-sm text-slate-500">
          <p>
            {unavailableDaysCount === 0
              ? 'All week has availability set.'
              : `${unavailableDaysCount} day${unavailableDaysCount === 1 ? '' : 's'} marked unavailable.`}
          </p>
          {isRefetching && <StatusMessage type="info" message="Refreshing availability…" className="text-xs" />}
          {combinedError && <StatusMessage type="error" message={combinedError} className="text-xs" />}
          {successVisible && <StatusMessage type="success" message="Availability saved!" className="text-xs" />}
        </div>

        <Button onClick={handleSave} disabled={isSaveDisabled}>
          {isSaving && <Spinner size="sm" className="border-white border-t-transparent" />}
          Save changes
        </Button>
      </div>
    </Card>
  )
}

