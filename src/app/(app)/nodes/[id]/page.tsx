import { GitBranch, GraduationCap, Plus } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"

import { Button } from "@/components/atoms/button"
import { NodeKindIcon } from "@/components/atoms/node-kind-icon"
import { Skeleton } from "@/components/atoms/skeleton"
import { Breadcrumbs } from "@/components/molecules/breadcrumbs"
import { DueCounts, totalDue } from "@/components/molecules/due-counts"
import { EmptyState } from "@/components/molecules/empty-state"
import { PageHeader } from "@/components/molecules/page-header"
import { NodeActionsMenu } from "@/components/organisms/node-actions-menu"
import { NodeChildrenGrid } from "@/components/organisms/node-children-grid"
import { NodeFormButton } from "@/components/organisms/node-form-dialog"
import { NoteList } from "@/components/organisms/note-list"
import { getNodePage } from "@/server/queries"

export const metadata: Metadata = { title: "Browse" }

export default function NodePage({ params }: PageProps<"/nodes/[id]">) {
  return (
    <div className="mx-auto max-w-6xl">
      <Suspense fallback={<NodeSkeleton />}>
        <NodeView params={params} />
      </Suspense>
    </div>
  )
}

async function NodeView({ params }: { params: PageProps<"/nodes/[id]">["params"] }) {
  const { id } = await params
  const { node, path, children, notes, moveTargets, canHaveChildren, canHoldNotes } =
    await getNodePage(id)
  const due = totalDue(node.counts)
  const addChild = (
    <NodeFormButton
      variant="outline"
      mode={{ type: "create-child", parentId: node.id, parentName: node.name, kind: "branch" }}
    >
      <Plus /> Branch or leaf
    </NodeFormButton>
  )

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Breadcrumbs trail={path} />
        <PageHeader
          title={node.name}
          icon={<NodeKindIcon kind={node.kind} className="size-6" />}
          description={node.description}
          meta={<DueCounts counts={node.counts} showLabels className="pt-1" />}
          actions={
            <>
              {due > 0 ? (
                <Button asChild>
                  <Link href={`/nodes/${node.id}/study`}>
                    <GraduationCap /> Study {due}
                  </Link>
                </Button>
              ) : (
                <Button disabled>
                  <GraduationCap /> Nothing due
                </Button>
              )}
              {canHaveChildren && addChild}
              <NodeActionsMenu node={node} moveTargets={moveTargets} />
            </>
          }
        />
      </div>

      {canHaveChildren && (
        <section aria-labelledby={`contents-${node.id}`} className="space-y-3">
          <h2 id={`contents-${node.id}`} className="text-lg font-semibold">
            {node.kind === "tree" ? "Branches & leaves" : "Inside this branch"}
          </h2>
          {children.length ? (
            <NodeChildrenGrid nodes={children} />
          ) : (
            <EmptyState
              icon={<GitBranch />}
              title={node.kind === "tree" ? "No branches yet" : "No sub-branches or leaves"}
              description={
                node.kind === "tree"
                  ? "Add a branch for each section, and leaves for each concept within it."
                  : "Cards can live directly on this branch, or in leaves and branches inside it."
              }
              action={addChild}
            />
          )}
        </section>
      )}

      {canHoldNotes && <NoteList nodeId={node.id} notes={notes} />}
    </div>
  )
}

function NodeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
