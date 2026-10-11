import { expect, test } from "@playwright/test";

const PAGES = ["/", "/generar.html", "/descarga.html", "/faq.html", "/ayuda.html", "/nosotros.html", "/404.html"];

// Cualquier error de consola o de página cuenta, sobre todo los bloqueos de la CSP.
function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

const file = (name, bytes = 2048) => ({ name, mimeType: "application/octet-stream", buffer: Buffer.alloc(bytes, 1) });

async function fillStudent(page) {
  await page.getByLabel("Nombre completo").fill("Ana Prueba Demo");
  await page.getByLabel("Cédula").fill("8-000-0000");
  await page.getByLabel("Nombre del curso").fill("Bases de Datos I");
  await page.getByLabel("Departamento FISC").selectOption({ label: "Ingeniería de Software" });
  await page.getByLabel("Facilitador(a)").fill("Ing. Demo Prueba");
  await page.getByText("II", { exact: true }).click();
}

const next = (page) => page.locator(".wizard-panel:not([hidden]) [data-wizard-next]").click();

// Lee los nombres del directorio central del ZIP guardado para la página de descarga.
async function readStoredZipEntries(page) {
  return page.evaluate(async () => {
    const saved = await window.PortafolioFiscZip.loadGeneratedZip();
    const bytes = new Uint8Array(await saved.blob.arrayBuffer());
    const view = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    const total = view.getUint16(end + 10, true);
    let offset = view.getUint32(end + 16, true);
    const names = [];
    for (let index = 0; index < total; index += 1) {
      const length = view.getUint16(offset + 28, true);
      names.push(new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + length)));
      offset += 46 + length;
    }
    return { filename: saved.filename, names };
  });
}

test.describe("páginas", () => {
  for (const path of PAGES) {
    test(`${path} carga sin errores y sin desbordarse`, async ({ page }) => {
      const errors = trackErrors(page);
      const response = await page.goto(path);
      expect(response.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);

      for (const width of [375, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        const overflow = await page.evaluate(() => {
          const limit = document.documentElement.clientWidth;
          const culprits = [...document.querySelectorAll("body *")]
            .filter((element) => element.getBoundingClientRect().right > limit + 0.5)
            .slice(0, 5)
            .map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
          return { extra: document.documentElement.scrollWidth - limit, culprits };
        });
        expect(overflow.extra, `desborde horizontal a ${width}px: ${overflow.culprits.join(", ")}`).toBeLessThanOrEqual(0);
      }
      // La página de descarga sin ZIP avisa con un mensaje propio, no con un error.
      expect(errors).toEqual([]);
    });
  }

  test("una ruta inexistente responde 404 con la página propia", async ({ page }) => {
    const response = await page.goto("/no-existe");
    expect(response.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Página no encontrada");
  });

  test("el inicio lleva al generador", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Crear mi portafolio/ }).click();
    await expect(page).toHaveURL(/generar\.html$/);
  });
});

