(() => {
  const article = document.querySelector(".help-article__card");
  if (!article) return;

  article.querySelectorAll("table").forEach((table) => {
    if (table.parentElement?.classList.contains("table-wrap")) return;
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  });

  article.querySelectorAll("img").forEach((img) => {
    img.loading = "lazy";
    img.decoding = "async";
    img.classList.add("article-image");
  });

  article.querySelectorAll("a").forEach((link) => {
    if (!link.href || link.getAttribute("href")?.startsWith("#")) return;
    link.target = "_blank";
    link.rel = "noopener";
  });
})();
