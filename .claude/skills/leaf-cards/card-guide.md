# Leaf card guide

The single reference for writing card files this app can import into a leaf (or a branch's
own cards). Both the `/leaf-cards` skill and the `leaf-card-writer` agent follow it.

## File format

The importer is `parseCardCsv` in `src/lib/card-csv.ts`. Write CSV exactly like this:

```
front,back,reversible
"What does CI stand for?","Continuous integration","no"
```

- **Header** `front,back,reversible` on the first line.
- **Quote every field** with double quotes, and escape a `"` inside a field as `""`. Quoted fields may contain commas and line breaks, which is how multi-line markdown and code blocks fit in one cell.
- **`reversible`** is `yes` or `no`. A reversible card is also studied back → front.
- **Encoding:** UTF-8. Use a `.csv` extension, at most 5000 cards and 4MB per file.
- **One file per leaf.** Save to `cards/<tree-slug>/<leaf-slug>.csv`. The `cards/` folder is gitignored because this repo is public.

### Markdown in cards

Both sides render GitHub-flavoured markdown: **bold**, `inline code`, lists and tables, and
fenced code blocks with syntax highlighting (` ```yaml `, ` ```bash `, ` ```ts `, …). Raw HTML
is not rendered, and images only show if they're public `https://` URLs.

A code block inside a quoted CSV field:

````
"Which trigger runs a workflow on every push?","```yaml
on: push
```","no"
````

## Writing good cards

Cards are scheduled with FSRS. Each card is reviewed many times, so a bad card costs time again and again.

1. **One fact per card.** Split "What are X, Y and Z?" into three cards. Lists of more than about three items are hard to recall reliably. Break them into separate cards, or into "Which item … ?" questions.
2. **Ask a precise question with one right answer.** Write "Which event triggers a workflow when a PR is opened?", not "Tell me about pull_request".
3. **Avoid yes/no questions.** They're guessable and teach little; ask "which", "what", "when", "why" or "how" instead.
4. **Keep answers short.** Aim for a phrase or one or two sentences. Add a short "why" line when it helps memory, not a paragraph.
5. **Give context in the front when the topic is ambiguous**, e.g. "(GitHub Actions) What does `needs:` do?".
6. **Use code for code.** Ask for the syntax ("Write the `on:` block that runs nightly at 02:00 UTC") and answer with a fenced block.
7. **Use `reversible: yes` only for true pairs**, i.e. a term ↔ definition, or an acronym ↔ expansion, where both directions make sense. Never use it for "how/why" questions.
8. **No duplicates or near-duplicates.** Two cards may test the same fact from genuinely different angles, but not with reworded questions.
9. **Be accurate and current.** Prefer official documentation. If sources disagree, or you're unsure, leave the card out and mention it in your report. Never guess.
10. **Size each leaf to its concept.** 10–40 cards is typical. If a topic needs much more, suggest splitting it into several leaves (or a branch with leaves).

## Validate before handing over

```bash
pnpm cards:check cards/<tree-slug>/<leaf-slug>.csv
```

It uses the app's own parser. Fix every ✗ error, and review each ⚠ warning (duplicates, very long sides).

## Importing

In the app, open the leaf, then choose **Import** and upload the file (or paste its contents). The preview shows the cards and any rows that would be skipped. You can also create the leaf first from its branch with **Branch or leaf**.
