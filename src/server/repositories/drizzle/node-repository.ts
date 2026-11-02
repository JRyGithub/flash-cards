import { asc, eq, inArray, isNull, sql } from "drizzle-orm"

import { type DbExecutor, rowsOf } from "../../db/types"
import { nodes } from "../../db/schema"
import { NotFoundError } from "../../domain/errors"
import type { TreeNode } from "../../domain/types"
import type { NewNode, NodeRepository } from "../interfaces"

export class DrizzleNodeRepository implements NodeRepository {
  constructor(private readonly db: DbExecutor) {}

  async findById(id: string): Promise<TreeNode | null> {
    const [row] = await this.db.select().from(nodes).where(eq(nodes.id, id))
    return row ?? null
  }

  listAll(): Promise<TreeNode[]> {
    return this.db.select().from(nodes).orderBy(asc(nodes.position), asc(nodes.name))
  }

  listChildren(parentId: string | null): Promise<TreeNode[]> {
    return this.db
      .select()
      .from(nodes)
      .where(parentId === null ? isNull(nodes.parentId) : eq(nodes.parentId, parentId))
      .orderBy(asc(nodes.position), asc(nodes.name))
  }

  async listAncestors(id: string): Promise<TreeNode[]> {
    const chain = rowsOf<{ id: string; depth: number }>(
      await this.db.execute(sql`
      WITH RECURSIVE chain AS (
        SELECT id, parent_id, 0 AS depth FROM ${nodes} WHERE id = ${id}
        UNION ALL
        SELECT n.id, n.parent_id, c.depth + 1 FROM ${nodes} n JOIN chain c ON n.id = c.parent_id
      )
      SELECT id, depth FROM chain
    `),
    )
    if (chain.length === 0) return []
    const depthById = new Map(chain.map((r) => [r.id, Number(r.depth)]))
    const rows = await this.db
      .select()
      .from(nodes)
      .where(inArray(nodes.id, [...depthById.keys()]))
    return rows.sort((a, b) => depthById.get(b.id)! - depthById.get(a.id)!)
  }

  async listSubtreeIds(id: string): Promise<string[]> {
    const rows = rowsOf<{ id: string }>(
      await this.db.execute(sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM ${nodes} WHERE id = ${id}
        UNION ALL
        SELECT n.id FROM ${nodes} n JOIN subtree s ON n.parent_id = s.id
      )
      SELECT id FROM subtree
    `),
    )
    return rows.map((r) => r.id)
  }

  async nextPosition(parentId: string | null): Promise<number> {
    const [row] = await this.db
      .select({ max: sql<number | null>`max(${nodes.position})` })
      .from(nodes)
      .where(parentId === null ? isNull(nodes.parentId) : eq(nodes.parentId, parentId))
    return row?.max == null ? 0 : Number(row.max) + 1
  }

  async create(input: NewNode): Promise<TreeNode> {
    const [row] = await this.db.insert(nodes).values(input).returning()
    return row!
  }

  async update(
    id: string,
    patch: Partial<Pick<TreeNode, "name" | "description" | "parentId" | "position">>,
  ): Promise<TreeNode> {
    const [row] = await this.db.update(nodes).set(patch).where(eq(nodes.id, id)).returning()
    if (!row) throw new NotFoundError("Node", id)
    return row
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(nodes).where(eq(nodes.id, id))
  }
}
