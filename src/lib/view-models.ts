import type { DueCounts, NodeKind } from "@/server/domain/types"

/* Plain, serialisable shapes passed from Server Components to the UI. */

export type { DueCounts, NodeKind }

export interface NodeSummary {
  id: string
  parentId: string | null
  kind: NodeKind
  name: string
  description: string | null
  position: number
  counts: DueCounts
}

export interface NoteView {
  id: string
  frontMd: string
  backMd: string
  reversible: boolean
}

export const KIND_LABEL: Record<NodeKind, string> = { tree: "Tree", branch: "Branch", leaf: "Leaf" }

export const KIND_DESCRIPTION: Record<NodeKind, string> = {
  tree: "A goal or large concept, e.g. a certification.",
  branch: "A section that can hold its own cards, leaves and further branches.",
  leaf: "A collection of cards for a single concept.",
}
