import { cn } from "cn"
import type { ReactNode } from "react"

import { Label } from "@/components/atoms/label"

export function FormField({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id: string
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
