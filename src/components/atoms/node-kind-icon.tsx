import { cn } from "cn"
import { GitBranch, Leaf, TreePine, type LucideProps } from "lucide-react"

import type { NodeKind } from "@/lib/view-models"

const ICONS = { tree: TreePine, branch: GitBranch, leaf: Leaf } as const
const COLORS = {
  tree: "text-emerald-600 dark:text-emerald-400",
  branch: "text-amber-600 dark:text-amber-400",
  leaf: "text-lime-600 dark:text-lime-400",
}

export function NodeKindIcon({ kind, className, ...props }: LucideProps & { kind: NodeKind }) {
  const Icon = ICONS[kind]
  return <Icon aria-hidden className={cn("size-4 shrink-0", COLORS[kind], className)} {...props} />
}
