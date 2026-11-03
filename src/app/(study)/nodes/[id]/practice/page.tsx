import type { Metadata } from "next"
import { Suspense } from "react"

import { NodeKindIcon } from "@/components/atoms/node-kind-icon"
import { Skeleton } from "@/components/atoms/skeleton"
import { PracticeSession } from "@/components/organisms/practice-session"
import { StudyLayout } from "@/components/templates/study-layout"
import { getPracticeStart } from "@/server/queries"

export const metadata: Metadata = { title: "Practice" }

export default function PracticePage({ params }: PageProps<"/nodes/[id]/practice">) {
  return (
    <Suspense
      fallback={
        <StudyLayout title="Practice" backHref="/">
          <Skeleton className="mx-auto h-72 w-full max-w-3xl rounded-xl" />
        </StudyLayout>
      }
    >
      <PracticeView params={params} />
    </Suspense>
  )
}

async function PracticeView({ params }: { params: PageProps<"/nodes/[id]/practice">["params"] }) {
  const { id } = await params
  const { node, deck } = await getPracticeStart(id)
  return (
    <StudyLayout
      backHref={`/nodes/${node.id}`}
      title={
        <>
          <NodeKindIcon kind={node.kind} />
          <span className="truncate">{node.name}</span>
          <span className="text-muted-foreground font-normal">· Practice</span>
        </>
      }
    >
      <PracticeSession nodeId={node.id} nodeName={node.name} deck={deck} />
    </StudyLayout>
  )
}
