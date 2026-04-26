const ALLOWED_ORIGIN = "https://folium81.pages.dev";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      "X-RateLimit-Policy": "Cloudflare-WAF",
    },
  });
}

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isValidUtpEmail(email) {
  return typeof email === "string" && /@utp\.ac\.pa$/i.test(email.trim());
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function sendOtpEmail(env, email, code) {
  const payload = {
    from: "Folium81 <noreply@folium81.com>",
    to: email,
    subject: "Tu código de acceso — Folium81",
    html: `<p>Tu código de acceso es: <strong>${code}</strong></p><p>Válido por 10 minutos.</p>`,
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`resend_error:${text}`);
  }
}

async function handleAuthRequest(request, env) {
  const body = await parseJson(request);
  const email = normalizeEmail(body?.email);

  if (!isValidUtpEmail(email)) {
    return jsonResponse({ ok: false, error: "Solo se aceptan correos @utp.ac.pa" }, 400);
  }

  try {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await env.FOLIUM81_KV.put(`otp:${email}`, code, { expirationTtl: 600 });
    await sendOtpEmail(env, email, code);
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ ok: false, error: "No se pudo enviar el código" }, 502);
  }
}

async function handleAuthVerify(request, env) {
  const body = await parseJson(request);
  const email = normalizeEmail(body?.email);
  const code = String(body?.code || "").trim();

  if (!isValidUtpEmail(email) || !code) {
    return jsonResponse({ ok: false, error: "Solicitud inválida" }, 400);
  }

  const key = `otp:${email}`;
  const storedCode = await env.FOLIUM81_KV.get(key);

  if (!storedCode) {
    return jsonResponse({ ok: false, error: "Código expirado o inválido" }, 400);
  }

  if (storedCode !== code) {
    return jsonResponse({ ok: false, error: "Código incorrecto" }, 400);
  }

  await env.FOLIUM81_KV.delete(key);

  const token = crypto.randomUUID();
  await env.FOLIUM81_KV.put(`token:${token}`, email, { expirationTtl: 30 * 24 * 60 * 60 });

  return jsonResponse({ ok: true, token });
}

async function handleConclusion(request, env) {
  const body = await parseJson(request);
  const requiredFields = [
    "courseName",
    "department",
    "facilitator",
    "semester",
    "year",
    "expectations",
    "activities",
    "numParciales",
  ];

  const missing = requiredFields.some((field) => {
    const value = body?.[field];
    return value === undefined || value === null || value === "";
  });

  if (missing) {
    return jsonResponse({ error: "missing_fields" }, 400);
  }

  const prompt = `
Eres un asistente académico.
Redacta una conclusión final de cierre de curso en español formal para un portafolio universitario.

Datos:
- Curso: ${body.courseName}
- Departamento: ${body.department}
- Facilitador: ${body.facilitator}
- Semestre: ${body.semester}
- Año: ${body.year}
- Expectativas iniciales: ${body.expectations}
- Actividades realizadas: ${body.activities}
- Número de parciales: ${body.numParciales}

Entrega una conclusión clara, humana y lista para revisar por el estudiante.
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      return jsonResponse({ error: "ai_unavailable" }, 502);
    }

    const data = await response.json();
    const conclusion =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!conclusion) {
      return jsonResponse({ error: "ai_unavailable" }, 502);
    }

    return jsonResponse({ conclusion });
  } catch {
    return jsonResponse({ error: "ai_unavailable" }, 502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Método no permitido" }, 405);
    }

    if (url.pathname === "/api/auth/request") {
      return handleAuthRequest(request, env);
    }

    if (url.pathname === "/api/auth/verify") {
      return handleAuthVerify(request, env);
    }

    if (url.pathname === "/api/conclusion") {
      return handleConclusion(request, env);
    }

    return jsonResponse({ ok: false, error: "Ruta no encontrada" }, 404);
  },
};
