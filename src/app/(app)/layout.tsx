import { type ReactNode, Suspense } from "react"

import { Skeleton } from "@/components/atoms/skeleton"
import { NodeTreeNav } from "@/components/organisms/node-tree-nav"
import { AppShell } from "@/components/templates/app-shell"
import { getNodeSummaries } from "@/server/queries"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      sidebar={
        <Suspense fallback={<SidebarSkeleton />}>
          <Sidebar />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  )
}

async function Sidebar() {
  return <NodeTreeNav nodes={await getNodeSummaries()} />
}

function SidebarSkeleton() {
  return (
    <div className="space-y-2 p-1" aria-busy="true" aria-label="Loading trees">
      {[70, 55, 60, 40, 65].map((w, i) => (
        <Skeleton key={i} className="h-5" style={{ width: `${w}%`, marginLeft: i % 2 ? 16 : 0 }} />
      ))}
    </div>
  )
}
