const ALLOWED_ORIGINS = new Set([
  "https://folium81.pages.dev",
  "http://localhost:8788",
  "http://127.0.0.1:8788",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const OTP_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const inMemoryStore = new Map();

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://folium81.pages.dev";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function jsonResponse(payload, status = 200, origin = "") {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
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

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidUtpEmail(email) {
  return /@utp\.ac\.pa$/i.test(normalizeEmail(email));
}

function buildCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function memoryGet(key) {
  const entry = inMemoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    inMemoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memoryPut(key, value, ttlSeconds) {
  inMemoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function memoryDelete(key) {
  inMemoryStore.delete(key);
}

async function readValue(env, key) {
  if (env.FOLIUM81_KV) {
    return env.FOLIUM81_KV.get(key);
  }
  return memoryGet(key);
}

async function writeValue(env, key, value, ttlSeconds) {
  if (env.FOLIUM81_KV) {
    await env.FOLIUM81_KV.put(key, value, {
      expirationTtl: ttlSeconds,
    });
    return;
  }
  memoryPut(key, value, ttlSeconds);
}

async function deleteValue(env, key) {
  if (env.FOLIUM81_KV) {
    await env.FOLIUM81_KV.delete(key);
    return;
  }
  memoryDelete(key);
}

async function sendOtpEmail(env, email, code) {
  if (!env.RESEND_API_KEY) {
    // TODO: Replace this stub with a real transactional email provider in production.
    console.log(`OTP stub delivery for ${email}: ${code}`);
    return { stub: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Folium81 <noreply@folium81.com>",
      to: email,
      subject: "Tu codigo de acceso - Folium81",
      html: `<p>Tu codigo de acceso es: <strong>${code}</strong></p><p>Expira en 10 minutos.</p>`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`resend_error:${text}`);
  }

  return { stub: false };
}

async function handleRequestCode(request, env, origin) {
  const body = await parseJson(request);
  const email = normalizeEmail(body?.email);

  if (!isValidUtpEmail(email)) {
    return jsonResponse(
      { ok: false, error: "Solo se aceptan correos @utp.ac.pa." },
      400,
      origin
    );
  }

  const code = buildCode();

  try {
    await writeValue(env, `otp:${email}`, code, OTP_TTL_SECONDS);
    const delivery = await sendOtpEmail(env, email, code);

    return jsonResponse(
      {
        ok: true,
        delivery: delivery.stub ? "stub" : "email",
      },
      200,
      origin
    );
  } catch {
    return jsonResponse(
      { ok: false, error: "No se pudo enviar el codigo." },
      502,
      origin
    );
  }
}

async function handleVerifyCode(request, env, origin) {
  const body = await parseJson(request);
  const email = normalizeEmail(body?.email);
  const code = String(body?.code || "").trim();

  if (!isValidUtpEmail(email) || !/^\d{6}$/.test(code)) {
    return jsonResponse(
      { ok: false, error: "Solicitud invalida." },
      400,
      origin
    );
  }

  const key = `otp:${email}`;
  const storedCode = await readValue(env, key);

  if (!storedCode) {
    return jsonResponse(
      { ok: false, error: "El codigo expiro o ya no es valido." },
      400,
      origin
    );
  }

  if (storedCode !== code) {
    return jsonResponse(
      { ok: false, error: "El codigo es incorrecto." },
      400,
      origin
    );
  }

  await deleteValue(env, key);

  const token = crypto.randomUUID();
  await writeValue(env, `session:${token}`, email, SESSION_TTL_SECONDS);

  return jsonResponse({ ok: true, token }, 200, origin);
}

async function handleConclusion(request, env, origin) {
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

  const hasMissingField = requiredFields.some((field) => {
    const value = body?.[field];
    return value === undefined || value === null || value === "";
  });

  if (hasMissingField) {
    return jsonResponse({ error: "missing_fields" }, 400, origin);
  }

  const prompt = `
Eres un asistente academico.
Redacta una conclusion final de cierre de curso en espanol formal para un portafolio universitario.

Datos:
- Curso: ${body.courseName}
- Departamento: ${body.department}
- Facilitador: ${body.facilitator}
- Semestre: ${body.semester}
- Ano: ${body.year}
- Expectativas iniciales: ${body.expectations}
- Actividades realizadas: ${body.activities}
- Numero de parciales: ${body.numParciales}

Entrega una conclusion clara, humana y lista para revisar por el estudiante.
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      return jsonResponse({ error: "ai_unavailable" }, 502, origin);
    }

    const data = await response.json();
    const conclusion = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!conclusion) {
      return jsonResponse({ error: "ai_unavailable" }, 502, origin);
    }

    return jsonResponse({ conclusion }, 200, origin);
  } catch {
    return jsonResponse({ error: "ai_unavailable" }, 502, origin);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Metodo no permitido." }, 405, origin);
    }

    if (url.pathname === "/api/request-code") {
      return handleRequestCode(request, env, origin);
    }

    if (url.pathname === "/api/verify-code") {
      return handleVerifyCode(request, env, origin);
    }

    if (url.pathname === "/api/conclusion") {
      return handleConclusion(request, env, origin);
    }

    return jsonResponse({ ok: false, error: "Ruta no encontrada." }, 404, origin);
  },
};
