import { describe, expect, it } from "vitest"

import { ValidationError } from "../domain/errors"
import { Rating } from "../domain/types"
import { createTestApp } from "../testing/in-memory"

async function seed() {
  const app = createTestApp()
  const { nodes, notes, study } = app.services
  const tree = await nodes.createTree({ name: "github-300", description: "Cert prep" })
  const section = await nodes.createChild(tree.id, "branch", { name: "Section 1" })
  const leaf = await nodes.createChild(section.id, "leaf", { name: "Actions" })
  await notes.create(section.id, { frontMd: "Q1", backMd: "A1", reversible: false })
  await notes.create(leaf.id, { frontMd: "Q2", backMd: "A2", reversible: true })
  const other = await nodes.createTree({ name: "Other" })
  const { current } = await study.next(leaf.id)
  await study.review(leaf.id, current!.cardId, Rating.Good, 1500)
  return { ...app, tree, other }
}

describe("ExportService", () => {
  it("round-trips a tree through JSON as a copy with fresh ids", async () => {
    const { services, store, tree } = await seed()
    const bundle = JSON.parse(JSON.stringify(await services.exports.export(tree.id)))
    expect(bundle.nodes).toHaveLength(3)
    expect(bundle.cards).toHaveLength(3)
    expect(bundle.reviewLogs).toHaveLength(1)

    const summary = await services.exports.import(bundle)
    expect(summary).toEqual({ trees: 1, nodes: 3, notes: 2, cards: 3 })

    const trees = await services.nodes.listTrees()
    expect(trees.map((t) => t.name)).toEqual(["github-300", "Other", "github-300"])
    const copy = trees[2]!
    expect(copy.id).not.toBe(tree.id)
    expect(copy.description).toBe("Cert prep")

    const copiedPath = (await services.nodes.listAll()).filter((n) => n.name === "Actions")
    expect(copiedPath).toHaveLength(2)
    expect(store.reviewLogs).toHaveLength(2)
    const reviewed = [...store.cards.values()].filter((c) => c.reps === 1)
    expect(reviewed).toHaveLength(2)
    expect(reviewed[0]!.dueAt).toEqual(reviewed[1]!.dueAt)
  })

  it("exports everything when no tree is given", async () => {
    const { services } = await seed()
    const bundle = await services.exports.export()
    expect(bundle.nodes.filter((n) => n.kind === "tree")).toHaveLength(2)
  })

  it("only exports whole trees", async () => {
    const { services, tree } = await seed()
    const [section] = await services.nodes.listChildren(tree.id)
    await expect(services.exports.export(section!.id)).rejects.toThrow(ValidationError)
  })

  it("rejects files that aren't exports", async () => {
    const { services } = await seed()
    await expect(services.exports.import({ hello: "world" })).rejects.toThrow(ValidationError)
  })
})
