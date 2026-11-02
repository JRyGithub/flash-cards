import type { Metadata } from "next"
import { Suspense } from "react"

import { NodeKindIcon } from "@/components/atoms/node-kind-icon"
import { Skeleton } from "@/components/atoms/skeleton"
import { StudySession } from "@/components/organisms/study-session"
import { StudyLayout } from "@/components/templates/study-layout"
import { getStudyStart } from "@/server/queries"

export const metadata: Metadata = { title: "Study" }

export default function StudyPage({ params }: PageProps<"/nodes/[id]/study">) {
  return (
    <Suspense
      fallback={
        <StudyLayout title="Study" backHref="/">
          <Skeleton className="mx-auto h-72 w-full max-w-3xl rounded-xl" />
        </StudyLayout>
      }
    >
      <StudyView params={params} />
    </Suspense>
  )
}

async function StudyView({ params }: { params: PageProps<"/nodes/[id]/study">["params"] }) {
  const { id } = await params
  const { node, state } = await getStudyStart(id)
  return (
    <StudyLayout
      backHref={`/nodes/${node.id}`}
      title={
        <>
          <NodeKindIcon kind={node.kind} />
          <span className="truncate">{node.name}</span>
        </>
      }
    >
      <StudySession nodeId={node.id} nodeName={node.name} initial={state} />
    </StudyLayout>
  )
}
