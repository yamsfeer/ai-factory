
const DATA_BADGE_CLASS = {
  '真实数据': 'chip-ok',
  '混合数据': 'chip-info',
  '示例数据': 'chip-neutral',
  '待接入': 'chip-neutral',
  '说明': 'chip-neutral',
};

const FEATURE_BADGE_CLASS = {
  '部分实现': 'chip-warn',
  '待实现': 'chip-neutral',
};

const TONE_KPI_CLASS = {
  ok: 'kpi-status-ok',
  warn: 'kpi-status-warn',
  bad: 'kpi-status-err',
  err: 'kpi-status-err',
  info: 'kpi-status-info',
  violet: 'kpi-status-violet',
  cyan: 'kpi-status-cyan',
  neutral: 'kpi-status-neutral',
};

function computeDataBadge(status = '说明', attrs = {}) {
  const label = status || '说明';
  const cls = DATA_BADGE_CLASS[label] || 'chip-neutral';
  const extra = Object.entries(attrs)
    .map(([key, value]) => ` ${esc(key)}="${esc(value)}"`)
    .join('');
  return `<span class="csys-data-badge ${cls}" data-status="${esc(label)}"${extra}>${esc(label)}</span>`;
}

function computeFeatureBadge(status) {
  if (!status || status === '已实现') return '';
  const cls = FEATURE_BADGE_CLASS[status] || 'chip-neutral';
  return `<span class="csys-data-badge ${cls}" data-feature-status="${esc(status)}">${esc(status)}</span>`;
}

function computePageShell({
  view = '',
  group = '计算场景',
  title = '',
  description = '',
  guidance = null,
  insight = null,
  featureStatus = '',
  showFeatureStatus = false,
  dataStatus = '',
  showDataStatus = false,
  tools = '',
  filter = '',
  body = '',
} = {}) {
  const badges = [
    showFeatureStatus ? computeFeatureBadge(featureStatus) : '',
    showDataStatus && dataStatus ? computeDataBadge(dataStatus) : '',
  ].filter(Boolean).join('');
  const helpId = `csys-page-help-${String(view || title || 'page').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'page'}`;
  const guidanceHTML = guidance ? computePageHelpDrawer({
    id: helpId,
    title,
    guidance,
  }) : '';
  const helpButton = guidance
    ? `<button type="button" class="btn btn-ghost btn-sm csys-page-help-btn" data-csys-page-help-open aria-controls="${esc(helpId)}" aria-expanded="false" aria-label="页面说明"><span class="csys-page-help-question" aria-hidden="true">?</span><span class="csys-page-help-label">页面说明</span></button>`
    : '';
  return `<div class="csys-shell" data-csys-page-help-root>
    <div class="crumb mb-1"><span>AI Factory</span><span class="mat">chevron_right</span><span>计算场景</span><span class="mat">chevron_right</span><span>${esc(group)}</span><span class="mat">chevron_right</span><b style="color:var(--text-2)">${esc(title)}</b></div>
    <div class="csys-shell-head">
      <div class="csys-shell-title">
        <h1>${esc(title)}</h1>
        ${description ? `<div class="csys-shell-desc">${esc(description)}</div>` : ''}
      </div>
      <div class="csys-meta">${badges}${tools || ''}${helpButton}</div>
    </div>
    <div class="csys-page-help-content" data-csys-page-help-content>
      ${filter ? `<div class="csys-filter-slot" data-csys-sticky-scope>${filter}</div>` : ''}
      ${insight ? computeInsightStrip(insight) : ''}
      ${body || ''}
    </div>
    ${guidanceHTML}
  </div>`;
}

function computeSection({ title = '', icon = 'article', meta = '', badge = '', body = '', cls = '' } = {}) {
  return `<section class="csys-section${cls ? ` ${esc(cls)}` : ''}">
    <div class="csys-section-head">
      <div class="csys-section-title"><span class="mat mat-sm">${esc(icon)}</span>${esc(title)}</div>
      <div class="csys-meta">${badge || ''}${meta || ''}</div>
    </div>
    <div class="csys-section-body">${body || ''}</div>
  </section>`;
}

function toneClass(tone) {
  return TONE_KPI_CLASS[tone] || TONE_KPI_CLASS.info;
}

function computeKpiStrip(kpis = []) {
  return `<div class="csys-kpi-strip">${kpis.map((kpi) => computeKpiCard(kpi)).join('')}</div>`;
}

function computeKpiCard(kpi = {}) {
  const badgeTone = kpi.tone === 'bad' || kpi.tone === 'err'
    ? 'chip-err'
    : kpi.tone === 'warn'
      ? 'chip-warn'
      : kpi.tone === 'ok'
        ? 'chip-ok'
        : 'chip-info';
  return `<div class="csys-kpi ${toneClass(kpi.tone)}">
    <div class="csys-kpi-label">${kpi.icon ? `<span class="mat mat-sm">${esc(kpi.icon)}</span>` : ''}<span>${esc(kpi.label || '')}</span>${kpi.badge ? `<span class="chip ${badgeTone}">${esc(kpi.badge)}</span>` : ''}</div>
    <div class="csys-kpi-value">${esc(kpi.value ?? '—')}${kpi.unit ? `<small>${esc(kpi.unit)}</small>` : ''}</div>
    ${kpi.detail ? `<div class="csys-kpi-detail">${esc(kpi.detail)}</div>` : ''}
  </div>`;
}

function computeInsightStrip(insight) {
  if (!insight?.message) return '';
  const severity = ['critical', 'warning', 'pending'].includes(insight.severity)
    ? insight.severity
    : 'warning';
  const role = severity === 'critical' ? 'alert' : 'status';
  const live = severity === 'critical' ? 'assertive' : 'polite';
  const icon = severity === 'critical' ? 'error' : severity === 'pending' ? 'schedule' : 'warning';
  const action = insight.action?.label
    ? `<button type="button" class="btn btn-ghost btn-sm" data-csys-insight-action="${esc(insight.action.key || '')}">${esc(insight.action.label)}</button>`
    : '';
  return `<section class="csys-insight csys-insight-${severity}" role="${role}" aria-live="${live}" data-csys-insight>
    <span class="mat mat-sm" aria-hidden="true">${icon}</span>
    <strong>${esc(insight.message)}</strong>
    ${action}
  </section>`;
}

