// Zero-dep page fetcher + lightweight HTML extraction. Used by agents that
// can do real analysis on the registered company URL (SEO audit, schema
// markup audit, ai-seo, copywriting review, site architecture).
//
// Not a full crawler: fetches one URL, returns parsed structured data.
// HTML parsing uses regex (no DOM library) — sufficient for the fields
// we need; refuses oversized responses to avoid resource abuse.

const MAX_BYTES = 800_000; // 800KB cap on a single page
const TIMEOUT_MS = 8_000;
const UA = 'AI-Marketing-Office/1.0 (+https://github.com/hyoeun979704-web/AI_maketing_ofice)';

export async function fetchPage(url) {
  if (!url) throw new Error('url required');
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('invalid URL: ' + url); }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('only http(s) URLs supported');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res;
  try {
    res = await fetch(parsed.toString(), {
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      signal: controller.signal,
      redirect: 'follow',
    });
  } catch (err) {
    clearTimeout(timer);
    throw new Error('fetch failed: ' + (err.message || err));
  }
  clearTimeout(timer);

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${parsed.toString()}`);
  const ct = res.headers.get('content-type') || '';
  if (!/text\/html|application\/xhtml/.test(ct)) {
    return {
      url: parsed.toString(),
      status: res.status,
      contentType: ct,
      html: '',
      summary: { note: '비-HTML 응답이라 분석 생략 (' + ct + ')' },
    };
  }

  // Stream the response with a byte cap
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      try { reader.cancel(); } catch {}
      break;
    }
    chunks.push(value);
  }
  const html = new TextDecoder('utf-8').decode(concat(chunks));
  const summary = extractSummary(html, parsed);
  return { url: parsed.toString(), status: res.status, contentType: ct, bytes: total, html, summary };
}

function concat(chunks) {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const c of chunks) { out.set(c, i); i += c.length; }
  return out;
}

// Pull out the fields a marketing agent typically needs.
function extractSummary(html, parsedUrl) {
  const out = {
    title: pick(html, /<title[^>]*>([^<]*)<\/title>/i),
    metaDescription: meta(html, 'description'),
    metaRobots: meta(html, 'robots'),
    canonical: link(html, 'canonical'),
    ogTitle: ogp(html, 'og:title'),
    ogDescription: ogp(html, 'og:description'),
    ogImage: ogp(html, 'og:image'),
    twitterCard: ogp(html, 'twitter:card'),
    h1: textContent(html, 'h1').slice(0, 5),
    h2: textContent(html, 'h2').slice(0, 10),
    images: [...html.matchAll(/<img[^>]+>/gi)].slice(0, 50).map((m) => parseImg(m[0])),
    internalLinks: 0,
    externalLinks: 0,
    schemaJsonLd: schemaScripts(html),
    htmlLang: pick(html, /<html[^>]*\blang=["']([^"']+)["']/i),
    hasGtm: /googletagmanager\.com\/gtm\.js/i.test(html),
    hasGa4: /gtag\(\s*['"]config['"]\s*,\s*['"]G-/i.test(html),
    hasAmplitude: /cdn\.amplitude\.com/.test(html),
    hasMixpanel: /cdn\.mxpnl\.com/.test(html),
    hasMetaPixel: /connect\.facebook\.net\/[^"']+\/fbevents\.js/.test(html),
    hasGoogleAdsConv: /googleadservices\.com\/pagead\/conversion/.test(html),
    bodyTextSample: bodySample(html),
  };
  // Count images missing alt
  out.imagesMissingAlt = out.images.filter((i) => !i.alt).length;

  // Link counts
  const host = parsedUrl.host;
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    const href = m[1];
    if (/^https?:\/\//i.test(href)) {
      try { (new URL(href).host === host ? 'internal' : 'external'); } catch {}
      try {
        const h = new URL(href).host;
        if (h === host) out.internalLinks++; else out.externalLinks++;
      } catch {}
    } else if (href.startsWith('/') || href.startsWith('#') || href.startsWith('?')) {
      out.internalLinks++;
    }
  }
  return out;
}

function pick(html, re) { const m = html.match(re); return m ? decode(m[1].trim()) : ''; }
function meta(html, name) {
  const m = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'));
  return m ? decode(m[1].trim()) : '';
}
function ogp(html, prop) {
  const m = html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*property=["']${prop}["']`, 'i'));
  return m ? decode(m[1].trim()) : '';
}
function link(html, rel) {
  const m = html.match(new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*href=["']([^"']+)["']`, 'i'));
  return m ? decode(m[1].trim()) : '';
}
function textContent(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const out = [];
  for (const m of html.matchAll(re)) {
    const text = decode(m[1].replace(/<[^>]+>/g, '').trim()).slice(0, 160);
    if (text) out.push(text);
  }
  return out;
}
function schemaScripts(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = m[1].trim().slice(0, 4000);
    try {
      const data = JSON.parse(raw);
      const types = [];
      const visit = (n) => {
        if (!n) return;
        if (Array.isArray(n)) n.forEach(visit);
        else if (typeof n === 'object') {
          if (n['@type']) types.push(Array.isArray(n['@type']) ? n['@type'].join(',') : n['@type']);
          Object.values(n).forEach(visit);
        }
      };
      visit(data);
      out.push({ types: [...new Set(types)] });
    } catch {
      out.push({ types: ['<invalid JSON>'] });
    }
  }
  return out;
}
function parseImg(tag) {
  const src = tag.match(/src=["']([^"']+)["']/i);
  const alt = tag.match(/alt=["']([^"']*)["']/i);
  const w = tag.match(/width=["']?(\d+)/i);
  const h = tag.match(/height=["']?(\d+)/i);
  return {
    src: src ? src[1] : '',
    alt: alt ? alt[1] : '',
    width: w ? Number(w[1]) : null,
    height: h ? Number(h[1]) : null,
  };
}
function bodySample(html) {
  // Strip scripts and styles, then take a chunk of visible text
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return decode(cleaned).slice(0, 1200);
}
function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
