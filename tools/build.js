// tools/build.js
// Baut aus Markdown-Artikeln HTML-Seiten + Suchindex.
// Output ist auf Vercel ausgelegt: Output Directory = "docs".

const fsp = require("fs/promises");
const path = require("path");
const matter = require("gray-matter");
const slugify = require("slugify");

// IMPORTANT:
// Diese Datei nutzt CommonJS (require). Pinne in package.json am besten:
//   "marked": "^4.3.0"
// neuere major-Versionen von marked können ESM-only sein.
const { marked } = require("marked");

const ROOT = process.cwd();
const SITES_DIR = path.join(ROOT, "sites");

// ✅ Vercel: Output Directory = docs
const OUT_DIR = path.join(ROOT, "docs");

// Markdown-Collections, die gebaut werden sollen
const COLLECTIONS = [
  {
    key: "profi-tipps",
    mdDir: path.join(SITES_DIR, "profi-tipps", "content", "blog"),
    outSiteDir: path.join(OUT_DIR, "profi-tipps"),
  },
  {
    key: "help",
    mdDir: path.join(SITES_DIR, "help", "content", "blog"),
    outSiteDir: path.join(OUT_DIR, "help"),
    templatePath: path.join(SITES_DIR, "help", "assets", "templates", "article.html"),
  },
];

// Home-Quelle (optional)
const HOME_SRC_DIR = path.join(SITES_DIR, "home");
const HOME_ALT_SRC_DIR = path.join(SITES_DIR, "_root");

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
  }).slice(0, 110);
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

async function walkMdFiles(dir) {
  const out = [];
  if (!(await exists(dir))) return out;

  async function walk(current) {
    const entries = await fsp.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile() && e.name.toLowerCase().endsWith(".md")) {
        out.push(full);
      }
    }
  }

  await walk(dir);
  return out;
}

function renderArticleHtml({ title, category, tags, updated, bodyHtml }) {
  const cat = category
    ? `<div class="meta">Kategorie: ${escapeHtml(category)}</div>`
    : "";
  const tagStr =
    Array.isArray(tags) && tags.length
      ? `<div class="meta">Tags: ${tags.map(escapeHtml).join(", ")}</div>`
      : "";
  const upd = updated ? `<div class="meta">Stand: ${escapeHtml(updated)}</div>` : "";

  // Blogseite liegt unter /<site>/blog/ -> zurück zur Übersicht: ../index.html
  // CSS liegt unter /<site>/assets/... -> von blog aus: ../assets/...
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

function renderArticleTemplate(template, { title, category, tags, updated, bodyHtml, backUrl }) {
  const meta = [];
  if (updated) meta.push(`<span>Stand: ${escapeHtml(updated)}</span>`);
  if (category) meta.push(`<span>Kategorie: ${escapeHtml(category)}</span>`);
  if (Array.isArray(tags) && tags.length) {
    meta.push(`<span>Tags: ${tags.map(escapeHtml).join(", ")}</span>`);
  }

  const metaHtml = meta.length ? `<div class="help-article__meta">${meta.join("")}</div>` : "";

  return template
    .replaceAll("{{title}}", escapeHtml(title))
    .replace("{{body}}", bodyHtml)
    .replace("{{meta}}", metaHtml)
    .replace("{{backUrl}}", backUrl || "../index.html");
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

async function buildCollection({ key, mdDir, outSiteDir, templatePath }) {
  const blogOut = path.join(outSiteDir, "blog");
  const dataOut = path.join(outSiteDir, "data");
  const indexOut = path.join(dataOut, "search-index.json");
  const template = templatePath && (await exists(templatePath))
    ? await fsp.readFile(templatePath, "utf8")
    : null;

  // Alte Generierung entfernen
  await rm(blogOut);
  await rm(dataOut);
  await mkdirp(blogOut);
  await mkdirp(dataOut);

  const mdFiles = await walkMdFiles(mdDir);
  if (!mdFiles.length) {
    await fsp.writeFile(indexOut, JSON.stringify([], null, 2), "utf8");
    console.log(`⚠️ ${key}: Keine Markdown-Artikel gefunden: ${mdDir}`);
    return;
  }

  const index = [];

  for (const full of mdFiles) {
    const raw = await fsp.readFile(full, "utf8");
    const parsed = matter(raw);

    // draft Artikel nicht ausspielen
    if (parsed.data && parsed.data.draft === true) continue;

    const rel = path.relative(mdDir, full).replace(/\\/g, "/");
    const baseNoExt = rel.replace(/\.md$/i, "");

    const title = parsed.data.title || path.basename(baseNoExt);
    const category = parsed.data.category || "";
    const tags = parsed.data.tags || [];
    const updated = parsed.data.updated || parsed.data.date || "";

    const slug =
      safeSlug(parsed.data.slug) || safeSlug(baseNoExt.replace(/\//g, "-")) || safeSlug(title);

    const bodyMd = parsed.content || "";
    const bodyHtml = marked.parse(bodyMd);

    const outHtml = template
      ? renderArticleTemplate(template, { title, category, tags, updated, bodyHtml, backUrl: "../index.html" })
      : renderArticleHtml({ title, category, tags, updated, bodyHtml });
    await fsp.writeFile(path.join(blogOut, `${slug}.html`), outHtml, "utf8");

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
      popular: parsed.data.popular === true,
      // optional für Debugging:
      source: rel,
    });
  }

  // Neueste oben (wenn ISO-Format genutzt wird)
  index.sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));

  await fsp.writeFile(indexOut, JSON.stringify(index, null, 2), "utf8");
  console.log(`✅ ${key}: ${index.length} Artikel gebaut`);
}

