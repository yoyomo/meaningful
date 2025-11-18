import rawSchema from '@shared/availability_schema.json'

type AvailabilitySchemaJson = {
  readonly dayKeys: readonly string[]
  readonly timePattern: string
  readonly defaultTimezone?: string
}

const ensureAvailabilitySchema = (data: unknown): AvailabilitySchemaJson => {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid availability schema payload')
  }

  const { dayKeys, timePattern, defaultTimezone } = data as Record<string, unknown>

  if (!Array.isArray(dayKeys) || dayKeys.some((entry) => typeof entry !== 'string')) {
    throw new Error('Schema dayKeys must be an array of strings')
  }

  if (typeof timePattern !== 'string') {
    throw new Error('Schema timePattern must be a string')
  }

  if (defaultTimezone !== undefined && typeof defaultTimezone !== 'string') {
    throw new Error('Schema defaultTimezone must be a string when provided')
  }

  return {
    dayKeys,
    timePattern,
    defaultTimezone,
  }
}

const availabilitySchema = ensureAvailabilitySchema(rawSchema)

export type DayKey = (typeof availabilitySchema.dayKeys)[number]

export const DAY_KEYS = availabilitySchema.dayKeys as readonly DayKey[]

export const TIME_PATTERN = new RegExp(availabilitySchema.timePattern)

export const DEFAULT_TIMEZONE = availabilitySchema.defaultTimezone ?? 'UTC'

export interface TimeRange {
  start: string
  end: string
}

export type WeeklyAvailability = Record<DayKey, TimeRange[]>

export interface Availability {
  timezone: string
  weekly: WeeklyAvailability
  updatedAt: string | null
}

export interface AvailabilityResponse {
  availability: Availability
}

export const createEmptyWeeklyAvailability = (): WeeklyAvailability =>
  DAY_KEYS.reduce((accumulator, day) => {
    accumulator[day] = []
    return accumulator
  }, {} as WeeklyAvailability)

export const createEmptyAvailability = (): Availability => ({
  timezone: DEFAULT_TIMEZONE,
  weekly: createEmptyWeeklyAvailability(),
  updatedAt: null,
})

const isTimeRange = (value: unknown): value is TimeRange => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>
  return typeof candidate.start === 'string' && typeof candidate.end === 'string'
}

const isWeeklyAvailability = (value: unknown): value is WeeklyAvailability => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return DAY_KEYS.every((day) => {
    const slots = record[day]
    return Array.isArray(slots) && slots.every(isTimeRange)
  })
}

export const parseAvailability = (value: unknown): Availability => {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Availability payload must be an object')
  }

  const candidate = value as Record<string, unknown>
  const timezoneCandidate = candidate.timezone
  const weeklyCandidate = candidate.weekly
  const updatedAtCandidate = candidate.updatedAt

  const timezone =
    typeof timezoneCandidate === 'string' && timezoneCandidate.trim().length > 0
      ? timezoneCandidate.trim()
      : DEFAULT_TIMEZONE

  if (!isWeeklyAvailability(weeklyCandidate)) {
    throw new Error('Weekly availability payload is invalid')
  }

  const updatedAt =
    typeof updatedAtCandidate === 'string' && updatedAtCandidate.trim().length > 0
      ? updatedAtCandidate
      : null

  return {
    timezone,
    weekly: weeklyCandidate,
    updatedAt,
  }
}

