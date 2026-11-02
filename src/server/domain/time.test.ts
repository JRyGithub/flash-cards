import { describe, expect, it } from "vitest"

import { formatInterval, isValidTimeZone, studyDayBounds } from "./time"

describe("studyDayBounds", () => {
  it("uses UTC midnight for UTC", () => {
    const { start, end } = studyDayBounds(new Date("2026-03-10T15:30:00Z"), "UTC")
    expect(start.toISOString()).toBe("2026-03-10T00:00:00.000Z")
    expect(end.toISOString()).toBe("2026-03-11T00:00:00.000Z")
  })

  it("uses local midnight for other time zones", () => {
    // 08:00 on the 10th in Auckland (UTC+13) is 19:00 on the 9th in UTC.
    const { start, end } = studyDayBounds(new Date("2026-01-09T19:00:00Z"), "Pacific/Auckland")
    expect(start.toISOString()).toBe("2026-01-09T11:00:00.000Z")
    expect(end.toISOString()).toBe("2026-01-10T11:00:00.000Z")
  })

  it("handles days that are shortened by daylight saving", () => {
    // US clocks spring forward on 2026-03-08, so that day is 23 hours long.
    const { start, end } = studyDayBounds(new Date("2026-03-08T18:00:00Z"), "America/New_York")
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z")
    expect(end.toISOString()).toBe("2026-03-09T04:00:00.000Z")
  })
})

describe("formatInterval", () => {
  it.each([
    [30_000, "1m"],
    [10 * 60_000, "10m"],
    [3 * 3_600_000, "3h"],
    [4 * 86_400_000, "4d"],
    [63 * 86_400_000, "2.1mo"],
    [400 * 86_400_000, "1.1y"],
    [365 * 86_400_000, "1y"],
  ])("%d ms → %s", (ms, label) => {
    expect(formatInterval(ms)).toBe(label)
  })
})

it("validates time zones", () => {
  expect(isValidTimeZone("Europe/London")).toBe(true)
  expect(isValidTimeZone("Mars/Olympus")).toBe(false)
})
