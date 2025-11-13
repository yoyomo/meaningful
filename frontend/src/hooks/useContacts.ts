import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { API_URL } from '../constants'

export type ContactEntry = {
  contactId: string
  names: string[]
  emails: string[]
  phones: string[]
  source: string
}

export type AppUserEntry = {
  userId: string
  name?: string
  email?: string
  phoneNumber?: string
  username?: string
  source: string
}

export type ContactSearchResult = {
  contacts: ContactEntry[]
  appUsers: AppUserEntry[]
}

const ensureStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry): entry is string => typeof entry === 'string')
}

const parseContactEntry = (input: unknown): ContactEntry | null => {
  if (!input || typeof input !== 'object') {
    return null
  }

  const contact = input as Record<string, unknown>
  const contactId = typeof contact.contactId === 'string' ? contact.contactId : undefined

  if (!contactId) {
    return null
  }

  return {
    contactId,
    names: ensureStringArray(contact.names),
    emails: ensureStringArray(contact.emails),
    phones: ensureStringArray(contact.phones),
    source: typeof contact.source === 'string' ? contact.source : 'google_people',
  }
}

const parseAppUserEntry = (input: unknown): AppUserEntry | null => {
  if (!input || typeof input !== 'object') {
    return null
  }

  const user = input as Record<string, unknown>
  const userId = typeof user.userId === 'string' ? user.userId : undefined
  if (!userId) {
    return null
  }

  return {
    userId,
    name: typeof user.name === 'string' ? user.name : undefined,
    email: typeof user.email === 'string' ? user.email : undefined,
    phoneNumber: typeof user.phoneNumber === 'string' ? user.phoneNumber : undefined,
    username: typeof user.username === 'string' ? user.username : undefined,
    source: typeof user.source === 'string' ? user.source : 'meaningful_directory',
  }
}

const parseSearchResponse = (payload: unknown): ContactSearchResult => {
  if (!payload || typeof payload !== 'object') {
    return { contacts: [], appUsers: [] }
  }

  const data = payload as Record<string, unknown>
  const contacts = Array.isArray(data.contacts) ? data.contacts : []
  const appUsers = Array.isArray(data.appUsers) ? data.appUsers : []

  return {
    contacts: contacts
      .map((entry) => parseContactEntry(entry))
      .filter((entry): entry is ContactEntry => entry !== null),
    appUsers: appUsers
      .map((entry) => parseAppUserEntry(entry))
      .filter((entry): entry is AppUserEntry => entry !== null),
  }
}

export const useContactsSearch = (
  userId: string | undefined,
  query: string,
  includeDirectory = true,
) => {
  const trimmedQuery = query.trim()
  return useQuery<ContactSearchResult, Error>({
    queryKey: ['contacts-search', userId, trimmedQuery, includeDirectory],
    enabled: Boolean(userId) && trimmedQuery.length > 0,
    queryFn: async () => {
      if (!userId) {
        throw new Error('Missing user ID')
      }

      const url = new URL(`${API_URL}/users/${userId}/contacts`)
      url.searchParams.set('query', trimmedQuery)
      if (!includeDirectory) {
        url.searchParams.set('includeDirectory', 'false')
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error('Failed to search contacts')
      }

      const payload = (await response.json()) as unknown
      return parseSearchResponse(payload)
    },
    gcTime: 60 * 1000,
    staleTime: 30 * 1000,
    retry: false,
  })
}

type ImportContactsParams = {
  maxConnections?: number
}

type ImportContactsResponse = {
  success: boolean
  imported: number
  providers: string[]
}

export const useImportContacts = (userId?: string) => {
  const queryClient = useQueryClient()

  return useMutation<ImportContactsResponse, Error, ImportContactsParams | void>({
    mutationFn: async (params) => {
      if (!userId) {
        throw new Error('Missing user ID')
      }

      const response = await fetch(`${API_URL}/users/${userId}/contacts/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxConnections: params && typeof params.maxConnections === 'number' ? params.maxConnections : undefined,
        }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || 'Failed to import contacts')
      }

      const payload = (await response.json()) as unknown
      const parsed = parseImportContactsResponse(payload)
      if (!parsed.success) {
        throw new Error('Failed to import contacts')
      }
      return parsed
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts-search', userId] })
    },
  })
}

const parseImportContactsResponse = (payload: unknown): ImportContactsResponse => {
  if (!payload || typeof payload !== 'object') {
    return { success: false, imported: 0, providers: [] }
  }

  const data = payload as Record<string, unknown>
  return {
    success: Boolean(data.success),
    imported: typeof data.imported === 'number' ? data.imported : 0,
    providers: Array.isArray(data.providers)
      ? data.providers.filter((provider): provider is string => typeof provider === 'string')
      : [],
  }
}


