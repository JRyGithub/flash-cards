"use client"

import { FileUp } from "lucide-react"
import { useRouter } from "next/navigation"
import { useDeferredValue, useId, useMemo, useState, useTransition } from "react"
import { toast } from "sonner"

import { importCsv } from "@/app/actions/imports"
import { Button } from "@/components/atoms/button"
import { Label } from "@/components/atoms/label"
import { Spinner } from "@/components/atoms/spinner"
import { Switch } from "@/components/atoms/switch"
import { Textarea } from "@/components/atoms/textarea"
import { FormField } from "@/components/molecules/form-field"
import { parseCardCsv } from "@/lib/card-csv"

const PREVIEW_ROWS = 20
const EXAMPLE = `front,back,reversible
What does CI stand for?,Continuous integration,no
"Which key starts a workflow on push?","\`\`\`yaml
on: push
\`\`\`",no`

/** Paste or upload CSV/TSV, preview what will be imported, then import into this node. */
export function CsvImportWizard({ nodeId }: { nodeId: string }) {
  const id = useId()
  const router = useRouter()
  const [text, setText] = useState("")
  const [defaultReversible, setDefaultReversible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const deferredText = useDeferredValue(text)
  const parsed = useMemo(
    () => (deferredText.trim() ? parseCardCsv(deferredText, { defaultReversible }) : null),
    [deferredText, defaultReversible],
  )

  async function loadFile(file: File | undefined) {
    if (!file) return
    if (file.size > 4_000_000) return setError("That file is too large (4MB max)")
    setError(null)
    setText(await file.text())
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const result = await importCsv({ nodeId, text, defaultReversible })
      if (!result.ok) return setError(result.error)
      const skipped = result.data.issues.length
      toast.success(
        `Imported ${result.data.imported} card${result.data.imported === 1 ? "" : "s"}`,
        {
          description: skipped
            ? `${skipped} row${skipped === 1 ? " was" : "s were"} skipped`
            : undefined,
        },
      )
      router.push(`/nodes/${nodeId}`)
    })
  }

  return (
    <div className="grid gap-6">
      <FormField
        id={`${id}-text`}
        label="Cards"
        hint="One card per row: front, back and optionally reversible (yes/no). Commas, tabs or semicolons all work, and a header row is optional. Quote fields to include commas or line breaks."
      >
        <Textarea
          id={`${id}-text`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE}
          rows={10}
          className="font-mono text-sm"
        />
      </FormField>

      <div className="flex flex-wrap items-center gap-4">
        <Button variant="outline" asChild>
          <label className="cursor-pointer">
            <FileUp /> Upload .csv / .tsv
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              className="sr-only"
              onChange={(e) => loadFile(e.target.files?.[0])}
            />
          </label>
        </Button>
        <div className="flex items-center gap-2">
          <Switch
            id={`${id}-rev`}
            checked={defaultReversible}
            onCheckedChange={setDefaultReversible}
          />
          <Label htmlFor={`${id}-rev`} className="font-normal">
            Make cards reversible when the column is missing
          </Label>
        </div>
      </div>

      {parsed && (
        <section aria-label="Preview" className="space-y-3">
          <h2 className="text-sm font-medium">
            {parsed.cards.length} card{parsed.cards.length === 1 ? "" : "s"} ready to import
            {parsed.issues.length > 0 && (
              <span className="text-destructive">
                {" "}
                · {parsed.issues.length} row(s) will be skipped
              </span>
            )}
          </h2>
          {parsed.issues.length > 0 && (
            <ul className="border-destructive/30 bg-destructive/5 max-h-32 overflow-y-auto rounded-lg border p-2 text-xs">
              {parsed.issues.map((issue, i) => (
                <li key={i}>
                  Row {issue.row}: {issue.message}
                </li>
              ))}
            </ul>
          )}
          {parsed.cards.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs">
                  <tr>
                    <th className="p-2 font-medium">Front</th>
                    <th className="p-2 font-medium">Back</th>
                    <th className="p-2 font-medium">Reverse</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsed.cards.slice(0, PREVIEW_ROWS).map((card, i) => (
                    <tr key={i} className="align-top">
                      <td className="max-w-xs truncate p-2 font-mono text-xs">{card.frontMd}</td>
                      <td className="max-w-xs truncate p-2 font-mono text-xs">{card.backMd}</td>
                      <td className="p-2 text-xs">{card.reversible ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.cards.length > PREVIEW_ROWS && (
                <p className="text-muted-foreground border-t p-2 text-xs">
                  …and {parsed.cards.length - PREVIEW_ROWS} more
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push(`/nodes/${nodeId}`)}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending || !parsed?.cards.length}>
          {pending && <Spinner />}
          Import {parsed?.cards.length ? `${parsed.cards.length} cards` : ""}
        </Button>
      </div>
    </div>
  )
}
