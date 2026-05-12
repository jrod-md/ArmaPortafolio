const ALLOWED_ORIGINS = new Set([
  "https://portafolio-fisc.pages.dev",
  "http://localhost:8788",
  "http://127.0.0.1:8788",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function corsHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://portafolio-fisc.pages.dev";
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

async function handleConclusion(request, env, origin) {
  const body = await parseJson(request);
  const requiredFields = [
    "courseName",
    "department",
    "facilitator",
    "semester",
    "year"
  ];

  const hasMissingField = requiredFields.some((field) => {
    const value = body?.[field];
    return value === undefined || value === null || value === "";
  });

  if (hasMissingField) {
    return jsonResponse({ error: "missing_fields" }, 400, origin);
  }

  const prompt = `
Eres un asistente académico experto de la Universidad Tecnológica de Panamá (UTP).
Redacta una conclusión final formal y profesional para un Portafolio Digital Estudiantil.

Contexto del Dossier:
- Institución: Facultad de Ingeniería de Sistemas Computacionales (FISC)
- Curso: ${body.courseName}
- Departamento: ${body.department}
- Facilitador(a): ${body.facilitator}
- Período: Semestre ${body.semester}, Año ${body.year}

Instrucciones:
1. El tono debe ser académico, reflexivo y de alta calidad institucional.
2. Evita frases genéricas; enfócate en la importancia de la organización de evidencias y el aprendizaje continuo.
3. La conclusión debe estar lista para ser incluida en un paquete de entrega oficial.
4. Idioma: Español formal (Panamá).

Entrega el texto de la conclusión directamente, sin preámbulos.
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
      return jsonResponse({ ok: false, error: "Método no permitido." }, 405, origin);
    }

    if (url.pathname === "/api/conclusion") {
      return handleConclusion(request, env, origin);
    }

    return jsonResponse({ ok: false, error: "Ruta no encontrada." }, 404, origin);
  },
};
