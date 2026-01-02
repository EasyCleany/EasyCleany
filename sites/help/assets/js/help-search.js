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
    document.head.appendChi
