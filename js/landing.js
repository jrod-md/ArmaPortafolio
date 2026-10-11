(() => {
  const reducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  const STACK_FILL_DELAY_MS = 260;
  const STACK_FILL_STEP_MS = 150;

  // La pila del hero se arma carpeta por carpeta, de abajo hacia arriba.
  function playHeroStack() {
    const folds = Array.from(document.querySelectorAll("#hero-stack .fold"));
    if (reducedMotion || folds.length === 0) return;

    folds.forEach((fold) => fold.classList.remove("is-filled"));
    folds.forEach((fold, index) => {
      window.setTimeout(() => fold.classList.add("is-filled"), STACK_FILL_DELAY_MS + index * STACK_FILL_STEP_MS);
    });
  }

  function watch(elements, options, onEnter) {
    if (!("IntersectionObserver" in window)) {
      elements.forEach(onEnter);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        onEnter(entry.target);
      });
    }, options);
    elements.forEach((element) => observer.observe(element));
  }

  function bindReveals() {
    const items = Array.from(document.querySelectorAll(".reveal"));
    if (reducedMotion || items.length === 0) return;

    // Solo se ocultan los que todavía no se ven, para no parpadear al cargar.
    const pending = items.filter((item) => item.getBoundingClientRect().top > window.innerHeight * 0.9);
    pending.forEach((item) => item.classList.add("reveal--pending"));
    watch(pending, { rootMargin: "0px 0px -8% 0px" }, (item) => item.classList.remove("reveal--pending"));
  }

  function bindChaos() {
    const list = document.getElementById("chaos");
    const state = document.getElementById("chaos-state");
    if (!list) return;

    const sort = () => {
      list.classList.add("is-sorted");
      if (state) state.textContent = "Así quedan: en orden.";
    };

    if (reducedMotion) {
      sort();
      return;
    }
    watch([list], { threshold: 0.6 }, () => window.setTimeout(sort, 350));
  }

  playHeroStack();
  bindReveals();
  bindChaos();
})();
