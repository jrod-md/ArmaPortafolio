# ArmaPortafolio

ArmaPortafolio is a static, browser-based tool for assembling academic portfolios. It helps a student enter cover-page information, add course evidence, organize files into a predictable folder structure, and download a final ZIP package.

The application processes portfolio data in the browser. It has no application backend, server-side file upload, user account system, or server database. A generated ZIP may be stored temporarily in the browser's IndexedDB so the download page can retrieve it, and the app falls back to a direct browser download when that handoff is unavailable.

Live demo: [armaport.pages.dev](https://armaport.pages.dev)

> Scope note: this repository is a public static export, not a live operational platform. It does not implement collaboration, server-side validation, real-time monitoring, messaging, field verification, or AI features.

## Screenshots

![Landing page overview](screenshots/01-overview.png)

Landing page showing the problem framing, portfolio package concept, and entry point to the generator.

![Portfolio generator](screenshots/02-generator.png)

Generator screen showing the five-step workflow, student metadata form, progress state, and live package preview.

![Generated portfolio cover](assets/showcase/01-portada-generada.png)

Generated `Portada.pdf` showing the cover included in the final portfolio package.

![Client-side generator workflow](assets/showcase/02-flujo-del-generador.png)

Client-side workflow with the student data form, five-step progress indicator, and live preview of the package cover.

![Validated portfolio structure](assets/showcase/03-estructura-final.png)

Example of the predictable folder structure produced inside the downloaded ZIP.

The generator runs locally in the browser without an account or server-side file upload. It includes practical technical limits—10 MB per file and 160 MB per package—which are described below.

## Core workflow

1. Collect student, course, department, facilitator, semester, and year information.
2. Accept optional evidence uploads grouped into predefined portfolio categories.
3. Generate a `Portada.pdf` cover in the browser using the supplied template and fonts.
4. Add the cover, uploaded files, and optional conclusion text to a structured ZIP package.
5. Save the latest ZIP temporarily in IndexedDB, open the download screen, and clear the stored copy after download.

## Technical implementation

- Static HTML, CSS, and vanilla JavaScript. There is no `package.json`, framework, or build step in the repository.
- `pdf-lib` creates the PDF document and embeds the supplied cover image and fonts.
- `fontkit` is registered with `pdf-lib` so the bundled Liberation Sans fonts can be embedded in the generated PDF.
- `js/zip.js` contains a custom stored-ZIP writer. It writes local file headers, central-directory entries, end-of-central-directory data, and CRC-32 checksums. The project does not use JSZip.
- IndexedDB stores only the latest generated ZIP Blob, filename, and creation time for the handoff to `descarga.html`.
- The landing page loads GSAP, ScrollTrigger, and Lenis from CDN for motion and scroll behavior. These libraries are not used by the generator workflow.

## File handling and limits

The upload workflow applies category-specific allowlists and limits:

- Maximum file size: 10 MB.
- Maximum package size: 160 MB.
- Category limits range from 1 to 120 files, depending on the section.
- Supported groups include documents, spreadsheets, presentations, source code, images, and archives.
- Dangerous executable or script-like extensions are rejected.
- Filenames and relative paths are sanitized before entering the ZIP. Path traversal segments are removed, names are normalized, and duplicate ZIP paths receive suffixes such as `_2`.
- Required student fields and text lengths are validated before generation.

## Repository layout

```text
.
|-- assets/       Cover template, fonts, and retained reference assets
|-- css/          Application styles
|-- docs/         Technical, legal, and deployment documentation
|-- js/           Generator, validation, ZIP, download, and landing logic
|-- screenshots/  Public README screenshots
|-- vendor/       Vendored pdf-lib and fontkit builds
|-- *.html        Static application pages
|-- _headers      Cloudflare Pages response headers
|-- _redirects    Cloudflare Pages redirects
|-- robots.txt
|-- sitemap.xml
`-- LICENSE
```

## Local development

The site itself has no dependencies and no build step. The repository includes a small Node toolchain (Node 22 or newer) for checking, testing and publishing it.

```powershell
npm install
npx playwright install chromium
```

| Command | What it does |
|---|---|
| `npm run serve` | Serves the checkout at `http://127.0.0.1:4173` with the response headers from `_headers`, including the Content-Security-Policy. |
| `npm run check` | Static review: missing files and links, inline code the CSP would block, external origins the CSP does not allow, duplicate or dangling ids, JavaScript syntax. |
| `npm run test:e2e` | Builds `dist/`, serves it with the production headers and runs the browser tests: every page loads without console errors or horizontal overflow, validation, file rejection, and a full run that generates a ZIP and checks its folder structure. |
| `npm test` | `check` followed by the browser tests. |
| `npm run build` | Writes the public export to `dist/`. |

Use `npm run serve` rather than a plain static server when testing by hand. A plain server does not send the Content-Security-Policy, so it will not show what production blocks. Opening the HTML files with `file://` is not a representative runtime either.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on every push to `main`: `npm run check`, then the browser tests against `dist/` served with the production headers.

## Deployment

The workflow does not publish the site. Deployment stays with Cloudflare Pages, in one of two ways:

- **Git integration**: if the Pages project is connected to this repository, Cloudflare builds and publishes each push by itself and no token is needed here. Set the build command to `node scripts/build-export.mjs` and the output directory to `dist`, so only the public files are published.
- **Manual upload**:

```powershell
npm run build
npx wrangler@4 pages deploy dist --project-name armaport
```

`dist/` contains only the public files: the HTML pages, `css/`, `js/`, `assets/`, `vendor/`, `_headers`, `_redirects`, `robots.txt`, `sitemap.xml`, `favicon.svg` and `LICENSE`.

## Documentation

- [Production checklist](docs/PRODUCTION_CHECKLIST.md)
- [Third-party notices](docs/THIRD_PARTY_NOTICES.md)
- [Asset notices](docs/ASSET_NOTICES.md)
