import type { ReactNode } from "react"

export function PageHeader({
  title,
  icon,
  description,
  meta,
  actions,
}: {
  title: string
  icon?: ReactNode
  description?: string | null
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {icon}
          <span className="truncate">{title}</span>
        </h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
        {meta}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
