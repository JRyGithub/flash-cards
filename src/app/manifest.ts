import type { MetadataRoute } from "next"

/** Lets the app be installed to a phone's home screen and open full-screen like a native app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flash Cards",
    short_name: "Flash Cards",
    description: "Spaced-repetition flash cards organised into trees, branches and leaves.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#eefbf2",
    theme_color: "#eefbf2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
