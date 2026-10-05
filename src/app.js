const menuButton = document.querySelector(".menu-toggle");
// Anchor destinations stay visible when translated or enlarged text changes the header height.
new ResizeObserver(([entry]) => {
  document.documentElement.style.setProperty(
    "--header-offset",
    `${Math.ceil(entry.target.getBoundingClientRect().height) + 24}px`,
  );
}).observe(document.querySelector("header"));
const menu = document.querySelector("#mobile-menu");
function closeMenu(returnFocus = false) {
  menu.hidden = true;
  menuButton.setAttribute("aria-expanded", "false");
  if (returnFocus) menuButton.focus();
}
menuButton.addEventListener("click", () => {
  const opening = menuButton.getAttribute("aria-expanded") !== "true";
  menu.hidden = !opening;
  menuButton.setAttribute("aria-expanded", String(opening));
});
menu.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    closeMenu();
    const hash = event.target.closest("a").hash;
    const target = hash && document.querySelector(hash);
    if (target) {
      target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !menu.hidden) closeMenu(true);
});
document.addEventListener("click", (event) => {
  if (!event.target.closest("header")) closeMenu();
});
matchMedia("(min-width: 1001px)").addEventListener("change", (event) => {
  if (event.matches) closeMenu();
});

const form = document.querySelector("#contact-form");
if (form) {
  const es = document.documentElement.lang.startsWith("es");
  const messages = es
    ? {
        company: "Ingrese el nombre de su empresa.",
        name: "Ingrese el nombre del contacto.",
        email: "Ingrese un correo electrónico válido.",
        consent: "Autorice el contacto para enviar su solicitud.",
        sending: "Enviando…",
        success: "Solicitud recibida. Conserve esta referencia:",
        error:
          "No se pudo confirmar la recepción. Sus datos se conservan en el formulario. Reintente el envío.",
        received: "Recibida el",
      }
    : {
        company: "Enter your company name.",
        name: "Enter the contact name.",
        email: "Enter a valid email address.",
        consent: "Provide contact consent to submit your request.",
        sending: "Sending…",
        success: "Request received. Keep this reference:",
        error:
          "We could not confirm receipt. Your details remain in the form. Please try again.",
        received: "Received on",
      };
  const submit = form.querySelector("button[type=submit]");
  const label = submit.textContent;
  const status = document.querySelector("#form-status");
  let submissionId = crypto.randomUUID();
  let lastPayload = "";
  let completed = false;
  const showError = (name) => {
    const input = form.elements[name];
    input.setAttribute("aria-invalid", "true");
    document.querySelector(`#${name}-error`).textContent = messages[name];
  };
  form.addEventListener("input", (event) => {
    const name = event.target.name;
    if (name && document.querySelector(`#${name}-error`)) {
      event.target.removeAttribute("aria-invalid");
      document.querySelector(`#${name}-error`).textContent = "";
    }
    if (completed) {
      completed = false;
      status.textContent = "";
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submit.disabled || completed) return;
    const payload = {
      company: form.elements.company.value.trim(),
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      consent: form.elements.consent.checked,
    };
    const errors = [];
    for (const name of ["company", "name", "email", "consent"]) {
      form.elements[name].removeAttribute("aria-invalid");
      document.querySelector(`#${name}-error`).textContent = "";
      if (
        !payload[name] ||
        (name === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
      ) {
        errors.push(name);
        showError(name);
      }
    }
    if (errors.length) {
      form.elements[errors[0]].focus();
      return;
    }
    const serialized = JSON.stringify(payload);
    if (lastPayload && serialized !== lastPayload)
      submissionId = crypto.randomUUID();
    lastPayload = serialized;
    submit.disabled = true;
    submit.textContent = messages.sending;
    status.textContent = "";
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, submissionId }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.fields?.length) {
          data.fields.filter((f) => f in messages).forEach(showError);
          form.querySelector("[aria-invalid=true]")?.focus();
        }
        throw new Error("Request failed");
      }
      if (!data.reference || !data.receivedAt)
        throw new Error("Invalid receipt");
      status.textContent = `${messages.success} ${data.reference}. ${messages.received} ${new Intl.DateTimeFormat(es ? "es-PE" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.receivedAt))}.`;
      completed = true;
      status.focus();
    } catch {
      status.textContent = messages.error;
      status.focus();
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}
