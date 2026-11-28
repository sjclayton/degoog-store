const SLOT_ID_SUFFIX = 'reddit-community-slot';
const ESCAPE_RE = /[&<>"']/g;
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escapeHtml = value => String(value ?? '').replace(ESCAPE_RE, ch => ESCAPES[ch]);

const bangQuery = () => {
  const fromUrl = new URLSearchParams(location.search).get('q') || '';
  const fromInput = document.getElementById('results-search-input')?.value || '';
  const value = fromUrl.trim() || fromInput.trim();
  const leading = value.match(/^!r\s+(.+)$/i);
  if (leading) return leading[1].trim();
  const trailing = value.match(/^(.+?)\s+!r$/i);
  return trailing ? trailing[1].trim() : '';
};

const renderPanel = panel => {
  const host = document.getElementById('slot-above-results');
  if (!host) return;
  if (host.querySelector(`[data-slot="${panel.id}"]`)) return;
  const title = panel.title
    ? `<div class="results-slot-panel-title degoog-panel--slot-title">${escapeHtml(panel.title)}</div>`
    : '';
  const wrap = document.createElement('div');
  wrap.className = 'results-slot-panel degoog-panel degoog-panel--slot degoog-panel--stack-item';
  wrap.setAttribute('data-slot', panel.id);
  wrap.innerHTML =
    title +
    `<div class="results-slot-panel-body degoog-panel--slot-body degoog-panel--slot-body-padded">${panel.html}</div>`;
  host.appendChild(wrap);
};

const bridge = async query => {
  if (document.querySelectorAll('.rd-slot-card').length > 0) return;
  const cmdUrl = `/api/command?q=${encodeURIComponent('!r ' + query)}&type=web&page=1`;
  const cmdRes = await fetch(cmdUrl, { headers: { Accept: 'application/json' } });
  if (!cmdRes.ok) return;
  const cmdData = await cmdRes.json();
  const results = Array.isArray(cmdData.results) ? cmdData.results : [];
  if (results.length === 0) return;
  const slotRes = await fetch('/api/slots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: '!r ' + query, results, type: 'web' }),
  });
  if (!slotRes.ok) return;
  const slotData = await slotRes.json();
  const panels = Array.isArray(slotData.panels) ? slotData.panels : [];
  const panel = panels.find(p => String(p.id || '').endsWith(SLOT_ID_SUFFIX));
  if (panel?.html?.trim()) renderPanel(panel);
};

let lastQuery = '';
let busy = false;

const tick = () => {
  if (busy) return;
  const query = bangQuery();
  if (!query) {
    lastQuery = '';
    return;
  }
  if (query === lastQuery) return;
  const list = document.getElementById('results-list');
  if (!list || list.children.length === 0) return;
  lastQuery = query;
  busy = true;
  setTimeout(() => {
    bridge(query).catch(() => {}).finally(() => {
      busy = false;
    });
  }, 600);
};

setInterval(tick, 700);
