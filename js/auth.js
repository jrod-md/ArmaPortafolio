const SESSION_KEY = "folium81_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const OTP_RE = /^\d{6}$/;

function getSessionStore() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isExpired(session) {
  return !session?.expiresAt || Date.now() > session.expiresAt;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  return { response, data };
}

function setHidden(node, hidden) {
  if (node) {
    node.hidden = hidden;
  }
}

function setButtonLoading(button, loading, label) {
  if (!button) return;
  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent || "";
  }
  button.disabled = loading;
  button.textContent = loading ? label : button.dataset.defaultLabel;
}

function setMessage(errorNode, successNode, errorText, successText) {
  if (errorNode) {
    errorNode.textContent = errorText || "";
    errorNode.hidden = !errorText;
  }
  if (successNode) {
    successNode.textContent = successText || "";
    successNode.hidden = !successText;
  }
}

export function validateUtpEmail(email) {
  return /@utp\.ac\.pa$/i.test(normalizeEmail(email));
}

export function getAuthSession() {
  const store = getSessionStore();
  if (!store) return null;

  try {
    const raw = store.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.email !== "string") return null;
    if (typeof parsed.expiresAt !== "number") return null;
    if (isExpired(parsed)) {
      store.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeAuthSession(email, token = "") {
  const store = getSessionStore();
  if (!store) return null;

  const session = {
    email: normalizeEmail(email),
    token: String(token || ""),
    verifiedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  store.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearAuthSession() {
  const store = getSessionStore();
  if (!store) return;
  try {
    store.removeItem(SESSION_KEY);
  } catch {
    // noop
  }
}

export function isAuthenticated() {
  return Boolean(getAuthSession());
}

export function getAuthEmail() {
  return getAuthSession()?.email || "";
}

export function bindLogoutLinks(selector = ".nav-logout", redirectUrl = "login.html") {
  document.querySelectorAll(selector).forEach((link) => {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        const { clearGeneratedZip } = await import("./zip.js");
        await clearGeneratedZip();
      } catch {
        // noop
      }
      clearAuthSession();
      window.location.href = redirectUrl;
    });
  });
}

export function renderAuthEmail(target = "navEmail") {
  const node = typeof target === "string" ? document.getElementById(target) : target;
  if (node) {
    node.textContent = getAuthEmail();
  }
}

export function guardProtectedPage(redirectUrl = "login.html") {
  if (isAuthenticated()) {
    return true;
  }

  window.location.replace(redirectUrl);
  return false;
}

export async function requestOTP(email) {
  const normalized = normalizeEmail(email);

  if (!validateUtpEmail(normalized)) {
    return { ok: false, error: "Solo se aceptan correos @utp.ac.pa." };
  }

  try {
    const { response, data } = await postJson("/api/request-code", {
      email: normalized,
    });

    if (!response.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || "No se pudo enviar el codigo. Intenta de nuevo.",
      };
    }

    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: "No se pudo conectar con el servidor para enviar el codigo.",
    };
  }
}

export async function verifyOTP(email, code) {
  const normalized = normalizeEmail(email);
  const cleanCode = String(code || "").trim();

  if (!validateUtpEmail(normalized)) {
    return { ok: false, error: "Solo se aceptan correos @utp.ac.pa." };
  }

  if (!OTP_RE.test(cleanCode)) {
    return { ok: false, error: "Ingresa un codigo de 6 digitos." };
  }

  try {
    const { response, data } = await postJson("/api/verify-code", {
      email: normalized,
      code: cleanCode,
    });

    if (!response.ok || !data.ok) {
      return {
        ok: false,
        error: data.error || "El codigo es invalido o ya expiro.",
      };
    }

    storeAuthSession(normalized, data.token || "");
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: "No se pudo verificar el codigo. Intenta nuevamente.",
    };
  }
}

export function logout(redirectUrl = "login.html") {
  import("./zip.js")
    .then(({ clearGeneratedZip }) => clearGeneratedZip())
    .catch(() => {})
    .finally(() => {
      clearAuthSession();
      window.location.href = redirectUrl;
    });
}

export function initProtectedPage(options = {}) {
  const {
    redirectUrl = "login.html",
    emailTarget = "navEmail",
    logoutSelector = ".nav-logout",
  } = options;

  if (!guardProtectedPage(redirectUrl)) {
    return false;
  }

  renderAuthEmail(emailTarget);
  bindLogoutLinks(logoutSelector, redirectUrl);
  return true;
}

