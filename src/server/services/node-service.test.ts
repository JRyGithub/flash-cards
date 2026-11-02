import { describe, expect, it } from "vitest"

import { InvariantViolation } from "../domain/errors"
import { createTestApp } from "../testing/in-memory"

async function seed() {
  const app = createTestApp()
  const { nodes } = app.services
  const tree = await nodes.createTree({ name: "github-300" })
  const section = await nodes.createChild(tree.id, "branch", { name: "Section 1" })
  const actions = await nodes.createChild(section.id, "leaf", { name: "Actions" })
  return { ...app, tree, section, actions }
}

describe("NodeService", () => {
  it("builds a tree of branches and leaves with breadcrumbs", async () => {
    const { services, tree, section, actions } = await seed()
    const path = await services.nodes.getPath(actions.id)
    expect(path.map((n) => n.name)).toEqual(["github-300", "Section 1", "Actions"])
    expect((await services.nodes.listChildren(tree.id)).map((n) => n.id)).toEqual([section.id])
  })

  it("lets branches nest inside branches", async () => {
    const { services, section } = await seed()
    const nested = await services.nodes.createChild(section.id, "branch", { name: "Deep dive" })
    expect(nested.parentId).toBe(section.id)
  })

  it("refuses children under a leaf", async () => {
    const { services, actions } = await seed()
    await expect(services.nodes.createChild(actions.id, "leaf", { name: "x" })).rejects.toThrow(
      InvariantViolation,
    )
  })

  it("refuses nested trees", async () => {
    const { services, tree } = await seed()
    await expect(services.nodes.createChild(tree.id, "tree", { name: "x" })).rejects.toThrow(
      InvariantViolation,
    )
  })

  it("requires a non-blank name", async () => {
    const { services } = await seed()
    await expect(services.nodes.createTree({ name: "   " })).rejects.toThrow(InvariantViolation)
  })

  it("moves nodes but never inside themselves", async () => {
    const { services, tree, section, actions } = await seed()
    const other = await services.nodes.createChild(tree.id, "branch", { name: "Section 2" })

    const moved = await services.nodes.move(actions.id, other.id)
    expect(moved.parentId).toBe(other.id)

    const child = await services.nodes.createChild(section.id, "branch", { name: "Child" })
    await expect(services.nodes.move(section.id, child.id)).rejects.toThrow(/inside itself/)
    await expect(services.nodes.move(section.id, section.id)).rejects.toThrow(/inside itself/)
    await expect(services.nodes.move(tree.id, other.id)).rejects.toThrow(/cannot be moved/)
  })

  it("reorders siblings", async () => {
    const { services, tree, section } = await seed()
    const second = await services.nodes.createChild(tree.id, "branch", { name: "Section 2" })
    await services.nodes.reorder(second.id, "up")
    const ids = (await services.nodes.listChildren(tree.id)).map((n) => n.id)
    expect(ids).toEqual([second.id, section.id])

    // Moving the first node further up is a no-op.
    await services.nodes.reorder(second.id, "up")
    expect((await services.nodes.listChildren(tree.id)).map((n) => n.id)).toEqual(ids)
  })

  it("deletes a node with its whole subtree", async () => {
    const { services, store, tree, actions } = await seed()
    await services.notes.create(actions.id, { frontMd: "Q", backMd: "A", reversible: false })
    await services.nodes.delete(tree.id)
    expect(store.nodes.size).toBe(0)
    expect(store.cards.size).toBe(0)
  })
})
