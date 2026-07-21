# Production Checklist

Use this checklist before and after a Cloudflare Pages Direct Upload.

## Public export

The deployment folder should contain only public runtime files:

```text
assets/
css/
js/
vendor/
404.html
_headers
_redirects
ayuda.html
descarga.html
faq.html
favicon.svg
generar.html
index.html
nosotros.html
robots.txt
sitemap.xml
```

Do not include `.git/`, `.wrangler/`, `_old/`, local screenshots, documentation source files, licenses, or private environment files in the public export.

## Local checks

- Run `git diff --check`.
- Run `node --check` on the JavaScript files in `js/`.
- Serve the project over HTTP, not `file://`.
- Open the landing page and all navigation links.
- Complete the generator from student data through download.
- Test accepted files, rejected extensions, oversized files, duplicate names, and nested folders.
- Confirm the ZIP contains `01_Portada/Portada.pdf` and the expected evidence folders.
- Confirm the download page handles both IndexedDB handoff and the direct-download fallback.

## Cloudflare Pages

Deploy manually with:

```powershell
npx wrangler@latest pages deploy . --project-name portafolio-fisc
```

After deployment:

1. Open the public site and perform a hard refresh.
2. Check the browser console for JavaScript or Content Security Policy errors.
3. Verify the landing page, generator, FAQ, help, download, and 404 pages.
4. Confirm that the generated ZIP downloads and that the temporary stored copy is cleared after download.
5. Confirm that analytics requests, if enabled in the Cloudflare dashboard, do not receive uploaded file contents.
