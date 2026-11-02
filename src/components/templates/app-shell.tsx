import { Layers, LogOut, PanelLeft, Settings } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { signOut } from "@/app/actions/auth"
import { Button } from "@/components/atoms/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/atoms/collapsible"
import { ThemeToggle } from "@/components/molecules/theme-toggle"

/** Header, tree sidebar (collapsible on small screens) and main content area. */
export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/90 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
        <Link href="/" className="mr-auto flex items-center gap-2 font-semibold">
          <Layers className="size-5" /> Flash Cards
        </Link>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/settings" aria-label="Settings">
            <Settings />
          </Link>
        </Button>
        <ThemeToggle />
        <form action={signOut}>
          <Button variant="ghost" size="icon" type="submit" aria-label="Sign out">
            <LogOut />
          </Button>
        </form>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <Collapsible className="border-b md:hidden">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-start rounded-none px-4">
              <PanelLeft /> Browse trees
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="max-h-[60svh] overflow-y-auto px-2 pb-3">
            {sidebar}
          </CollapsibleContent>
        </Collapsible>
        <aside className="bg-sidebar hidden w-72 shrink-0 border-r md:block">
          <div className="sticky top-14 max-h-[calc(100svh-3.5rem)] overflow-y-auto p-2">
            {sidebar}
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  )
}
