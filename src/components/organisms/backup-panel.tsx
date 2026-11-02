"use client"

import { Download, Upload } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import { importBackup } from "@/app/actions/imports"
import { Button } from "@/components/atoms/button"
import { Spinner } from "@/components/atoms/spinner"

/** Download a full JSON backup, or restore one (imported as copies alongside existing trees). */
export function BackupPanel() {
  const [pending, startTransition] = useTransition()

  function restore(file: File | undefined) {
    if (!file) return
    if (file.size > 4_000_000) {
      toast.error(
        "That file is too large (4MB max). Export and import trees one at a time instead.",
      )
      return
    }
    startTransition(async () => {
      const result = await importBackup({ json: await file.text() })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      const { trees, notes } = result.data
      toast.success(
        `Imported ${trees} tree${trees === 1 ? "" : "s"} with ${notes} note${notes === 1 ? "" : "s"}`,
      )
    })
  }

  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">
        Backups include every tree, card and review. Importing a backup adds its trees as new
        copies, so nothing you already have is overwritten. Individual trees can be exported from
        their menu.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href="/api/export" download>
            <Download /> Download backup
          </a>
        </Button>
        <Button asChild variant="outline" disabled={pending}>
          <label className="cursor-pointer">
            {pending ? <Spinner /> : <Upload />} Import backup
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              disabled={pending}
              onChange={(e) => {
                restore(e.target.files?.[0])
                e.target.value = ""
              }}
            />
          </label>
        </Button>
      </div>
    </div>
  )
}
