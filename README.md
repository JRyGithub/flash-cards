# flash-cards

A simple project, so I don't have to pay for my own flash card app. Anki-style learning, free to run.

- **Trees, branches and leaves.** A _tree_ is a goal or large concept (e.g. a certification). _Branches_ break it into sections and can nest inside each other. A branch can hold its own cards and contain _leaves_, which are card collections for a single concept.
- **Spaced repetition with FSRS**, the algorithm modern Anki uses (via [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)), with Anki-style learning steps and Again / Hard / Good / Easy ratings.
- **Study any level.** Studying a tree or branch pulls in due cards from everything beneath it.
- **Markdown cards** with syntax-highlighted code blocks, and optional reverse (back → front) cards.
- **CSV/TSV import** with a preview, plus **JSON backup/restore** of trees, cards and review history.
- **Single-owner and secure.** One allowed account (GitHub or magic-link sign-in), checked on every request.
- **Costs nothing.** Next.js on Vercel Hobby, with Postgres and Auth on Supabase's free tier.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FJRyGithub%2Fflash-cards&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,DATABASE_URL,ADMIN_EMAIL,CRON_SECRET&envDescription=See%20.env.example%20for%20where%20to%20find%20each%20value&envLink=https%3A%2F%2Fgithub.com%2FJRyGithub%2Fflash-cards%2Fblob%2Fmain%2F.env.example)

## Set up your own copy

