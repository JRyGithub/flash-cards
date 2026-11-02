/*
 * Validates a card file with the same parser the import page uses, so a file that passes
 * here imports cleanly. Also flags cards that are likely to study badly.
 *
 *   pnpm cards:check cards/github-actions/triggers.csv
 *
 * Exits non-zero on errors (rows the importer would skip, or no cards at all). Warnings
 * (duplicates, very long sides) don't fail the check.
 */
import { readFileSync } from "node:fs"

import { MAX_IMPORT_ROWS, parseCardCsv } from "../src/lib/card-csv"

const MAX_BYTES = 4_000_000
const LONG_FRONT = 200
const LONG_BACK = 600

function main() {
  const [file] = process.argv.slice(2)
  if (!file) throw new Error("Usage: pnpm cards:check <file.csv|file.tsv>")

  const text = readFileSync(file, "utf8")
  const errors: string[] = []
  const warnings: string[] = []

  if (Buffer.byteLength(text) > MAX_BYTES) errors.push(`File is over the 4MB import limit`)
  const { cards, issues } = parseCardCsv(text)
  for (const issue of issues) errors.push(`Row ${issue.row}: ${issue.message}`)
  if (cards.length === 0) errors.push("No cards found")
  if (cards.length > MAX_IMPORT_ROWS) errors.push(`More than ${MAX_IMPORT_ROWS} cards`)

  const seen = new Map<string, number>()
  cards.forEach((card, i) => {
    const n = i + 1
    const key = card.frontMd.toLowerCase().replace(/\s+/g, " ")
    if (seen.has(key)) warnings.push(`Card ${n} has the same front as card ${seen.get(key)}`)
    else seen.set(key, n)
    if (card.frontMd.length > LONG_FRONT)
      warnings.push(`Card ${n}: front is long (${card.frontMd.length} chars)`)
    if (card.backMd.length > LONG_BACK)
      warnings.push(`Card ${n}: back is long (${card.backMd.length} chars); consider splitting it`)
    if (
      (card.backMd.match(/```/g)?.length ?? 0) % 2 ||
      (card.frontMd.match(/```/g)?.length ?? 0) % 2
    ) {
      errors.push(`Card ${n}: unclosed code fence`)
    }
  })

  const reversible = cards.filter((c) => c.reversible).length
  console.log(
    `${file}: ${cards.length} cards (${reversible} reversible, ${cards.length + reversible} to study)`,
  )
  for (const w of warnings) console.log(`  ⚠ ${w}`)
  for (const e of errors) console.log(`  ✗ ${e}`)
  if (errors.length) process.exit(1)
  console.log("  ✓ Ready to import")
}

try {
  main()
} catch (error) {
  console.error(`✗ ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
