---
name: leaf-cards
description: Research a topic from URLs, files, notes or well-established knowledge, and write a validated CSV of flash cards ready to import into a leaf of this app. Use when asked to make, generate or draft cards, a deck or a leaf, or to turn docs, notes, a course section or a syllabus into flash cards.
argument-hint: "<topic or leaf name> [sources: URLs, file paths, or pasted notes]"
---

# Leaf cards

Turn source material into a card file that imports cleanly into one leaf.

First read [card-guide.md](card-guide.md). It defines the file format and the card-writing rules, and everything below assumes it.

## 1. Pin down the leaf

From the request, work out:

- the **tree** (the goal, e.g. "GitHub Actions certification") and the **leaf** (one concept, e.g. "Workflow triggers");
- the **sources** to use;
- any **scope or depth** hints (exam objectives, "beginner", "only the CLI").

If the topic is clearly too big for one leaf (more than about 40 cards), propose a split into several leaves or a branch with leaves, and confirm it before writing. Ask only about things you can't sensibly infer.

## 2. Gather the material

Work through these in order, using whatever applies:

- **Sources the user gave:** read every URL (WebFetch, or the web-fetch agent), file (Read, including PDFs) or pasted note.
- **Official documentation:** search for it (WebSearch) when no sources were given and the topic changes over time, such as products, APIs, tools or exam syllabi.
- **Your own knowledge:** only for stable, well-established facts. Check anything version-specific against a source.

Keep a short list of the URLs or files you actually used.

## 3. Write the cards

- Draft them following every rule in card-guide.md: one fact per card, precise questions, short answers, code in fences, and `reversible` only for true pairs.
- Order cards from foundational to advanced, so studying a new leaf builds up naturally.
- Write the file to `cards/<tree-slug>/<leaf-slug>.csv` (lower-case, hyphenated).

## 4. Validate and fix

Run:

```bash
pnpm cards:check cards/<tree-slug>/<leaf-slug>.csv
```

Fix every error, review each warning, and repeat until it passes.

## 5. Report back

Keep the report short:

- the file path and the card count (and how many are reversible);
- what the leaf covers, plus anything you deliberately left out or weren't sure about;
- the sources used;
- how to import: open the leaf → **Import** → upload the file.

Don't paste the whole CSV unless asked.
