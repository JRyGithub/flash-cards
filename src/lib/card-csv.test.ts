import { describe, expect, it } from "vitest"

import { parseCardCsv } from "./card-csv"

describe("parseCardCsv", () => {
  it("parses comma separated rows and skips a header", () => {
    const { cards, issues } = parseCardCsv("front,back\nWhat is CI?,Continuous integration\n")
    expect(issues).toEqual([])
    expect(cards).toEqual([
      { frontMd: "What is CI?", backMd: "Continuous integration", reversible: false },
    ])
  })

  it("detects tabs and reads the reversible column", () => {
    const { cards } = parseCardCsv("a\tb\tyes\nc\td\tno\ne\tf")
    expect(cards.map((c) => c.reversible)).toEqual([true, false, false])
  })

  it("supports quoted multi-line markdown with commas", () => {
    const text = '"Explain `on:`, briefly","```yaml\non: push\n```"\n'
    const { cards } = parseCardCsv(text)
    expect(cards[0]).toEqual({
      frontMd: "Explain `on:`, briefly",
      backMd: "```yaml\non: push\n```",
      reversible: false,
    })
  })

  it("applies the default reversible flag when the column is missing", () => {
    expect(parseCardCsv("q,a", { defaultReversible: true }).cards[0]!.reversible).toBe(true)
  })

  it("reports rows missing a side with their row number", () => {
    const { cards, issues } = parseCardCsv("q1,a1\nonly-front\n,a3\n")
    expect(cards).toHaveLength(1)
    expect(issues).toEqual([
      { row: 2, message: "Each row needs a front and a back" },
      { row: 3, message: "Each row needs a front and a back" },
    ])
  })

  it("ignores a byte-order mark and blank lines", () => {
    expect(parseCardCsv("\uFEFFq,a\n\n\n").cards).toHaveLength(1)
  })
})
