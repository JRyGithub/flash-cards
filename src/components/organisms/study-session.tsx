"use client"

import { cn } from "cn"
import { ArrowLeft, Clock, Dumbbell, PartyPopper, Repeat } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import { nextCard, reviewCard } from "@/app/actions/study"
import { Badge } from "@/components/atoms/badge"
import { Button } from "@/components/atoms/button"
import { Card, CardContent } from "@/components/atoms/card"
import { Kbd } from "@/components/atoms/kbd"
import { Separator } from "@/components/atoms/separator"
import { DueCounts } from "@/components/molecules/due-counts"
import { EmptyState } from "@/components/molecules/empty-state"
import { Markdown } from "@/components/molecules/markdown"
import { RatingButton } from "@/components/molecules/rating-button"
import type { StudyState } from "@/server/services/study-service"

const RATINGS = [
  { rating: 1, label: "Again" },
  { rating: 2, label: "Hard" },
  { rating: 3, label: "Good" },
  { rating: 4, label: "Easy" },
] as const

type Rating = (typeof RATINGS)[number]["rating"]

/**
 * The review loop: show the prompt, reveal the answer, rate it, and load the next card.
 * Keyboard: Space/Enter reveals (then means Good); 1–4 rate.
 */
export function StudySession({
  nodeId,
  nodeName,
  initial,
}: {
  nodeId: string
  nodeName: string
  initial: StudyState
}) {
  const [state, setState] = useState(initial)
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [pending, startTransition] = useTransition()
  const shownAt = useRef(0)
  const current = state.current

  useEffect(() => {
    shownAt.current = Date.now()
  }, [current?.cardId, state])

  const rate = useCallback(
    (rating: Rating) => {
      if (!current || pending) return
      const durationMs = Math.min(Date.now() - shownAt.current, 3_600_000)
      startTransition(async () => {
        const result = await reviewCard({ nodeId, cardId: current.cardId, rating, durationMs })
        if (!result.ok) {
          toast.error(result.error)
          return
        }
        setReviewed((n) => n + 1)
        setRevealed(false)
        setState(result.data)
      })
    },
    [current, nodeId, pending],
  )

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await nextCard(nodeId)
      if (result.ok) setState(result.data)
      else toast.error(result.error)
    })
  }, [nodeId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || !current) return
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable]"))
        return
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        if (revealed) rate(3)
        else setRevealed(true)
      } else if (revealed && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault()
        rate(Number(e.key) as Rating)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [current, revealed, rate])

  // When only later learning cards remain, check back automatically once the next is due.
  useEffect(() => {
    if (current || !state.nextLearningDueAt) return
    const delay = new Date(state.nextLearningDueAt).getTime() - Date.now()
    if (delay > 30 * 60_000) return
    const timer = setTimeout(refresh, Math.max(delay, 0) + 500)
    return () => clearTimeout(timer)
  }, [current, state.nextLearningDueAt, refresh])

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <DueCounts counts={state.remaining} showLabels className="text-sm" />
        <span className="text-muted-foreground">{reviewed} reviewed</span>
      </div>

      {current ? (
        <>
          <Card
            className={cn("min-h-72 transition-opacity", pending && "opacity-60")}
            aria-live="polite"
          >
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
                {RATINGS.map(({ rating, label }) => (
                  <RatingButton
                    key={rating}
                    rating={rating}
                    label={label}
                    interval={current.intervals[rating]}
                    disabled={pending}
                    onRate={rate}
                  />
                ))}
              </div>
            ) : (
              <Button
                size="lg"
                className="h-12 w-full"
                onClick={() => setRevealed(true)}
                disabled={pending}
              >
                Show answer <Kbd className="ml-2 hidden sm:inline-flex">Space</Kbd>
              </Button>
            )}
          </div>
        </>
      ) : state.nextLearningDueAt ? (
        <EmptyState
          icon={<Clock />}
          title="Nothing due right now"
          description={`Cards you're still learning come back at ${formatTime(state.nextLearningDueAt)}. This page will pick them up automatically.`}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={refresh} disabled={pending}>
                Check again
              </Button>
              <Button asChild variant="ghost">
                <Link href={`/nodes/${nodeId}`}>
                  <ArrowLeft /> Back to {nodeName}
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <EmptyState
          icon={<PartyPopper />}
          title={reviewed ? "Done for now!" : "Nothing to study"}
          description={
            reviewed
              ? `You reviewed ${reviewed} card${reviewed === 1 ? "" : "s"}. Come back tomorrow for more.`
              : "There are no cards due in here today."
          }
          action={
            <div className="flex gap-2">
              <Button asChild>
                <Link href={`/nodes/${nodeId}`}>
                  <ArrowLeft /> Back to {nodeName}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/nodes/${nodeId}/practice`}>
                  <Dumbbell /> Practice anyway
                </Link>
              </Button>
            </div>
          }
        />
      )}
    </div>
  )
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}
