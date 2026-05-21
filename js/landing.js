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

      function applyTransform() {
        frame = 0;
        button.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }

      button.addEventListener("pointermove", (event) => {
        const rect = button.getBoundingClientRect();
        targetX = (event.clientX - rect.left - rect.width / 2) * 0.16;
        targetY = (event.clientY - rect.top - rect.height / 2) * 0.24;

        if (!frame) {
          frame = window.requestAnimationFrame(applyTransform);
        }
      });

      button.addEventListener("pointerleave", () => {
        if (frame) {
          window.cancelAnimationFrame(frame);
          frame = 0;
        }

        if (motionAnimate) {
          motionAnimate(button, { x: 0, y: 0 }, { type: "spring", stiffness: 360, damping: 24, mass: 0.45 });
        } else {
          button.style.transform = "translate3d(0, 0, 0)";
        }
      });
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
