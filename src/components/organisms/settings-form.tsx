"use client"

import { useId, useState, useSyncExternalStore, useTransition } from "react"
import { toast } from "sonner"

import { updateSettings } from "@/app/actions/settings"
import { Button } from "@/components/atoms/button"
import { Input } from "@/components/atoms/input"
import { Label } from "@/components/atoms/label"
import { Spinner } from "@/components/atoms/spinner"
import { Switch } from "@/components/atoms/switch"
import { FormField } from "@/components/molecules/form-field"
import type { SettingsInput } from "@/lib/validation"

export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const id = useId()
  const [values, setValues] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const set = <K extends keyof SettingsInput>(key: K, value: SettingsInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateSettings(values)
      if (!result.ok) return setError(result.error)
      toast.success("Settings saved")
    })
  }

  const browserZone = useSyncExternalStore(noop, getBrowserZone, () => null)

  return (
    <form onSubmit={submit} className="grid gap-5">
      <FormField
        id={`${id}-retention`}
        label={`Desired retention: ${Math.round(values.desiredRetention * 100)}%`}
        hint="How likely you should be to remember a card when it comes due. Higher means more reviews."
      >
        <input
          id={`${id}-retention`}
          type="range"
          min={0.7}
          max={0.99}
          step={0.01}
          value={values.desiredRetention}
          onChange={(e) => set("desiredRetention", Number(e.target.value))}
          className="accent-primary w-full"
        />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id={`${id}-new`} label="New cards per day" hint="Across all trees.">
          <Input
            id={`${id}-new`}
            type="number"
            min={0}
            max={9999}
            value={values.newCardsPerDay}
            onChange={(e) => set("newCardsPerDay", e.target.valueAsNumber || 0)}
          />
        </FormField>
        <FormField id={`${id}-reviews`} label="Maximum reviews per day" hint="Across all trees.">
          <Input
            id={`${id}-reviews`}
            type="number"
            min={0}
            max={99999}
            value={values.maxReviewsPerDay}
            onChange={(e) => set("maxReviewsPerDay", e.target.valueAsNumber || 0)}
          />
        </FormField>
      </div>

      <FormField
        id={`${id}-tz`}
        label="Time zone"
        hint={
          browserZone && browserZone !== values.timezone ? (
            <>
              Your study day starts at midnight here.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => set("timezone", browserZone)}
              >
                Use {browserZone}
              </button>
            </>
          ) : (
            "Your study day starts at midnight here."
          )
        }
      >
        <Input
          id={`${id}-tz`}
          value={values.timezone}
          onChange={(e) => set("timezone", e.target.value)}
          placeholder="e.g. Europe/London"
        />
      </FormField>

      <div className="flex items-center gap-2">
        <Switch
          id={`${id}-fuzz`}
          checked={values.enableFuzz}
          onCheckedChange={(v) => set("enableFuzz", v)}
        />
        <Label htmlFor={`${id}-fuzz`} className="font-normal">
          Fuzz intervals slightly so cards added together don&apos;t always come due together
        </Label>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          Save settings
        </Button>
      </div>
    </form>
  )
}

const noop = () => () => {}
const getBrowserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