You need Node.js 24+, pnpm, a free [Supabase](https://supabase.com) project and a free [Vercel](https://vercel.com) account. Fork this repo first.

### 1. Supabase

1. Create a project. Note the database password.
2. **Authentication → Sign In / Providers**
   - Turn **off** "Allow new users to sign up". Nobody else can create an account.
   - Leave **Email** enabled (used for magic links).
   - Enable **GitHub** (optional). Create a GitHub OAuth app at <https://github.com/settings/developers> with the callback URL `https://<project-ref>.supabase.co/auth/v1/callback`, then paste its client ID and secret into Supabase.
3. **Authentication → URL Configuration**
   - **Site URL:** your production URL, e.g. `https://your-app.vercel.app`.
   - **Redirect URLs:** add `http://localhost:3000/auth/callback` and `https://your-app.vercel.app/auth/callback`.
4. Collect the values for `.env.example`:
   - **Project Settings → API:** the project URL, the anon/publishable key, and the service-role/secret key.
   - **Connect** (top of the project page): the _Session pooler_ string (port 5432) for `DIRECT_URL`. Use a pooler string, not "Direct connection": the direct host is IPv6-only on the free tier and unreachable from WSL and many networks. `DATABASE_URL` is filled in for you in step 2.

### 2. Local setup

Run these in order:

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the example env file, then fill in the values from step 1:

   ```bash
   cp .env.example .env.local
   ```

3. Create the tables, triggers, row-level security and the app's database role:

   ```bash
   pnpm db:migrate
   ```

4. Give the app's restricted database role a password and point `DATABASE_URL` at it (re-run any time to rotate the password):

   ```bash
   pnpm db:app-role
   ```

5. Create your single owner account (`ADMIN_EMAIL`):

   ```bash
   pnpm admin:create
   ```

6. Start the app at http://localhost:3000:

   ```bash
   pnpm dev
   ```

If you sign in with GitHub, its primary verified email must match `ADMIN_EMAIL`. Supabase links the GitHub identity to your account automatically.

### 3. Deploy to Vercel

Import the fork into Vercel, or use the button above, and add these environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `DATABASE_URL` (the restricted-role value `pnpm db:app-role` wrote to your env file)
- `ADMIN_EMAIL`
- `ADMIN_GITHUB_USERNAME` (optional)
- `CRON_SECRET`

Don't add `DIRECT_URL` or `SUPABASE_SERVICE_ROLE_KEY` to Vercel. They hold owner credentials and are only needed on your machine.

Vercel calls `/api/cron/keepalive` daily (see `vercel.json`). This stops Supabase pausing a free project after a week without activity.

## Security model

- **One owner, set by environment.** Sign-ups are disabled in Supabase, and the owner account is created by `pnpm admin:create`.
- **Defence in depth.**
  - `src/proxy.ts` sends signed-out visitors to `/login`.
  - Every page loader, Server Action and route handler calls `requireOwner()` (`src/server/auth/session.ts`). It verifies the session with Supabase Auth and checks it against `ADMIN_EMAIL` (and `ADMIN_GITHUB_USERNAME`, if set).
  - Any other signed-in account is signed straight back out.
- **The database isn't exposed.**
  - Supabase's public Data API roles (`anon`, `authenticated`) have no privileges on the app's tables, and row-level security gives them no rows even if a grant is ever added back. The public REST API answers "permission denied".
  - The app connects server-side through Drizzle as `flash_cards_app`, a role that can only read and write rows in the app's five tables. It can't change the schema, bypass RLS or touch Supabase's `auth` schema. Owner credentials (`DIRECT_URL`) are only used locally for migrations.
  - Connections to remote databases require TLS (`src/server/db/connection.ts`). Optionally also turn on **Enforce SSL** under Supabase → Database → Settings.
- **Safe card content.** Markdown is rendered without raw HTML, and auth redirects only allow same-site paths.
- **Hardening.** `next.config.ts` sets a Content-Security-Policy (no third-party scripts or connections, no framing, forms only post to the app and the sign-in flow) and other security headers. The cron endpoint requires `CRON_SECRET`.

## Architecture

```
src/
  app/                    Next.js routes (App Router, Cache Components). Pages compose components and read data via server/queries.ts
    actions/              Thin Server Actions: requireOwner → zod validation → service call → refresh
  components/             Atomic design
    atoms/                shadcn/ui primitives + tiny building blocks (NodeKindIcon)
    molecules/            Markdown, DueCounts, RatingButton, FormField, ConfirmDialog, ...
    organisms/            NodeTreeNav, NoteList, NoteEditorDialog, StudySession, CsvImportWizard, ...
    templates/            AppShell, StudyLayout, AuthLayout
  lib/                    Code shared by client and server (validation schemas, CSV parsing, view models)
  server/                 Backend (SOLID)
    domain/               Types, errors, hierarchy rules, time helpers. No framework code
    repositories/         Interfaces + Drizzle implementations + UnitOfWork (transactions)
    scheduling/           Scheduler interface + FSRS adapter (swappable)
    services/             Use cases: Node, Note, Study, Import, Export, Settings
    container.ts          Composition root wiring Drizzle + FSRS into the services
    queries.ts            Authorised read models for pages
  proxy.ts                Session refresh + redirect for signed-out visitors
drizzle/                  SQL migrations (schema, RLS, hierarchy triggers)
e2e/                      Playwright tests against the real app with local Postgres/Auth stand-ins
```

Services depend only on repository and scheduler interfaces. Unit tests run them against in-memory fakes, and the integration test runs the same services against real Postgres (PGlite) with the real migrations.

## Scripts

| Command                        | What it does                                                                |
| ------------------------------ | --------------------------------------------------------------------------- |
| `pnpm dev`                     | Start the dev server                                                        |
| `pnpm test`                    | Unit tests + Postgres integration tests (Vitest, PGlite, no setup needed)   |
| `pnpm e2e`                     | Build the app and drive it in Chromium against local stand-ins for Supabase |
| `pnpm lint` / `pnpm typecheck` | Static checks                                                               |
| `pnpm db:generate`             | Generate a migration after changing `src/server/db/schema.ts`               |
| `pnpm db:migrate`              | Apply migrations (uses `DIRECT_URL`)                                        |
| `pnpm admin:create`            | Create the owner account in Supabase Auth                                   |

## Generating cards with Claude Code

The repo includes a [Claude Code](https://claude.com/claude-code) skill and agent that research a topic and write an import-ready card file for one leaf:

- **`/leaf-cards <topic> [sources]`**: run it in Claude Code to write a leaf interactively. Sources can be URLs, files (including PDFs) or pasted notes. Without sources, it uses official documentation.
- **`leaf-card-writer` agent**: the same job as a self-contained agent. Ask Claude to use it, e.g. one agent per concept to build out a whole branch in parallel.

Both follow [`.claude/skills/leaf-cards/card-guide.md`](.claude/skills/leaf-cards/card-guide.md):

- one fact per card, precise questions, short answers and code in fenced blocks;
- reverse cards only for term ↔ definition pairs.

They write to `cards/<tree>/<leaf>.csv`. That folder is gitignored, because your study material stays out of the public repo.

Every file is checked with the app's own parser before it's handed over. You can also check one yourself:

```bash
pnpm cards:check cards/github-actions/triggers.csv
```

Then open the leaf in the app → **Import** → upload the file.

## CSV import format

One card per row: `front,back[,reversible]`.

- A header row is optional.
- Commas, tabs, semicolons and pipes are all detected as delimiters.
- Quote a field to include commas or line breaks, which is how you add a multi-line code block:

````csv
front,back,reversible
What does CI stand for?,Continuous integration,no
"Trigger a workflow on push?","```yaml
on: push
```",no
````
