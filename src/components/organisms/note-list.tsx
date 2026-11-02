"use client"

import { Layers, Pencil, Plus, Repeat, Search, Trash2, Upload } from "lucide-react"
import Link from "next/link"
import { useId, useMemo, useState } from "react"
import { toast } from "sonner"

import { deleteNote } from "@/app/actions/notes"
import { Badge } from "@/components/atoms/badge"
import { Button } from "@/components/atoms/button"
import { Input } from "@/components/atoms/input"
import { ConfirmDialog } from "@/components/molecules/confirm-dialog"
import { EmptyState } from "@/components/molecules/empty-state"
import { Markdown } from "@/components/molecules/markdown"
import type { NoteView } from "@/lib/view-models"

import { NoteEditorDialog } from "./note-editor-dialog"

/** The cards attached directly to a branch or leaf, with search, add, edit and delete. */
export function NoteList({ nodeId, notes }: { nodeId: string; notes: NoteView[] }) {
  const headingId = useId()
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<NoteView | "new" | null>(null)
  const [deleting, setDeleting] = useState<NoteView | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return notes
    return notes.filter(
      (n) => n.frontMd.toLowerCase().includes(q) || n.backMd.toLowerCase().includes(q),
    )
  }, [notes, query])

  const cardCount = notes.reduce((sum, n) => sum + (n.reversible ? 2 : 1), 0)

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id={headingId} className="mr-auto text-lg font-semibold">
          Cards <span className="text-muted-foreground text-sm font-normal">({cardCount})</span>
        </h2>
        {notes.length > 5 && (
          <div className="relative w-full sm:w-56">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              type="search"
              placeholder="Search cards"
              aria-label="Search cards"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        )}
        <Button variant="outline" asChild>
          <Link href={`/nodes/${nodeId}/import`}>
            <Upload /> Import
          </Link>
        </Button>
        <Button onClick={() => setEditing("new")}>
          <Plus /> Add card
        </Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="No cards yet"
          description="Add cards one at a time, or import a CSV of front/back pairs."
          action={
            <Button onClick={() => setEditing("new")}>
              <Plus /> Add your first card
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No cards match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {filtered.map((note) => (
            <li key={note.id} className="grid gap-3 p-3 sm:grid-cols-[1fr_1fr_9rem] sm:items-start">
              <div className="max-h-40 min-w-0 overflow-hidden text-sm">
                <Markdown className="prose-sm">{note.frontMd}</Markdown>
              </div>
              <div className="text-muted-foreground max-h-40 min-w-0 overflow-hidden text-sm">
                <Markdown className="prose-sm">{note.backMd}</Markdown>
              </div>
              <div className="flex items-center gap-1 sm:justify-end">
                {note.reversible && (
                  <Badge variant="secondary" title="Also studied back → front">
                    <Repeat /> Reverse
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Edit card"
                  onClick={() => setEditing(note)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete card"
                  onClick={() => setDeleting(note)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <NoteEditorDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          mode={editing === "new" ? { type: "create", nodeId } : { type: "edit", note: editing }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this card?"
        description="The card and its review history will be permanently deleted."
        onConfirm={async () => {
          const result = await deleteNote(deleting!.id)
          if (result.ok) toast.success("Card deleted")
          return result
        }}
      />
    </section>
  )
}
