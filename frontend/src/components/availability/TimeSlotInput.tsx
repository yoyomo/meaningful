import type { TimeRange } from '../../shared/availability'
import { Button } from '../ui/Button'

type TimeSlotInputProps = {
  slot: TimeRange
  onChange: (slot: TimeRange) => void
  onRemove: () => void
}

export const TimeSlotInput = ({ slot, onChange, onRemove }: TimeSlotInputProps) => {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          type="time"
          value={slot.start}
          onChange={(event) => onChange({ ...slot, start: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <span className="text-slate-400">—</span>
        <input
          type="time"
          value={slot.end}
          onChange={(event) => onChange({ ...slot, end: event.target.value })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>
      <Button variant="danger" onClick={onRemove} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium">
        Remove
      </Button>
    </div>
  )
}

