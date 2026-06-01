/* gallery.js — loads sketches.csv and drives the student gallery */

const CSV_PATH = 'data/Intro262PreWorks.csv';

let sketches = [];
let activeIndex = -1;

/* ── CSV LOADING ── */

async function loadCSV() {
  try {
    const res = await fetch(CSV_PATH);
    if (!res.ok) throw new Error(`Could not fetch ${CSV_PATH} (${res.status})`);
    const text = await res.text();
    sketches = parseCSV(text);
    if (!sketches.length) throw new Error('No valid p5.js links found in the CSV.');
    init();
  } catch (err) {
    console.error('[Gallery]', err.message);
    showFatalError(err.message);
  }
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results = [];
  let labelCounter = 1;

  lines.forEach((line, i) => {
    /* skip header row if it contains column names */
    if (i === 0 && /^(url|link|sketch|name|label)/i.test(line.split(',')[0])) return;

    const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    const url  = cols.find(c => c.includes('p5js') || c.includes('openprocessing') || c.startsWith('http'));
    if (!url) return;

    const rawLabel = cols.find(c => c && c !== url) || null;
    const label    = rawLabel || `Sketch ${String(labelCounter).padStart(2, '0')}`;
    labelCounter++;

    results.push({ label, embedUrl: toEmbedUrl(url) });
  });

  return results;
}

/* ── URL CONVERSION ── */

function toEmbedUrl(raw) {
  raw = raw.trim();
  if (!raw.startsWith('http')) raw = 'https://' + raw;

  try {
    const url   = new URL(raw);
    const parts = url.pathname.split('/').filter(Boolean);

    if (url.hostname.includes('p5js.org')) {
      /* editor.p5js.org/username/sketches/ID  →  /username/full/ID */
      if (parts.length >= 3) {
        parts[1] = 'full';
        return `https://editor.p5js.org/${parts.join('/')}`;
      }
      /* editor.p5js.org/full/ID  — already embedded */
      if (parts.length === 2 && parts[0] === 'full') return raw;
    }

    /* openprocessing.org/sketch/ID  →  embed URL */
    if (url.hostname.includes('openprocessing.org') && parts[0] === 'sketch') {
      return `https://openprocessing.org/sketch/${parts[1]}/embed/`;
    }

  } catch (_) { /* fall through */ }

  return raw;
}

/* ── INITIALISE UI ── */

function init() {
  updateBadge();
  renderList();
}

function updateBadge() {
  const badge = document.getElementById('count-badge');
  if (badge) badge.textContent = `${sketches.length} sketch${sketches.length !== 1 ? 'es' : ''}`;
}

/* ── PANEL LIST ── */

function renderList() {
  const list = document.getElementById('panel-list');
  list.innerHTML = '';

  sketches.forEach((s, i) => {
    const item = document.createElement('div');
    item.className = 'sketch-item' + (i === activeIndex ? ' active' : '');
    item.dataset.index = i;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `View ${s.label}`);

    item.innerHTML = `
      <div class="sketch-thumb" aria-hidden="true">
        <iframe src="${s.embedUrl}"
                title="thumbnail"
                scrolling="no"
                tabindex="-1"
                sandbox="allow-scripts allow-same-origin">
        </iframe>
        <div class="sketch-thumb-overlay"></div>
      </div>
      <div class="sketch-info">
        <div class="sketch-label">${escHtml(s.label)}</div>
        <div class="sketch-sublabel">p5.js sketch</div>
      </div>
      <div class="play-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20"><polygon points="5,3 19,10 5,17"/></svg>
      </div>
    `;

    item.addEventListener('click',  () => selectSketch(i));
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectSketch(i); });

    list.appendChild(item);
  });
}

/* ── SELECT & DISPLAY SKETCH ── */

function selectSketch(index) {
  if (index < 0 || index >= sketches.length) return;
  activeIndex = index;
  const s = sketches[index];

  /* update list highlights */
  document.querySelectorAll('.sketch-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  /* scroll selected item into view */
  const activeEl = document.querySelectorAll('.sketch-item')[index];
  if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  /* show stage */
  document.getElementById('stage-empty').style.display = 'none';
  const content = document.getElementById('stage-content');
  content.classList.add('visible');

  document.getElementById('stage-title').textContent   = s.label;
  document.getElementById('stage-counter').textContent = `${index + 1} / ${sketches.length}`;

  /* nav buttons */
  document.getElementById('prev-btn').disabled = index === 0;
  document.getElementById('next-btn').disabled = index === sketches.length - 1;

  /* set iframe src via JS — keeps URL out of static markup (link obscuring) */
  const iframe = document.getElementById('stage-iframe');
  const bar    = document.getElementById('loading-bar');

  iframe.src = '';
  bar.classList.add('active');

  iframe.onload = () => bar.classList.remove('active');

  /* small rAF delay ensures blank frame renders before new src loads */
  requestAnimationFrame(() => {
    iframe.src = s.embedUrl;
  });
}

/* ── NAVIGATION ── */

function navigate(dir) {
  const next = activeIndex + dir;
  if (next >= 0 && next < sketches.length) selectSketch(next);
}

/* keyboard arrow support */
document.addEventListener('keydown', e => {
  if (!sketches.length) return;
  /* don't hijack keys when focus is inside the stage iframe */
  if (document.activeElement && document.activeElement.id === 'stage-iframe') return;

  if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  { e.preventDefault(); navigate(-1); }
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); navigate(1);  }
});

/* ── ERROR STATE ── */

function showFatalError(msg) {
  const list = document.getElementById('panel-list');
  list.innerHTML = `
    <div style="padding:24px 16px; font-family:'DM Mono',monospace; font-size:11px;
                color:rgba(232,242,251,0.35); line-height:1.8; letter-spacing:0.04em;">
      Could not load sketches.<br><br>${escHtml(msg)}<br><br>
      Check that <code>data/sketches.csv</code> exists<br>
      and the page is served from a local<br>
      or remote web server.
    </div>
  `;
}

/* ── HELPERS ── */

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── BOOT ── */
document.addEventListener('DOMContentLoaded', loadCSV);
