let motionAnimate = null;

try {
  ({ animate: motionAnimate } = await import("https://cdn.jsdelivr.net/npm/motion@latest/+esm"));
} catch {
  motionAnimate = null;
}

(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function initLenis() {
    if (reduceMotion || !window.Lenis) return null;

    const lenis = new window.Lenis({
      lerp: 0.08,
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });

    if (window.ScrollTrigger) {
      lenis.on("scroll", window.ScrollTrigger.update);
    }

    if (window.gsap) {
      window.gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
      });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      function raf(time) {
        lenis.raf(time);
        window.requestAnimationFrame(raf);
      }

      window.requestAnimationFrame(raf);
    }

    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;

        event.preventDefault();
        lenis.scrollTo(target, { offset: -72 });
      });
    });

    return lenis;
  }

  function initNavbarState() {
    const navbar = document.querySelector(".landing-nav");
    const hero = document.querySelector("[data-landing-hero]");

    if (!navbar || !hero) return;

    function updateNavbar() {
      const heroBottom = hero.getBoundingClientRect().bottom;
      navbar.classList.toggle("navbar--scrolled", heroBottom <= 96);
    }

    updateNavbar();
    window.addEventListener("scroll", updateNavbar, { passive: true });
    window.addEventListener("resize", updateNavbar);
  }

  function initHeroScene() {
    if (reduceMotion || !window.gsap) return;

    const hero = document.querySelector("[data-landing-hero]");
    if (!hero) return;

    const titleLines = hero.querySelectorAll(".hero-title-line");
    const entranceTargets = [
      hero.querySelector("[data-hero-kicker]"),
      ...titleLines,
      hero.querySelector(".hero__sub"),
      hero.querySelector(".hero__cta-group"),
      hero.querySelector(".hero-scroll-cue"),
    ].filter(Boolean);
    const heroVisual = hero.querySelector("[data-hero-visual]");
    const timeline = window.gsap.timeline({ defaults: { ease: "expo.out" } });

    window.gsap.set(entranceTargets, {
      autoAlpha: 0,
      y: 22,
    });
    window.gsap.set(titleLines, { clipPath: "inset(0 100% 0 0)" });
    window.gsap.set(heroVisual, {
      autoAlpha: 0,
      x: 56,
      rotateY: -8,
      filter: "blur(10px)",
      transformPerspective: 900,
    });

    timeline
      .to(hero.querySelector("[data-hero-kicker]"), { autoAlpha: 1, y: 0, duration: 0.48 }, 0.08)
      .to(titleLines, { autoAlpha: 1, y: 0, clipPath: "inset(0 0% 0 0)", duration: 0.78, stagger: 0.09 }, 0.18)
      .to(heroVisual, { autoAlpha: 1, x: 0, rotateY: 0, filter: "blur(0px)", duration: 0.9 }, 0.45)
      .to(hero.querySelector(".hero__sub"), { autoAlpha: 1, y: 0, duration: 0.58 }, 0.78)
      .to(hero.querySelector(".hero__cta-group"), { autoAlpha: 1, y: 0, duration: 0.5 }, 0.92)
      .to(hero.querySelector(".hero-scroll-cue"), { autoAlpha: 1, y: 0, duration: 0.45 }, 1.05);
  }

  function initInteractiveGradient() {
    const gradient = document.querySelector(".hero-interactive-gradient");
    const hero = document.querySelector("[data-landing-hero]");
    if (!gradient || !hero) return;

    let influenceX = 0;
    let influenceY = 0;
    let targetInfluenceX = 0;
    let targetInfluenceY = 0;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function setGradient(time = 0) {
      const baseX = 0.7 + Math.sin(time * 0.00032) * 0.055 + Math.sin(time * 0.00015 + 1.8) * 0.026;
      const baseY = 0.25 + Math.cos(time * 0.00028) * 0.045 + Math.sin(time * 0.00014 + 0.6) * 0.018;

      influenceX += (targetInfluenceX - influenceX) * 0.025;
      influenceY += (targetInfluenceY - influenceY) * 0.025;

      const x = clamp(baseX * 100, 54, 82);
      const y = clamp(baseY * 100, 10, 42);
      const driftX = Math.sin(time * 0.00042) * 24 + influenceX * 18;
      const driftY = Math.cos(time * 0.00038) * 18 + influenceY * 14;
      const rotate = Math.sin(time * 0.00018) * 4 + influenceX * 1.6;

      gradient.style.setProperty("--ig-x", `${x.toFixed(2)}%`);
      gradient.style.setProperty("--ig-y", `${y.toFixed(2)}%`);
      gradient.style.setProperty("--ig-drift-x", `${driftX.toFixed(2)}px`);
      gradient.style.setProperty("--ig-drift-y", `${driftY.toFixed(2)}px`);
      gradient.style.setProperty("--ig-rotate", `${rotate.toFixed(2)}deg`);

      if (!reduceMotion) {
        window.requestAnimationFrame(setGradient);
      }
    }

    hero.addEventListener("pointermove", (event) => {
      const rect = hero.getBoundingClientRect();
      const pointerX = (event.clientX - rect.left) / rect.width - 0.5;
      const pointerY = (event.clientY - rect.top) / rect.height - 0.5;

      targetInfluenceX = clamp(pointerX, -0.5, 0.5);
      targetInfluenceY = clamp(pointerY, -0.5, 0.5);
    }, { passive: true });

    hero.addEventListener("pointerleave", () => {
      targetInfluenceX = 0;
      targetInfluenceY = 0;
    });

    setGradient();
  }

  function initLandingProcess() {
    const visualTarget = document.getElementById("sticky-visual-target");
    const statusLabel = document.getElementById("artifact-status");
    const panels = document.querySelectorAll(".step-panel");

    if (!visualTarget || panels.length === 0) return;

    const statusMessages = {
      datos: "Preparando datos...",
      evidencias: "Organizando archivos...",
      revision: "Estructura verificada",
      zip: "ZIP empaquetado",
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const step = entry.target.id.replace("step-", "");
          visualTarget.dataset.step = step;

          if (statusLabel) {
            statusLabel.textContent = statusMessages[step] || "Preparando...";
          }
        });
      },
      { threshold: 0.5 }
    );

    panels.forEach((panel) => observer.observe(panel));
  }

  function initMagneticButtons() {
    if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;

    document.querySelectorAll("[data-magnetic]").forEach((button) => {
      let frame = 0;
      let targetX = 0;
      let targetY = 0;
      let returnFrame = 0;

      function setMagnet(x, y, scale = 1.015) {
        button.style.setProperty("--magnet-x", `${x.toFixed(2)}px`);
        button.style.setProperty("--magnet-y", `${y.toFixed(2)}px`);
        button.style.setProperty("--magnet-scale", scale.toFixed(3));
      }

      function applyTransform() {
        frame = 0;
        setMagnet(targetX, targetY);
      }

      function cancelReturn() {
        if (!returnFrame) return;
        window.cancelAnimationFrame(returnFrame);
        returnFrame = 0;
      }

      function fallbackSpringReturn(startX, startY) {
        let x = startX;
        let y = startY;
        let vx = 0;
        let vy = 0;
        const stiffness = 0.24;
        const damping = 0.68;

        function step() {
          vx += -x * stiffness;
          vy += -y * stiffness;
          vx *= damping;
          vy *= damping;
          x += vx;
          y += vy;

          setMagnet(x, y, 1 + Math.min(0.015, Math.hypot(x, y) / 900));

          if (Math.abs(x) < 0.08 && Math.abs(y) < 0.08 && Math.abs(vx) < 0.08 && Math.abs(vy) < 0.08) {
            setMagnet(0, 0, 1);
            returnFrame = 0;
            return;
          }

          returnFrame = window.requestAnimationFrame(step);
        }

        returnFrame = window.requestAnimationFrame(step);
      }

      function returnToRest() {
        if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }

        const startX = parseFloat(button.style.getPropertyValue("--magnet-x")) || targetX;
        const startY = parseFloat(button.style.getPropertyValue("--magnet-y")) || targetY;
        targetX = 0;
        targetY = 0;
        cancelReturn();

        if (motionAnimate) {
          try {
            const animation = motionAnimate(
              button,
              {
                "--magnet-x": [`${startX}px`, "0px"],
                "--magnet-y": [`${startY}px`, "0px"],
                "--magnet-scale": [1.018, 1],
              },
              { type: "spring", stiffness: 720, damping: 19, mass: 0.42 }
            );

            if (animation?.finished) {
              animation.finished.finally(() => setMagnet(0, 0, 1));
            } else {
              window.setTimeout(() => setMagnet(0, 0, 1), 460);
            }
            return;
          } catch {
            fallbackSpringReturn(startX, startY);
            return;
          }
        }

        fallbackSpringReturn(startX, startY);
      }

      button.addEventListener("pointermove", (event) => {
        cancelReturn();
        const rect = button.getBoundingClientRect();
        targetX = (event.clientX - rect.left - rect.width / 2) * 0.16;
        targetY = (event.clientY - rect.top - rect.height / 2) * 0.24;

        if (!frame) {
          frame = window.requestAnimationFrame(applyTransform);
        }
      });

      button.addEventListener("pointerleave", returnToRest);
      button.addEventListener("pointerout", returnToRest);
      button.addEventListener("mouseleave", returnToRest);
      button.addEventListener("blur", returnToRest);

      document.addEventListener("pointermove", (event) => {
        const rect = button.getBoundingClientRect();
        const outside =
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom;

        if (outside && (targetX !== 0 || targetY !== 0)) {
          returnToRest();
        }
      }, { passive: true });
    });
  }

  function initScrollScenes() {
    if (reduceMotion || !window.gsap || !window.ScrollTrigger) return;

    window.gsap.registerPlugin(window.ScrollTrigger);

    document.querySelectorAll(".step-panel").forEach((panel) => {
      window.gsap.fromTo(
        panel,
        { autoAlpha: 0.55, y: 28 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.55,
          ease: "expo.out",
          scrollTrigger: {
            trigger: panel,
            start: "top 70%",
            end: "center center",
            toggleActions: "play none none reverse",
          },
        }
      );
    });
  }

  function initLanding() {
    if (window.gsap && window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
    }

    initLenis();
    initNavbarState();
    initInteractiveGradient();
    initHeroScene();
    initLandingProcess();
    initMagneticButtons();
    initScrollScenes();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLanding, { once: true });
  } else {
    initLanding();
  }
})();
