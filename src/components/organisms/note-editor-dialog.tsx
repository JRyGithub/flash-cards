"use client"

import { cn } from "cn"
import { Eye, PencilLine } from "lucide-react"
import { useId, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { createNote, updateNote } from "@/app/actions/notes"
import { Button } from "@/components/atoms/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/dialog"
import { Kbd } from "@/components/atoms/kbd"
import { Label } from "@/components/atoms/label"
import { Spinner } from "@/components/atoms/spinner"
import { Switch } from "@/components/atoms/switch"
import { Textarea } from "@/components/atoms/textarea"
import { FormField } from "@/components/molecules/form-field"
import { Markdown } from "@/components/molecules/markdown"
import type { NoteView } from "@/lib/view-models"

type Mode = { type: "create"; nodeId: string } | { type: "edit"; note: NoteView }

/** Markdown editor for both sides of a card, with preview and the reverse-card toggle. */
export function NoteEditorDialog({
  mode,
  open,
  onOpenChange,
}: {
  mode: Mode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const id = useId()
  const initial = mode.type === "edit" ? mode.note : { frontMd: "", backMd: "", reversible: false }
  const [front, setFront] = useState(initial.frontMd)
  const [back, setBack] = useState(initial.backMd)
  const [reversible, setReversible] = useState(initial.reversible)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const frontRef = useRef<HTMLTextAreaElement>(null)

  function save(addAnother: boolean) {
    setError(null)
    startTransition(async () => {
      const content = { frontMd: front, backMd: back, reversible }
      const result =
        mode.type === "edit"
          ? await updateNote({ id: mode.note.id, ...content })
          : await createNote({ nodeId: mode.nodeId, ...content })
      if (!result.ok) return setError(result.error)

      if (addAnother) {
        toast.success("Card added")
        setFront("")
        setBack("")
        setPreview(false)
        frontRef.current?.focus()
      } else {
        toast.success(mode.type === "edit" ? "Card saved" : "Card added")
        onOpenChange(false)
      }
    })
  }

  const isCreate = mode.type === "create"

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            save(false)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              save(isCreate)
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{isCreate ? "Add card" : "Edit card"}</DialogTitle>
            <DialogDescription>
              Markdown is supported, including fenced code blocks (```yaml).
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreview((p) => !p)}>
              {preview ? <PencilLine /> : <Eye />}
              {preview ? "Edit" : "Preview"}
            </Button>
          </div>

          {(["front", "back"] as const).map((side) => {
            const value = side === "front" ? front : back
            const setValue = side === "front" ? setFront : setBack
            const fieldId = `${id}-${side}`
            return (
              <FormField key={side} id={fieldId} label={side === "front" ? "Front" : "Back"}>
                {preview ? (
                  <div className="bg-muted/30 min-h-24 rounded-lg border p-3">
                    {value.trim() ? (
                      <Markdown>{value}</Markdown>
                    ) : (
                      <p className="text-muted-foreground text-sm">Nothing to preview</p>
                    )}
                  </div>
                ) : (
                  <Textarea
                    id={fieldId}
                    ref={side === "front" ? frontRef : undefined}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    rows={side === "front" ? 3 : 6}
                    required
                    autoFocus={side === "front"}
                    maxLength={20_000}
                    className={cn("font-mono text-sm")}
                  />
                )}
              </FormField>
            )
          })}

          <div className="flex items-center gap-2">
            <Switch id={`${id}-reversible`} checked={reversible} onCheckedChange={setReversible} />
            <Label htmlFor={`${id}-reversible`} className="font-normal">
              Also create a reverse card (back → front)
            </Label>
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <DialogFooter className="items-center">
            <span className="text-muted-foreground mr-auto hidden text-xs sm:block">
              <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> {isCreate ? "to save and add another" : "to save"}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            {isCreate && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => save(true)}
                disabled={pending}
              >
                Save & add another
              </Button>
            )}
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
