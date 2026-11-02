import { describe, expect, it } from "vitest"

import { InvariantViolation } from "../domain/errors"
import { Rating } from "../domain/types"
import { createTestApp } from "../testing/in-memory"

async function seed() {
  const app = createTestApp()
  const tree = await app.services.nodes.createTree({ name: "Tree" })
  const branch = await app.services.nodes.createChild(tree.id, "branch", { name: "Branch" })
  return { ...app, tree, branch }
}

const cardsOf = (store: ReturnType<typeof createTestApp>["store"], noteId: string) =>
  [...store.cards.values()].filter((c) => c.noteId === noteId)

describe("NoteService", () => {
  it("creates one card per note, or two when reversible", async () => {
    const { services, store, branch } = await seed()
    const plain = await services.notes.create(branch.id, {
      frontMd: "Q",
      backMd: "A",
      reversible: false,
    })
    const both = await services.notes.create(branch.id, {
      frontMd: "Q2",
      backMd: "A2",
      reversible: true,
    })

    expect(cardsOf(store, plain.id).map((c) => c.direction)).toEqual(["forward"])
    expect(
      cardsOf(store, both.id)
        .map((c) => c.direction)
        .sort(),
    ).toEqual(["forward", "reverse"])
  })

  it("attaches cards directly to branches and leaves, but not trees", async () => {
    const { services, tree, branch } = await seed()
    const leaf = await services.nodes.createChild(branch.id, "leaf", { name: "Leaf" })
    await expect(
      services.notes.create(leaf.id, { frontMd: "Q", backMd: "A", reversible: false }),
    ).resolves.toBeTruthy()
    await expect(
      services.notes.create(tree.id, { frontMd: "Q", backMd: "A", reversible: false }),
    ).rejects.toThrow(InvariantViolation)
  })

  it("requires both sides", async () => {
    const { services, branch } = await seed()
    await expect(
      services.notes.create(branch.id, { frontMd: " ", backMd: "A", reversible: false }),
    ).rejects.toThrow(InvariantViolation)
  })

  it("toggling reversible adds/removes only the reverse card and keeps forward history", async () => {
    const { services, store, branch } = await seed()
    const note = await services.notes.create(branch.id, {
      frontMd: "Q",
      backMd: "A",
      reversible: false,
    })
    const [forward] = cardsOf(store, note.id)
    await services.study.review(branch.id, forward!.id, Rating.Good, 1000)
    const reviewed = store.cards.get(forward!.id)!

    await services.notes.update(note.id, { frontMd: "Q", backMd: "A", reversible: true })
    expect(cardsOf(store, note.id)).toHaveLength(2)
    expect(store.cards.get(forward!.id)).toEqual(reviewed)

    await services.notes.update(note.id, { frontMd: "Q!", backMd: "A", reversible: false })
    expect(cardsOf(store, note.id).map((c) => c.id)).toEqual([forward!.id])
    expect(store.notes.get(note.id)!.frontMd).toBe("Q!")
  })
})
