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

The app can be served by any simple static HTTP server. For example:

```powershell
python -m http.server 8081
```

Open `http://127.0.0.1:8081/` and test the complete flow from `index.html` to `generar.html` and `descarga.html`. The generator loads local assets through HTTP, so opening the HTML files directly with `file://` is not the representative runtime.

Basic JavaScript syntax checks can be run without installing project dependencies:

```powershell
node --check js/app.js
node --check js/generate.js
node --check js/zip.js
node --check js/download.js
node --check js/landing.js
```

## Deployment

The live demo is a Cloudflare Pages Direct Upload deployment at [armaport.pages.dev](https://armaport.pages.dev). A GitHub push does not create a Cloudflare deployment automatically. The command deploys the folder supplied to Wrangler, so use the curated public export folder rather than the checkout root if documentation and screenshots should remain outside the hosted site.

```powershell
npx wrangler@latest pages deploy .\deploy --project-name armaport
```

The deployment folder should contain only public files. Do not upload `.git/`, `.wrangler/`, `_old/`, local screenshots, documentation source files that are excluded from the public export, or private environment files.

## Documentation

- [Production checklist](docs/PRODUCTION_CHECKLIST.md)
- [Third-party notices](docs/THIRD_PARTY_NOTICES.md)
- [Asset notices](docs/ASSET_NOTICES.md)

## License

Original source code is available under the MIT License. Third-party libraries, fonts, templates, and retained reference assets remain subject to their own licenses and notices. See the [third-party notices](docs/THIRD_PARTY_NOTICES.md) for details.
