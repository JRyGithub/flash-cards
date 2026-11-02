import { describe, expect, it } from "vitest"

import { CardState, Rating } from "../domain/types"
import { createTestApp } from "../testing/in-memory"

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

async function seed() {
  const app = createTestApp()
  const { nodes, notes } = app.services
  const tree = await nodes.createTree({ name: "github-300" })
  const section = await nodes.createChild(tree.id, "branch", { name: "Section 1" })
  const leafA = await nodes.createChild(section.id, "leaf", { name: "Actions" })
  const leafB = await nodes.createChild(tree.id, "leaf", { name: "Packages" })
  await notes.create(section.id, { frontMd: "Branch Q", backMd: "Branch A", reversible: false })
  await notes.create(leafA.id, { frontMd: "Leaf A Q", backMd: "Leaf A A", reversible: true })
  await notes.create(leafB.id, { frontMd: "Leaf B Q", backMd: "Leaf B A", reversible: false })
  return { ...app, tree, section, leafA, leafB }
}

describe("StudyService", () => {
  it("studying a tree includes cards from every descendant", async () => {
    const { services, tree } = await seed()
    const state = await services.study.next(tree.id)
    expect(state.remaining).toEqual({ new: 4, learning: 0, review: 0 })
    expect(state.current).not.toBeNull()
  })

  it("studying a leaf only includes that leaf", async () => {
    const { services, leafB } = await seed()
    const state = await services.study.next(leafB.id)
    expect(state.remaining.new).toBe(1)
    expect(state.current?.promptMd).toBe("Leaf B Q")
  })

  it("reverse cards swap prompt and answer", async () => {
    const { services, leafA } = await seed()
    const forward = await services.study.next(leafA.id)
    expect(forward.current).toMatchObject({ direction: "forward", promptMd: "Leaf A Q" })

    const reverse = await services.study.review(
      leafA.id,
      forward.current!.cardId,
      Rating.Easy,
      null,
    )
    expect(reverse.current).toMatchObject({
      direction: "reverse",
      promptMd: "Leaf A A",
      answerMd: "Leaf A Q",
    })
  })

  it("provides interval labels for every rating", async () => {
    const { services, leafB } = await seed()
    const { current } = await services.study.next(leafB.id)
    expect(current!.intervals[Rating.Again]).toBe("1m")
    expect(Object.keys(current!.intervals)).toEqual(["1", "2", "3", "4"])
  })

  it("persists the review, logs the prior state, and schedules learning steps", async () => {
    const { services, store, clock, leafB } = await seed()
    const { current } = await services.study.next(leafB.id)
    const next = await services.study.review(leafB.id, current!.cardId, Rating.Again, 4200)

    const card = store.cards.get(current!.cardId)!
    expect(card.state).toBe(CardState.Learning)
    expect(card.reps).toBe(1)
    expect(card.dueAt.getTime()).toBe(clock.now().getTime() + MINUTE)
    expect(store.reviewLogs).toHaveLength(1)
    expect(store.reviewLogs[0]).toMatchObject({
      cardId: card.id,
      rating: Rating.Again,
      state: CardState.New,
      durationMs: 4200,
    })

    // The only card is in learning and due within the learn-ahead window, so it's shown again.
    expect(next.current?.cardId).toBe(card.id)
    expect(next.remaining).toEqual({ new: 0, learning: 1, review: 0 })
  })

  it("graduated cards leave today's queue and come back when due", async () => {
    const { services, store, clock, leafB } = await seed()
    let state = await services.study.next(leafB.id)
    state = await services.study.review(leafB.id, state.current!.cardId, Rating.Easy, null)
    expect(state.current).toBeNull()

    const card = [...store.cards.values()].find((c) => c.state === CardState.Review)!
    clock.set(new Date(card.dueAt.getTime() + DAY))
    state = await services.study.next(leafB.id)
    expect(state.current?.cardId).toBe(card.id)
    expect(state.remaining.review).toBe(1)
  })

  it("reports when the next learning card comes due once nothing is left now", async () => {
    const { services, store, leafB } = await seed()
    let state = await services.study.next(leafB.id)
    const cardId = state.current!.cardId
    state = await services.study.review(leafB.id, cardId, Rating.Good, null)
    // A 10m learning step is inside the 20m learn-ahead window, so it's shown straight away.
    expect(state.current?.cardId).toBe(cardId)

    // Push the step beyond the learn-ahead window.
    store.cards.set(cardId, {
      ...store.cards.get(cardId)!,
      dueAt: new Date(Date.parse("2026-01-01T12:00:00Z")),
    })
    state = await services.study.next(leafB.id)
    expect(state.current).toBeNull()
    expect(state.nextLearningDueAt?.toISOString()).toBe("2026-01-01T12:00:00.000Z")
  })

  it("caps new cards per day across all trees", async () => {
    const { services, tree, leafB } = await seed()
    await services.settings.update({ newCardsPerDay: 1 })

    expect((await services.study.next(tree.id)).remaining.new).toBe(1)
    const { current } = await services.study.next(leafB.id)
    const after = await services.study.review(leafB.id, current!.cardId, Rating.Easy, null)
    expect(after.remaining.new).toBe(0)
    expect((await services.study.next(tree.id)).current).toBeNull()
  })

  it("rolls counts up the tree for the dashboard", async () => {
    const { services, tree, section, leafA, leafB } = await seed()
    const counts = await services.study.countsForAll()
    expect(counts.get(tree.id)?.new).toBe(4)
    expect(counts.get(section.id)?.new).toBe(3)
    expect(counts.get(leafA.id)?.new).toBe(2)
    expect(counts.get(leafB.id)?.new).toBe(1)
  })
})
