import { Card } from '../ui/Card'

type WelcomeSectionProps = {
  greetingTitle: string
  inviterMessage: string
  userName: string
  showGuide?: boolean
}

export const WelcomeSection = ({ greetingTitle, inviterMessage, userName, showGuide }: WelcomeSectionProps) => {
  return (
    <Card className="px-10 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Welcome</p>
      <h2 className="mt-3 text-4xl font-semibold text-slate-900">{greetingTitle}</h2>
      <p className="mt-4 text-lg text-slate-600 max-w-2xl">
        {inviterMessage}
        {showGuide && (
          <>
            {' '}
            We'll guide you through setting your availability and sending invites when you're ready.
          </>
        )}
      </p>
      <p className="mt-6 text-sm text-slate-400">Signed in as {userName}</p>
    </Card>
  )
}

