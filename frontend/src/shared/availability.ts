import { z } from 'zod'
import rawSchema from '@shared/availability_schema.json'

// Schema configuration
const availabilitySchemaConfig = z.object({
  dayKeys: z.array(z.string()),
  timePattern: z.string(),
  defaultTimezone: z.string().optional(),
})

const schemaConfig = availabilitySchemaConfig.parse(rawSchema)

export type DayKey = (typeof schemaConfig.dayKeys)[number]

export const DAY_KEYS = schemaConfig.dayKeys as readonly DayKey[]

export const TIME_PATTERN = new RegExp(schemaConfig.timePattern)

export const DEFAULT_TIMEZONE = schemaConfig.defaultTimezone ?? 'UTC'

// Zod schemas for validation
const timeRangeSchema = z.object({
  start: z.string().regex(TIME_PATTERN, 'Invalid time format'),
  end: z.string().regex(TIME_PATTERN, 'Invalid time format'),
})

const weeklyAvailabilitySchema = z.object({
  sunday: z.array(timeRangeSchema),
  monday: z.array(timeRangeSchema),
  tuesday: z.array(timeRangeSchema),
  wednesday: z.array(timeRangeSchema),
  thursday: z.array(timeRangeSchema),
  friday: z.array(timeRangeSchema),
  saturday: z.array(timeRangeSchema),
})

const availabilitySchema = z.object({
  timezone: z.string().min(1).default(DEFAULT_TIMEZONE),
  weekly: weeklyAvailabilitySchema,
  updatedAt: z.string().nullable().default(null),
})

// TypeScript types inferred from Zod schemas
export type TimeRange = z.infer<typeof timeRangeSchema>
export type WeeklyAvailability = Record<DayKey, TimeRange[]>

// Availability type - using Record for weekly to allow dynamic day keys
export type Availability = {
  timezone: string
  weekly: WeeklyAvailability
  updatedAt: string | null
}

export interface AvailabilityResponse {
  availability: Availability
}

// Helper functions
export const createEmptyWeeklyAvailability = (): WeeklyAvailability => {
  const result = {} as Record<string, TimeRange[]>
  for (const day of DAY_KEYS) {
    result[day] = []
  }
  return result as WeeklyAvailability
}

export const createEmptyAvailability = (): Availability => ({
  timezone: DEFAULT_TIMEZONE,
  weekly: createEmptyWeeklyAvailability(),
  updatedAt: null,
})

// Parse and validate function
export const parseAvailability = (value: unknown): Availability => {
  try {
    const parsed = availabilitySchema.parse(value)
    // Ensure timezone defaults correctly if empty
    return {
      ...parsed,
      timezone: parsed.timezone.trim() || DEFAULT_TIMEZONE,
      updatedAt: parsed.updatedAt?.trim() || null,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid availability payload: ${error.issues.map((e) => e.message).join(', ')}`)
    }
    throw error
  }
}

