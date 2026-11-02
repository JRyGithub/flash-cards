import { type NextRequest, NextResponse } from "next/server"

import { uuidSchema } from "@/lib/validation"
import { getSessionStatus } from "@/server/auth/session"
import { getServices } from "@/server/container"
import { DomainError } from "@/server/domain/errors"

/** Downloads a JSON backup of everything, or of one tree with `?tree=<id>`. */
export async function GET(request: NextRequest) {
  const session = await getSessionStatus()
  if (session.status !== "owner")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const tree = request.nextUrl.searchParams.get("tree")
  if (tree !== null && !uuidSchema.safeParse(tree).success) {
    return NextResponse.json({ error: "Invalid tree id" }, { status: 400 })
  }

  try {
    const bundle = await getServices().exports.export(tree ?? undefined)
    const date = bundle.exportedAt.slice(0, 10)
    const name = tree ? slug(bundle.nodes.find((n) => n.id === tree)?.name ?? "tree") : "all"
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="flash-cards-${name}-${date}.json"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    if (error instanceof DomainError)
      return NextResponse.json({ error: error.message }, { status: 400 })
    throw error
  }
}

function slug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "tree"
  )
}
