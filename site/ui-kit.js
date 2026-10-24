/* ============================================================
   AI Factory — 共享 UI 组件层（ui-kit）
   空态 / 报错 / 加载态 的唯一正确渲染实现；被 app.js 与后续页面复用。
   纯字符串构造函数可单测；render* 为薄 DOM 副作用（null-safe）。
   ============================================================ */

// HTML 转义：真实数据经 innerHTML 注入前统一过滤，防 XSS。
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const TONE_COLOR = { err: 'var(--err)', ok: 'var(--ok)', muted: 'var(--text-3)' };

function emptyStateHTML({ icon = 'inbox', text = '暂无数据', tone = '', pad = '', spin = false, cls = '', iconSize = '' } = {}) {
  const color = TONE_COLOR[tone];
  const iconCls = spin ? 'mat spinning' : 'mat';
  const iconDecl = [color ? `color:${color}` : '', iconSize ? `font-size:${iconSize}` : ''].filter(Boolean).join(';');
  const iconStyle = iconDecl ? ` style="${iconDecl}"` : '';
  const wrapStyle = pad ? ` style="padding:${pad}"` : '';
  const textStyle = tone === 'muted' ? ' style="color:var(--text-3)"' : '';
  const wrapCls = cls ? ` ${cls}` : '';
  return `<div class="empty-state${wrapCls}"${wrapStyle}><span class="${iconCls}"${iconStyle}>${icon}</span><div${textStyle}>${esc(text)}</div></div>`;
}

function errorStateHTML(message) {
  return emptyStateHTML({ icon: 'error', text: message, tone: 'err' });
}

function loadingHTML(text = '加载中…') {
  return emptyStateHTML({ icon: 'progress_activity', text, tone: 'muted', spin: true });
}

function renderEmptyState(el, opts = {}) {
  if (el) el.innerHTML = emptyStateHTML(opts);
}
function renderErrorState(el, message) {
  if (el) el.innerHTML = errorStateHTML(message);
}
function renderLoading(el, text) {
  if (el) el.innerHTML = loadingHTML(text);
}

// 加载态状态机：统一「加载中 / 失败不重试」语义，供各视图数据拉取复用。
// begin() 已在 loading/failed 时返回 false，避免重复发起；reset() 允许重试。
function createLoadState() {
  return {
    loading: false,
    failed: false,
    begin() { if (this.loading || this.failed) return false; this.loading = true; return true; },
    succeed() { this.loading = false; },
    fail() { this.failed = true; this.loading = false; },
    reset() { this.loading = false; this.failed = false; },
  };
}

// 分区加载态状态机：全局单发（一次只拉一个）+ 按 key 记失败（失败该 key 不再重试）。
// 契合 compute(per-biz)/fault-real(per-cacheKey)：loading 全局互斥，failed 分区隔离。
function createKeyedLoadState() {
  const failed = Object.create(null);
  return {
    loading: false,
    begin(key) { if (this.loading || failed[key]) return false; this.loading = true; return true; },
    settle() { this.loading = false; },              // 无论成功/失败，加载动作结束
    markFailed(key) { failed[key] = true; },
    isFailed(key) { return !!failed[key]; },
    clearFailed(key) { delete failed[key]; },
  };
}

// 图表调色板默认值（= design-system.css :root 当前值）。运行时优先取 :root，取不到才回退。
const CHART_DEFAULTS = {
  primary:'#1E4FD8', primary2:'#2E63F0', deep:'#0A2A6B',
  siteBrand:'#1E4FD8', siteBrand2:'#2E63F0',
  ok:'#16A26A', warn:'#D89A18', err:'#D14343',
  violet:'#6B4CE6', cyan:'#0EA5B7',
  t1:'#0F1B2D', t2:'#4A5875', t3:'#8894AB',
  bg:'#F5F7FA', panel:'#FFFFFF', mask:'rgba(255,255,255,.6)', grid:'#EEF1F6', border:'#E6EAF0',
};
const CHART_VAR_MAP = {
  primary:'--primary', primary2:'--primary-2', deep:'--deep',
  siteBrand:'--site-brand', siteBrand2:'--site-brand-2',
  ok:'--ok', warn:'--warn', err:'--err',
  violet:'--violet', cyan:'--cyan',
  t1:'--text-1', t2:'--text-2', t3:'--text-3',
  bg:'--bg', panel:'--panel', mask:'--chart-mask', grid:'--border-2', border:'--border',
};

// ECharts canvas 无法解析 CSS var(--x)，故运行时读取 :root 变量构建具体色值表。
// 任一变量读到空串时回退到内置默认值，保证图表永不失色。
function buildChartPalette(readVar) {
  const read = typeof readVar === 'function'
    ? readVar
    : (name) => (typeof getComputedStyle === 'function'
        ? getComputedStyle(document.documentElement).getPropertyValue(name)
        : '');
  const out = {};
  for (const key of Object.keys(CHART_DEFAULTS)) {
    const v = (read(CHART_VAR_MAP[key]) || '').trim();
    out[key] = v || CHART_DEFAULTS[key];
  }
  return out;
}

function remapChartThemeOption(option, previousPalette, nextPalette) {
  const colorMap = new Map();
  for (const key of Object.keys(previousPalette)) {
    const previous = String(previousPalette[key] || '').toLowerCase();
    const next = nextPalette[key];
    if (previous && next) colorMap.set(previous, next);
  }

  function remap(value, seen) {
    if (typeof value === 'string') {
      const normalized = value.toLowerCase();
      if (colorMap.has(normalized)) return colorMap.get(normalized);
      if (/^#[0-9a-f]{8}$/i.test(value)) {
        const base = normalized.slice(0, 7);
        if (colorMap.has(base)) return `${colorMap.get(base)}${value.slice(7)}`;
      }
      return value;
    }
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const copy = Array.isArray(value) ? [] : {};
    seen.set(value, copy);
    for (const [key, child] of Object.entries(value)) copy[key] = remap(child, seen);
    return copy;
  }

  return remap(option, new WeakMap());
}
