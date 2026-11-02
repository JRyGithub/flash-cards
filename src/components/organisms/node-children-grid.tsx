import { GraduationCap } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/atoms/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/atoms/card"
import { NodeKindIcon } from "@/components/atoms/node-kind-icon"
import { DueCounts, totalDue } from "@/components/molecules/due-counts"
import type { NodeSummary } from "@/lib/view-models"

/** Cards linking to child nodes (or top-level trees), each with due counts and a study shortcut. */
export function NodeChildrenGrid({ nodes }: { nodes: NodeSummary[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {nodes.map((n) => (
        <li key={n.id}>
          <Card className="hover:bg-muted/40 relative h-full gap-2 transition-colors">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <NodeKindIcon kind={n.kind} />
                <Link href={`/nodes/${n.id}`} className="truncate after:absolute after:inset-0">
                  {n.name}
                </Link>
              </CardTitle>
              {n.description && (
                <CardDescription className="line-clamp-2">{n.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="mt-auto flex items-center justify-between gap-2">
              <DueCounts counts={n.counts} />
              {totalDue(n.counts) > 0 && (
                <Button asChild size="sm" variant="secondary" className="relative z-10">
                  <Link href={`/nodes/${n.id}/study`}>
                    <GraduationCap /> Study
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}
