import { Button } from '../ui/Button'

type FriendCardProps = {
  displayName: string
  friendType: 'contact' | 'app_user'
  emails: string[]
  phoneNumbers: string[]
  onRemove?: () => void
  isRemoving?: boolean
}

export const FriendCard = ({ displayName, friendType, emails, phoneNumbers, onRemove, isRemoving }: FriendCardProps) => {
  return (
    <li className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <div className="font-semibold text-slate-900">{displayName}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
        {friendType === 'contact' ? 'Added from Google contacts' : 'Meaningful member'}
      </div>
      <ul className="mt-2 space-y-1 text-xs text-slate-500">
        {emails.map((email) => (
          <li key={email}>{email}</li>
        ))}
        {phoneNumbers.map((phone) => (
          <li key={phone}>{phone}</li>
        ))}
      </ul>
      {onRemove && (
        <div className="mt-3 flex items-center gap-3">
          <Button variant="danger" onClick={onRemove} disabled={isRemoving}>
            {isRemoving ? 'Removing…' : 'Remove'}
          </Button>
        </div>
      )}
    </li>
  )
}

