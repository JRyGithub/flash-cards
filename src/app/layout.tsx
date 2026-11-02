import "./globals.css"
import "highlight.js/styles/github-dark.css"

import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { Toaster } from "@/components/atoms/sonner"
import { TooltipProvider } from "@/components/atoms/tooltip"
import { ThemeProvider } from "@/components/providers/theme-provider"

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: { default: "Flash Cards", template: "%s · Flash Cards" },
  description: "Spaced-repetition flash cards organised into trees, branches and leaves.",
  robots: { index: false, follow: false },
}

// Tints mobile browser chrome to match the --background token in each theme.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eefbf2" },
    { media: "(prefers-color-scheme: dark)", color: "#021c0f" },
  ],
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
