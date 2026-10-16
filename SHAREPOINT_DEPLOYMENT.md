# Repository Shelf

## SharePoint deployment

This project can be exported as a static Next.js site for the internal SharePoint RepoShelf library.

The deployment path is stored in `sharepoint-path.txt`. It is used only at build time to generate the correct asset URLs.

Build:

```bash
npm install
npm run build
```

When `sharepoint-path.txt` is present, the static files are generated in `out/`.

**Upload only the contents of `out/` to SharePoint. Do not upload the repository, `node_modules/`, `.git/`, or the `out` folder itself.**

For local development, remove or rename `sharepoint-path.txt` before running `npm run dev`; the app will use normal root-relative paths.
