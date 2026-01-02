const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");
const slugify = require("slugify");

const ROOT = process.cwd();
const SITES_DIR = path.join(ROOT, "sites");
const OUT_DIR = path.join(ROOT, "docs");

const TIPPS_SRC = path.join(SITES_DIR, "profi-tipps");
const TIPPS_MD_DIR = path.join(TIPPS_SRC, "content", "blog");
const TIPPS_OUT = path.join(OUT_DIR, "profi-tipps");
const TIPPS_BLOG_OUT = path.join(TIPPS_OUT, "blog");
const TIPPS_DATA_OUT = path.join(TIPPS_OUT, "data");
const TIPPS_INDEX_OUT = path.join(TIPPS_DATA_OUT, "search-index.json");

function safeSlug(input) {
  return slugify(String(input || ""), { lower: true, strict: true, trim: true }).slice(0, 90);
}

function mdToPlainText(md) {
  return String(md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/[#>*_~\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderArticleHtml({ title, category, tags, updated, bodyHtml }) {
  const cat = category ? `<div class="meta">Kategorie: ${escapeHtml(category)}</div>` : "";
  const tagStr = Array.isArray(tags) && tags.length
    ? `<div class="meta">Tags: ${tags.map(escapeHtml).join(", ")}</div>`
    : "";
  const upd = updated ? `<div class="meta">Stand: ${escapeHtml(updated)}</div>` : "";

  // Blogseite liegt unter /profi-tipps/blog/, zurück zur Übersicht: ../index.html
  // CSS liegt in /profi-tipps/assets/... -> von blog aus: ../assets/...
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | Easy Cleany</title>
  <link rel="stylesheet" href="../assets/css/site.css" />
</head>
<body>
  <div class="wrap">
    <a class="back" href="../index.html">← Zur Übersicht</a>
    <div class="card">
      <h1>${escapeHtml(title)}</h1>
      ${upd}${cat}${tagStr}
      <article>${bodyHtml}</article>
    </div>
  </div>
</body>
</html>`;
}

async function rm(dir) {
  await fsp.rm(dir, { recursive: true, force: true });
}

async function copyDir(src, dst, opts = {}) {
  const { excludeNames = [] } = opts;
  await fsp.mkdir(dst, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });

  for (const e of entries) {
    if (excludeNames.includes(e.name)) continue;
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);

    if (e.isDirectory()) {
      await copyDir(s, d, opts);
    } else {
      await fsp.copyFile(s, d);
    }
  }
}

async function buildTipps() {
  await fsp.mkdir(TIPPS_BLOG_OUT, { recursive: true });
  await fsp.mkdir(TIPPS_DATA_OUT, { recursive: true });

  if (!fs.existsSync(TIPPS_MD_DIR)) {
    console.warn("⚠️ Keine Markdown-Artikel gefunden:", TIPPS_MD_DIR);
    await fsp.writeFile(TIPPS_INDEX_OUT, JSON.stringify([], null, 2), "utf8");
    return;
  }

  const files = (await fsp.readdir(TIPPS_MD_DIR)).filter(f => f.endsWith(".md"));
  const index = [];

  for (const file of files) {
    const full = path.join(TIPPS_MD_DIR, file);
    const raw = await fsp.readFile(full, "utf8");
    const parsed = matter(raw);

    const title = parsed.data.title || file.replace(/\.md$/, "");
    const category = parsed.data.category || "";
    const tags = parsed.data.tags || [];
    const updated = parsed.data.updated || parsed.data.date || "";

    const baseName = file.replace(/\.md$/, "");
    const slug = safeSlug(baseName) || safeSlug(title);

    const bodyMd = parsed.content || "";
    const bodyHtml = marked.parse(bodyMd);

    const outHtml = renderArticleHtml({ title, category, tags, updated, bodyHtml });
    await fsp.writeFile(path.join(TIPPS_BLOG_OUT, `${slug}.html`), outHtml, "utf8");

    const text = mdToPlainText(bodyMd);
    index.push({
      id: slug,
      title,
      category,
      tags,
      url: `./blog/${slug}.html`,
      excerpt: text.slice(0, 240),
      text,
      updated
    });
  }

  index.sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));
  await fsp.writeFile(TIPPS_INDEX_OUT, JSON.stringify(index, null, 2), "utf8");

  console.log(`✅ Profi-Tipps: ${files.length} Artikel gebaut`);
}

async function main() {
  // 1) docs/ frisch aufbauen
  await rm(OUT_DIR);
  await fsp.mkdir(OUT_DIR, { recursive: true });

  // 2) Alle sites nach docs kopieren (ohne content/)
  const siteNames = await fsp.readdir(SITES_DIR);
  for (const name of siteNames) {
    const src = path.join(SITES_DIR, name);
    const stat = await fsp.stat(src);
    if (!stat.isDirectory()) continue;

    const dst = path.join(OUT_DIR, name);
    await copyDir(src, dst, { excludeNames: ["content"] });
  }

  // 3) Profi-Tipps Artikel + Suchindex generieren
  await buildTipps();
  // Root Landing Page für /
  const rootIndexHtml = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Easy Cleany Portal</title>
  <meta http-equiv="refresh" content="0; url=./profi-tipps/">
</head>
<body>
  <p>Weiterleitung… <a href="./profi-tipps/">Profi-Tipps öffnen</a></p>
  <ul>
    <li><a href="./services/">Services</a></li>
    <li><a href="./deine-offerte/">Deine Offerte</a></li>
    <li><a href="./help/">Help</a></li>
  </ul>
</body>
</html>`;
  await fsp.writeFile(path.join(OUT_DIR, "index.html"), rootIndexHtml, "utf8");

  console.log("✅ Build komplett: docs/ ist bereit für Deploy");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
