import { type DueCounts, EMPTY_COUNTS, type NodeKind, type TreeNode } from "./types"

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
  return rollUp(nodes, ownCounts, EMPTY_COUNTS, (a, b) => ({
    new: a.new + b.new,
    learning: a.learning + b.learning,
    review: a.review + b.review,
  }))
}

/** Sum each node's own card total with all of its descendants'. */
export function rollUpTotals(
  nodes: readonly TreeNode[],
  ownTotals: ReadonlyMap<string, number>,
): Map<string, number> {
  return rollUp(nodes, ownTotals, 0, (a, b) => a + b)
}

function rollUp<T>(
  nodes: readonly TreeNode[],
  own: ReadonlyMap<string, T>,
  zero: T,
  add: (a: T, b: T) => T,
): Map<string, T> {
  const children = new Map<string | null, TreeNode[]>()
  for (const node of nodes) {
    const siblings = children.get(node.parentId) ?? []
    siblings.push(node)
    children.set(node.parentId, siblings)
  }

  const totals = new Map<string, T>()
  const visit = (node: TreeNode): T => {
    let total = own.get(node.id) ?? zero
    for (const child of children.get(node.id) ?? []) total = add(total, visit(child))
    totals.set(node.id, total)
    return total
  }
  for (const root of children.get(null) ?? []) visit(root)
  return totals
}
