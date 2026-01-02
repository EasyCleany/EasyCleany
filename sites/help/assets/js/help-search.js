// sites/help/assets/js/help-search.js
(() => {
  // -------- Konfiguration (falls du IDs anders hast, hier anpassen) --------
  const INDEX_URL = "./data/search-index.json"; // relativ zu /help/
  const MAX_SUGGESTIONS = 6;
  const MAX_RESULTS = 30;

  // Try multiple selectors (damit es auch mit ecpt-IDs funktioniert)
  const pick = (...sels) => sels.map(s => document.querySelector(s)).find(Boolean) || null;

  const input =
    pick("#helpSearchInput", "#ecptSearchInput", '[data-help-search="input"]');
  const button =
    pick("#helpSearchBtn", "#ecptSearchBtn", '[data-help-search="button"]');

  // Results container: bevorzugt vorhandene, sonst erzeugen wir eine
  let results =
    pick("#helpSearchResults", "#ecptSearchResults", '[data-help-search="results"]');

  if (!input) {
    console.warn("[help-search] Kein Such-Input gefunden. Lege z.B. ein <input id='helpSearchInput'> an.");
    return;
  }

  // Suggestions container: bevorzugt vorhandene, sonst erzeugen wir eine
  let suggestions =
    pick("#helpSearchSuggestions", "#ecptSearchSuggestions", '[data-help-search="suggestions"]');

  // Falls Containers fehlen, bauen wir sie direkt unter die Searchbar
  const ensureContainers = () => {
    const parent = input.closest("form, .search, .ecpt-search-wrap, .ecpt-searchbar, .ecpt-search") || input.parentElement;

    if (!suggestions) {
      suggestions = document.createElement("div");
      suggestions.id = "helpSearchSuggestions";
      suggestions.setAttribute("data-help-search", "suggestions");
      parent.appendChild(suggestions);
    }

    if (!results) {
      results = document.createElement("div");
      results.id = "helpSearchResults";
      results.setAttribute("data-help-search", "results");
      // möglichst nach dem Suchblock einfügen
      (parent.closest("section") || parent.parentElement || document.body).appendChild(results);
    }
  };

  ensureContainers();

  // Minimal-Styles für Dropdown + Ergebnisse (kollidiert kaum)
  const injectStyles = () => {
    const css = `
      [data-help-search="suggestions"], #helpSearchSuggestions, #ecptSearchSuggestions{
        position: relative;
        z-index: 50;
      }
      .hs-dd{
        position:absolute;
        left:0; right:0;
        top: calc(100% + 8px);
        background:#fff;
        border:1px solid rgba(15,26,23,.12);
        border-radius:14px;
        box-shadow:0 14px 38px rgba(0,0,0,.12);
        overflow:hidden;
      }
      .hs-item{
        display:block;
        padding:10px 12px;
        text-decoration:none;
        color:inherit;
        font-size:14px;
        line-height:1.35;
        border-top:1px solid rgba(15,26,23,.08);
      }
      .hs-item:first-child{border-top:none}
      .hs-item:hover{background:rgba(31,111,104,.08)}
      .hs-muted{opacity:.72;font-size:12px;margin-top:2px}
      .hs-results{
        margin-top:16px;
        display:grid;
        gap:10px;
      }
      .hs-card{
        background:#fff;
        border:1px solid rgba(15,26,23,.10);
        border-radius:16px;
        padding:12px 12px;
      }
      .hs-card a{font-weight:800; text-decoration:none; color:inherit}
      .hs-card a:hover{text-decoration:underline}
      .hs-meta{opacity:.72;font-size:12px;margin-top:4px}
      .hs-ex{opacity:.85;font-size:13px;margin-top:6px;line-height:1.45}
      .hs-empty{
        padding:12px;
        border:1px dashed rgba(15,26,23,.22);
        border-radius:16px;
        background:rgba(31,111,104,.05);
      }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  };
  injectStyles();

  // -------- Helpers --------
  const escapeHtml = (str) =>
    String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // diacritics
      .replace(/\s+/g, " ")
      .trim();

  const scoreItem = (q, item) => {
    const t = norm(item.title);
    const x = norm(item.text || "");
    if (!q) return 0;
    let score = 0;
    const posT = t.indexOf(q);
    const posX = x.indexOf(q);

    if (posT >= 0) score += 100 - Math.min(posT, 50); // Titel sehr wichtig
    if (posX >= 0) score += 40 - Math.min(posX, 80);  // Text wichtig
    // leichte Boni
    if (item.popular) score += 5;
    return score;
  };

  const hideSuggestions = () => {
    suggestions.innerHTML = "";
    suggestions.style.display = "none";
  };

  const showSuggestions = (html) => {
    suggestions.innerHTML = html;
    suggestions.style.display = "block";
  };

  const renderDropdown = (items, query) => {
    if (!items.length) {
      // Wunsch: "Nichts passendes gefunden" als Vorschlag anklickbar
      return `
        <div class="hs-dd">
          <a class="hs-item" href="./index.html#kontakt" data-hs-empty="1">
            <div><strong>Nichts passendes gefunden</strong></div>
            <div class="hs-muted">Klick hier, dann helfen wir dir persönlich weiter.</div>
          </a>
        </div>
      `;
    }

    const rows = items.map(it => `
      <a class="hs-item" href="${escapeHtml(it.url)}">
        <div><strong>${escapeHtml(it.title)}</strong></div>
        <div class="hs-muted">${escapeHtml((it.excerpt || "").slice(0, 120))}</div>
      </a>
    `).join("");

    return `<div class="hs-dd">${rows}</div>`;
  };

  const renderResults = (items, query) => {
    if (!items.length) {
      results.innerHTML = `
        <div class="hs-empty">
          <strong>Keine Treffer</strong><br>
          Versuch’s mit einem anderen Begriff – oder klick oben auf „Nichts passendes gefunden“.
        </div>
      `;
      return;
    }

    const cards = items.map(it => `
      <div class="hs-card">
        <a href="${escapeHtml(it.url)}">${escapeHtml(it.title)}</a>
        <div class="hs-meta">
          ${it.category ? `Kategorie: ${escapeHtml(it.category)} · ` : ""}
          ${it.updated ? `Stand: ${escapeHtml(it.updated)}` : ""}
        </div>
        <div class="hs-ex">${escapeHtml((it.excerpt || it.text || "").slice(0, 220))}</div>
      </div>
    `).join("");

    results.innerHTML = `<div class="hs-results">${cards}</div>`;
  };

  // -------- Daten laden --------
  let INDEX = [];
  let ready = false;

  const loadIndex = async () => {
    try {
      const res = await fetch(INDEX_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      INDEX = Array.isArray(json) ? json : [];
      ready = true;

      if (!INDEX.length) {
        console.warn("[help-search] Index ist leer. Build muss help/content/blog indizieren.");
      }
    } catch (e) {
      console.error("[help-search] Konnte search-index.json nicht laden:", e);
      INDEX = [];
      ready = true;
    }
  };

  // -------- Suche --------
  const queryIndex = (q) => {
    const qq = norm(q);
    if (!qq) return [];
    const scored = INDEX
      .map(it => ({ it, s: scoreItem(qq, it) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map(x => x.it);
    return scored;
  };

  const onType = () => {
    if (!ready) return;
    const q = input.value || "";
    const list = queryIndex(q).slice(0, MAX_SUGGESTIONS);
    const html = renderDropdown(list, q);
    showSuggestions(html);
  };

  const onSubmitSearch = () => {
    if (!ready) return;
    hideSuggestions();
    const q = input.value || "";
    const list = queryIndex(q).slice(0, MAX_RESULTS);
    renderResults(list, q);
  };

  // Events
  input.addEventListener("input", () => {
    // Vorschläge nur beim Tippen
    if (!ready) return;
    const v = (input.value || "").trim();
    if (!v) {
      hideSuggestions();
      results.innerHTML = "";
      return;
    }
    onType();
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmitSearch();
    }
    if (e.key === "Escape") {
      hideSuggestions();
    }
  });

  if (button) {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      onSubmitSearch();
    });
  }

  // Klick ausserhalb -> Dropdown zu
  document.addEventListener("click", (e) => {
    if (!suggestions.contains(e.target) && e.target !== input) hideSuggestions();
  });

  // Start
  loadIndex();
})();
