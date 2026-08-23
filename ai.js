(function () {
  "use strict";

  var $ = function (s, sc) { return (sc || document).querySelector(s); };
  var $$ = function (s, sc) { return Array.prototype.slice.call((sc || document).querySelectorAll(s)); };
  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[ai:" + name + "]", e); } }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var money = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };

  /* ============================================================
     CHAT ASSISTANT
     ============================================================ */
  function initChat() {
    var fab = $("[data-fab]"), panel = $("[data-chat]"), log = $("[data-log]");
    var input = $("[data-chatin]"), send = $("[data-chatsend]"), sugg = $("[data-sugg]");
    if (!fab || !panel || !log) return;

    var history = [];
    var busy = false;

    fab.addEventListener("click", function () {
      var open = panel.classList.toggle("is-open");
      fab.classList.toggle("is-open", open);
      fab.setAttribute("aria-label", open ? "Close the assistant" : "Open the assistant");
      if (open && input) setTimeout(function () { input.focus(); }, 260);
    });

    function bubble(text, who) {
      var d = document.createElement("div");
      d.className = "msg " + who;
      d.textContent = text;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d;
    }

    function typing() {
      var d = document.createElement("div");
      d.className = "msg bot typing";
      d.innerHTML = "<i></i><i></i><i></i>";
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d;
    }

    function ask(text) {
      if (busy || !text) return;
      busy = true;
      if (sugg) sugg.hidden = true;
      bubble(text, "me");
      history.push({ role: "user", text: text });
      if (input) input.value = "";
      if (send) send.disabled = true;
      var t = typing();

      fetch("assistant.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: history.slice(-8) })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          t.remove();
          var reply = (d && d.reply) || "I couldn't answer that one. Use the form on this page and we'll get back to you.";
          bubble(reply, "bot");
          history.push({ role: "model", text: reply });
        })
        .catch(function () {
          t.remove();
          bubble("I can't reach the assistant right now. Send us a note through the form and we'll respond shortly.", "bot");
        })
        .then(function () {
          busy = false;
          if (send) send.disabled = false;
          if (input) input.focus();
        });
    }

    if (send) send.addEventListener("click", function () { ask((input.value || "").trim()); });
    if (input) input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); ask((input.value || "").trim()); }
    });
    if (sugg) $$("button", sugg).forEach(function (b) {
      b.addEventListener("click", function () { ask(b.textContent.trim()); });
    });
  }

  /* ============================================================
     PHOTO ESTIMATOR
     ============================================================ */
  function initEstimator() {
    var root = $("[data-est]");
    if (!root) return;

    var files = [];
    var finish = "mid";
    var result = null;

    var drop = $("[data-drop]", root);
    var picker = $("[data-files]", root);
    var thumbs = $("[data-thumbs]", root);
    var areaEl = $("[data-area]", root);
    var err = $("[data-err]", root);
    var err2 = $("[data-err2]", root);
    var dots = $$(".est-steps span", root);

    function pane(name) {
      $$(".est-pane", root).forEach(function (p) {
        p.classList.toggle("is-on", p.getAttribute("data-pane") === String(name));
      });
      var idx = { "1": 0, "loading": 0, "2": 1, "3": 2 }[String(name)];
      dots.forEach(function (d, i) { d.classList.toggle("is-on", i <= idx); });
    }
    function showErr(el, msg) {
      if (!el) return;
      el.textContent = msg;
      el.classList.add("is-on");
    }
    function clearErr(el) { if (el) el.classList.remove("is-on"); }

    /* ---- files ---- */
    function renderThumbs() {
      if (!thumbs) return;
      thumbs.hidden = files.length === 0;
      thumbs.innerHTML = "";
      files.forEach(function (f, i) {
        var d = document.createElement("div");
        d.className = "thumb";
        var img = document.createElement("img");
        img.alt = "";
        img.src = URL.createObjectURL(f);
        var b = document.createElement("button");
        b.type = "button";
        b.textContent = "\u2715";
        b.setAttribute("aria-label", "Remove photo");
        b.addEventListener("click", function () { files.splice(i, 1); renderThumbs(); });
        d.appendChild(img); d.appendChild(b);
        thumbs.appendChild(d);
      });
    }

    function addFiles(list) {
      clearErr(err);
      Array.prototype.slice.call(list).forEach(function (f) {
        if (files.length >= 4) return;
        if (!/^image\//.test(f.type)) return;
        if (f.size > 8 * 1024 * 1024) { showErr(err, "One of those photos is over 8 MB. Try a smaller one."); return; }
        files.push(f);
      });
      renderThumbs();
    }

    if (drop && picker) {
      drop.addEventListener("click", function () { picker.click(); });
      picker.addEventListener("change", function () { addFiles(picker.files); picker.value = ""; });
      ["dragenter", "dragover"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("is-over"); });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("is-over"); });
      });
      drop.addEventListener("drop", function (e) {
        if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
      });
    }

    /* ---- finish chips ---- */
    var chips = $("[data-finish]", root);
    if (chips) $$("button", chips).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("button", chips).forEach(function (x) { x.classList.remove("is-on"); });
        b.classList.add("is-on");
        finish = b.getAttribute("data-v");
      });
    });

    /* ---- analyze ---- */
    var loadMsgs = [
      "Looking at your photos\u2026",
      "Identifying the trades involved\u2026",
      "Checking condition and complexity\u2026",
      "Putting the scope together\u2026"
    ];
    var loadTimer = null;

    function startLoading() {
      var el = $("[data-loadmsg]", root);
      var i = 0;
      if (loadTimer) clearInterval(loadTimer);
      loadTimer = setInterval(function () {
        i = (i + 1) % loadMsgs.length;
        if (el) el.textContent = loadMsgs[i];
      }, 2600);
    }
    function stopLoading() { if (loadTimer) clearInterval(loadTimer); loadTimer = null; }

    var REASONS = {
      no_files: "Add at least one photo first.",
      area: "Put in a rough square footage — even a guess helps.",
      size: "One of those photos is too large. Try one under 8 MB.",
      type: "That file type isn't supported. Use a JPG, PNG or HEIC photo.",
      not_construction: "Those don't look like photos of a space we can scope. Try a wide shot of the room or exterior.",
      no_scope: "We couldn't make out the work from those photos. A wider shot usually does it.",
      no_key: "The estimator isn't switched on yet. Use the form below and we'll get right back to you.",
      rate_min: "That's a few too many in a row. Give it a minute.",
      rate_day: "You've used the estimator a lot today. Use the form and we'll help you directly.",
      rate_global: "The estimator is busy right now. Use the form below and we'll respond shortly.",
      ai: "Something went wrong reading those photos. Try again, or use the form below."
    };

    var analyze = $("[data-analyze]", root);
    if (analyze) analyze.addEventListener("click", function () {
      clearErr(err);
      var area = parseFloat(areaEl && areaEl.value);
      if (!files.length) { showErr(err, REASONS.no_files); return; }
      if (!area || area <= 0) { showErr(err, REASONS.area); return; }

      var fd = new FormData();
      files.forEach(function (f) { fd.append("photos[]", f); });
      fd.append("area", String(area));
      fd.append("finish", finish);

      pane("loading");
      startLoading();

      fetch("scope-reader.php", { method: "POST", body: fd })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          stopLoading();
          if (!d || !d.ok) {
            pane("1");
            showErr(err, REASONS[(d && d.reason)] || REASONS.ai);
            return;
          }
          result = d;
          renderScope(d);
          pane("2");
        })
        .catch(function () {
          stopLoading();
          pane("1");
          showErr(err, REASONS.ai);
        });
    });

    /* ---- render scope (step 2) ---- */
    function renderScope(d) {
      var sum = $("[data-scopesum]", root);
      if (sum) {
        var cond = { good: "in good shape", fair: "needing some repair", poor: "with real repair work likely" }[d.condition] || "";
        sum.textContent = "About " + d.area.toLocaleString("en-US") + " sq ft"
          + (d.space_type ? " of " + d.space_type : "")
          + (cond ? ", " + cond : "")
          + ". Here's how the work breaks down.";
      }

      var list = $("[data-scope]", root);
      if (list) {
        list.innerHTML = d.lines.map(function (l) {
          return '<div class="scope-row">'
            + "<strong>" + esc(l.label) + "</strong>"
            + '<span class="sq">' + l.share + "% \u00b7 ~" + l.sqft.toLocaleString("en-US") + " sq ft</span>"
            + '<span class="wt">' + esc(l.what) + "</span>"
            + "</div>";
        }).join("");
      }

      var notes = $("[data-notes]", root);
      if (notes) {
        notes.innerHTML = (d.notes || []).map(function (n) {
          return "<li>" + esc(n) + "</li>";
        }).join("");
      }

      var unk = $("[data-unknowns]", root);
      if (unk) {
        unk.innerHTML = (d.unknowns && d.unknowns.length)
          ? "<b>What we can't tell from photos:</b> " + d.unknowns.map(esc).join(" \u00b7 ")
          : "";
      }
    }

    /* ---- email gate -> report ---- */
    var unlock = $("[data-unlock]", root);
    if (unlock) unlock.addEventListener("click", function () {
      clearErr(err2);
      var email = ($("[data-email]", root) || {}).value || "";
      var phone = ($("[data-phone]", root) || {}).value || "";
      var consent = $("[data-consent]", root);
      email = email.trim();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        showErr(err2, "That email doesn't look right — check it and try again.");
        return;
      }
      if (consent && !consent.checked) {
        showErr(err2, "Tick the box so we know it's okay to send it and follow up.");
        return;
      }

      unlock.disabled = true;
      unlock.textContent = "One moment\u2026";

      fetch("lead.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          telefono: phone,
          consent: true,
          calc: {
            area: result.area,
            finish: result.finish,
            condition: result.condition,
            trades: result.lines.map(function (l) { return l.label + " " + l.share + "%"; }).join(", "),
            low: result.range ? result.range.low : null,
            high: result.range ? result.range.high : null
          }
        })
      })
        .then(function (r) { return r.json(); })
        .catch(function () { return { ok: false }; })
        .then(function () {
          // The report shows either way — a failed save must not punish the visitor.
          renderReport(result);
          pane("3");
          unlock.disabled = false;
          unlock.textContent = "Show me the numbers";
          var card = $(".est-card", document);
          if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });

    /* ---- render report (step 3) ---- */
    function renderReport(d) {
      var rangeEl = $("[data-range]", root);
      var daysEl = $("[data-days]", root);

      if (d.rates_ready && d.range) {
        if (rangeEl) rangeEl.textContent = money(d.range.low) + " \u2013 " + money(d.range.high);
        if (daysEl) {
          daysEl.textContent = d.days
            ? "Roughly " + d.days.low + "\u2013" + d.days.high + " working days on site"
            : "";
        }
      } else {
        if (rangeEl) rangeEl.textContent = "Scope ready";
        if (daysEl) {
          daysEl.textContent = "Pricing isn't switched on yet — we'll put a real number in writing after the walkthrough.";
        }
      }

      var list2 = $("[data-scope2]", root);
      if (list2) {
        list2.innerHTML = d.lines.map(function (l) {
          var amt = (d.rates_ready && l.low != null)
            ? '<span class="amt">' + money(l.low) + " \u2013 " + money(l.high) + "</span>"
            : "";
          return '<div class="scope-row">'
            + "<strong>" + esc(l.label) + "</strong>"
            + '<span class="sq">~' + l.sqft.toLocaleString("en-US") + " sq ft</span>"
            + amt
            + '<span class="wt">' + esc(l.what) + "</span>"
            + "</div>";
        }).join("");
      }
    }

    var restart = $("[data-restart]", root);
    if (restart) restart.addEventListener("click", function () {
      files = []; result = null;
      renderThumbs();
      if (areaEl) areaEl.value = "";
      clearErr(err); clearErr(err2);
      pane("1");
    });
  }

  function boot() {
    safe(initChat, "chat");
    safe(initEstimator, "estimator");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
