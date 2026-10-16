# Repository Shelf

Repository Shelf is a standalone Next.js 16 App Router application built with TypeScript, React, Tailwind CSS, and npm. It collects public GitHub repositories and exports the current collection to PDF or OneNote-friendly HTML. There is no application server or account synchronization: repository data lives in the current browser's local storage.

## Build, lint, and run

Run commands from the project root:

| Purpose | Command |
| --- | --- |
| Install dependencies | `npm install` |
| Start development server | `npm run dev` |
| Production build | `npm run build` |
| Run ESLint | `npm run lint` |
| Lint one file | `npx eslint app/page.tsx` |
| Start the production server | `npm run start` |

There is no test script, test runner, or test file in the project currently, so there is no single-test command.

## Architecture and data flow

- `app/layout.tsx` owns document metadata, the root layout, and the Geist font setup. `app/page.tsx` is the `"use client"` entry point for the collection experience; it owns the repository type, link parsing, GitHub requests, collection state, filtering, and exports.
- Pasted text is scanned for GitHub repository URLs. The app normalizes and de-duplicates repository names, then fetches metadata directly from the public GitHub REST API. Requests can partially succeed; preserve successful additions and surface individual failures rather than failing the entire import. Unauthenticated API rate limits apply, and private repositories cannot be fetched.
- The collection is loaded from and saved to browser `localStorage` under the versioned `github-repository-library:v1` key. Filtering and summary statistics derive from the in-memory collection.
- Both exports are generated in the browser from the current collection: PDF uses `jspdf` and `jspdf-autotable`; the OneNote-friendly export is an HTML table downloaded as a file. Keep exported content in step with the displayed collection. Direct OneNote account sync is not implemented.
- `app/globals.css` contains the app's custom visual system, responsive layouts, and Tailwind CSS import/theme setup. `app/layout.tsx` loads the font variables used by those styles.

## Repository-specific guidance

- Keep browser-only features such as `localStorage`, `Blob`, download links, and PDF generation on the client side. There is currently no backend layer.
- Preserve the local-only privacy and export behavior described above; do not suggest that data synchronizes across browsers/devices or to a Microsoft account.
- The installed Next.js version may differ from familiar APIs. Before changing Next.js behavior or conventions, read the relevant guide under `node_modules/next/dist/docs/`, as required by the existing Next.js agent guidance in `AGENTS.md` and `CLAUDE.md`.
- Next.js manages the marked agent-rules block in `AGENTS.md`; do not remove that generated block.
