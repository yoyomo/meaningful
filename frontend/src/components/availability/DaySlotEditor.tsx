import type { DayKey, TimeRange } from '../../shared/availability'
import { Button } from '../ui/Button'

const HUMAN_READABLE_DAYS: Record<DayKey, { label: string; short: string }> = {
  sunday: { label: 'Sunday', short: 'S' },
  monday: { label: 'Monday', short: 'M' },
  tuesday: { label: 'Tuesday', short: 'T' },
  wednesday: { label: 'Wednesday', short: 'W' },
  thursday: { label: 'Thursday', short: 'T' },
  friday: { label: 'Friday', short: 'F' },
  saturday: { label: 'Saturday', short: 'S' },
}

type DaySlotEditorProps = {
  day: DayKey
  slots: TimeRange[]
  onSlotChange: (index: number, slot: TimeRange) => void
  onAddSlot: () => void
  onRemoveSlot: (index: number) => void
  onClearDay: () => void
  onCopyForward: () => void
}

const EMPTY_SLOT: TimeRange = { start: '', end: '' }

export const DaySlotEditor = ({
  day,
  slots,
  onSlotChange,
  onAddSlot,
  onRemoveSlot,
  onClearDay,
  onCopyForward,
}: DaySlotEditorProps) => {
  const dayInfo = HUMAN_READABLE_DAYS[day]
  const isUnavailable = slots.length === 0

  return (
    <div className="flex items-start gap-5">
      <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
        {dayInfo.short}
      </div>

      <div className="flex-1 space-y-2">
        {isUnavailable ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-500">Unavailable</span>
            <Button variant="secondary" onClick={onAddSlot} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100">
              Add hours
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {slots.map((slot, index) => (
              <div key={`${day}-${index}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={slot.start}
                    onChange={(event) => onSlotChange(index, { ...slot, start: event.target.value })}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  <span className="text-slate-400">—</span>
                  <input
                    type="time"
                    value={slot.end}
                    onChange={(event) => onSlotChange(index, { ...slot, end: event.target.value })}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <Button variant="danger" onClick={() => onRemoveSlot(index)} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium">
                  Remove
                </Button>
              </div>
            ))}

            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={onAddSlot} className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100">
                + Add slot
              </Button>
              <button onClick={onClearDay} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                Mark unavailable
              </button>
              <button onClick={onCopyForward} className="text-xs font-medium text-blue-500 hover:text-blue-700">
                Copy forward
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

