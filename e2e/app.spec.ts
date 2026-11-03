import { cspGuard as base, expect, sessionCookie, test, USERS } from "./fixtures"

base.describe("access control", () => {
  base("signed-out visitors are sent to the login page", async ({ page }) => {
    await page.goto("/settings")
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings/)
    await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible()
  })

  base("a valid session that isn't the owner is signed out", async ({ page, context }) => {
    await context.addCookies([sessionCookie(USERS.intruder)])
    await page.goto("/")
    await expect(page).toHaveURL(/\/login\?error=forbidden/)
    await expect(page.getByText("That account isn't allowed to use this app.")).toBeVisible()
  })

  base("pages send a strict Content-Security-Policy", async ({ request }) => {
    const csp = (await request.get("/login")).headers()["content-security-policy"] ?? ""
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("connect-src 'self'")
  })

  base("the keep-alive cron requires its secret", async ({ request }) => {
    expect((await request.get("/api/cron/keepalive")).status()).toBe(401)
    const ok = await request.get("/api/cron/keepalive", {
      headers: { Authorization: "Bearer e2e-cron-secret-0123456789" },
    })
    expect(ok.status()).toBe(200)
  })

  base("auth callbacks never redirect off-site", async ({ request }) => {
    const res = await request.get("/auth/callback?code=x&next=//evil.example", { maxRedirects: 0 })
    expect(res.headers().location).toMatch(/^http:\/\/[^/]+\/login\?error=link$/)
  })
})

test.describe.serial("building and studying a tree", () => {
  let treeUrl = ""
  let leafUrl = ""

  test("create a tree, a branch with its own card, and a leaf", async ({ page }) => {
    await page.goto("/")
    await page.getByRole("button", { name: "New tree" }).first().click()
    await page.getByLabel("Name").fill("GitHub Actions")
    await page.getByRole("button", { name: "Create" }).click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("GitHub Actions")
    treeUrl = page.url()

    await page.getByRole("button", { name: "Branch or leaf" }).first().click()
    await page.getByLabel("Name").fill("Section 1")
    await page.getByRole("button", { name: "Create" }).click()
    await page.locator("main").getByRole("link", { name: "Section 1" }).click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Section 1")

    await page.getByRole("button", { name: "Add card" }).first().click()
    await page.getByRole("textbox", { name: "Front" }).fill("Where do workflows live?")
    await page.getByRole("textbox", { name: "Back" }).fill("`.github/workflows/`")
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect(page.getByText("Where do workflows live?")).toBeVisible()

    await page.getByRole("button", { name: "Branch or leaf" }).first().click()
    await page.getByRole("radio", { name: "Leaf" }).click()
    await page.getByLabel("Name").fill("Triggers")
    await page.getByRole("button", { name: "Create" }).click()
    await page.locator("main").getByRole("link", { name: "Triggers" }).click()
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Triggers")
    leafUrl = page.url()
    await expect(page.getByRole("button", { name: "Branch or leaf" })).toHaveCount(0)
  })

  test("import cards into a leaf from CSV", async ({ page }) => {
    await page.goto(`${leafUrl}/import`)
    await page
      .getByRole("textbox", { name: "Cards" })
      .fill(
        "front,back,reversible\nRuns on push?,`on: push`,no\nworkflow_dispatch,Manual trigger,yes\nbroken row\n",
      )
    await expect(page.getByText("2 cards ready to import")).toBeVisible()
    await expect(page.getByText("Row 4: Each row needs a front and a back")).toBeVisible()
    await page.getByRole("button", { name: /Import 2 cards/ }).click()
    await expect(page).toHaveURL(leafUrl)
    await expect(page.getByText("Cards (3)")).toBeVisible()
  })

  test("studying the tree includes every descendant's cards", async ({ page }) => {
    await page.goto(treeUrl)
    await expect(page.getByRole("link", { name: "Study 4" })).toBeVisible()
    await page.getByRole("link", { name: "Study 4" }).click()

    await page.getByRole("button", { name: /Show answer/ }).click()
    await expect(page.getByRole("button", { name: /1m\s*Again/ })).toBeVisible()
    await page.keyboard.press("1")
    await expect(page.getByText("1 reviewed")).toBeVisible()

    for (let i = 0; i < 8; i++) {
      const show = page.getByRole("button", { name: /Show answer/ })
      if (!(await show.isVisible().catch(() => false))) break
      await page.keyboard.press("Space")
      await page.keyboard.press("4")
      await expect(page.getByText(`${i + 2} reviewed`)).toBeVisible()
    }
    await expect(page.getByText("Done for now!")).toBeVisible()
  })

  test("practice runs through cards that aren't due", async ({ page }) => {
    await page.goto(leafUrl)
    await expect(page.getByRole("link", { name: /Study/ })).toHaveCount(0)
    await page.getByRole("link", { name: "Practice" }).click()
    await expect(page.getByText("3 left")).toBeVisible()

    await page.keyboard.press("Space")
    await page.keyboard.press("1")
    await expect(page.getByText("3 left")).toBeVisible()
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press("Space")
      await page.keyboard.press("Space")
    }
    await expect(page.getByText("Practice complete")).toBeVisible()
    await expect(page.getByText("1 needed another go")).toBeVisible()
  })

  test("settings save and backups download", async ({ page }) => {
    await page.goto("/settings")
    await page.getByLabel("New cards per day").fill("15")
    await page.getByRole("button", { name: "Save settings" }).click()
    await expect(page.getByText("Settings saved")).toBeVisible()

    const res = await page.request.get("/api/export")
    const bundle = await res.json()
    expect(bundle).toMatchObject({ app: "flash-cards", version: 1 })
    expect(bundle.cards).toHaveLength(4)
    expect(bundle.reviewLogs).toHaveLength(5)
  })
})
