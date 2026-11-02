import type { DueCounts, NodeKind, TreeNode } from "./types"

/** Trees and branches can contain branches and leaves; leaves are terminal. */
export function canHaveChildren(kind: NodeKind): boolean {
  return kind !== "leaf"
}

export function isValidChildKind(kind: NodeKind): kind is "branch" | "leaf" {
  return kind === "branch" || kind === "leaf"
}

/** Cards attach to branches (a "direct anki") and leaves, but not trees. */
export function canHoldNotes(kind: NodeKind): boolean {
  return kind !== "tree"
}

type Ordered = Pick<TreeNode, "position" | "name">

export function byPosition(a: Ordered, b: Ordered): number {
  return a.position - b.position || a.name.localeCompare(b.name)
}

/** Sum each node's own counts with all of its descendants'. */
export function rollUpCounts(
  nodes: readonly TreeNode[],
  ownCounts: ReadonlyMap<string, DueCounts>,
): Map<string, DueCounts> {
  const children = new Map<string | null, TreeNode[]>()
  for (const node of nodes) {
    const siblings = children.get(node.parentId) ?? []
    siblings.push(node)
    children.set(node.parentId, siblings)
  }

  const totals = new Map<string, DueCounts>()
  const visit = (node: TreeNode): DueCounts => {
    const own = ownCounts.get(node.id)
    const total = { new: own?.new ?? 0, learning: own?.learning ?? 0, review: own?.review ?? 0 }
    for (const child of children.get(node.id) ?? []) {
      const c = visit(child)
      total.new += c.new
      total.learning += c.learning
      total.review += c.review
    }
    totals.set(node.id, total)
    return total
  }
  for (const root of children.get(null) ?? []) visit(root)
  return totals
}
