import { X } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Button } from "@/components/atoms/button"

/** Distraction-free layout for study sessions. */
export function StudyLayout({
  title,
  backHref,
  children,
}: {
  title: ReactNode
  backHref: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <div className="mr-auto flex min-w-0 items-center gap-2 font-medium">{title}</div>
        <Button variant="ghost" size="icon" asChild>
          <Link href={backHref} aria-label="End session">
            <X />
          </Link>
        </Button>
      </header>
      <main className="flex flex-1 flex-col px-4 py-6">{children}</main>
    </div>
  )
}