function computePageHelpDrawer({ id = '', title = '', guidance = {} } = {}) {
  const readingPath = Array.isArray(guidance.readingPath) ? guidance.readingPath : [];
  return `<div class="csys-page-help-backdrop" data-csys-page-help-close aria-hidden="true"></div>
    <aside class="csys-page-help-drawer" id="${esc(id)}" role="dialog" aria-modal="true" aria-hidden="true" aria-label="${esc(`${title || '页面'}说明`)}" tabindex="-1">
      <div class="csys-page-help-head">
        <div><b>${esc(title || '页面')} · 页面说明</b><small>了解页面用途、阅读路径和数据边界</small></div>
        <button type="button" class="btn btn-ghost btn-sm" data-csys-page-help-close aria-label="关闭页面说明"><span class="mat mat-sm" aria-hidden="true">close</span></button>
      </div>
      <div class="csys-page-help-body">
        ${guidance.purpose ? `<section><h2>页面用途</h2><p>${esc(guidance.purpose)}</p></section>` : ''}
        ${guidance.focus ? `<section><h2>分析重点</h2><p>${esc(guidance.focus)}</p></section>` : ''}
        ${readingPath.length ? `<section><h2>阅读与下钻路径</h2><ol class="csys-page-help-list">${readingPath.map((item) => `<li>${esc(item)}</li>`).join('')}</ol></section>` : ''}
        ${guidance.dataBoundary ? `<section><h2>数据口径与边界</h2><p>${esc(guidance.dataBoundary)}</p></section>` : ''}
      </div>
    </aside>`;
}

let pageHelpTrigger = null;
let pageHelpEventsBound = false;

function pageHelpFocusable(drawer) {
  return [...drawer.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
}

function setPageHelpOpen(root, open) {
  if (!root) return;
  const drawer = root.querySelector('.csys-page-help-drawer');
  const backdrop = root.querySelector('.csys-page-help-backdrop');
  const content = root.querySelector('[data-csys-page-help-content]');
  const trigger = root.querySelector('[data-csys-page-help-open]');
  if (!drawer || !backdrop || !content || !trigger) return;
  drawer.classList.toggle('open', open);
  backdrop.classList.toggle('open', open);
  drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
  trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    content.setAttribute('inert', '');
    pageHelpTrigger = trigger;
    const first = pageHelpFocusable(drawer)[0] || drawer;
    const focusDrawer = () => {
      if (drawer.classList.contains('open')) first.focus({ preventScroll: true });
    };
    const transitionDuration = Number.parseFloat(getComputedStyle(drawer).transitionDuration) || 0;
    if (transitionDuration > 0) drawer.addEventListener('transitionend', focusDrawer, { once: true });
    else requestAnimationFrame(focusDrawer);
  } else {
    content.removeAttribute('inert');
  }
}

function openPageHelp(trigger) {
  setPageHelpOpen(trigger?.closest?.('[data-csys-page-help-root]'), true);
}

function closeComputePageHelp({ restoreFocus = false } = {}) {
  if (typeof document === 'undefined') return;
  const activeRoot = document.querySelector('.csys-page-help-drawer.open')?.closest('[data-csys-page-help-root]');
  if (!activeRoot) return;
  const restoreTarget = pageHelpTrigger;
  setPageHelpOpen(activeRoot, false);
  pageHelpTrigger = null;
  if (restoreFocus && restoreTarget?.isConnected) {
    requestAnimationFrame(() => restoreTarget.focus({ preventScroll: true }));
  }
}

