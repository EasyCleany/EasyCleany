// tools/build.js
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const matter = require("gray-matter");
const { marked } = require("marked");
const slugify = require("slugify");

const ROOT = process.cwd();
const SITES_DIR = path.join(ROOT, "sites");
const OUT_DIR = path.join(ROOT, "docs");

// Profi-Tipps (Quelle + Output)
const TIPPS_SRC = path.join(SITES_DIR, "profi-tipps");
const TIPPS_MD_DIR = path.join(TIPPS_SRC, "content", "blog");
const TIPPS_OUT = path.join(OUT_DIR, "profi-tipps");
const TIPPS_BLOG_OUT = path.join(TIPPS_OUT, "blog");
const TIPPS_DATA_OUT = path.join(TIPPS_OUT, "data");
const TIPPS_INDEX_OUT = path.join(TIPPS_DATA_OUT, "search-index.json");

// Home-Quelle (optional)
const HOME_SRC_DIR = path.join(SITES_DIR, "home"); // optional: sites/home/*
const HOME_ALT_SRC_DIR = path.join(SITES_DIR, "_root"); // optional alternative: sites/_root/*

// ---------- helpers ----------
async function exists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function rm(dir) {
  await fsp.rm(dir, { recursive: true, force: true });
}

async function mkdirp(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function copyDir(src, dst, opts = {}) {
  const { excludeNames = [] } = opts;
  await mkdirp(dst);
  const entries = await fsp.readdir(src, { withFileTypes: true });

  for (const e of entries) {
    if (excludeNames.includes(e.name)) continue;

    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);

    if (e.isDirectory()) {
      await copyDir(s, d, opts);
    } else {
      await mkdirp(path.dirname(d));
      await fsp.copyFile(s, d);
    }
  }
}

