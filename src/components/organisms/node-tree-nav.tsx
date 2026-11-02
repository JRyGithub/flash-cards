"use client"

import { cn } from "cn"
import { ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo, useState } from "react"

import { NodeKindIcon } from "@/components/atoms/node-kind-icon"
import { DueCounts, totalDue } from "@/components/molecules/due-counts"
import type { NodeSummary } from "@/lib/view-models"

/** Collapsible sidebar of every tree, branch and leaf with due counts. */
export function NodeTreeNav({ nodes }: { nodes: NodeSummary[] }) {
  const pathname = usePathname()
  const activeId = pathname.match(/^\/nodes\/([^/]+)/)?.[1] ?? null
  const [toggled, setToggled] = useState<Map<string, boolean>>(new Map())

  const { children, byId } = useMemo(() => {
    const children = new Map<string | null, NodeSummary[]>()
    for (const n of [...nodes].sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    )) {
      children.set(n.parentId, [...(children.get(n.parentId) ?? []), n])
    }
    return { children, byId: new Map(nodes.map((n) => [n.id, n])) }
  }, [nodes])

  // The active node's ancestors are open by default so it's always visible.
  const activeAncestors = useMemo(() => {
    const ids = new Set<string>()
    let current = activeId ? byId.get(activeId) : undefined
    while (current?.parentId) {
      ids.add(current.parentId)
      current = byId.get(current.parentId)
    }
    return ids
  }, [activeId, byId])

  const isOpen = (n: NodeSummary) =>
    toggled.get(n.id) ?? (n.kind === "tree" || activeAncestors.has(n.id))
  const toggle = (n: NodeSummary) => setToggled((prev) => new Map(prev).set(n.id, !isOpen(n)))

  const renderLevel = (parentId: string | null, depth: number) => {
    const items = children.get(parentId)
    if (!items?.length) return null
    return (
      <ul role={depth === 0 ? "tree" : "group"} className="space-y-0.5">
        {items.map((n) => {
          const hasChildren = !!children.get(n.id)?.length
          const open = hasChildren && isOpen(n)
          return (
            <li
              key={n.id}
              role="treeitem"
              aria-expanded={hasChildren ? open : undefined}
              aria-selected={n.id === activeId}
            >
              <div
                className={cn(
                  "group hover:bg-sidebar-accent flex items-center gap-1 rounded-md pr-2 text-sm",
                  n.id === activeId && "bg-sidebar-accent font-medium",
                )}
                style={{ paddingLeft: depth * 12 + 4 }}
              >
                <button
                  type="button"
                  onClick={() => toggle(n)}
                  className={cn(
                    "text-muted-foreground hover:text-foreground rounded p-0.5",
                    !hasChildren && "invisible",
                  )}
                  aria-label={open ? `Collapse ${n.name}` : `Expand ${n.name}`}
                  tabIndex={hasChildren ? 0 : -1}
                >
                  <ChevronRight
                    className={cn("size-3.5 transition-transform", open && "rotate-90")}
                  />
                </button>
                <Link
                  href={`/nodes/${n.id}`}
                  className="flex min-w-0 flex-1 items-center gap-1.5 py-1"
                >
                  <NodeKindIcon kind={n.kind} className="size-3.5" />
                  <span className="truncate">{n.name}</span>
                </Link>
                {totalDue(n.counts) > 0 && (
                  <DueCounts counts={n.counts} className="gap-1.5 text-[11px]" />
                )}
              </div>
              {open && renderLevel(n.id, depth + 1)}
            </li>
          )
        })}
      </ul>
    )
  }

  if (nodes.length === 0) {
    return <p className="text-muted-foreground px-2 text-sm">No trees yet.</p>
  }
  return <nav aria-label="Trees">{renderLevel(null, 0)}</nav>
}
