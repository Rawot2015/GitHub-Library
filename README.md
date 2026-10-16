## Repository Shelf

A standalone Next.js app for collecting public GitHub repositories from links and exporting the current collection as a PDF or OneNote-friendly HTML file.

## Run locally

Requirements: Node.js 20.9 or later and npm.

```powershell
npm install
npm run dev
```

Open http://localhost:3000. Run `npm run lint` and `npm run build` to check the app.

## Use

Paste one or more GitHub repository links into the collector. It also finds repository URLs inside pasted text. Repository metadata is fetched from GitHub's public REST API. Private repositories are not accessible; unauthenticated requests are subject to GitHub's API rate limits.

The collection is saved in browser local storage. It is private to that browser profile and is not synchronized to another device.

## Exports

- **PDF** is generated from the current collection in the browser when you click the download button, so it always reflects the latest list. Repository names in the PDF link to GitHub.
- **OneNote** downloads a table as an HTML file that can be opened or inserted into OneNote. It is regenerated from the current collection when requested.
- Direct synchronization with a Microsoft OneNote account is not included. That requires Microsoft Graph integration, account sign-in, and appropriate application permissions.

## Project files

- `app/page.tsx`: repository import, list, persistence, and exports.
- `app/globals.css`: responsive visual design.
- `app/layout.tsx`: document metadata and shared layout.