function safeSlug(input) {
  return slugify(String(input || ""), {
    lower: true,
    strict: true,
    trim: true,
  }).slice(0, 90);
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
  const cat = category
    ? `<div class="meta">Kategorie: ${escapeHtml(category)}</div>`
    : "";
  const tagStr =
    Array.isArray(tags) && tags.length
      ? `<div class="meta">Tags: ${tags.map(escapeHtml).join(", ")}</div>`
      : "";
  const upd = updated
    ? `<div class="meta">Stand: ${escapeHtml(updated)}</div>`
    : "";

  // Blogseite liegt unter /profi-tipps/blog/ -> zurück zur Übersicht: ../index.html
  // CSS liegt unter /profi-tipps/assets/... -> von blog aus: ../assets/...
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

function defaultHomeHtml() {
  // Keine Weiterleitung. Nur Home/Portal mit Links.
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Easy Cleany – Portal</title>
  <style>
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:#f6faf9;color:#0f1a17}
    .wrap{max-width:980px;margin:0 auto;padding:28px 18px}
    .top{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .brand{font-weight:900;letter-spacing:.2px;font-size:22px}
    .brand span{color:#1f6f68}
    h1{margin:18px 0 6px;font-size:32px}
    p{margin:0 0 18px;color:#5a6b66}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin-top:18px}
    a.card{display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid #e6eeeb;border-radius:18px;padding:16px;transition:transform .12s ease,border-color .12s ease}
    a.card:hover{transform:translateY(-2px);border-color:rgba(31,111,104,.35)}
    .title{font-weight:800;margin:0 0 6px}
    .desc{color:#5a6b66;margin:0;font-size:14px;line-height:1.4}
    .btn{display:inline-block;text-decoration:none;border:1px solid #e6eeeb;border-radius:14px;padding:10px 12px;font-weight:700;background:#fff}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div class="brand">easy<span>cleany</span></div>
      <a class="btn" href="./deine-offerte/">Offerte anfragen</a>
    </div>

    <h1>Willkommen im Easy Cleany Portal</h1>
    <p>Wähle einen Bereich aus.</p>

    <div class="grid">
      <a class="card" href="./profi-tipps/">
        <div class="title">Profi-Tipps</div>
        <p class="desc">Anleitungen & Artikel – mit Volltextsuche.</p>
      </a>
      <a class="card" href="./help/">
        <div class="title">Help</div>
        <p class="desc">Schnelle Antworten und häufige Fragen.</p>
      </a>
      <a class="card" href="./services/">
        <div class="title">Services</div>
        <p class="desc">Unsere Leistungen im Überblick.</p>
      </a>
      <a class="card" href="./deine-offerte/">
        <div class="title">Deine Offerte</div>
        <p class="desc">Offerte anfragen und Details erfassen.</p>
      </a>
    </div>
  </div>
</body>
</html>`;
}

async function buildTipps() {
  // Alte Generierung entfernen, damit keine verwaisten HTMLs bleiben
  await rm(TIPPS_BLOG_OUT);
  await rm(TIPPS_DATA_OUT);
  await mkdirp(TIPPS_BLOG_OUT);
  await mkdirp(TIPPS_DATA_OUT);

  if (!(await exists(TIPPS_MD_DIR))) {
    // kein Content? trotzdem leeren Index schreiben
    await fsp.writeFile(TIPPS_INDEX_OUT, JSON.stringify([], null, 2), "utf8");
    console.log("⚠️ Profi-Tipps: Keine Markdown-Artikel gefunden:", TIPPS_MD_DIR);
    return;
  }

  const files = (await fsp.readdir(TIPPS_MD_DIR)).filter((f) => f.endsWith(".md"));
  const index = [];

  for (const file of files) {
    const full = path.join(TIPPS_MD_DIR, file);
    const raw = await fsp.readFile(full, "utf8");
    const parsed = matter(raw);

    // optional: draft Artikel nicht ausspielen
    if (parsed.data && parsed.data.draft === true) continue;

    const title = parsed.data.title || file.replace(/\.md$/, "");
    const category = parsed.data.category || "";
    const tags = parsed.data.tags || [];
    const updated = parsed.data.updated || parsed.data.date || "";

    const baseName = file.replace(/\.md$/, "");
    const slug =
      safeSlug(parsed.data.slug) || safeSlug(baseName) || safeSlug(title);

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
      updated,
      popular: parsed.data.popular === true
    });
  }

  // Neueste oben (als String-Vergleich ok, wenn ISO-Format genutzt wird)
  index.sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));

  await fsp.writeFile(TIPPS_INDEX_OUT, JSON.stringify(index, null, 2), "utf8");
  console.log(`✅ Profi-Tipps: ${index.length} Artikel gebaut`);
}

async function buildHomeToRoot() {
  // Wenn sites/home existiert, kopieren wir deren Inhalt in den Root von docs/
  // (Also docs/index.html, docs/assets/..., etc.)
  if (await exists(HOME_SRC_DIR)) {
    await copyDir(HOME_SRC_DIR, OUT_DIR, { excludeNames: ["content"] });
    // sicherstellen, dass index.html existiert:
    if (!(await exists(path.join(OUT_DIR, "index.html")))) {
      await fsp.writeFile(path.join(OUT_DIR, "index.html"), defaultHomeHtml(), "utf8");
    }
    console.log("✅ Home: aus sites/home nach docs/ kopiert");
    return;
  }

  // Alternative Quelle sites/_root
  if (await exists(HOME_ALT_SRC_DIR)) {
    await copyDir(HOME_ALT_SRC_DIR, OUT_DIR, { excludeNames: ["content"] });
    if (!(await exists(path.join(OUT_DIR, "index.html")))) {
      await fsp.writeFile(path.join(OUT_DIR, "index.html"), defaultHomeHtml(), "utf8");
    }
    console.log("✅ Home: aus sites/_root nach docs/ kopiert");
    return;
  }

  // Sonst Default Home generieren
  await fsp.writeFile(path.join(OUT_DIR, "index.html"), defaultHomeHtml(), "utf8");
  console.log("✅ Home: Default docs/index.html generiert");
}

async function main() {
  // 1) docs/ komplett neu aufbauen (sauberer Output)
  await rm(OUT_DIR);
  await mkdirp(OUT_DIR);

  // 2) Home zuerst/zuletzt ist egal – wir schreiben sie am Ende nochmal sicherheitshalber.
  // 3) Alle "Sites" nach docs/<name>/ kopieren (ohne content/)
  if (!(await exists(SITES_DIR))) {
    throw new Error(`SITES Ordner fehlt: ${SITES_DIR}`);
  }

  const siteNames = await fsp.readdir(SITES_DIR);

  for (const name of siteNames) {
    const src = path.join(SITES_DIR, name);
    const stat = await fsp.stat(src);
    if (!stat.isDirectory()) continue;

    // home/_root ist special: wird in docs/ root kopiert (nicht als Unterordner)
    if (name === "home" || name === "_root") continue;

    const dst = path.join(OUT_DIR, name);
    await copyDir(src, dst, { excludeNames: ["content"] });
  }

  // 4) Profi-Tipps: Artikel + Index generieren
  await buildTipps();

  // 5) Home ganz am Ende in Root schreiben (damit definitiv kein Redirect drin ist)
  await buildHomeToRoot();

  console.log("✅ Build komplett: docs/ ist bereit für Vercel Output Directory = docs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
