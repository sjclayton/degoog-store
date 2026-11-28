let maxCommunities = 5;
let template = '';
let fallbackIcon = '';

const _esc = value => {
  if (typeof value !== 'string') return '';
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

const _formatCount = value => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
};

const _render = data => template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '');

export const slot = {
  isClientExposed: false,
  id: 'reddit-community-slot',
  name: 'Reddit Communities',
  position: 'above-results',
  waitForResults: true,
  description:
    "Shows the top Reddit communities by member count from Reddit engine results. Requires sjclayton's Reddit engine to be installed.",

  settingsSchema: [
    {
      key: 'maxCommunities',
      label: 'Top communities count',
      type: 'text',
      default: '5',
      placeholder: '5',
      description: 'Maximum number of community cards to display (1–10).',
    },
  ],

  init(ctx) {
    template = ctx.template;
    fallbackIcon = `/plugins/${ctx.pluginId}/snoo.png`;
  },

  configure(settings) {
    const n = parseInt(settings?.maxCommunities ?? '5', 10);
    maxCommunities = Number.isFinite(n) ? Math.max(1, Math.min(10, n)) : 5;
  },

  trigger() {
    return true;
  },

  async execute(_query, context) {
    const results = Array.isArray(context?.results) ? context.results : [];
    const seen = new Set();
    const communities = [];

    for (const result of results) {
      if (!result?.community || !Number.isFinite(result.memberCount)) continue;
      const subreddit = String(result.community.subreddit || '').toLowerCase();
      if (!subreddit || seen.has(subreddit)) continue;
      seen.add(subreddit);
      communities.push(result);
    }

    if (communities.length === 0) return { title: '', html: '' };
    communities.sort((a, b) => b.memberCount - a.memberCount);

    const cards = communities.slice(0, maxCommunities).map(result => {
      const community = result.community;
      const subreddit = _esc(String(community.subreddit || 'r/unknown'));
      const href = _esc(String(result.url || ''));
      const age = _esc(String(community.age || ''));
      const count = `${_formatCount(result.memberCount)} members`;
      const exact = _esc(`${Number(result.memberCount).toLocaleString('en-US')} members`);
      const description = _esc(String(community.description || ''));
      const iconUrl =
        community.icon && context?.signProxyUrl
          ? _esc(context.signProxyUrl(String(community.icon)))
          : _esc(fallbackIcon);
      const meta = [age, count].filter(Boolean).join(' · ');

      return (
        `<a href="${href}" class="rd-slot-card">` +
        `<div class="rd-slot-head">` +
        `<span class="rd-slot-icon"><img src="${iconUrl}" alt="" class="rd-slot-icon-img" loading="lazy"></span>` +
        `<span class="rd-slot-name">${subreddit}</span>` +
        `</div>` +
        (meta ? `<div class="rd-slot-meta" title="${exact}">${meta}</div>` : '') +
        (description ? `<p class="rd-slot-desc">${description}</p>` : '') +
        `</a>`
      );
    });

    const content =
      `<div class="rd-slot-wrap">` +
      `<h4 class="rd-slot-heading">Top communities by members</h4>` +
      `<div class="rd-slot-grid">${cards.join('')}</div>` +
      `</div>`;
    return { title: 'Reddit Communities', html: _render({ content }) };
  },
};

export default { slot };