async function buildHomeToRoot() {
  // Wenn sites/home existiert -> nach docs/ kopieren
  if (await exists(HOME_SRC_DIR)) {
    await copyDir(HOME_SRC_DIR, OUT_DIR, { excludeNames: ["content"] });

    const idx = path.join(OUT_DIR, "index.html");
    if (!(await exists(idx))) {
      await fsp.writeFile(idx, defaultHomeHtml(), "utf8");
      console.log("✅ Home: index.html fehlte, Default generiert");
      return;
    }

    // Falls dort noch eine Meta-Weiterleitung drin ist -> überschreiben
    const raw = await fsp.readFile(idx, "utf8");
    if (/http-equiv\s*=\s*"refresh"/i.test(raw)) {
      await fsp.writeFile(idx, defaultHomeHtml(), "utf8");
      console.log("✅ Home: Redirect-Index ersetzt durch Portal-Index");
    } else {
      console.log("✅ Home: aus sites/home nach docs/ kopiert");
    }

    return;
  }

  // Alternative Quelle sites/_root
  if (await exists(HOME_ALT_SRC_DIR)) {
    await copyDir(HOME_ALT_SRC_DIR, OUT_DIR, { excludeNames: ["content"] });
    const idx = path.join(OUT_DIR, "index.html");
    if (!(await exists(idx))) {
      await fsp.writeFile(idx, defaultHomeHtml(), "utf8");
      console.log("✅ Home: index.html fehlte, Default generiert");
      return;
    }
    const raw = await fsp.readFile(idx, "utf8");
    if (/http-equiv\s*=\s*"refresh"/i.test(raw)) {
      await fsp.writeFile(idx, defaultHomeHtml(), "utf8");
      console.log("✅ Home: Redirect-Index ersetzt durch Portal-Index");
    } else {
      console.log("✅ Home: aus sites/_root nach docs/ kopiert");
    }
    return;
  }

  // Sonst Default Home generieren
  await fsp.writeFile(path.join(OUT_DIR, "index.html"), defaultHomeHtml(), "utf8");
  console.log("✅ Home: Default docs/index.html generiert");
}

async function main() {
  // 1) docs/ komplett neu aufbauen
  await rm(OUT_DIR);
  await mkdirp(OUT_DIR);

  // 2) Alle "Sites" nach docs/<name>/ kopieren (ohne content/)
  if (!(await exists(SITES_DIR))) {
    throw new Error(`SITES Ordner fehlt: ${SITES_DIR}`);
  }

  const siteNames = await fsp.readdir(SITES_DIR);

  for (const name of siteNames) {
    const src = path.join(SITES_DIR, name);
    const stat = await fsp.stat(src);
    if (!stat.isDirectory()) continue;

    // home/_root ist special (wird in docs/ root kopiert)
    if (name === "home" || name === "_root") continue;

    const dst = path.join(OUT_DIR, name);
    await copyDir(src, dst, { excludeNames: ["content"] });
  }

  // 3) Markdown-Collections bauen
  for (const c of COLLECTIONS) {
    await buildCollection(c);
  }

  // 4) Home ganz am Ende in Root schreiben (ohne Redirect)
  await buildHomeToRoot();

  console.log('✅ Build komplett: docs/ ist bereit (Vercel Output Directory = "docs")');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
