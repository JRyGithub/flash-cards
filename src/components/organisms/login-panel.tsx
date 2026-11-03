"use client"

import { MailCheck } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useActionState, useId, useState } from "react"
import { useFormStatus } from "react-dom"

import {
  type EmailCodeState,
  type MagicLinkState,
  sendMagicLink,
  signInWithGithub,
  verifyEmailCode,
} from "@/app/actions/auth"
import { Button } from "@/components/atoms/button"
import { Input } from "@/components/atoms/input"
import { Separator } from "@/components/atoms/separator"
import { Spinner } from "@/components/atoms/spinner"
import { FormField } from "@/components/molecules/form-field"

const ERRORS: Record<string, string> = {
  forbidden: "That account isn't allowed to use this app.",
  link: "That sign-in link is invalid or has expired. Please request a new one.",
  oauth: "GitHub sign-in couldn't be started. Please try again.",
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-current">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.56-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

function SubmitButton({ children, variant }: { children: React.ReactNode; variant?: "outline" }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant={variant} className="w-full" disabled={pending}>
      {pending && <Spinner />}
      {children}
    </Button>
  )
}

export function LoginPanel() {
  const params = useSearchParams()
  // Remounting the options resets the email step when the user wants to start over.
  const [attempt, setAttempt] = useState(0)
  return (
    <SignInOptions
      key={attempt}
      next={params.get("next") ?? ""}
      error={ERRORS[params.get("error") ?? ""]}
      onRestart={() => setAttempt((n) => n + 1)}
    />
  )
}

function SignInOptions({
  next,
  error,
  onRestart,
}: {
  next: string
  error?: string
  onRestart: () => void
}) {
  const id = useId()
  const [state, action] = useActionState<MagicLinkState, FormData>(sendMagicLink, {
    status: "idle",
  })

  if (state.status === "sent") {
    return <EmailCodeForm email={state.email} next={state.next ?? next} onRestart={onRestart} />
  }

  return (
    <div className="grid gap-4">
      {error && (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
          {error}
        </p>
      )}
      <form action={signInWithGithub}>
        <input type="hidden" name="next" value={next} />
        <SubmitButton>
          <GithubIcon /> Continue with GitHub
        </SubmitButton>
      </form>

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <Separator className="flex-1" /> or <Separator className="flex-1" />
      </div>

      <form action={action} className="grid gap-3">
        <input type="hidden" name="next" value={next} />
        <FormField
          id={`${id}-email`}
          label="Email"
          error={state.status === "error" ? state.message : null}
        >
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </FormField>
        <SubmitButton variant="outline">Email me a sign-in code</SubmitButton>
      </form>
    </div>
  )
}

/**
 * Second step of email sign-in. Typing the code works everywhere, including an app installed
 * to the home screen, where tapping the emailed link would open the browser instead.
 */
function EmailCodeForm({
  email,
  next,
  onRestart,
}: {
  email: string
  next: string
  onRestart: () => void
}) {
  const id = useId()
  const [state, action] = useActionState<EmailCodeState, FormData>(verifyEmailCode, {
    status: "idle",
  })

  return (
    <div className="grid gap-4">
      <div className="flex flex-col items-center gap-2 text-center" role="status">
        <MailCheck className="text-muted-foreground size-8" />
        <p className="font-medium">Check your email</p>
        <p className="text-muted-foreground text-sm">
          If that address is allowed in, a sign-in email is on its way. Enter its code here, or open
          its link on this device.
        </p>
      </div>
      <form action={action} className="grid gap-3">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <FormField
          id={`${id}-code`}
          label="Code"
          error={state.status === "error" ? state.message : null}
        >
          <Input
            id={`${id}-code`}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            required
            autoFocus
            placeholder="123456"
            className="text-center font-mono text-lg tracking-widest"
          />
        </FormField>
        <SubmitButton>Sign in</SubmitButton>
      </form>
      <Button type="button" variant="link" size="sm" onClick={onRestart}>
        Use a different email
      </Button>
    </div>
  )
}
