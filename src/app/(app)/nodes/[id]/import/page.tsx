import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { Skeleton } from "@/components/atoms/skeleton"
import { Breadcrumbs } from "@/components/molecules/breadcrumbs"
import { PageHeader } from "@/components/molecules/page-header"
import { CsvImportWizard } from "@/components/organisms/csv-import-wizard"
import { getNodePage } from "@/server/queries"

export const metadata: Metadata = { title: "Import cards" }

export default function ImportPage({ params }: PageProps<"/nodes/[id]/import">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <ImportView params={params} />
      </Suspense>
    </div>
  )
}

async function ImportView({ params }: { params: PageProps<"/nodes/[id]/import">["params"] }) {
  const { id } = await params
  const { node, path, canHoldNotes } = await getNodePage(id)
  if (!canHoldNotes) notFound()

  return (
    <div className="space-y-6">
      <Breadcrumbs trail={path} />
      <PageHeader
        title={`Import cards into ${node.name}`}
        description="Bring in a batch of cards from a spreadsheet or another app's CSV export."
      />
      <CsvImportWizard nodeId={node.id} />
    </div>
  )
}