function trapPageHelpFocus(event) {
  if (event.key !== 'Tab') return;
  const drawer = event.target.closest?.('.csys-page-help-drawer.open');
  if (!drawer) return;
  const focusable = pageHelpFocusable(drawer);
  if (!focusable.length) {
    event.preventDefault();
    drawer.focus({ preventScroll: true });
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && event.target === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && event.target === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

function ensurePageHelpEvents() {
  if (pageHelpEventsBound || typeof document === 'undefined') return;
  pageHelpEventsBound = true;
  document.addEventListener('click', (event) => {
    const open = event.target.closest?.('[data-csys-page-help-open]');
    if (open) {
      openPageHelp(open);
      return;
    }
    const close = event.target.closest?.('[data-csys-page-help-close]');
    if (close) closeComputePageHelp({ restoreFocus: true });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.querySelector('.csys-page-help-drawer.open')) {
      event.preventDefault();
      closeComputePageHelp({ restoreFocus: true });
      return;
    }
    trapPageHelpFocus(event);
  });
  window.addEventListener('hashchange', () => closeComputePageHelp({ restoreFocus: false }));
}

ensurePageHelpEvents();

function computeTabBar({
  items = [],
  active = '',
  label = '页面功能',
  tools = '',
} = {}) {
  const tabs = (items || []).map((item) => {
    const selected = item.key === active;
    const dataAttrs = Object.entries(item.data || {})
      .filter(([key]) => /^[a-z0-9-]+$/i.test(key))
      .map(([key, value]) => ` data-${key}="${esc(value)}"`)
      .join('');
    return `<button type="button" class="csys-tab${selected ? ' active' : ''}" role="tab" aria-selected="${selected ? 'true' : 'false'}" tabindex="${selected ? '0' : '-1'}"${dataAttrs}>${item.icon ? `<span class="mat mat-sm">${esc(item.icon)}</span>` : ''}${esc(item.label || item.key || '')}</button>`;
  }).join('');
  return `<div class="csys-tab-row">
    <div class="csys-tabs" role="tablist" aria-label="${esc(label)}">${tabs}</div>
    ${tools ? `<div class="csys-tab-tools">${tools}</div>` : ''}
  </div>`;
}

let sharedTabKeyboardBound = false;

function focusCurrentSharedTab(tablistLabel) {
  const activeView = document.querySelector('.view.active');
  const tablist = (activeView || document).querySelector(
    `.csys-tabs[aria-label="${CSS.escape(tablistLabel || '')}"]`,
  );
  const active = tablist?.querySelector('.csys-tab.active');
  active?.focus({ preventScroll: true });
}

function ensureSharedTabKeyboardEvents() {
  if (sharedTabKeyboardBound || typeof document === 'undefined') return;
  sharedTabKeyboardBound = true;
  document.addEventListener('keydown', (event) => {
    const tab = event.target.closest?.('.csys-tabs .csys-tab');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tablist = tab.closest('.csys-tabs');
    const tablistLabel=tablist.getAttribute('aria-label');
    const tabs = [...tablist.querySelectorAll('.csys-tab')];
    const current = tabs.indexOf(tab);
    let next = current;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
    if (!tabs[next]) return;
    event.preventDefault();
    tabs[next].click();
    requestAnimationFrame(() => focusCurrentSharedTab(tablistLabel));
  });
}

ensureSharedTabKeyboardEvents();

function optionPairs(options) {
  return (options || []).map((option) => Array.isArray(option) ? option : [option.value, option.label]);
}

function computeMultiSelect({
  key = '',
  instance = '',
  label = '',
  options = [],
  value = null,
  open = false,
  searchable = true,
  searchThreshold = 6,
  searchValue = '',
  unavailable = [],
  loading = false,
  error = '',
  protocol = 'csys',
} = {}) {
  const pairs = optionPairs(options);
  const normalizedSearch = String(searchValue || '').trim().toLowerCase();
  const selected = Array.isArray(value) ? value : [];
  const isAll = value === null || value === undefined;
  const isEmpty = Array.isArray(value) && value.length === 0;
  const instanceKey = String(instance || '').replace(/[^A-Za-z0-9_-]/g, '-');
  const keyPart = String(key).replace(/[^A-Za-z0-9_-]/g, '-');
  const idKey = [instanceKey, keyPart].filter(Boolean).join('-');
  const labelId = `csys-multi-label-${idKey}`;
  const panelId = `csys-multi-panel-${idKey}`;
  const groupId = `csys-multi-group-${idKey}`;
  const selectedLabels = selected.map((item) => {
    const hit = pairs.find(([v]) => v === item);
    return hit ? hit[1] : item;
  });
  const summary = isAll ? '全部' : isEmpty ? '无匹配' : (selected.length <= 1 ? selectedLabels.join(', ') : `${selected.length} 项`);
  const toggleLabel = [label, summary].filter(Boolean).join('：');
  const checks = pairs.map(([v, text]) => {
    const checked = isAll || selected.includes(v);
    const hidden = Boolean(normalizedSearch) && !String(text).toLowerCase().includes(normalizedSearch);
    const inputAttrs = protocol === 'cs'
      ? `data-cs-act="multi-check" data-cs-key="${esc(key)}" data-cs-val="${esc(v)}"`
      : `data-csys-multi-check="${esc(key)}" value="${esc(v)}"`;
    const labelAttr = protocol === 'cs'
      ? `data-cs-multi-label="${esc(String(text).toLowerCase())}"`
      : `data-csys-multi-label="${esc(String(text).toLowerCase())}"`;
    return `<label class="csys-multi-item cs-multi-item" ${labelAttr}${hidden ? ' hidden' : ''}><input type="checkbox" ${inputAttrs}${checked ? ' checked' : ''}><span>${esc(text)}</span></label>`;
  }).join('');
  const visibleOptionCount = pairs.filter(([, text]) => (
    !normalizedSearch || String(text).toLowerCase().includes(normalizedSearch)
  )).length;
  const toggleAttrs = protocol === 'cs'
    ? `data-cs-act="multi-toggle" data-cs-key="${esc(key)}"`
    : `data-csys-multi-toggle="${esc(key)}"`;
  const allAttrs = protocol === 'cs'
    ? `data-cs-act="multi-all-toggle" data-cs-key="${esc(key)}"`
    : `data-csys-multi-all="${esc(key)}"`;
  const clearAttrs = protocol === 'cs'
    ? `data-cs-act="multi-none" data-cs-key="${esc(key)}"`
    : `data-csys-multi-clear="${esc(key)}"`;
  const searchAttr = protocol === 'cs'
    ? 'data-cs-multi-search'
    : `data-csys-multi-search="${esc(key)}"`;
  const emptyAttr = protocol === 'cs'
    ? 'data-cs-multi-empty'
    : `data-csys-multi-empty="${esc(key)}"`;
  const unavailableItems = (Array.isArray(unavailable) ? unavailable : []).filter(Boolean);
  const stateBody = error
    ? errorStateHTML(error)
    : loading
      ? loadingHTML('正在加载候选')
      : pairs.length === 0
        ? `<div class="csys-multi-empty" ${emptyAttr}>${emptyStateHTML({ icon: 'filter_alt_off', text: '当前范围无候选', tone: 'muted', pad: '12px 8px' })}</div>`
        : `
          <div class="csys-multi-actions"><button type="button" ${allAttrs}>全选</button><button type="button" ${clearAttrs}>清空</button></div>
          ${searchable && pairs.length > searchThreshold ? `<label class="fault-stage-filter-search"><span class="mat">search</span><input ${searchAttr} value="${esc(searchValue)}" placeholder="快速筛选"></label>` : ''}
          ${unavailableItems.length ? `<div class="csys-multi-unavailable">当前范围无候选：${esc(unavailableItems.join('、'))}</div>` : ''}
          <div class="csys-multi-list cs-multi-list" id="${groupId}" role="group" aria-labelledby="${labelId}">${checks}</div>
          <div class="csys-multi-empty" ${emptyAttr}${visibleOptionCount ? ' hidden' : ''}>${emptyStateHTML({ icon: 'search_off', text: '当前搜索无候选', tone: 'muted', pad: '12px 8px' })}</div>
        `;
  return `<span class="csys-multi cs-multi" data-csys-multi-key="${esc(key)}" data-csys-multi-instance="${esc(instance)}">
    <span class="flab" id="${labelId}">${esc(label)}</span>
    <span class="csys-multi-wrap cs-multi-wrap${isAll ? '' : ' csys-multi-on'}">
      <button type="button" class="csys-multi-btn cs-multi-btn" ${toggleAttrs} aria-label="${esc(toggleLabel)}" aria-haspopup="dialog" aria-expanded="${open ? 'true' : 'false'}" aria-controls="${panelId}">${esc(summary)}<span class="mat mat-sm" aria-hidden="true">expand_more</span></button>
      <div class="csys-multi-panel cs-multi-panel" id="${panelId}" role="dialog" aria-labelledby="${labelId}"${open ? ' style="display:block"' : ' style="display:none"'}>
        ${stateBody}
      </div>
    </span>
  </span>`;
}

function selectItem(item) {
  const pairs = optionPairs(item.options);
  return `<span class="selwrap"><span class="flab">${esc(item.label || '')}</span><select class="filt" data-csys-select="${esc(item.key || '')}">
    ${pairs.map(([value, label]) => `<option value="${esc(value)}"${item.value === value ? ' selected' : ''}>${esc(label)}</option>`).join('')}
  </select></span>`;
}

function searchItem(item) {
  return `<label class="fault-stage-filter-search"><span class="mat">search</span><input data-csys-search="${esc(item.key || '')}" value="${esc(item.value || '')}" placeholder="${esc(item.placeholder || item.label || '搜索')}"></label>`;
}

function buttonItem(item) {
  return `<button type="button" class="btn btn-ghost btn-sm" data-csys-action="${esc(item.action || '')}">${item.icon ? `<span class="mat mat-sm">${esc(item.icon)}</span>` : ''}${esc(item.label || '')}</button>`;
}

function computeFilterBar({ items = [], tone = '' } = {}) {
  const body = items.map((item) => {
    if (item.type === 'select') return selectItem(item);
    if (item.type === 'multi') return computeMultiSelect(item);
    if (item.type === 'search') return searchItem(item);
    if (item.type === 'button') return buttonItem(item);
    if (item.type === 'custom') return item.html || '';
    return '';
  }).join('');
  const cls = ['filterbar', tone ? esc(tone) : ''].filter(Boolean).join(' ');
  return `<div class="${cls}">${body}</div>`;
}

function computeStatePanel({ type = 'empty', title = '', icon = '' } = {}) {
  if (type === 'loading') return loadingHTML(title || '加载中…');
  if (type === 'error') return errorStateHTML(title || '加载失败');
  if (type === 'pending') return emptyStateHTML({ icon: icon || 'construction', text: title || '待实现', tone: 'muted' });
  return emptyStateHTML({ icon: icon || 'inbox', text: title || '暂无数据' });
}

function clientValue(column, row, kind = 'sort') {
  const getter = kind === 'filter' ? column.filterValue : column.sortValue;
  const raw = typeof getter === 'function' ? getter(row) : row[column.key];
  return String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function numericClientColumn(column, rows) {
  if (column.numeric) return true;
  if (!rows.length) return false;
  return rows.every((row) => {
    const value = clientValue(column, row);
    return /^-?\d+(?:\.\d+)?(?:%|h|ms|s)?$/i.test(value.replace(/,/g, ''));
  });
}

function clientNumber(value) {
  const normalized = String(value ?? '').replace(/,/g, '').trim();
  if (!/^-?\d+(?:\.\d+)?(?:%|h|ms|s)?$/i.test(normalized)) return NaN;
  return Number.parseFloat(normalized);
}

function cellHTML(column, row, interactive = false) {
  const raw = typeof column.render === 'function' ? column.render(row) : row[column.key];
  const classes = [];
  if (column.numeric) classes.push('td-num');
  if (column.wrap) classes.push('csys-cell-wrap');
  const cls = classes.length ? ` class="${classes.join(' ')}"` : '';
  const sortValue = column.numeric ? clientNumber(clientValue(column, row)) : clientValue(column, row);
  const clientAttrs = interactive
    ? ` data-column-key="${esc(column.key || '')}" data-sort-value="${esc(Number.isFinite(sortValue) ? sortValue : clientValue(column, row))}" data-sort-type="${column.numeric ? 'number' : 'text'}"`
    : '';
  return `<td${cls}${clientAttrs}>${column.html ? (raw ?? '') : esc(raw ?? '—')}</td>`;
}

function headerHTML(column, sort = {}, sortAttr = 'data-csys-sort') {
  const classes = [];
  if (column.numeric) classes.push('th-num');
  if (column.sortable) {
    classes.push('sortable');
    if (sort.field === column.key && (sort.dir === 'asc' || sort.dir === 'desc')) classes.push(sort.dir);
  }
  const cls = classes.length ? ` class="${classes.join(' ')}"` : '';
  const sortData = column.sortable ? ` ${esc(sortAttr)}="${esc(column.key || '')}"` : '';
  return `<th${cls}${sortData}>${column.labelHtml || esc(column.label || column.key || '')}</th>`;
}

function pageNumbers(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const candidates = Array.from(new Set([1, totalPages, page - 1, page, page + 1]
    .filter((value) => value >= 1 && value <= totalPages)))
    .sort((left, right) => left - right);
  const numbers = [];
  candidates.forEach((value, index) => {
    if (index && value - candidates[index - 1] > 1) numbers.push('ellipsis');
    numbers.push(value);
  });
  return numbers;
}

function tableToolbarHTML({ tableKey, query, searchPlaceholder, page, pageSizes, toolbar }) {
  if (!tableKey || !page) return toolbar ? `<div class="csys-table-toolbar">${toolbar}</div>` : '';
  const sizes = Array.from(new Set((pageSizes || [10, 20, 50]).map(Number).filter((value) => value > 0)));
  const searchLabel = searchPlaceholder || '搜索当前表格';
  return `<div class="csys-table-toolbar">
    <label class="fault-stage-filter-search csys-table-search"><span class="mat">search</span><input data-csys-table-search="${esc(tableKey)}" value="${esc(query || '')}" placeholder="${esc(searchLabel)}" aria-label="${esc(searchLabel)}"></label>
    <div class="csys-table-tools">${toolbar || ''}<label class="csys-table-size"><span>每页</span><select class="filt" data-csys-table-size="${esc(tableKey)}">${sizes.map((size) => `<option value="${size}"${Number(page.pageSize) === size ? ' selected' : ''}>${size} 条</option>`).join('')}</select></label></div>
  </div>`;
}

function clientToolbarHTML({
  searchPlaceholder,
  filterColumn,
  filterLabel,
  filterValues,
  pageSize,
  total,
  pageSizeControl = true,
  scopeLabel = '',
}) {
  const searchLabel = searchPlaceholder || '筛选当前列表';
  const filter = filterColumn
    ? `<select class="filt" data-csys-client-filter="${esc(filterColumn)}" aria-label="${esc(filterLabel || '状态筛选')}">
        <option value="">${esc(`全部${filterLabel || '状态'}`)}</option>
        ${filterValues.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}
      </select>`
    : '';
  const size = pageSizeControl ? clientPageSizeHTML(pageSize) : '';
  const scope = scopeLabel ? `<span class="csys-table-scope">${esc(scopeLabel)}</span>` : '';
  return `<div class="csys-table-toolbar csys-table-client-toolbar">
    <label class="fault-stage-filter-search csys-table-search"><span class="mat">search</span><input data-csys-client-search placeholder="${esc(searchLabel)}" aria-label="${esc(searchLabel)}"></label>
    <div class="csys-table-tools">${scope}${filter}${size}<span class="csys-table-client-count" data-csys-client-count>命中 ${total} / ${total} 条</span></div>
  </div>`;
}

// Include the configured size so the selected value matches the visible row count.
function clientPageSizeHTML(pageSize) {
  const sizes = [...new Set([10, 20, 50, Number(pageSize)])].filter((size) => size > 0).sort((a, b) => a - b);
  return `<label class="csys-table-size"><span>每页</span><select class="filt" data-csys-client-page-size aria-label="每页条数">${sizes.map((size) => `<option value="${size}"${size === Number(pageSize) ? ' selected' : ''}>${size} 条</option>`).join('')}</select></label>`;
}

function clientPagerHTML(total, pageSize, pageSizeControl = false, keepVisible = false) {
  // A toolbar size selector can turn a single-page result into multiple pages.
  if (total <= pageSize && !pageSizeControl && !keepVisible) return '';
  const end = Math.min(total, pageSize);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return `<div class="csys-table-pager" data-csys-client-pager>
    ${pageSizeControl ? clientPageSizeHTML(pageSize) : ''}
    <span class="csys-table-range" data-csys-client-range>${total ? `1–${end} / ${total}` : '0–0 / 0'}</span>
    <span class="csys-table-page-meta" data-csys-client-page-meta>1 / ${pages} 页</span>
    <div class="pages"><button type="button" data-csys-client-page="prev" aria-label="上一页" disabled><span class="mat mat-sm">chevron_left</span></button><button type="button" data-csys-client-page="next" aria-label="下一页"${pages <= 1 ? ' disabled' : ''}><span class="mat mat-sm">chevron_right</span></button></div>
  </div>`;
}

function tablePagerHTML(tableKey, page) {
  if (!tableKey || !page) return '';
  const current = Math.max(1, Number(page.page) || 1);
  const totalPages = Math.max(1, Number(page.totalPages) || 1);
  const start = Math.max(0, Number(page.start) || 0);
  const end = Math.max(0, Number(page.end) || 0);
  const total = Math.max(0, Number(page.total) || 0);
  const button = (label, target, disabled = false, currentPage = false, ariaLabel = '') => `<button type="button"${currentPage ? ' class="current" aria-current="page"' : ''}${ariaLabel ? ` aria-label="${esc(ariaLabel)}"` : ''} data-csys-table-page="${esc(tableKey)}" data-page="${target}"${disabled ? ' disabled' : ''}>${label}</button>`;
  const pages = pageNumbers(current, totalPages).map((value) => value === 'ellipsis'
    ? '<span class="csys-pager-ellipsis">…</span>'
    : button(value, value, false, value === current)).join('');
  return `<div class="csys-table-pager">
    <span class="csys-table-range">${start}–${end} / ${total}</span>
    <span class="csys-table-page-meta">${current} / ${totalPages} 页</span>
    <div class="pages">${button('<span class="mat mat-sm">chevron_left</span>', current - 1, current <= 1, false, '上一页')}${pages}${button('<span class="mat mat-sm">chevron_right</span>', current + 1, current >= totalPages, false, '下一页')}</div>
  </div>`;
}

function computeTableBlock({
  columns = [],
  rows = [],
  emptyText = '暂无数据',
  showHeadersWhenEmpty = false,
  toolbar = '',
  rowAttrs = () => '',
  sort = {},
  sortAttr = 'data-csys-sort',
  tableKey = '',
  query = '',
  searchPlaceholder = '',
  page = null,
  pageSizes = [10, 20, 50],
  interactive = false,
  filterColumn = '',
  clientPageSizePlacement = 'toolbar',
  clientPageSize = 20,
  clientPagination = true,
  clientPageSizeControl = true,
  clientScopeLabel = '',
  tableClass = '',
  relatedRow = null,
} = {}) {
  if (!rows.length && !showHeadersWhenEmpty && (!tableKey || !page)) {
    return computeStatePanel({ type: 'empty', title: emptyText, icon: 'filter_alt_off' });
  }
  const resolvedColumns = columns.map((column) => (
    interactive && column.sortable === undefined ? { ...column, sortable: true } : column
  ));
  if (interactive) {
    resolvedColumns.forEach((column) => {
      if (numericClientColumn(column, rows)) column.numeric = true;
    });
  }
  // false explicitly opts out; the empty-string default still infers a status column.
  const resolvedFilterColumn = filterColumn === false ? '' : filterColumn || (interactive
    ? (resolvedColumns.find((column) => /状态|结论|阶段/.test(column.label || ''))?.key || '')
    : '');
  const filterLabel = resolvedColumns.find((column) => column.key === resolvedFilterColumn)?.label || '状态';
  const filterValues = resolvedFilterColumn
    ? Array.from(new Set(rows.map((row) => clientValue(
      resolvedColumns.find((column) => column.key === resolvedFilterColumn) || { key: resolvedFilterColumn },
      row,
      'filter',
    )).filter(Boolean))).sort()
    : [];
  const clientToolbar = interactive
    ? clientToolbarHTML({
      searchPlaceholder,
      filterColumn: resolvedFilterColumn,
      filterLabel,
      filterValues,
      pageSize: clientPageSize,
      total: rows.length,
      pageSizeControl: clientPageSizeControl && clientPageSizePlacement !== 'footer',
      scopeLabel: clientScopeLabel,
    })
    : '';
  const effectiveSortAttr = interactive ? 'data-csys-client-sort' : sortAttr;
  const tableClasses = ['tbl', tableClass].filter(Boolean).map(esc).join(' ');
  const emptyRow = `<tr><td colspan="${resolvedColumns.length}">${computeStatePanel({ type: 'empty', title: emptyText, icon: 'filter_alt_off' })}</td></tr>`;
  const body = rows.length || showHeadersWhenEmpty
    ? `<div class="overflow-auto csys-table-scroll"><table class="${tableClasses}"><thead><tr>${resolvedColumns.map((column) => headerHTML(column, sort, effectiveSortAttr)).join('')}</tr></thead><tbody>
      ${rows.length ? rows.map((row, index) => {
        const searchValue = resolvedColumns.map((column) => clientValue(column, row)).join(' ').toLowerCase();
        const filterValue = resolvedFilterColumn
          ? clientValue(resolvedColumns.find((column) => column.key === resolvedFilterColumn) || { key: resolvedFilterColumn }, row, 'filter')
          : '';
        const related = typeof relatedRow === 'function' ? relatedRow(row, index) : null;
        const group = related ? `${tableKey || 'table'}-${index}` : '';
        const clientAttrs = `${interactive
          ? ` data-csys-row data-original-index="${index}" data-search-value="${esc(searchValue)}" data-filter-value="${esc(filterValue)}"`
          : ''}${group ? ` data-csys-group="${esc(group)}"` : ''}`;
        const detail = related
          ? `<tr class="cs-detail-row${related.open ? ' cs-open' : ''}" data-csys-related-to="${esc(group)}"><td colspan="${resolvedColumns.length}">${related.body || ''}</td></tr>`
          : '';
        return `<tr${interactive && clientPagination && index >= clientPageSize ? ' hidden' : ''}${clientAttrs}${rowAttrs(row) || ''}>${resolvedColumns.map((column) => cellHTML(column, row, interactive)).join('')}</tr>${detail}`;
      }).join('') : emptyRow}
      ${interactive && rows.length ? `<tr data-csys-client-empty hidden><td colspan="${resolvedColumns.length}">${computeStatePanel({ type: 'empty', title: '当前筛选无匹配数据', icon: 'filter_alt_off' })}</td></tr>` : ''}
    </tbody></table></div>`
    : computeStatePanel({ type: 'empty', title: emptyText, icon: 'filter_alt_off' });
  return `<div class="csys-table-block"${tableKey ? ` data-csys-table-key="${esc(tableKey)}"` : ''}${interactive ? ` data-csys-client-table data-client-page="1" data-client-page-size="${clientPageSize}" data-client-pagination="${clientPagination ? 'true' : 'false'}"` : ''}>
    ${clientToolbar || tableToolbarHTML({ tableKey, query, searchPlaceholder, page, pageSizes, toolbar })}
    ${body}
    ${interactive && clientPagination ? clientPagerHTML(rows.length, clientPageSize, clientPageSizeControl && clientPageSizePlacement === 'footer', clientPageSizeControl) : tablePagerHTML(tableKey, page)}
  </div>`;
}

function compareClientRows(left, right, field, dir) {
  const leftCell = left.querySelector(`[data-column-key="${CSS.escape(field)}"]`);
  const rightCell = right.querySelector(`[data-column-key="${CSS.escape(field)}"]`);
  const type = leftCell?.dataset.sortType || rightCell?.dataset.sortType || 'text';
  const leftValue = leftCell?.dataset.sortValue || '';
  const rightValue = rightCell?.dataset.sortValue || '';
  const comparison = type === 'number'
    ? (clientNumber(leftValue) || 0) - (clientNumber(rightValue) || 0)
    : leftValue.localeCompare(rightValue, 'zh-CN', { numeric: true, sensitivity: 'base' });
  if (comparison) return comparison * dir;
  return (Number(left.dataset.originalIndex) - Number(right.dataset.originalIndex)) * dir;
}

function applyClientTableState(root) {
  const tbody = root.querySelector('tbody');
  if (!tbody) return;
  const query = String(root.querySelector('[data-csys-client-search]')?.value || '').trim().toLowerCase();
  const filter = String(root.querySelector('[data-csys-client-filter]')?.value || '');
  const rows = [...tbody.querySelectorAll(':scope > tr[data-csys-row]')];
  const visible = rows.filter((row) => (
    (!query || (row.dataset.searchValue || '').includes(query))
    && (!filter || row.dataset.filterValue === filter)
  ));
  const field = root.dataset.sortField || '';
  const dir = root.dataset.sortDir === 'desc' ? -1 : 1;
  const sorted = field ? visible.slice().sort((left, right) => compareClientRows(left, right, field, dir)) : visible;
  const paginated = root.dataset.clientPagination !== 'false';
  const pageSize = paginated ? Math.max(1, Number(root.dataset.clientPageSize) || 20) : Math.max(visible.length, 1);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = paginated ? Math.min(Math.max(1, Number(root.dataset.clientPage) || 1), totalPages) : 1;
  root.dataset.clientPage = String(page);
  const startIndex = (page - 1) * pageSize;
  const pageRows = paginated ? sorted.slice(startIndex, startIndex + pageSize) : sorted;
  rows.forEach((row) => {
    const visibleOnPage = pageRows.includes(row);
    row.hidden = !visibleOnPage;
    const group = row.dataset.csysGroup || '';
    if (group) {
      tbody.querySelectorAll(`:scope > tr[data-csys-related-to="${CSS.escape(group)}"]`).forEach((related) => {
        related.classList.toggle('csys-related-filtered', !visibleOnPage);
      });
    }
  });
  sorted.forEach((row) => {
    tbody.appendChild(row);
    const group = row.dataset.csysGroup || '';
    if (group) tbody.querySelectorAll(`:scope > tr[data-csys-related-to="${CSS.escape(group)}"]`).forEach((related) => tbody.appendChild(related));
  });
  const empty = tbody.querySelector(':scope > tr[data-csys-client-empty]');
  if (empty) {
    empty.hidden = visible.length > 0;
    tbody.appendChild(empty);
  }
  const count = root.querySelector('[data-csys-client-count]');
  if (count) count.textContent = `命中 ${visible.length} / ${rows.length} 条`;
  const range = root.querySelector('[data-csys-client-range]');
  if (range) range.textContent = visible.length ? `${startIndex + 1}–${startIndex + pageRows.length} / ${visible.length}` : '0–0 / 0';
  const meta = root.querySelector('[data-csys-client-page-meta]');
  if (meta) meta.textContent = `${page} / ${totalPages} 页`;
  const previous = root.querySelector('[data-csys-client-page="prev"]');
  const next = root.querySelector('[data-csys-client-page="next"]');
  if (previous) previous.disabled = page <= 1;
  if (next) next.disabled = page >= totalPages;
}

function captureComputeClientTableStates(container) {
  if (!container) return [];
  return [...container.querySelectorAll('[data-csys-client-table]')].map((root) => ({
    key: root.dataset.csysTableKey || '',
    query: root.querySelector('[data-csys-client-search]')?.value || '',
    filter: root.querySelector('[data-csys-client-filter]')?.value || '',
    page: root.dataset.clientPage || '1',
    pageSize: root.dataset.clientPageSize || '20',
    sortField: root.dataset.sortField || '',
    sortDir: root.dataset.sortDir || '',
  }));
}

function mergeComputeClientTableStates(previous = [], current = []) {
  const merged = new Map();
  (Array.isArray(previous) ? previous : []).forEach((state, index) => {
    merged.set(state?.key || `__index_${index}`, state);
  });
  (Array.isArray(current) ? current : []).forEach((state, index) => {
    merged.set(state?.key || `__index_${index}`, state);
  });
  return Array.from(merged.values()).filter(Boolean);
}

function restoreComputeClientTableStates(container, states = []) {
  if (!container) return;
  const byKey = new Map(states.filter((state) => state?.key).map((state) => [state.key, state]));
  [...container.querySelectorAll('[data-csys-client-table]')].forEach((root, index) => {
    const key = root.dataset.csysTableKey || '';
    const saved = key ? byKey.get(key) : states[index];
    if (!saved) return;
    const search = root.querySelector('[data-csys-client-search]');
    const filter = root.querySelector('[data-csys-client-filter]');
    const pageSize = root.querySelector('[data-csys-client-page-size]');
    if (search) search.value = saved.query || '';
    if (filter && [...filter.options].some((option) => option.value === saved.filter)) filter.value = saved.filter || '';
    if (pageSize && [...pageSize.options].some((option) => option.value === String(saved.pageSize))) pageSize.value = String(saved.pageSize);
    root.dataset.clientPageSize = String(saved.pageSize || 20);
    root.dataset.sortField = saved.sortField || '';
    root.dataset.sortDir = saved.sortDir || '';
    root.querySelectorAll('[data-csys-client-sort]').forEach((item) => {
      item.classList.remove('asc', 'desc');
      if (item.dataset.csysClientSort === saved.sortField && ['asc', 'desc'].includes(saved.sortDir)) {
        item.classList.add(saved.sortDir);
      }
    });
    root.dataset.clientPage = String(saved.page || 1);
    applyClientTableState(root);
  });
}

let clientTableEventsBound = false;

function ensureClientTableEvents() {
  if (clientTableEventsBound || typeof document === 'undefined') return;
  clientTableEventsBound = true;
  document.addEventListener('input', (event) => {
    const input = event.target.closest?.('[data-csys-client-search]');
    const root = input?.closest('[data-csys-client-table]');
    if (root) {
      root.dataset.clientPage = '1';
      applyClientTableState(root);
    }
  });
  document.addEventListener('change', (event) => {
    const filter = event.target.closest?.('[data-csys-client-filter]');
    const root = filter?.closest('[data-csys-client-table]');
    if (root) {
      root.dataset.clientPage = '1';
      applyClientTableState(root);
      return;
    }
    const pageSize = event.target.closest?.('[data-csys-client-page-size]');
    const pageRoot = pageSize?.closest('[data-csys-client-table]');
    if (pageRoot) {
      pageRoot.dataset.clientPageSize = String(Math.max(1, Number(pageSize.value) || 20));
      pageRoot.dataset.clientPage = '1';
      applyClientTableState(pageRoot);
    }
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-domain-help]')) return;
    const pageButton = event.target.closest?.('[data-csys-client-page]');
    const pageRoot = pageButton?.closest('[data-csys-client-table]');
    if (pageRoot) {
      const current = Math.max(1, Number(pageRoot.dataset.clientPage) || 1);
      pageRoot.dataset.clientPage = String(pageButton.dataset.csysClientPage === 'prev' ? current - 1 : current + 1);
      applyClientTableState(pageRoot);
      return;
    }
    const header = event.target.closest?.('[data-csys-client-sort]');
    const root = header?.closest('[data-csys-client-table]');
    if (!root) return;
    const field = header.dataset.csysClientSort || '';
    const nextDir = root.dataset.sortField === field && root.dataset.sortDir === 'asc' ? 'desc' : 'asc';
    root.dataset.sortField = field;
    root.dataset.sortDir = nextDir;
    root.dataset.clientPage = '1';
    root.querySelectorAll('[data-csys-client-sort]').forEach((item) => item.classList.remove('asc', 'desc'));
    header.classList.add(nextDir);
    applyClientTableState(root);
  });
}

ensureClientTableEvents();

let enhancedTableSequence = 0;

function inferredColumns(table) {
  const headers = [...table.querySelectorAll(':scope > thead > tr:first-child > th')];
  return headers.map((header, index) => ({
    header,
    key: `column-${index}`,
    label: String(header.textContent || '').replace(/\s+/g, ' ').trim() || `第 ${index + 1} 列`,
    numeric: header.classList.contains('th-num'),
  }));
}

function setupEnhancedRows(table, columns) {
  const tbody = table.tBodies[0];
  if (!tbody) return [];
  const directRows = [...tbody.children].filter((row) => row.tagName === 'TR');
  const mainRows = directRows.filter((row) => (
    !row.classList.contains('cs-detail-row')
    && row.querySelectorAll(':scope > td').length === columns.length
    && !row.querySelector('.empty-state')
  ));
  columns.forEach((column, index) => {
    if (column.numeric || !mainRows.length) return;
    column.numeric = mainRows.every((row) => Number.isFinite(clientNumber(row.children[index]?.textContent)));
  });
  mainRows.forEach((row, rowIndex) => {
    const next = row.nextElementSibling;
    const detail = next?.classList.contains('cs-detail-row') ? next : null;
    const group = detail ? `enhanced-${++enhancedTableSequence}` : '';
    row.dataset.csysRow = '';
    row.dataset.originalIndex = String(rowIndex);
    if (group) {
      row.dataset.csysGroup = group;
      detail.dataset.csysRelatedTo = group;
    }
    const cells = [...row.querySelectorAll(':scope > td')];
    const searchParts = [];
    cells.forEach((cell, index) => {
      const column = columns[index];
      const value = String(cell.textContent || '').replace(/\s+/g, ' ').trim();
      searchParts.push(value);
      cell.dataset.columnKey = column.key;
      const numeric = column.numeric || cell.classList.contains('td-num');
      const numericValue = numeric ? clientNumber(value) : NaN;
      cell.dataset.sortValue = Number.isFinite(numericValue) ? String(numericValue) : value;
      cell.dataset.sortType = numeric ? 'number' : 'text';
    });
    if (detail) searchParts.push(String(detail.textContent || '').replace(/\s+/g, ' ').trim());
    row.dataset.searchValue = searchParts.join(' ').toLowerCase();
  });
  return mainRows;
}

function enhancedFilterColumn(columns) {
  return columns.findIndex((column) => /状态|结论|阶段|健康度|稳定态|一致性|合规/.test(column.label));
}

function enhanceRawTable(table) {
  if (!table.classList.contains('tbl')) return;
  if (table.closest('.csys-table-block, [data-og-table-block], .drawer, [data-csys-no-enhance]')) return;
  if (table.parentElement?.closest('table')) return;
  if (table.querySelector('.og-table-search')) return;
  const columns = inferredColumns(table);
  if (!columns.length) return;
  let scroller = table.parentElement?.classList.contains('overflow-auto') ? table.parentElement : null;
  if (!scroller) {
    scroller = document.createElement('div');
    scroller.className = 'overflow-auto csys-table-scroll';
    table.before(scroller);
    scroller.appendChild(table);
  }
  const rows = setupEnhancedRows(table, columns);
  if (!rows.length) return;
  columns.forEach(({ header, key, numeric }) => {
    header.classList.add('sortable');
    if (numeric) header.classList.add('th-num');
    header.dataset.csysClientSort = key;
  });
  const filterIndex = enhancedFilterColumn(columns);
  const filterColumn = filterIndex >= 0 ? columns[filterIndex] : null;
  rows.forEach((row) => {
    row.dataset.filterValue = filterColumn
      ? String(row.children[filterIndex]?.textContent || '').replace(/\s+/g, ' ').trim()
      : '';
  });
  const filterValues = filterColumn
    ? Array.from(new Set(rows.map((row) => row.dataset.filterValue).filter(Boolean))).sort()
    : [];
  const wrapper = document.createElement('div');
  wrapper.className = 'csys-table-block';
  wrapper.dataset.csysClientTable = '';
  wrapper.dataset.clientPage = '1';
  wrapper.dataset.clientPageSize = '20';
  scroller.classList.add('csys-table-scroll');
  scroller.before(wrapper);
  wrapper.innerHTML = clientToolbarHTML({
    searchPlaceholder: `筛选${columns.slice(0, 3).map((column) => column.label).join(' / ')}`,
    filterColumn: filterColumn?.key || '',
    filterLabel: filterColumn?.label || '状态',
    filterValues,
    pageSize: 20,
    total: rows.length,
  });
  wrapper.appendChild(scroller);
  wrapper.insertAdjacentHTML('beforeend', clientPagerHTML(rows.length, 20));
  applyClientTableState(wrapper);
}

function enhanceComputeTableLists(root) {
  if (!root || typeof document === 'undefined') return;
  root.querySelectorAll('table.tbl').forEach(enhanceRawTable);
}

let computeTableObserver = null;

function ensureComputeTableObserver() {
  if (computeTableObserver || typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.body) return;
  computeTableObserver = new MutationObserver((records) => {
    records.forEach((record) => record.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      if (node.matches('.csys-shell')) {
        enhanceComputeTableLists(node);
        return;
      }
      const relevantTables = new Set();
      if (node.matches('table.tbl')) relevantTables.add(node);
      const ancestorTable = node.closest('table.tbl');
      if (ancestorTable) relevantTables.add(ancestorTable);
      node.querySelectorAll?.('table.tbl').forEach((table) => relevantTables.add(table));
      relevantTables.forEach((table) => {
        if (table.closest('.csys-shell')) enhanceRawTable(table);
      });
      node.querySelectorAll?.('.csys-shell').forEach(enhanceComputeTableLists);
    }));
  });
  computeTableObserver.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('.csys-shell').forEach(enhanceComputeTableLists);
}

ensureComputeTableObserver();

function computeAuditPanel({ title = '数据状态', items = [] } = {}) {
  return computeSection({
    title,
    icon: 'fact_check',
    body: `<div class="csys-audit">${items.map((item) => `<div class="csys-audit-row"><span>${esc(item.label || '')}</span><b>${esc(item.value ?? '—')}</b></div>`).join('')}</div>`,
  });
}
