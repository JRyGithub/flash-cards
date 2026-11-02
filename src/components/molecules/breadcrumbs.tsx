import { ChevronRight, Home } from "lucide-react"
import Link from "next/link"

import { NodeKindIcon } from "@/components/atoms/node-kind-icon"
import type { NodeKind } from "@/lib/view-models"

export interface Crumb {
  id: string
  name: string
  kind: NodeKind
}

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="text-muted-foreground flex min-w-0 items-center gap-1 text-sm"
    >
      <Link href="/" className="hover:text-foreground shrink-0 rounded p-0.5" aria-label="Home">
        <Home className="size-4" />
      </Link>
      {trail.map((crumb, i) => {
        const last = i === trail.length - 1
        return (
          <span key={crumb.id} className="flex min-w-0 items-center gap-1">
            <ChevronRight className="size-3.5 shrink-0" aria-hidden />
            {last ? (
              <span
                aria-current="page"
                className="text-foreground flex min-w-0 items-center gap-1 font-medium"
              >
                <NodeKindIcon kind={crumb.kind} className="size-3.5" />
                <span className="truncate">{crumb.name}</span>
              </span>
            ) : (
              <Link href={`/nodes/${crumb.id}`} className="hover:text-foreground truncate">
                {crumb.name}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
