import { cn } from "cn"

import type { DueCounts as Counts } from "@/lib/view-models"

/** Anki-style new / learning / review counts. Zero counts are dimmed. */
export function DueCounts({
  counts,
  className,
  showLabels = false,
}: {
  counts: Counts
  className?: string
  showLabels?: boolean
}) {
  const items = [
    { key: "new", label: "New", value: counts.new, color: "text-count-new" },
    { key: "learning", label: "Learning", value: counts.learning, color: "text-count-learning" },
    { key: "review", label: "Review", value: counts.review, color: "text-count-review" },
  ]
  return (
    <span
      className={cn("inline-flex items-center gap-2 font-mono text-xs tabular-nums", className)}
      aria-label={items.map((i) => `${i.value} ${i.label.toLowerCase()}`).join(", ")}
    >
      {items.map((i) => (
        <span
          key={i.key}
          className={cn(i.value ? i.color : "text-muted-foreground/50", i.value && "font-semibold")}
        >
          {showLabels && (
            <span className="text-muted-foreground mr-1 font-sans font-normal">{i.label}</span>
          )}
          {i.value}
        </span>
      ))}
    </span>
  )
}

export function totalDue(counts: Counts): number {
  return counts.new + counts.learning + counts.review
}
