import { cn } from "cn"

import { Button } from "@/components/atoms/button"
import { Kbd } from "@/components/atoms/kbd"

const TONES = {
  1: "border-red-500/40 hover:bg-red-500/10 text-red-700 dark:text-red-300",
  2: "border-amber-500/40 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300",
  3: "border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  4: "border-sky-500/40 hover:bg-sky-500/10 text-sky-700 dark:text-sky-300",
} as const

export function RatingButton({
  rating,
  label,
  interval,
  disabled,
  onRate,
}: {
  rating: 1 | 2 | 3 | 4
  label: string
  interval: string
  disabled?: boolean
  onRate: (rating: 1 | 2 | 3 | 4) => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={() => onRate(rating)}
      className={cn("h-auto flex-1 flex-col gap-0.5 py-2", TONES[rating])}
    >
      <span className="text-xs opacity-80">{interval}</span>
      <span className="font-semibold">{label}</span>
      <Kbd className="mt-0.5 hidden sm:inline-flex">{rating}</Kbd>
    </Button>
  )
}
