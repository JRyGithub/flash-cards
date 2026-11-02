import Papa from "papaparse"

/*
 * CSV/TSV card parsing, shared by the import preview (client) and the import itself
 * (server re-parses; the client is never trusted).
 *
 * Format: `front,back[,reversible]`, one card per row. A header row is optional, the
 * delimiter (comma, tab, semicolon) is detected, and fields may be quoted to span lines.
 */

export const MAX_IMPORT_ROWS = 5000

export interface ParsedCard {
  frontMd: string
  backMd: string
  reversible: boolean
}

export interface ParseIssue {
  row: number
  message: string
}

export interface ParseResult {
  cards: ParsedCard[]
  issues: ParseIssue[]
}

const TRUTHY = new Set(["1", "true", "yes", "y", "reverse", "reversed", "x"])

export function parseCardCsv(
  text: string,
  options: { defaultReversible?: boolean } = {},
): ParseResult {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
    delimitersToGuess: ["\t", ",", ";", "|"],
  })

  const rows = parsed.data
  const issues: ParseIssue[] = parsed.errors
    .filter((e) => e.code !== "UndetectableDelimiter")
    .map((e) => ({ row: (e.row ?? 0) + 1, message: e.message }))

  const start = rows[0] && isHeader(rows[0]) ? 1 : 0
  const cards: ParsedCard[] = []

  for (let i = start; i < rows.length; i++) {
    const row = rows[i]!
    const line = i + 1
    const [front = "", back = "", reversible] = row.map((cell) => cell.trim())
    if (!front || !back) {
      issues.push({ row: line, message: "Each row needs a front and a back" })
      continue
    }
    if (cards.length >= MAX_IMPORT_ROWS) {
      issues.push({
        row: line,
        message: `Imports are limited to ${MAX_IMPORT_ROWS} cards at a time`,
      })
      break
    }
    cards.push({
      frontMd: front,
      backMd: back,
      reversible: reversible ? TRUTHY.has(reversible.toLowerCase()) : !!options.defaultReversible,
    })
  }

  return { cards, issues }
}

function isHeader(row: string[]): boolean {
  const [a, b] = row.map((c) => c.trim().toLowerCase())
  return (a === "front" || a === "question") && (b === "back" || b === "answer")
}
