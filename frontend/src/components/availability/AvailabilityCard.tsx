import type { Availability } from '../../shared/availability'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'

type AvailabilityCardProps = {
  availability: Availability
  isLoading: boolean
  onEdit: () => void
}

const formatUpdatedAt = (value: string | null) => {
  if (!value) return 'Not saved yet'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Not saved yet'
  return parsed.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const countAvailabilitySlots = (availability: Availability) =>
  Object.values(availability.weekly).reduce((total, slots) => total + slots.length, 0)

export const AvailabilityCard = ({ availability, isLoading, onEdit }: AvailabilityCardProps) => {
  const slotCount = countAvailabilitySlots(availability)
  const hasAvailabilitySaved = slotCount > 0 || Boolean(availability.updatedAt)

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Weekly availability</h3>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</span>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {isLoading
          ? 'Checking your saved schedule...'
          : hasAvailabilitySaved
            ? `${slotCount} time slot${slotCount === 1 ? '' : 's'} ready to share.`
            : 'No availability saved yet. Set it once and reuse it for every invite.'}
      </p>

      <dl className="mt-6 space-y-2 text-sm text-slate-500">
        <div className="flex justify-between">
          <dt>Timezone</dt>
          <dd className="font-medium text-slate-900">{availability.timezone}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Last updated</dt>
          <dd className="font-medium text-slate-900">{formatUpdatedAt(availability.updatedAt)}</dd>
        </div>
      </dl>

      <Button onClick={onEdit} className="mt-8">
        {hasAvailabilitySaved ? 'Edit availability' : 'Set availability'}
      </Button>
    </Card>
  )
}

