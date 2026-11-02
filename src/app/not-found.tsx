import { SearchX } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/atoms/button"
import { EmptyState } from "@/components/molecules/empty-state"

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        icon={<SearchX />}
        title="Not found"
        description="That tree, branch or leaf doesn't exist. It may have been deleted."
        action={
          <Button asChild>
            <Link href="/">Back to your trees</Link>
          </Button>
        }
      />
    </main>
  )
}
