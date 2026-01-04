(() => {
  const article = document.querySelector(".help-article__card");
  if (!article) return;

  const nav = document.querySelector("#articleNav");

  const wrapTables = () => {
    article.querySelectorAll("table").forEach((table) => {
      if (table.parentElement?.classList.contains("table-wrap")) return;
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  };

  const handleImages = () => {
    const makePlaceholder = (img) => {
      const altText = img.getAttribute("alt") || "Symbolbild";
      const placeholder = document.createElement("div");
      placeholder.className = "image-placeholder";
      placeholder.innerHTML = `
        <span class="image-placeholder__icon">🖼️</span>
        <span>${altText}</span>
      `;
      img.replaceWith(placeholder);
    };

    article.querySelectorAll("img").forEach((img) => {
      img.loading = "lazy";
      img.decoding = "async";
      img.classList.add("article-image");
      img.addEventListener("error", () => makePlaceholder(img), { once: true });
    });
  };

  const handleLinks = () => {
    article.querySelectorAll("a").forEach((link) => {
      if (!link.href || link.getAttribute("href")?.startsWith("#")) return;
      link.target = "_blank";
      link.rel = "noopener";
    });
  };

  const buildNav = () => {
    if (!nav) return;
    const headings = [...article.querySelectorAll("h2, h3")];
    if (!headings.length) {
      nav.style.display = "none";
      return;
    }

    const items = headings.map((heading, index) => {
      if (!heading.id) {
        heading.id = `section-${index + 1}`;
      }
      const label = heading.textContent?.trim() || `Abschnitt ${index + 1}`;
      return { id: heading.id, label, level: heading.tagName.toLowerCase() };
    });

    nav.innerHTML = `
      <h4>In diesem Artikel</h4>
      ${items.map((item) => `
        <a href="#${item.id}" class="nav-link nav-link--${item.level}">${item.label}</a>
      `).join("")}
    `;

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const target = article.querySelector(link.getAttribute("href"));
        if (!target) return;
        const offset = 100;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
      });
    });
  };

  const setupFeedback = () => {
    const feedbackButtons = article.querySelectorAll("[data-feedback]");
    const feedbackForm = article.querySelector("#feedbackForm");
    const feedbackThanks = article.querySelector("#feedbackThanks");
    const feedbackQuick = article.querySelector("#feedbackQuick");
    const feedbackActions = article.querySelector(".feedback-actions");

    if (!feedbackButtons.length) return;

    feedbackButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.feedback;
        if (value === "yes") {
          feedbackActions.style.display = "none";
          feedbackQuick.style.display = "grid";
          feedbackThanks.style.display = "none";
          feedbackForm.style.display = "none";
        } else {
          feedbackActions.style.display = "none";
          feedbackQuick.style.display = "none";
          feedbackThanks.style.display = "none";
          feedbackForm.style.display = "grid";
        }
      });
    });
  };

  wrapTables();
  handleImages();
  handleLinks();
  buildNav();
  setupFeedback();
})();
