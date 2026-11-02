import { Plus, TreePine } from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"

import { Skeleton } from "@/components/atoms/skeleton"
import { EmptyState } from "@/components/molecules/empty-state"
import { PageHeader } from "@/components/molecules/page-header"
import { NodeChildrenGrid } from "@/components/organisms/node-children-grid"
import { NodeFormButton } from "@/components/organisms/node-form-dialog"
import { getNodeSummaries } from "@/server/queries"

export const metadata: Metadata = { title: "Your trees" }

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Your trees"
        description="Each tree is a goal or large concept. Break it down into branches and leaves of cards."
        actions={
          <NodeFormButton mode={{ type: "create-tree" }}>
            <Plus /> New tree
          </NodeFormButton>
        }
      />
      <Suspense fallback={<GridSkeleton />}>
        <Trees />
      </Suspense>
    </div>
  )
}

async function Trees() {
  const trees = (await getNodeSummaries()).filter((n) => n.parentId === null)
  if (trees.length === 0) {
    return (
      <EmptyState
        icon={<TreePine />}
        title="Plant your first tree"
        description="For example “GitHub Actions certification”, then add a branch for each section of the course and a leaf for each concept."
        action={
          <NodeFormButton mode={{ type: "create-tree" }}>
            <Plus /> New tree
          </NodeFormButton>
        }
      />
    )
  }
  return <NodeChildrenGrid nodes={trees} />
}

function GridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  )
}