test.describe("generador", () => {
  test("marca cada dato que falta y no avanza", async ({ page }) => {
    await page.goto("/generar.html");
    await next(page);

    await expect(page.locator('[aria-invalid="true"]')).toHaveCount(6);
    await expect(page.locator("#wizard-message")).toContainText("Faltan 6 datos");
    await expect(page.locator("#generador")).toHaveAttribute("data-step", "1");
    await expect(page.getByLabel("Nombre completo")).toBeFocused();
  });

  test("la portada en pantalla refleja los datos", async ({ page }) => {
    await page.goto("/generar.html");
    await fillStudent(page);

    await expect(page.locator("#cover-nombre")).toHaveText("Ana Prueba Demo");
    await expect(page.locator("#cover-curso")).toHaveText("Bases de Datos I");
    await expect(page.locator("#cover-depto")).toHaveText("INGENIERÍA DE SOFTWARE");
    await expect(page.locator('.fold[data-folder="portada"]')).toHaveClass(/is-filled/);
  });

  test("rechaza archivos que no corresponden", async ({ page }) => {
    await page.goto("/generar.html");
    await fillStudent(page);
    await next(page);
    await next(page);

    const tareas = page.locator('[data-upload-key="tareas"]');
    await tareas.locator(".upload-zone__input").setInputFiles([file("virus.exe")]);
    await expect(page.locator("#wizard-message")).toContainText("bloqueado por seguridad");

    await tareas.locator(".upload-zone__input").setInputFiles([file("grande.pdf", 10 * 1024 * 1024 + 1)]);
    await expect(page.locator("#wizard-message")).toContainText("máximo 10MB");
    await expect(tareas.locator(".upload-zone__file-item")).toHaveCount(0);
  });

  test("arma el ZIP con la estructura de carpetas y lo entrega", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/generar.html");
    await fillStudent(page);

    await next(page);
    await page.locator('[data-upload-key="planContenido"] .upload-zone__input').setInputFiles([file("plan.pdf")]);

    await next(page);
    await page
      .locator('[data-upload-key="tareas"] .upload-zone__input')
      .setInputFiles([file("Tarea 1 final final.pdf"), file("informe.docx")]);
    await page.locator('[data-upload-key="tareas"] .upload-zone__input').setInputFiles([file("informe.docx")]);
    await page.locator('[data-upload-key="labs"] .upload-zone__input').setInputFiles([file("lab7.py")]);
    await page.locator('[data-upload-key="material"] .upload-zone__input').setInputFiles([file("guia.pptx")]);
    await expect(page.locator('[data-upload-key="tareas"] .upload-zone__file-item')).toHaveCount(3);

    await next(page);
    await page.getByLabel("Conclusión final del curso").fill("Aprendí a normalizar tablas.");

    await next(page);
    await expect(page.locator("#sumNombre")).toHaveText("Ana Prueba Demo");
    await expect(page.locator("#sum-conclusion")).toHaveText("Incluida");

    await page.getByRole("button", { name: "Generar portafolio" }).click();
    await page.waitForURL(/descarga\.html$/);

    const stored = await readStoredZipEntries(page);
    expect(stored.filename).toBe("portafolio_fisc_ana_prueba_demo.zip");
    expect(stored.names.sort()).toEqual(
      [
        "01_Portada/Portada.pdf",
        "02_Descripcion_Curso/plan.pdf",
        "04_Actividades/Laboratorios_Talleres/lab7.py",
        "04_Actividades/Tareas/Tarea_1_final_final.pdf",
        "04_Actividades/Tareas/informe.docx",
        "04_Actividades/Tareas/informe_2.docx",
        "05_Material_Didactico/guia.pptx",
        "06_Conclusion_Final/conclusion_final.txt",
      ].sort()
    );

    await expect(page.locator("#contenido-lista li")).toHaveCount(6);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar ZIP" }).click();
    expect((await download).suggestedFilename()).toBe("portafolio_fisc_ana_prueba_demo.zip");

    expect(errors).toEqual([]);
  });

  test("sin evidencias, el ZIP lleva solo la portada", async ({ page }) => {
    await page.goto("/generar.html");
    await fillStudent(page);
    for (let step = 0; step < 4; step += 1) await next(page);

    await page.getByRole("button", { name: "Generar portafolio" }).click();
    await page.waitForURL(/descarga\.html$/);
    expect((await readStoredZipEntries(page)).names).toEqual(["01_Portada/Portada.pdf"]);
  });

  test("generar con datos incompletos vuelve al paso 1", async ({ page }) => {
    await page.goto("/generar.html");
    await fillStudent(page);
    for (let step = 0; step < 4; step += 1) await next(page);

    await page.locator("#wizard-nav-1").click();
    await page.getByLabel("Cédula").fill("");
    await page.locator("#wizard-nav-5").click();
    await expect(page.locator("#generador")).toHaveAttribute("data-step", "1");
    await expect(page.getByLabel("Cédula")).toHaveAttribute("aria-invalid", "true");
  });
});

test("la descarga sin ZIP lo dice en vez de afirmar que está listo", async ({ page }) => {
  await page.goto("/descarga.html");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aquí todavía no hay nada.");
  await expect(page.getByRole("button", { name: "Descargar ZIP" })).toBeHidden();
});
