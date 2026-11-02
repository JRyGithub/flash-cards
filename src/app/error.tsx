"use client"

import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/atoms/button"
import { EmptyState } from "@/components/molecules/empty-state"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        icon={<TriangleAlert />}
        title="Something went wrong"
        description={error.digest ? `Error reference: ${error.digest}` : "Please try again."}
        action={<Button onClick={reset}>Try again</Button>}
      />
    </main>
  )
}