export function initLoginPage(options = {}) {
  const { successRedirect = "generar.html" } = options;

  if (isAuthenticated()) {
    window.location.replace(successRedirect);
    return;
  }

  const form = document.getElementById("loginForm");
  if (!form) return;

  const emailInput = document.getElementById("email");
  const codeInput = document.getElementById("otpCode");
  const emailBlock = document.getElementById("loginEmailBlock");
  const codeBlock = document.getElementById("loginCodeBlock");
  const errorNode = document.getElementById("loginError");
  const successNode = document.getElementById("loginSuccess");
  const submitButton = document.getElementById("loginSubmit");
  const changeEmailButton = document.getElementById("loginChangeEmail");
  const resendButton = document.getElementById("loginRetry");
  const retryWrap = document.getElementById("loginRetryWrap");
  const codeLead = document.getElementById("loginCodeLead");
  const previewItems = Array.from(document.querySelectorAll("[data-preview-item]"));

  let pendingEmail = "";
  let previewIndex = 0;

  function showEmailStep() {
    form.dataset.state = "email";
    setHidden(emailBlock, false);
    setHidden(codeBlock, true);
    setHidden(retryWrap, true);
    setMessage(errorNode, successNode, "", "");
    if (emailInput) {
      emailInput.focus();
    }
  }

  function showCodeStep(email) {
    pendingEmail = normalizeEmail(email);
    form.dataset.state = "code";
    setHidden(emailBlock, false);
    setHidden(codeBlock, false);
    setHidden(retryWrap, false);
    if (codeLead) {
      codeLead.textContent = `Escribe el codigo de 6 digitos enviado a ${pendingEmail}.`;
    }
    setMessage(
      errorNode,
      successNode,
      "",
      "Codigo enviado. Revisa tu correo institucional."
    );
    if (codeInput) {
      codeInput.value = "";
      codeInput.focus();
    }
  }

  async function sendCode() {
    const email = normalizeEmail(emailInput?.value);

    if (!validateUtpEmail(email)) {
      setMessage(
        errorNode,
        successNode,
        "Este correo no es valido o no pertenece a @utp.ac.pa.",
        ""
      );
      return;
    }

    setButtonLoading(submitButton, true, "Enviando codigo...");
    setMessage(errorNode, successNode, "", "");

    const result = await requestOTP(email);
    setButtonLoading(submitButton, false, "");

    if (!result.ok) {
      setMessage(errorNode, successNode, result.error, "");
      return;
    }

    showCodeStep(email);
  }

  async function submitCode() {
    const code = String(codeInput?.value || "").trim();

    setButtonLoading(submitButton, true, "Verificando...");
    setMessage(errorNode, successNode, "", "");

    const result = await verifyOTP(pendingEmail || emailInput?.value, code);
    setButtonLoading(submitButton, false, "");

    if (!result.ok) {
      setMessage(errorNode, successNode, result.error, "");
      return;
    }

    window.location.href = successRedirect;
  }

  if (previewItems.length) {
    window.setInterval(() => {
      previewItems.forEach((item) => {
        item.classList.remove("portfolio-preview__line--active");
      });
      previewItems[previewIndex].classList.add("portfolio-preview__line--active");
      previewIndex = (previewIndex + 1) % previewItems.length;
    }, 1200);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (form.dataset.state === "code") {
      await submitCode();
      return;
    }

    await sendCode();
  });

  if (changeEmailButton) {
    changeEmailButton.addEventListener("click", () => {
      pendingEmail = "";
      form.dataset.state = "email";
      setHidden(codeBlock, true);
      setHidden(retryWrap, true);
      setMessage(errorNode, successNode, "", "");
      if (emailInput) {
        emailInput.focus();
      }
    });
  }

  if (resendButton) {
    resendButton.addEventListener("click", async () => {
      const email = pendingEmail || normalizeEmail(emailInput?.value);
      if (!email) {
        showEmailStep();
        return;
      }

      setButtonLoading(resendButton, true, "Reenviando...");
      setMessage(errorNode, successNode, "", "");

      const result = await requestOTP(email);
      setButtonLoading(resendButton, false, "");

      if (!result.ok) {
        setMessage(errorNode, successNode, result.error, "");
        return;
      }

      showCodeStep(email);
    });
  }

  showEmailStep();
}
