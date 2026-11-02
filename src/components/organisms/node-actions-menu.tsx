"use client"

import {
  ArrowDown,
  ArrowUp,
  Download,
  FolderInput,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteNode, moveNode, reorderNode } from "@/app/actions/nodes"
import { Button } from "@/components/atoms/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu"
import { NodeKindIcon } from "@/components/atoms/node-kind-icon"
import { Spinner } from "@/components/atoms/spinner"
import { ConfirmDialog } from "@/components/molecules/confirm-dialog"
import { KIND_LABEL, type NodeKind } from "@/lib/view-models"
import type { MoveTarget } from "@/server/queries"

import { NodeFormDialog } from "./node-form-dialog"

interface ActionNode {
  id: string
  parentId: string | null
  kind: NodeKind
  name: string
  description: string | null
}

export function NodeActionsMenu({
  node,
  moveTargets,
}: {
  node: ActionNode
  moveTargets: MoveTarget[]
}) {
  const [dialog, setDialog] = useState<"edit" | "move" | "delete" | null>(null)
  const [, startTransition] = useTransition()
  const label = KIND_LABEL[node.kind].toLowerCase()

  const reorder = (direction: "up" | "down") =>
    startTransition(async () => {
      const result = await reorderNode({ id: node.id, direction })
      if (!result.ok) toast.error(result.error)
    })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={`More actions for ${node.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog("edit")}>
            <Pencil /> Rename / describe
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => reorder("up")}>
            <ArrowUp /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => reorder("down")}>
            <ArrowDown /> Move down
          </DropdownMenuItem>
          {node.kind !== "tree" && (
            <DropdownMenuItem onSelect={() => setDialog("move")}>
              <FolderInput /> Move to…
            </DropdownMenuItem>
          )}
          {node.kind === "tree" && (
            <DropdownMenuItem asChild>
              <a href={`/api/export?tree=${node.id}`} download>
                <Download /> Export JSON
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
            <Trash2 /> Delete {label}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "edit" && (
        <NodeFormDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          mode={{
            type: "edit",
            id: node.id,
            kind: node.kind,
            name: node.name,
            description: node.description,
          }}
        />
      )}
      {dialog === "move" && (
        <MoveNodeDialog node={node} targets={moveTargets} onClose={() => setDialog(null)} />
      )}
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={`Delete "${node.name}"?`}
        description={`This permanently deletes the ${label}, everything inside it, and all of its cards and review history.`}
        onConfirm={() => deleteNode(node.id)}
      />
    </>
  )
}

function MoveNodeDialog({
  node,
  targets,
  onClose,
}: {
  node: ActionNode
  targets: MoveTarget[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const submit = () =>
    startTransition(async () => {
      if (!selected) return
      const result = await moveNode({ id: node.id, parentId: selected })
      if (!result.ok) return setError(result.error)
      toast.success("Moved")
      onClose()
    })

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move &ldquo;{node.name}&rdquo;</DialogTitle>
          <DialogDescription>Choose a tree or branch to move it into.</DialogDescription>
        </DialogHeader>
        <div
          role="listbox"
          aria-label="Destination"
          className="max-h-72 overflow-y-auto rounded-lg border p-1"
        >
          {targets.map((t) => (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={selected === t.id}
              disabled={t.id === node.parentId}
              onClick={() => setSelected(t.id)}
              style={{ paddingLeft: t.depth * 16 + 8 }}
              className="hover:bg-muted aria-selected:bg-primary aria-selected:text-primary-foreground flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm disabled:opacity-50"
            >
              <NodeKindIcon kind={t.kind} className="size-3.5" />
              <span className="truncate">{t.name}</span>
              {t.id === node.parentId && <span className="ml-auto text-xs">current</span>}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!selected || pending}>
            {pending && <Spinner />}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
