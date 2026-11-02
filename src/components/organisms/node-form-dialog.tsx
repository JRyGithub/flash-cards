"use client"

import { cn } from "cn"
import { useRouter } from "next/navigation"
import { type ReactNode, useId, useState, useTransition } from "react"
import { toast } from "sonner"

import { createNode, updateNode } from "@/app/actions/nodes"
import { Button } from "@/components/atoms/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/dialog"
import { Input } from "@/components/atoms/input"
import { NodeKindIcon } from "@/components/atoms/node-kind-icon"
import { Spinner } from "@/components/atoms/spinner"
import { Textarea } from "@/components/atoms/textarea"
import { FormField } from "@/components/molecules/form-field"
import { KIND_DESCRIPTION, KIND_LABEL, type NodeKind } from "@/lib/view-models"

type Mode =
  | { type: "create-tree" }
  | { type: "create-child"; parentId: string; parentName: string; kind: "branch" | "leaf" }
  | { type: "edit"; id: string; kind: NodeKind; name: string; description: string | null }

/** Create a tree, branch or leaf, or rename/describe an existing one. */
export function NodeFormDialog({
  mode,
  open,
  onOpenChange,
}: {
  mode: Mode
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const id = useId()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [childKind, setChildKind] = useState<"branch" | "leaf">(
    mode.type === "create-child" ? mode.kind : "branch",
  )

  const kind: NodeKind =
    mode.type === "create-tree" ? "tree" : mode.type === "edit" ? mode.kind : childKind
  const title =
    mode.type === "edit"
      ? `Edit ${KIND_LABEL[kind].toLowerCase()}`
      : mode.type === "create-tree"
        ? "New tree"
        : `Add to ${mode.parentName}`

  function submit(formData: FormData) {
    const name = String(formData.get("name") ?? "")
    const description = String(formData.get("description") ?? "")
    setError(null)
    startTransition(async () => {
      const result =
        mode.type === "edit"
          ? await updateNode({ id: mode.id, name, description })
          : await createNode({
              name,
              description,
              kind,
              parentId: mode.type === "create-child" ? mode.parentId : null,
            })
      if (!result.ok) return setError(result.error)

      onOpenChange(false)
      toast.success(mode.type === "edit" ? "Saved" : `${KIND_LABEL[kind]} created`)
      if (mode.type === "create-tree" && result.data) router.push(`/nodes/${result.data.id}`)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <form action={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <NodeKindIcon kind={kind} />
              {title}
            </DialogTitle>
            <DialogDescription>{KIND_DESCRIPTION[kind]}</DialogDescription>
          </DialogHeader>

          {mode.type === "create-child" && (
            <div role="radiogroup" aria-label="Type" className="grid grid-cols-2 gap-2">
              {(["branch", "leaf"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={childKind === k}
                  onClick={() => setChildKind(k)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                    childKind === k ? "border-primary bg-muted" : "hover:bg-muted/50",
                  )}
                >
                  <NodeKindIcon kind={k} />
                  <span className="font-medium">{KIND_LABEL[k]}</span>
                </button>
              ))}
            </div>
          )}

          <FormField id={`${id}-name`} label="Name" error={error}>
            <Input
              id={`${id}-name`}
              name="name"
              required
              maxLength={120}
              autoFocus
              defaultValue={mode.type === "edit" ? mode.name : ""}
              placeholder={kind === "tree" ? "e.g. GitHub Actions certification" : "e.g. Section 1"}
              aria-invalid={!!error}
            />
          </FormField>
          <FormField id={`${id}-description`} label="Description" hint="Optional">
            <Textarea
              id={`${id}-description`}
              name="description"
              maxLength={2000}
              rows={3}
              defaultValue={mode.type === "edit" ? (mode.description ?? "") : ""}
            />
          </FormField>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />}
              {mode.type === "edit" ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** A button that opens the dialog; convenient for server-rendered pages. */
export function NodeFormButton({
  mode,
  children,
  ...buttonProps
}: { mode: Mode; children: ReactNode } & React.ComponentProps<typeof Button>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button {...buttonProps} onClick={() => setOpen(true)}>
        {children}
      </Button>
      {open && <NodeFormDialog mode={mode} open={open} onOpenChange={setOpen} />}
    </>
  )
}
