import { Button } from '../ui/Button'

type ContactCardProps = {
  displayName: string
  emails: string[]
  phones: string[]
  source: 'contact' | 'app_user'
  onAdd?: () => void
  isAdding?: boolean
  isAlreadyAdded?: boolean
}

export const ContactCard = ({
  displayName,
  emails,
  phones,
  source,
  onAdd,
  isAdding,
  isAlreadyAdded,
}: ContactCardProps) => {
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <p className="font-semibold text-slate-900">{displayName}</p>
      <ul className="mt-1 space-y-1 text-xs text-slate-500">
        {emails.map((email) => (
          <li key={email}>{email}</li>
        ))}
        {phones.map((phone) => (
          <li key={phone}>{phone}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
        {source === 'contact' ? 'Imported from Google contacts' : 'Found in Meaningful directory'}
      </p>
      {onAdd && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={onAdd}
            disabled={isAlreadyAdded || isAdding}
            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
          >
            {isAlreadyAdded ? 'Already added' : isAdding ? 'Adding…' : 'Add to friends'}
          </Button>
        </div>
      )}
    </li>
  )
}

