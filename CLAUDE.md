@AGENTS.md

# takahiro — バズったX投稿 量産ツール

A single-purpose Next.js app. The user pastes the text of a viral X (Twitter)
post — or uploads a screenshot of one — and Claude classifies it into one of 12
predefined "types" (型), explains why it went viral, then generates N brand-new
posts that reuse the same structure/hook but are retargeted to a fixed audience
and genre (AI-powered side hustles for busy 30–40s in field/sales jobs).

The entire product surface is in Japanese: UI copy, API error messages, model
prompts, and commit messages. Keep it that way — write new user-facing strings
and commit subjects in Japanese, code identifiers and comments in English.

## Stack

| Piece | Version / note |
| --- | --- |
| Next.js | 16.2.9, App Router, TypeScript |
| React | 19.2.4 |
| Tailwind CSS | v4 — CSS-first (`@import "tailwindcss"`), configured via `@theme inline` in `src/app/globals.css`. There is no `tailwind.config.js` and you should not add one. |
| Anthropic SDK | `@anthropic-ai/sdk` ^0.105.0, called server-side only |
| ESLint | v9 flat config (`eslint.config.mjs`) composing `eslint-config-next/core-web-vitals` + `/typescript` |

**Read the Next.js docs before writing code.** Per `AGENTS.md`, this Next.js
version diverges from what you may remember; the authoritative guides ship in
`node_modules/next/dist/docs/`. They only exist after `npm install`, so install
first if you need them.

## Commands

```bash
npm install
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
npm run build
npm run lint                 # bare `eslint` — flat config, no args needed
```

There is no test suite, no CI workflow, and no `.github/` directory. Verify
changes with `npm run lint`, `npm run build`, and by exercising the app.

## Layout

```
src/
  app/
    layout.tsx              # root layout: Geist fonts, metadata, dark-mode body classes
    page.tsx                # server component; header copy + <PostGeneratorForm />
    globals.css             # Tailwind v4 entry + CSS variable theme
    api/generate/route.ts   # the only API route — all Claude logic lives here
  components/
    PostGeneratorForm.tsx   # "use client" — the whole interactive UI
  lib/
    post-types.ts           # the 12 型 definitions + id lookup
```

Import with the `@/*` alias (`@/lib/post-types`), which maps to `src/*` via
`tsconfig.json`. TypeScript runs in `strict` mode.

## How `src/app/api/generate/route.ts` works

Node runtime (`export const runtime = "nodejs"`), accepts `multipart/form-data`
POST with fields:

- `mode` — `"text"` or `"image"` (required, rejected otherwise)
- `text` — required when `mode=text`, trimmed, max 5000 chars
- `image` — required when `mode=image`; PNG/JPEG/WebP/GIF only, max 10MB,
  base64-encoded into an Anthropic image block
- `count` — clamped to 3–20, default 10

Key design decisions to preserve when editing:

1. **Forced tool use, not free-form JSON.** The route defines a single
   `submit_generation` tool and pins `tool_choice: { type: "tool", name: ... }`.
   The response is read out of the `tool_use` block. Add new output fields by
   extending `input_schema` (and its `required` list) plus the local response
   type — don't switch to parsing prose.
2. **`detected_type_id` is constrained** by `enum: POST_TYPE_IDS`, and the
   result is re-validated server-side with `getPostTypeById`; an unknown id
   returns 502. Adding a type means only editing `src/lib/post-types.ts` — the
   union type, prompt list, and enum all derive from `POST_TYPES`.
3. **`count` is enforced twice** — in the prompt text and as
   `minItems`/`maxItems` on `generated_posts`. Keep both in sync.
4. **Target audience and genre are hardcoded** as `TARGET_AUDIENCE` and `GENRE`
   constants in the route. Generated posts are always retargeted to them
   regardless of the source post's topic — this is intentional product
   behavior, not a bug. Make it configurable only if asked.
5. **Model comes from `ANTHROPIC_MODEL`**, falling back to `"claude-sonnet-4-6"`.
6. **Errors are Japanese strings** in `{ error }` JSON with meaningful status
   codes: 400 validation, 500 missing key / unexpected failure, 502 malformed
   model output. `Anthropic.APIError` is unwrapped into a readable message.

The response shape consumed by the client is camelCase (`detectedType`,
`viralFactors`, `sourceText`, `posts`) — it deliberately differs from the
snake_case tool schema, so update both sides together.

## Client conventions (`PostGeneratorForm.tsx`)

- Everything is local `useState`; no state library, no server actions. The form
  posts `FormData` to `/api/generate` and renders the JSON.
- Object URLs for the image preview are revoked in `selectFile` before being
  replaced.
- Copy-to-clipboard uses a shared `copyTimeoutRef` to flash "コピーしました!"
  for 1.5s; a single timer is reused, so per-item and copy-all states cancel
  each other by design.
- **Every color utility needs a `dark:` counterpart.** Two commits in the
  history exist solely to fix unreadable dark mode. Dark mode is
  `prefers-color-scheme`-driven (no toggle, no `class` strategy), and the body
  already sets `bg-white dark:bg-gray-950`.
- The preview `<img>` is a raw tag with an inline
  `// eslint-disable-next-line @next/next/no-img-element` — `next/image` can't
  take a blob URL here.

## Secrets

`ANTHROPIC_API_KEY` is read only inside the route handler, never exposed to the
client, and `.env*` is gitignored except `.env.example`. Never add it to a
`NEXT_PUBLIC_*` variable or call the Anthropic SDK from a client component.

## Known drift

`README.md` still describes the app's earlier incarnation (a screenshot-only
*analyzer*) and points at `src/app/api/analyze/route.ts` and
`src/components/AnalyzerForm.tsx`, neither of which exists. Trust this file and
the source over the README.
