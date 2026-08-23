(function () {
  "use strict";

  var $ = function (s, sc) { return (sc || document).querySelector(s); };
  var $$ = function (s, sc) { return Array.prototype.slice.call((sc || document).querySelectorAll(s)); };
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function safe(fn, name) {
    try { fn(); } catch (e) { console.warn("[" + name + "]", e); }
  }

  /* ---------------------------------------------------- splash */
  function initSplash() {
    var el = $("[data-splash]");
    if (!el) return;
    var hide = function () { el.classList.add("is-out"); };
    if (document.readyState === "complete") setTimeout(hide, 700);
    else window.addEventListener("load", function () { setTimeout(hide, 500); });
    setTimeout(hide, 4000);
  }

  /* ---------------------------------------------------- nav */
  function initNav() {
    var hdr = $("[data-hdr]");
    var burger = $("[data-burger]");
    var menu = $("[data-menu]");

    if (hdr) {
      var onScroll = function () {
        hdr.classList.toggle("is-stuck", window.scrollY > 40);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    if (burger && menu) {
      var close = function () {
        menu.classList.remove("is-open");
        burger.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      };
      burger.addEventListener("click", function () {
        var open = menu.classList.toggle("is-open");
        burger.classList.toggle("is-open", open);
        burger.setAttribute("aria-expanded", open ? "true" : "false");
        document.body.style.overflow = open ? "hidden" : "";
      });
      $$("a", menu).forEach(function (a) { a.addEventListener("click", close); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") close();
      });
    }
  }

  /* ---------------------------------------------------- reveals */
  function initReveals() {
    var els = $$("[data-reveal]");
    if (!els.length) return;
    if (!("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("is-revealed"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-revealed");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -2% 0px" });
    els.forEach(function (el) { io.observe(el); });

    // mandatory safety net
    setTimeout(function () {
      $$("[data-reveal]:not(.is-revealed)").forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight * 1.5) {
          el.classList.add("is-revealed");
        }
      });
    }, 6000);
  }

  /* ---------------------------------------------------- count up */
  function initCount() {
    var els = $$("[data-count-to]");
    if (!els.length || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.textContent = el.getAttribute("data-count-to"); });
      return;
    }
    var run = function (el) {
      var to = parseFloat(el.getAttribute("data-count-to")) || 0;
      var dur = 1400, t0 = null;
      var pad = /^0\d/.test(el.getAttribute("data-count-to"));
      var step = function (t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / dur, 1);
        var v = Math.round(to * (1 - Math.pow(1 - p, 3)));
        el.textContent = pad && v < 10 ? "0" + v : String(v);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
      });
    }, { threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------- before / after */
  function initBeforeAfter() {
    $$("[data-ba]").forEach(function (ba) {
      var before = $("[data-ba-before]", ba);
      var handle = $("[data-ba-handle]", ba);
      if (!before || !handle) return;

      var dragging = false;

      var set = function (pct) {
        pct = Math.max(2, Math.min(98, pct));
        before.style.clipPath = "inset(0 " + (100 - pct) + "% 0 0)";
        handle.style.left = pct + "%";
      };

      var fromEvent = function (e) {
        var r = ba.getBoundingClientRect();
        var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
        set((x / r.width) * 100);
      };

      set(50);

      ba.addEventListener("pointerdown", function (e) {
        dragging = true;
        ba.setPointerCapture && ba.setPointerCapture(e.pointerId);
        fromEvent(e);
      });
      ba.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        e.preventDefault();
        fromEvent(e);
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
        ba.addEventListener(ev, function () { dragging = false; });
      });

      // hover-to-scrub on fine pointers, without needing a click
      if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
        ba.addEventListener("mousemove", function (e) {
          if (!dragging) fromEvent(e);
        });
      }

      // keyboard
      ba.setAttribute("tabindex", "0");
      ba.setAttribute("role", "slider");
      ba.setAttribute("aria-label", "Compare before and after");
      var cur = 50;
      ba.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { cur -= 4; set(cur); e.preventDefault(); }
        if (e.key === "ArrowRight") { cur += 4; set(cur); e.preventDefault(); }
      });
    });
  }

  /* ---------------------------------------------------- trades carousel */
  function initTrades() {
    var track = $("[data-trades]");
    if (!track) return;
    var prev = $("[data-tprev]"), next = $("[data-tnext]");
    var step = function () {
      var card = $(".trade", track);
      return card ? card.getBoundingClientRect().width + 22 : 320;
    };
    if (next) next.addEventListener("click", function () {
      track.scrollBy({ left: step(), behavior: "smooth" });
    });
    if (prev) prev.addEventListener("click", function () {
      track.scrollBy({ left: -step(), behavior: "smooth" });
    });
  }

  /* ---------------------------------------------------- gallery */
  function initGallery() {
    var grid = $("[data-gallery]");
    if (!grid) return;
    var cells = $$(".gal-cell", grid);
    var filters = $$("[data-filters] button");
    var more = $("[data-galmore]");
    var expanded = false;
    // A 12-photo wall costs about a screen and a half of thumb-scrolling on a
    // phone. Show half, let them ask for the rest.
    var LIMIT = matchMedia("(max-width: 719px)").matches ? 6 : 12;
    var active = "all";

    var apply = function () {
      var shown = 0;
      cells.forEach(function (c) {
        var match = active === "all" || c.getAttribute("data-cat") === active;
        var visible = match && (expanded || shown < LIMIT);
        if (match) shown++;
        c.hidden = !visible;
      });
      if (more) {
        var totalMatch = cells.filter(function (c) {
          return active === "all" || c.getAttribute("data-cat") === active;
        }).length;
        more.hidden = totalMatch <= LIMIT;
        more.textContent = expanded ? "Show fewer" : "Show all " + totalMatch + " photos";
      }
    };

    filters.forEach(function (b) {
      b.addEventListener("click", function () {
        filters.forEach(function (x) { x.classList.remove("is-on"); });
        b.classList.add("is-on");
        active = b.getAttribute("data-filter");
        expanded = false;
        apply();
      });
    });

    if (more) more.addEventListener("click", function () {
      expanded = !expanded;
      apply();
      if (!expanded) grid.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    apply();

    /* lightbox */
    var lb = $("[data-lb]"), lbImg = $("[data-lbimg]"), lbCount = $("[data-lbcount]");
    if (!lb || !lbImg) return;
    var order = [], pos = 0;

    var render = function () {
      var c = order[pos];
      if (!c) return;
      var img = $("img", c);
      lbImg.src = img.getAttribute("src");
      lbImg.alt = img.getAttribute("alt") || "";
      if (lbCount) lbCount.textContent = (pos + 1) + " / " + order.length;
    };
    var open = function (cell) {
      order = cells.filter(function (c) { return !c.hidden; });
      pos = order.indexOf(cell);
      if (pos < 0) pos = 0;
      render();
      lb.classList.add("is-open");
      document.body.style.overflow = "hidden";
    };
    var close = function () {
      lb.classList.remove("is-open");
      document.body.style.overflow = "";
    };
    var move = function (d) {
      pos = (pos + d + order.length) % order.length;
      render();
    };

    cells.forEach(function (c) {
      c.addEventListener("click", function () { open(c); });
    });
    $("[data-lbclose]").addEventListener("click", close);
    $("[data-lbprev]").addEventListener("click", function (e) { e.stopPropagation(); move(-1); });
    $("[data-lbnext]").addEventListener("click", function (e) { e.stopPropagation(); move(1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
    });
  }

  /* ---------------------------------------------------- faq */
  function initFaq() {
    $$("[data-faq] .faq-item").forEach(function (item) {
      var q = $(".faq-q", item);
      if (!q) return;
      q.setAttribute("aria-expanded", "false");
      q.addEventListener("click", function () {
        var open = item.classList.toggle("is-open");
        q.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  /* ---------------------------------------------------- form */
  function initForm() {
    var form = $("[data-form]");
    if (!form) return;
    var ok = $("[data-formok]");
    var btn = $("[data-submit]", form);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }
      // NOTE: no backend yet — wire this to lead.php when the site goes live.
      setTimeout(function () {
        if (ok) ok.classList.add("is-on");
        form.reset();
        if (btn) { btn.disabled = false; btn.textContent = "Request my estimate"; }
      }, 700);
    });
  }


  /* ---------------------------------------------------- mobile action bar */
  function initMobileBar() {
    var bar = $("[data-mbar]");
    var contact = $("#contact");
    if (!bar || !contact || !("IntersectionObserver" in window)) return;
    // No point shouting "get an estimate" while they're looking at the form.
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { bar.classList.toggle("is-hidden", e.isIntersecting); });
    }, { threshold: 0.12 }).observe(contact);
  }

  /* ---------------------------------------------------- misc */
  function initYear() {
    var y = $("[data-year]");
    if (y) y.textContent = String(new Date().getFullYear());
  }

  /* ---------------------------------------------------- hero slideshow */
  function initHeroSlides() {
    var wrap = $("[data-heroslides]");
    if (!wrap) return;
    var slides = $$("img", wrap);
    if (slides.length < 2) {
      if (slides[0]) slides[0].classList.add("is-on");
      return;
    }

    var ticks = $("[data-heroticks]");
    var dots = [];
    if (ticks) {
      slides.forEach(function () {
        var d = document.createElement("span");
        d.className = "hero-tick";
        ticks.appendChild(d);
        dots.push(d);
      });
    }

    var i = 0;
    var SLIDE_MS = 6000;
    var timer = null;

    function show(n) {
      slides.forEach(function (s, k) { s.classList.toggle("is-on", k === n); });
      dots.forEach(function (d, k) { d.classList.toggle("is-on", k === n); });
    }

    show(0);

    // A still hero is the correct behaviour for reduced motion.
    if (reduced) return;

    function start() {
      if (timer) return;
      timer = setInterval(function () {
        i = (i + 1) % slides.length;
        show(i);
      }, SLIDE_MS);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    // don't burn cycles (or battery) while the tab is hidden or the hero is off-screen
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });

    if ("IntersectionObserver" in window) {
      var hero = $(".hero");
      if (hero) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (e) { if (e.isIntersecting) start(); else stop(); });
        }, { threshold: 0.05 }).observe(hero);
        return;
      }
    }
    start();
  }

  function initHeroParallax() {
    if (reduced) return;
    var bg = $(".hero-bg");
    if (!bg) return;
    gsap.to(bg, {
      yPercent: 10,
      ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
  }

  function initTilt() {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    $$(".quote, .pillar").forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = "perspective(900px) rotateX(" + (-py * 3.2) + "deg) rotateY(" + (px * 3.2) + "deg) translateY(-4px)";
      });
      el.addEventListener("mouseleave", function () { el.style.transform = ""; });
    });
  }

  /* ---------------------------------------------------- boot */
  function boot() {
    safe(initSplash, "splash");
    safe(initNav, "nav");
    safe(initReveals, "reveals");
    safe(initCount, "count");
    safe(initBeforeAfter, "beforeAfter");
    safe(initTrades, "trades");
    safe(initGallery, "gallery");
    safe(initFaq, "faq");
    safe(initForm, "form");
    safe(initYear, "year");
    safe(initTilt, "tilt");
    safe(initHeroSlides, "heroSlides");
    safe(initMobileBar, "mobileBar");

    if (window.gsap && window.ScrollTrigger) {
      try { gsap.registerPlugin(ScrollTrigger); } catch (_) {}
      safe(initHeroParallax, "heroParallax");
    }

    document.documentElement.classList.add("is-ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
