import { InvariantViolation, NotFoundError } from "../domain/errors"
import { byPosition, canHaveChildren, isValidChildKind } from "../domain/hierarchy"
import type { NodeKind, TreeNode } from "../domain/types"
import type { NodeRepository, UnitOfWork } from "../repositories/interfaces"

export interface NodeDetails {
  name: string
  description?: string | null
}

export class NodeService {
  constructor(
    private readonly deps: {
      nodes: NodeRepository
      uow: UnitOfWork
    },
  ) {}

  listAll(): Promise<TreeNode[]> {
    return this.deps.nodes.listAll()
  }

  listTrees(): Promise<TreeNode[]> {
    return this.deps.nodes.listChildren(null)
  }

  listChildren(id: string): Promise<TreeNode[]> {
    return this.deps.nodes.listChildren(id)
  }

  async get(id: string): Promise<TreeNode> {
    const node = await this.deps.nodes.findById(id)
    if (!node) throw new NotFoundError("Node", id)
    return node
  }

  /** Breadcrumb trail: root tree first, ending with the node. */
  getPath(id: string): Promise<TreeNode[]> {
    return this.deps.nodes.listAncestors(id)
  }

  async createTree(details: NodeDetails): Promise<TreeNode> {
    return this.deps.nodes.create({
      parentId: null,
      kind: "tree",
      ...normalise(details),
      position: await this.deps.nodes.nextPosition(null),
    })
  }

  async createChild(parentId: string, kind: NodeKind, details: NodeDetails): Promise<TreeNode> {
    if (!isValidChildKind(kind))
      throw new InvariantViolation("Trees can only be created at the top level")
    const parent = await this.get(parentId)
    if (!canHaveChildren(parent.kind))
      throw new InvariantViolation("Leaves cannot contain other nodes")

    return this.deps.nodes.create({
      parentId,
      kind,
      ...normalise(details),
      position: await this.deps.nodes.nextPosition(parentId),
    })
  }

  async update(id: string, details: NodeDetails): Promise<TreeNode> {
    await this.get(id)
    return this.deps.nodes.update(id, normalise(details))
  }

  /** Move a branch or leaf under a different tree or branch. */
  async move(id: string, newParentId: string): Promise<TreeNode> {
    const node = await this.get(id)
    if (node.kind === "tree")
      throw new InvariantViolation("Trees are top-level and cannot be moved")
    if (node.parentId === newParentId) return node

    const parent = await this.get(newParentId)
    if (!canHaveChildren(parent.kind))
      throw new InvariantViolation("Leaves cannot contain other nodes")
    const subtree = await this.deps.nodes.listSubtreeIds(id)
    if (subtree.includes(newParentId)) {
      throw new InvariantViolation("A node cannot be moved inside itself")
    }

    return this.deps.nodes.update(id, {
      parentId: newParentId,
      position: await this.deps.nodes.nextPosition(newParentId),
    })
  }

  /** Swap a node with its previous or next sibling. */
  async reorder(id: string, direction: "up" | "down"): Promise<void> {
    const node = await this.get(id)
    await this.deps.uow.transaction(async ({ nodes }) => {
      const siblings = (await nodes.listChildren(node.parentId)).sort(byPosition)
      const index = siblings.findIndex((s) => s.id === id)
      const swapWith = siblings[direction === "up" ? index - 1 : index + 1]
      if (index < 0 || !swapWith) return

      // Re-number so positions are dense, then swap the pair.
      const ordered = [...siblings]
      ordered[index] = swapWith
      ordered[siblings.indexOf(swapWith)] = siblings[index]!
      for (const [position, sibling] of ordered.entries()) {
        if (sibling.position !== position) await nodes.update(sibling.id, { position })
      }
    })
  }

  async delete(id: string): Promise<TreeNode> {
    const node = await this.get(id)
    await this.deps.nodes.delete(id)
    return node
  }
}

function normalise({ name, description }: NodeDetails) {
  const trimmed = name.trim()
  if (!trimmed) throw new InvariantViolation("Name is required")
  return { name: trimmed, description: description?.trim() || null }
}
