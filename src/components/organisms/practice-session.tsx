"use client"

import { ArrowLeft, Dumbbell, PartyPopper, Repeat, RotateCcw } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/atoms/badge"
import { Button } from "@/components/atoms/button"
import { Card, CardContent } from "@/components/atoms/card"
import { Kbd } from "@/components/atoms/kbd"
import { Separator } from "@/components/atoms/separator"
import { EmptyState } from "@/components/molecules/empty-state"
import { Markdown } from "@/components/molecules/markdown"
import { RatingButton } from "@/components/molecules/rating-button"
import { shuffle } from "@/lib/shuffle"
import type { PracticeCard } from "@/server/services/study-service"

/**
 * Practice runs through every card in the node without scheduling anything. "Again" sends
 * the card to the back of the queue; "Got it" drops it. Keyboard: Space/Enter reveals (then
 * means Got it); 1 is Again, 2–4 are Got it.
 */
export function PracticeSession({
  nodeId,
  nodeName,
  deck,
}: {
  nodeId: string
  nodeName: string
  deck: PracticeCard[]
}) {
  const [queue, setQueue] = useState(deck)
  const [revealed, setRevealed] = useState(false)
  const [seen, setSeen] = useState(0)
  const [missed, setMissed] = useState(() => new Set<string>())
  const current = queue[0]

  const answer = useCallback(
    (gotIt: boolean) => {
      if (!current) return
      setSeen((n) => n + 1)
      setRevealed(false)
      if (gotIt) {
        setQueue((q) => q.slice(1))
      } else {
        setMissed((m) => new Set(m).add(current.cardId))
        setQueue((q) => [...q.slice(1), q[0]])
      }
    },
    [current],
  )

  const restart = () => {
    setQueue(shuffle(deck))
    setRevealed(false)
    setSeen(0)
    setMissed(new Set())
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || !current) return
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]"))
        return
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        if (revealed) answer(true)
        else setRevealed(true)
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault()
        answer(e.key !== "1")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [current, revealed, answer])

  const back = (
    <Button asChild variant={current ? "ghost" : "outline"}>
      <Link href={`/nodes/${nodeId}`}>
        <ArrowLeft /> Back to {nodeName}
      </Link>
    </Button>
  )

  if (deck.length === 0) {
    return (
      <EmptyState
        icon={<Dumbbell />}
        title="No cards to practise"
        description="Add or import cards here first."
        action={back}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="text-muted-foreground flex items-center justify-between gap-3 text-sm">
        <span>
          <span className="text-foreground font-mono font-semibold tabular-nums">
            {queue.length}
          </span>{" "}
          left · doesn&apos;t affect your schedule
        </span>
        <span>{seen} seen</span>
      </div>

      {current ? (
        <>
          <Card className="min-h-72" aria-live="polite">
            <CardContent className="flex flex-col gap-4">
              {current.direction === "reverse" && (
                <Badge variant="secondary" className="self-start">
                  <Repeat /> Reverse
                </Badge>
              )}
              <Markdown className="text-base sm:text-lg">{current.promptMd}</Markdown>
              {revealed && (
                <>
                  <Separator />
                  <Markdown className="text-base sm:text-lg">{current.answerMd}</Markdown>
                </>
              )}
            </CardContent>
          </Card>

          <div className="bg-background/90 sticky bottom-0 py-3 backdrop-blur">
            {revealed ? (
              <div className="flex gap-2">
                <RatingButton
                  rating={1}
                  label="Again"
                  interval="Later this round"
                  onRate={() => answer(false)}
                />
                <RatingButton
                  rating={3}
                  label="Got it"
                  interval="Done"
                  onRate={() => answer(true)}
                />
              </div>
            ) : (
              <Button size="lg" className="h-12 w-full" onClick={() => setRevealed(true)}>
                Show answer <Kbd className="ml-2 hidden sm:inline-flex">Space</Kbd>
              </Button>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          icon={<PartyPopper />}
          title="Practice complete"
          description={
            missed.size
              ? `You went through ${plural(deck.length)}. ${missed.size} needed another go.`
              : `You got ${deck.length === 1 ? "it" : `all ${plural(deck.length)}`} first time.`
          }
          action={
            <div className="flex gap-2">
              <Button onClick={restart}>
                <RotateCcw /> Practise again
              </Button>
              {back}
            </div>
          }
        />
      )}
    </div>
  )
}

function plural(n: number): string {
  return `${n} card${n === 1 ? "" : "s"}`
}
