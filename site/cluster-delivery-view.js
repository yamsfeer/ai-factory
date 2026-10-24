(function () {
  const D = window.CLUSTER_DELIVERY_DATA;
  if (!D) return;

  const DAY = 86400000;
  const START = Date.parse(`${D.rangeStart}T00:00:00Z`);
  const END = Date.parse(`${D.rangeEnd}T00:00:00Z`);
  const TODAY = Date.parse(`${D.asOf}T00:00:00Z`);
  const SLA_DAYS = 30;
  const STATE_LABEL = { past: '已交付', present: '建设中', future: '规划中' };
  const STATE_CHIP = { past: 'chip-ok', present: 'chip-info', future: 'chip-neutral' };
  const ORIGIN_LABEL = { 'new-first': '新机房首批', 'existing-add': '存量机房扩容' };
  const state = { area: '', kind: '', type: '', source: 'all', query: '', expanded: false };
  let currentDrawer = null;
  const clusterState = new Map();

  function esc(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const siteById = (id) => D.sites.find((site) => site.id === id);
  const batchById = (id) => D.sites.flatMap((site) => site.batches).find((batch) => batch.id === id);

  function day(value) {
    const parsed = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function pct(value) { return ((day(value) - START) / (END - START)) * 100; }
  function daysBetween(a, b) { return Math.round((day(b) - day(a)) / DAY); }
  function fmtMD(value) {
    if (!value) return '—';
    return `${String(Number(value.slice(5, 7))).padStart(2, '0')}/${String(Number(value.slice(8, 10))).padStart(2, '0')}`;
  }
  function fmtDate(value) {
    if (!value) return '—';
    return `${value.slice(0, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)}`;
  }
  function ownerInitial(name) { return (name || '待').slice(0, 1); }

  function groupFromName(name) {
    const prefix = (name || '').split('-')[0] || 'Core';
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  function businessFromCluster(cluster, batch) {
    const prefix = (cluster.name || '').split('-')[0] || '';
    const known = { seed: 'Seed', seed01: 'Seed', panda: 'Panda', cloudnative: 'CloudNative', candy: 'Candy', infer: 'Infer' };
    if (known[prefix]) return known[prefix];
    return batch?.business || (batch?.type === '通用 / 微服务' ? 'Core' : cluster.type);
  }
  function scaledStagePlan(totalDays) {
    const base = D.stages.map((s) => s.baseline);
    const baseTotal = base.reduce((a, b) => a + b, 0);
    if (baseTotal === 0 || totalDays <= 0) return base;
    return base.map((d) => Math.max(1, Math.round((d / baseTotal) * totalDays)));
  }
  /* ---------------- 统一集群列表 ---------------- */
  function allClusters() {
    const existing = D.clusters.map((cluster) => {
      const batch = cluster.batchId ? batchById(cluster.batchId) : null;
      return {
        ...cluster,
        state: cluster.state || batch?.state || 'present',
        end: cluster.end || cluster.planEnd || cluster.start,
        slaDays: cluster.slaDays || SLA_DAYS,
        group: cluster.group || groupFromName(cluster.name),
        business: cluster.business || businessFromCluster(cluster, batch),
        ...(clusterState.get(cluster.id) || {}),
      };
    });
    const synthetic = [];
    D.sites.forEach((site) => {
      site.batches.forEach((batch) => {
        if (batch.state === 'present') return;
        const totalDays = Math.max(1, daysBetween(batch.start, batch.end));
        const typeSlug = batch.type === '通用 / 微服务' ? 'common' : batch.type === '训练' ? 'train' : batch.type === '推理' ? 'infer' : 'pool';
        const batchGroup = batch.type === '训练' ? 'Train' : batch.type === '推理' ? 'Infer' : 'Core';
        for (let index = 0; index < batch.count; index += 1) {
          const clusterId = `${batch.id}-c${index + 1}`;
          synthetic.push({
            id: clusterId,
            name: `${site.code.toLowerCase()}-${typeSlug}-${index + 1}`,
            group: batchGroup,
            business: batch.type === '通用 / 微服务' ? 'Core' : batch.type,
            siteId: site.id,
            batchId: batch.id,
            type: batch.type,
            owner: batch.owner,
            origin: batch.origin,
            state: batch.state,
            start: batch.start,
            planEnd: batch.end,
            end: batch.end,
            stageIndex: batch.state === 'past' ? D.stages.length : 0,
            stageDays: 0,
            subIndex: 0,
            stagePlan: scaledStagePlan(totalDays),
            slaDays: SLA_DAYS,
            risk: null,
            next: batch.state === 'past' ? '六阶段流程已完成（示例）' : '推进「确认需求」及子项',
            synthetic: true,
            ...(clusterState.get(clusterId) || {}),
          });
        }
      });
    });
    return [...existing, ...synthetic];
  }

  const clusterById = (id) => allClusters().find((cluster) => cluster.id === id);

  function persistCluster(cluster) {
    if (!cluster || !cluster.id) return;
    clusterState.set(cluster.id, {
      stageIndex: cluster.stageIndex,
      subIndex: cluster.subIndex,
      stageDays: cluster.stageDays,
      state: cluster.state,
      end: cluster.end,
      next: cluster.next,
      subDone: { ...(cluster.subDone || {}) },
      subItemData: { ...(cluster.subItemData || {}) },
    });
  }

  function qMatch(...values) {
    const query = state.query.trim().toLowerCase();
    if (!query) return true;
    return values.filter(Boolean).join(' ').toLowerCase().includes(query);
  }
  function sitePass(site) {
    if (state.area && site.area !== state.area) return false;
    if (state.kind && site.kind !== state.kind) return false;
    return true;
  }
  function visibleClusters() {
    return allClusters().filter((cluster) => {
      const site = siteById(cluster.siteId);
      if (!site || !sitePass(site)) return false;
      if (state.type && !cluster.type.includes(state.type)) return false;
      if (state.source !== 'all' && cluster.origin !== state.source) return false;
      return qMatch(site.name, site.region, site.code, site.owner, cluster.type, cluster.id, cluster.name, cluster.group, cluster.business, cluster.owner);
    });
  }
  function sourceCounts() {
    const all = allClusters();
    return {
      all: all.length,
      'new-first': all.filter((c) => c.origin === 'new-first').length,
      'existing-add': all.filter((c) => c.origin === 'existing-add').length,
    };
  }

  /* ---------------- KPI ---------------- */
  function kpiValues() {
    const clusters = visibleClusters();
    const past = clusters.filter((c) => c.state === 'past');
    const present = clusters.filter((c) => c.state === 'present');
    const future = clusters.filter((c) => c.state === 'future');
    const pastCount = past.length;
    const presentCount = present.length;
    const futureCount = future.length;
    const avgCycle = pastCount
      ? Math.round(past.reduce((sum, c) => sum + daysBetween(c.start, c.end), 0) / pastCount)
      : null;
    const pastSites = new Set(past.map((c) => c.siteId)).size;
    const risks = present.filter((c) => c.risk);
    const blocked = risks.filter((c) => c.risk.level === 'err').length;
    const stageOver = present.filter((c) => c.stageDays > c.stagePlan[c.stageIndex]).length;
    const futureNew = future.filter((c) => c.origin === 'new-first').length;
    const futureOld = future.filter((c) => c.origin === 'existing-add').length;
    return { pastCount, presentCount, futureCount, avgCycle, pastSites, riskCount: risks.length, blocked, stageOver, futureNew, futureOld };
  }

  function renderKpis() {
    const k = kpiValues();
    const avgText = k.avgCycle === null ? '暂无已交付样本' : `平均耗时 <b>${k.avgCycle}</b> 天`;
    document.querySelector('#cd-kpis').innerHTML = `<div class="cd-summary-cards">
      <div class="cd-summary-card past">
        <div class="cd-summary-top">
          <span class="cd-summary-icon"><span class="mat">history</span></span>
          <span class="cd-summary-label">过去 · 已交付集群</span>
          <span class="cd-summary-value">${k.pastCount}</span>
          <span class="cd-summary-unit">个集群</span>
        </div>
        <div class="cd-summary-sub">何时交付 · 谁负责</div>
        <div class="cd-summary-metrics">
          <span class="cd-summary-metric">${avgText}</span>
          <span class="cd-summary-metric"><b>${k.pastSites}</b> 个机房</span>
        </div>
      </div>
      <div class="cd-summary-card present">
        <div class="cd-summary-top">
          <span class="cd-summary-icon"><span class="mat">pending_actions</span></span>
          <span class="cd-summary-label">现在 · 建设中集群</span>
          <span class="cd-summary-value">${k.presentCount}</span>
          <span class="cd-summary-unit">个集群</span>
        </div>
        <div class="cd-summary-sub">当前进度 · 目标时间 · 阻塞</div>
        <div class="cd-summary-metrics">
          <span class="cd-summary-metric${k.blocked ? ' alert' : ''}"><b>${k.blocked}</b> 集群阻塞</span>
          <span class="cd-summary-metric${k.stageOver ? ' alert' : ''}"><b>${k.stageOver}</b> 阶段超基线</span>
        </div>
      </div>
      <div class="cd-summary-card future">
        <div class="cd-summary-top">
          <span class="cd-summary-icon"><span class="mat">event_upcoming</span></span>
          <span class="cd-summary-label">未来 · 规划中集群</span>
          <span class="cd-summary-value">${k.futureCount}</span>
          <span class="cd-summary-unit">个集群</span>
        </div>
        <div class="cd-summary-sub">何时启动 · 计划建什么</div>
        <div class="cd-summary-metrics">
          <span class="cd-summary-metric"><b>${k.futureNew}</b> 新机房首批</span>
          <span class="cd-summary-metric"><b>${k.futureOld}</b> 存量扩容</span>
        </div>
      </div>
    </div>`;
  }

  /* ---------------- 时间轴 ---------------- */
  function monthLabels() {
    const labels = [];
    const firstYear = Number(D.rangeStart.slice(0, 4));
    const lastYear = Number(D.rangeEnd.slice(0, 4));
    for (let year = firstYear; year < lastYear; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        labels.push({ year, month, label: `${year}/${String(month).padStart(2, '0')}`, yearStart: month === 1 });
      }
    }
    return labels;
  }
  function barRatio(value) { return Math.max(0, Math.min(100, pct(value))); }
  function timelineGroupHTML(key, title, clusters) {
    const total = clusters.length;
    if (!total) return '';
    const preview = state.expanded ? total : Math.min(2, total);
    const showPreview = !state.expanded && total > 2;
    const rows = clusters.slice(0, preview).map((cluster) => timelineRowHTML(cluster)).join('');
    return `<div class="cd-tl-group ${key}">
      <div class="cd-tl-group-main"><span class="cd-tl-group-dot"></span><b class="cd-tl-group-title">${esc(title)}</b><span class="cd-tl-group-count">· ${total} 个集群</span></div>
      ${showPreview ? `<span class="cd-tl-group-preview">预览 ${preview} 个</span>` : ''}
    </div>${rows}`;
  }
  function timelineRowHTML(cluster) {
    const site = siteById(cluster.siteId);
    const startPct = barRatio(cluster.start);
    const endPct = barRatio(cluster.end);
    const width = Math.max(endPct - startPct, 0.5);
    const riskDot = cluster.risk ? `<span class="cd-tl-bar-risk" style="left:calc(${endPct}% + 5px)"></span>` : '';
    const newClass = cluster.isNew ? ' is-new' : '';
    const title = esc(`${cluster.name} · ${cluster.type} · ${ORIGIN_LABEL[cluster.origin]} · ${cluster.start} → ${cluster.end} · ${cluster.owner}${cluster.risk ? ' · 有风险' : ''}`);
    return `<button type="button" class="cd-tl-row ${cluster.state}${newClass}" data-cluster="${esc(cluster.id)}" title="${title}" aria-label="${title}">
      <div class="cd-tl-row-label"><b>${esc(cluster.name)}</b><span>${esc(site?.name || '')} · ${esc(cluster.owner)} · ${esc(site?.region || '')}</span></div>
      <div class="cd-tl-row-track"><span class="cd-tl-bar ${cluster.state}" style="left:${startPct}%;width:${width}%"></span>${riskDot}</div>
      <div class="cd-tl-row-date">${cluster.end}</div>
    </button>`;
  }
  function renderTimeline() {
    const clusters = visibleClusters().slice().sort((a, b) => day(a.start) - day(b.start));
    const groups = [
      { key: 'past', title: '过去 · 已交付', clusters: clusters.filter((c) => c.state === 'past') },
      { key: 'present', title: '现在 · 建设中', clusters: clusters.filter((c) => c.state === 'present') },
      { key: 'future', title: '未来 · 规划中', clusters: clusters.filter((c) => c.state === 'future') },
    ].filter((g) => g.clusters.length);
    const counts = sourceCounts();
    const hasMore = groups.some((g) => g.clusters.length > 2);
    const expandButton = hasMore ? `<button type="button" class="cd-tl-expand" data-cd-expand>${state.expanded ? '收起时间线' : '展开完整时间线'}<span class="mat">${state.expanded ? 'unfold_less' : 'unfold_more'}</span></button>` : '';
    const months = monthLabels();
    const yearSpans = [];
    const firstYear = Number(D.rangeStart.slice(0, 4));
    const lastYear = Number(D.rangeEnd.slice(0, 4));
    for (let y = firstYear; y < lastYear; y++) yearSpans.push(y);
    const todayRatio = (TODAY - START) / (END - START);
    const toolbar = `<div class="cd-tl-toolbar">
      <div class="cd-source"><span class="flab">交付来源</span><div class="cd-seg" role="group" aria-label="按交付来源筛选">
        <button type="button" class="${state.source === 'all' ? 'active' : ''}" data-cd-source="all" aria-pressed="${state.source === 'all'}">全部 ${counts.all}</button>
        <button type="button" class="${state.source === 'new-first' ? 'active' : ''}" data-cd-source="new-first" aria-pressed="${state.source === 'new-first'}">新机房首批 ${counts['new-first']}</button>
        <button type="button" class="${state.source === 'existing-add' ? 'active' : ''}" data-cd-source="existing-add" aria-pressed="${state.source === 'existing-add'}">存量机房扩容 ${counts['existing-add']}</button>
      </div></div>
      ${expandButton}
    </div>
    <div class="cd-tl-legend">
      <span class="lg"><i class="past"></i>过去 · 已交付</span>
      <span class="lg"><i class="present"></i>现在 · 建设中</span>
      <span class="lg"><i class="future"></i>未来 · 规划中</span>
      <span class="lg"><i class="today"></i>示例基准 ${D.asOf}</span>
    </div>
    <div class="cd-tl-frame">
      <div class="cd-tl-head">
        <div class="cd-tl-head-label">集群 / 机房 · 负责人</div>
        <div class="cd-tl-head-axis">
          <div class="cd-tl-years">${yearSpans.map((y) => `<span>${y}</span>`).join('')}</div>
          <div class="cd-tl-months">${months.map(({ month, yearStart }) => `<span class="${yearStart ? 'year-start' : ''}">${String(month).padStart(2, '0')}</span>`).join('')}</div>
        </div>
        <div class="cd-tl-head-date">完成 / 目标</div>
      </div>
      <div class="cd-tl-body" style="--pct:${todayRatio.toFixed(4)}">
        <div class="cd-tl-grid"></div>
        <div class="cd-tl-today"></div>
        ${groups.map((g) => timelineGroupHTML(g.key, g.title, g.clusters)).join('')}
      </div>
    </div>
    <p class="cd-tl-foot">横条为启动 → 完成 / 目标；点击条带或行打开集群详情。默认各阶段预览最多 2 个集群，展开后查看全部；随区域、机房类型、类型与搜索联动。红点表示存在阻塞或依赖风险。</p>`;
    document.querySelector('#cd-timeline').innerHTML = groups.length
      ? toolbar
      : emptyStateHTML({ icon: 'domain_disabled', text: '当前筛选下没有集群数据', tone: 'muted' });
    const expandBtn = document.querySelector('[data-cd-expand]');
    if (expandBtn) expandBtn.focus({ preventScroll: true });
  }

  /* ---------------- 集群清单 ---------------- */
  function pipelineRow(cluster) {
    const site = siteById(cluster.siteId);
    const stageIndex = Math.min(cluster.stageIndex, D.stages.length - 1);
    const stage = D.stages[stageIndex];
    const completed = cluster.state === 'past' ? D.stages.length : Math.min(cluster.stageIndex, D.stages.length);
    const stageName = cluster.state === 'past' ? '已完成' : cluster.state === 'future' ? D.stages[0].name : stage.name;
    const stateChip = cluster.state === 'past'
      ? '<span class="chip chip-ok">已交付</span>'
      : cluster.state === 'present'
        ? '<span class="chip chip-info">建设中</span>'
        : '<span class="chip chip-neutral">规划中</span>';
    const timeLabel = cluster.state === 'past' ? '交付' : '目标';
    const elapsed = cluster.state === 'past' ? daysBetween(cluster.start, cluster.end) : cluster.state === 'present' ? daysBetween(cluster.start, D.asOf) : null;
    const sla = cluster.slaDays || SLA_DAYS;
    const over = elapsed !== null && elapsed > sla;
    const slaHTML = elapsed === null
      ? `<b>—</b><small>SLA ${sla} 天</small>`
      : `<b class="${over ? 'cd-sla-over' : ''}">${elapsed}天</b><small class="${over ? 'cd-sla-over' : ''}">SLA ${sla}天${over ? ` · 超${elapsed - sla}天` : ''}</small>`;
    let blockHTML;
    if (cluster.risk) {
      const riskClass = cluster.risk.level === 'err' ? 'cd-block--err' : 'cd-block--warn';
      blockHTML = `<div class="cd-block ${riskClass}"><span class="mat">warning</span><span class="cd-block-text">${esc(cluster.risk.text)}</span></div>`;
    } else {
      blockHTML = `<div class="cd-block"><span class="cd-block-text">${esc(cluster.next || '—')}</span></div>`;
    }
    const newClass = cluster.isNew ? ' is-new' : '';
    return `<div class="cd-cluster-row${newClass}" role="button" tabindex="0" data-cluster="${esc(cluster.id)}" aria-label="查看 ${esc(cluster.name)} 的阶段详情">
      <div class="cd-cluster-name"><span class="cd-tree-mark"></span><div><b>${esc(cluster.name)}</b><small>${esc(cluster.group || '—')}</small></div></div>
      <span class="cd-cluster-vdc">${esc((site?.code || '').toLowerCase())}</span>
      <div class="cd-cluster-type"><span class="cd-cluster-type-main">${esc(cluster.type)}</span><span class="cd-cluster-type-sub">${esc(cluster.business || '—')}</span></div>
      <div>${stateChip}</div>
      <div class="cd-cluster-stage">
        <div class="cd-cluster-stage-name">${esc(stageName)}</div>
        <div class="cd-steps">${D.stages.map((_, i) => {
          const done = i < completed;
          const current = i === completed && cluster.state !== 'past';
          return `<span class="cd-step${done ? ' done' : current ? ' current' : ''}">${done ? '✓' : i + 1}</span>`;
        }).join('')}</div>
        <div class="cd-cluster-stage-meta">${completed}/${D.stages.length} 环节完成</div>
      </div>
      <div class="cd-cluster-time"><span class="cd-cluster-time-row">启动 ${esc(cluster.start)}</span><span class="cd-cluster-time-row">${timeLabel} ${esc(cluster.end)}</span></div>
      <div class="cd-cluster-owner">${esc(cluster.owner)}</div>
      <div class="cd-cluster-sla">${slaHTML}</div>
      ${blockHTML}
    </div>`;
  }

  function renderPipeline() {
    const clusters = visibleClusters().slice().sort((a, b) => {
      const rank = (c) => (c.state === 'present' ? 0 : c.state === 'past' ? 1 : 2);
      return rank(a) - rank(b) || day(a.start) - day(b.start);
    });
    if (!clusters.length) {
      document.querySelector('#cd-pipeline').innerHTML = emptyStateHTML({ icon: 'list_alt', text: '当前筛选下没有集群', tone: 'muted', pad: '26px' });
      return;
    }
    const head = `<div class="cd-cluster-row cd-cluster-head">
      <span>集群 / 集群组</span><span>VDC</span><span>类型 / 业务</span><span>时间阶段</span><span>集群建设阶段</span><span>建设时间</span><span>负责人</span><span>耗时 / SLA</span><span>阻塞 / 下一步</span>
    </div>`;
    document.querySelector('#cd-pipeline').innerHTML = `<div class="cd-cluster-scroll"><div class="cd-cluster-table">${head}${clusters.map(pipelineRow).join('')}</div></div>`;
  }

  /* ---------------- 抽屉 ---------------- */
  function ensureDrawer() {
    if (document.querySelector('#cd-drawer')) return;
    const backdrop = document.createElement('div');
    backdrop.className = 'cd-drawer-backdrop';
    backdrop.id = 'cd-drawer-backdrop';
    backdrop.addEventListener('click', closeDrawer);
    const drawer = document.createElement('aside');
    drawer.className = 'cd-drawer';
    drawer.id = 'cd-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'cd-drawer-title');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = `<div class="cd-drawer-head"><div class="cd-drawer-title"><b id="cd-drawer-title"></b><span id="cd-drawer-sub"></span></div><button type="button" class="btn btn-ghost btn-sm" data-cd-close aria-label="关闭详情"><span class="mat mat-sm">close</span></button></div><div class="cd-drawer-body" id="cd-drawer-body"></div><div class="cd-sub-drawer-backdrop" id="cd-sub-drawer-backdrop"></div><div class="cd-sub-drawer" id="cd-sub-drawer" aria-hidden="true"><div class="cd-sub-drawer-head"><div class="cd-sub-drawer-title"><b id="cd-sub-drawer-title"></b><span id="cd-sub-drawer-sub"></span></div><button type="button" class="btn btn-ghost btn-sm" data-cd-sub-close aria-label="关闭子项编辑"><span class="mat mat-sm">close</span></button></div><div class="cd-sub-drawer-body" id="cd-sub-drawer-body"></div></div>`;
    drawer.querySelector('[data-cd-close]').addEventListener('click', closeDrawer);
    drawer.querySelector('#cd-sub-drawer-backdrop').addEventListener('click', closeSubEditor);
    drawer.addEventListener('click', (event) => {
      const toastTarget = event.target.closest('[data-cd-toast]');
      if (toastTarget) { event.preventDefault(); toast(toastTarget.dataset.cdToast); return; }
      const stageEdit = event.target.closest('[data-cd-stage-edit]');
      if (stageEdit) { event.preventDefault(); toggleStageEdit(Number(stageEdit.dataset.cdStageEdit)); return; }
      const cancelBtn = event.target.closest('[data-cd-stage-editor-cancel]');
      if (cancelBtn) { event.preventDefault(); hideAllStageEditors(); return; }
      const saveBtn = event.target.closest('[data-cd-stage-editor-save]');
      if (saveBtn) { event.preventDefault(); saveStageEdit(saveBtn); return; }
      const subEdit = event.target.closest('[data-cd-sub-edit]');
      if (subEdit) { event.preventDefault(); const [si, subi] = subEdit.dataset.cdSubEdit.split(':').map(Number); openSubEditor(si, subi); return; }
      if (event.target.closest('[data-cd-sub-close], [data-cd-sub-cancel]')) { event.preventDefault(); closeSubEditor(); return; }
      const subSave = event.target.closest('[data-cd-sub-save]');
      if (subSave) { event.preventDefault(); saveSubEditor(subSave); return; }
      const nextBtn = event.target.closest('[data-cd-next]');
      if (nextBtn) { event.preventDefault(); openCurrentStageEdit(); return; }
      const target = event.target.closest('[data-cluster]');
      if (target) openCluster(target.dataset.cluster);
    });
    document.body.append(backdrop, drawer);
  }

  function openDrawer() {
    const drawer = document.querySelector('#cd-drawer');
    const backdrop = document.querySelector('#cd-drawer-backdrop');
    drawer.classList.add('open');
    backdrop.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cd-drawer-open');
    ['#main', '#app-sidebar', '.app-header'].forEach((selector) => {
      const element = document.querySelector(selector);
      if (element) element.inert = true;
    });
    drawer.querySelector('[data-cd-close]').focus({ preventScroll: true });
  }

  function closeDrawer() {
    const drawer = document.querySelector('#cd-drawer');
    if (!drawer) return;
    drawer.classList.remove('open');
    document.querySelector('#cd-drawer-backdrop').classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cd-drawer-open');
    ['#main', '#app-sidebar', '.app-header'].forEach((selector) => {
      const element = document.querySelector(selector);
      if (element) element.inert = false;
    });
    currentDrawer = null;
  }

  function stageSchedule(cluster) {
    let cursor = day(cluster.start);
    return D.stages.map((stage, index) => {
      const planDays = cluster.stagePlan[index] || stage.baseline;
      const planStart = iso(cursor);
      const planEnd = iso(cursor + planDays * DAY);
      let status, actualDays;
      if (cluster.state === 'future') { status = 'todo'; actualDays = null; }
      else if (cluster.state === 'past') {
        status = 'done';
        actualDays = Math.max(1, Math.round(planDays));
      } else {
        status = index < cluster.stageIndex ? 'done' : index === cluster.stageIndex ? 'doing' : 'todo';
        actualDays = status === 'done' ? planDays + (cluster.slip?.[index] || 0) : status === 'doing' ? cluster.stageDays : null;
      }
      cursor += planDays * DAY;
      return { ...stage, planStart, planEnd, status, planDays, actualDays, over: actualDays !== null && actualDays > planDays };
    });
  }

  function subStatus(cluster, stageIndex, subIndex) {
    if (cluster.state === 'past') return 'done';
    if (cluster.state === 'future') return 'todo';
    if (cluster.subDone?.[`${stageIndex}-${subIndex}`]) return 'done';
    if (stageIndex < cluster.stageIndex) return 'done';
    if (stageIndex > cluster.stageIndex) return 'todo';
    const current = cluster.subIndex || 0;
    if (subIndex < current) return 'done';
    if (subIndex === current) return 'doing';
    return 'todo';
  }

  function subItemHTML(sub, status, stageIndex, subIndex) {
    const tags = sub.detail ? `<span class="cd-sub-tags">${sub.detail.map((item) => `<span>${esc(item)}</span>`).join('')}</span>` : '';
    const name = sub.link
      ? `<span class="cd-sub-link-label">${esc(sub.name)}</span><span class="mat mat-tiny">open_in_new</span>`
      : esc(sub.name);
    return `<button type="button" class="cd-sub-item ${status}" data-cd-sub-edit="${stageIndex}:${subIndex}"><span class="cd-sub-dot"></span><span class="cd-sub-label">${name}${tags}</span><span class="mat cd-sub-chevron">chevron_right</span></button>`;
  }

  function stageAccordion(cluster) {
    return stageSchedule(cluster).map((stage, index) => {
      const isCurrent = index === cluster.stageIndex && cluster.state !== 'past' && cluster.state !== 'future';
      const isDone = index < cluster.stageIndex || cluster.state === 'past';
      const status = cluster.state === 'future' ? 'todo' : isDone ? 'done' : isCurrent ? 'doing' : 'todo';
      const chip = isDone
        ? '<span class="chip chip-ok">已完成</span>'
        : isCurrent
          ? `<span class="chip ${cluster.risk?.level === 'err' ? 'chip-err' : 'chip-info'}">进行中</span>`
          : '<span class="cd-muted">待开始</span>';
      const subCount = stage.subItems.length;
      const doneCount = stage.subItems.filter((_, i) => cluster.state === 'past' || cluster.subDone?.[`${index}-${i}`] || index < cluster.stageIndex || (index === cluster.stageIndex && i < (cluster.subIndex || 0))).length;
      let meta;
      if (isDone) meta = `${subCount}/${subCount} 项完成 · <span class="${stage.over ? 'cd-over' : ''}">实际 ${stage.actualDays} 天</span> · 基线 ${stage.planDays} 天`;
      else if (isCurrent) meta = `${doneCount}/${subCount} 项完成 · <span class="${cluster.stageDays > stage.planDays ? 'cd-over' : ''}">已停留 ${cluster.stageDays} 天</span> · 基线 ${stage.planDays} 天`;
      else meta = `${subCount} 项 · 计划 ${fmtMD(stage.planStart)}–${fmtMD(stage.planEnd)}`;
      const subs = stage.subItems.map((sub, subIndex) => subItemHTML(sub, subStatus(cluster, index, subIndex), index, subIndex)).join('');
      const canEdit = cluster.state !== 'past';
      return `<details class="cd-stage-acc"${isCurrent ? ' open' : ''}>
        <summary>
          <span class="cd-stage-acc-dot ${status}"></span>
          <span class="cd-stage-acc-sum">
            <span class="cd-stage-acc-name">${String(index + 1).padStart(2, '0')} ${esc(stage.name)} ${chip}</span>
            <span class="cd-stage-acc-meta">${meta}</span>
          </span>
          <span class="mat cd-stage-acc-chevron">expand_more</span>
          ${canEdit ? `<button type="button" class="cd-stage-edit-btn" data-cd-stage-edit="${index}" title="编辑阶段"><span class="mat mat-sm">edit</span></button>` : ''}
        </summary>
        <div class="cd-stage-acc-body">
          <p class="cd-stage-desc-inline">${esc(stage.desc)}</p>
          <div class="cd-sub-list">${subs}</div>
          ${canEdit ? stageEditorPanel(index, status, isDone, isCurrent) : ''}
        </div>
      </details>`;
    }).join('');
  }

  function stageEditorPanel(idx, status, isDone, isCurrent) {
    const selTodo = status === 'todo' && !isDone ? ' selected' : '';
    const selDoing = (isCurrent && !isDone) ? ' selected' : '';
    const selDone = isDone ? ' selected' : '';
    return `<div class="cd-stage-edit-panel" data-cd-stage-edit-panel="${idx}" hidden>
      <div class="cd-stage-edit-form">
        <label class="cd-form-field cd-form-field--inline"><span>阶段状态</span>
          <select data-cd-stage-editor-status>
            <option value="todo"${selTodo}>待开始</option>
            <option value="doing"${selDoing}${isDone ? ' disabled' : ''}>进行中</option>
            <option value="done"${selDone}>已完成</option>
          </select>
        </label>
        <div class="cd-stage-edit-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-cd-stage-editor-cancel>取消</button>
          <button type="button" class="btn btn-primary btn-sm" data-cd-stage-editor-save="${idx}">保存</button>
        </div>
      </div>
    </div>`;
  }

  function toggleStageEdit(idx) {
    hideAllStageEditors();
    const panel = document.querySelector(`[data-cd-stage-edit-panel="${idx}"]`);
    if (panel) panel.hidden = false;
  }
  function hideAllStageEditors() {
    document.querySelectorAll('.cd-stage-edit-panel').forEach((p) => { p.hidden = true; });
  }
  function refreshClusterDrawer(cluster) {
    const site = siteById(cluster.siteId);
    document.querySelector('#cd-drawer-body').innerHTML = clusterDrawer(cluster);
    document.querySelector('#cd-drawer-title').textContent = cluster.name;
    document.querySelector('#cd-drawer-sub').textContent = `${site?.name || ''} · ${STATE_LABEL[cluster.state]} · ${ORIGIN_LABEL[cluster.origin]}`;
    render();
  }
  function resetStageSubs(cluster, stageIndex) {
    if (!cluster.subDone) return;
    Object.keys(cluster.subDone).forEach((key) => {
      if (key.startsWith(`${stageIndex}-`)) delete cluster.subDone[key];
    });
  }
  function saveStageEdit(btn) {
    const cluster = clusterById(currentDrawer.id);
    if (!cluster) return;
    const panel = btn.closest('.cd-stage-edit-panel');
    const si = Number(btn.dataset.cdStageEditorSave);
    const status = panel.querySelector('[data-cd-stage-editor-status]').value;
    if (status === 'done' && si >= cluster.stageIndex) {
      cluster.stageIndex = si + 1;
      cluster.subIndex = 0;
      cluster.stageDays = 0;
      if (cluster.stageIndex >= D.stages.length) { cluster.state = 'past'; cluster.end = D.asOf; }
    } else if (status === 'doing') {
      cluster.stageIndex = si;
      cluster.subIndex = 0;
      cluster.stageDays = 1;
      cluster.state = 'present';
      resetStageSubs(cluster, si);
    } else {
      cluster.stageIndex = si;
      cluster.subIndex = 0;
      cluster.stageDays = 0;
      cluster.state = 'present';
      resetStageSubs(cluster, si);
    }
    cluster.next = `推进「${D.stages[Math.min(cluster.stageIndex, D.stages.length - 1)].name}」及子项`;
    persistCluster(cluster);
    refreshClusterDrawer(cluster);
    toast(`阶段已更新为 ${status === 'done' ? '已完成' : status === 'doing' ? '进行中' : '待开始'}`);
  }
  function benchmarkClusters(excludeId) {
    return allClusters()
      .filter((c) => c.id !== excludeId && (c.state === 'past' || c.state === 'present'))
      .slice(0, 8);
  }
  function subFieldHTML(field, saved) {
    if (field.type === 'select') {
      return `<label class="cd-form-field"><span>${esc(field.label)}</span><select name="${field.key}">${field.options.map((opt) => `<option value="${esc(opt)}"${saved[field.key] === opt ? ' selected' : ''}>${esc(opt)}</option>`).join('')}</select></label>`;
    }
    if (field.type === 'textarea') {
      return `<label class="cd-form-field full"><span>${esc(field.label)}</span><textarea name="${field.key}" rows="3" placeholder="${esc(field.placeholder || '')}">${esc(saved[field.key] || '')}</textarea></label>`;
    }
    return `<label class="cd-form-field"><span>${esc(field.label)}</span><input name="${field.key}" type="text" value="${esc(saved[field.key] ?? field.value ?? '')}" placeholder="${esc(field.placeholder || '')}" /></label>`;
  }
  function subEditorHTML(cluster, stageIndex, subIndex) {
    const stage = D.stages[stageIndex];
    const sub = stage.subItems[subIndex];
    const saved = cluster.subItemData?.[`${stageIndex}-${subIndex}`] || {};
    const benchmarks = benchmarkClusters(cluster.id).map((c) => c.name);
    let fields;
    if (sub.key === 'scene') {
      fields = [
        { key: 'scenario', label: '业务场景', type: 'select', options: ['训练', '推理', '通用 / 微服务', '弹性池'] },
        { key: 'group', label: '集群组', type: 'text', value: cluster.group || '' },
        { key: 'projectType', label: 'project 类型', type: 'select', options: ['TCE', 'Seed', 'Infer', 'Core', 'Pool'] },
        { key: 'direction', label: '训练 / 推理方向', type: 'select', options: ['训练', '推理', '混合'] },
        { key: 'benchmark', label: 'copy 标杆集群', type: 'select', options: ['（不 copy）', ...benchmarks] },
        { key: 'nodelevel', label: 'nodelevel', type: 'text', placeholder: '如 nodelevel-32' },
      ];
    } else if (sub.key === 'copy') {
      fields = [{ key: 'benchmark', label: 'copy 标杆集群', type: 'select', options: ['（不 copy）', ...benchmarks] }];
    } else if (sub.key === 'nodelevel') {
      fields = [{ key: 'nodelevel', label: 'nodelevel', type: 'text', placeholder: '如 nodelevel-32' }];
    } else {
      fields = [{ key: 'note', label: '完成说明', type: 'textarea', placeholder: '填写本子项的完成情况...' }];
    }
    return `<div class="cd-sub-editor">
      <p class="cd-sub-editor-desc">${esc(stage.desc)}</p>
      <div class="cd-form-grid">${fields.map((f) => subFieldHTML(f, saved)).join('')}</div>
      <div class="cd-sub-editor-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-cd-sub-cancel>取消</button>
        <button type="button" class="btn btn-primary btn-sm" data-cd-sub-save="${stageIndex}:${subIndex}">标记完成</button>
      </div>
    </div>`;
  }
  function openSubEditor(stageIndex, subIndex) {
    const cluster = clusterById(currentDrawer.id);
    if (!cluster) return;
    if (cluster.state === 'past') { toast('已交付集群的子项已全部完成'); return; }
    if (stageIndex < cluster.stageIndex) { toast('该阶段已完成'); return; }
    const stage = D.stages[stageIndex];
    const sub = stage.subItems[subIndex];
    document.querySelector('#cd-sub-drawer-title').textContent = `${String(stageIndex + 1).padStart(2, '0')} ${stage.name}`;
    document.querySelector('#cd-sub-drawer-sub').textContent = sub.name;
    document.querySelector('#cd-sub-drawer-body').innerHTML = subEditorHTML(cluster, stageIndex, subIndex);
    document.querySelector('#cd-sub-drawer').classList.add('open');
    document.querySelector('#cd-sub-drawer').setAttribute('aria-hidden', 'false');
    document.querySelector('#cd-sub-drawer-backdrop').classList.add('open');
    window.setTimeout(() => document.querySelector('#cd-sub-drawer-body input, #cd-sub-drawer-body select, #cd-sub-drawer-body textarea')?.focus({ preventScroll: true }), 120);
  }
  function closeSubEditor() {
    const drawer = document.querySelector('#cd-sub-drawer');
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.querySelector('#cd-sub-drawer-backdrop')?.classList.remove('open');
  }
  function saveSubEditor(btn) {
    const cluster = clusterById(currentDrawer.id);
    if (!cluster) return;
    const [stageIndex, subIndex] = btn.dataset.cdSubSave.split(':').map(Number);
    const stage = D.stages[stageIndex];
    const sub = stage.subItems[subIndex];
    const form = btn.closest('.cd-sub-editor');
    const data = {};
    form.querySelectorAll('input, select, textarea').forEach((field) => { data[field.name] = field.value.trim(); });
    cluster.subItemData = cluster.subItemData || {};
    cluster.subItemData[`${stageIndex}-${subIndex}`] = data;
    cluster.subDone = cluster.subDone || {};
    cluster.subDone[`${stageIndex}-${subIndex}`] = true;
    if (cluster.state === 'future') { cluster.state = 'present'; cluster.stageDays = 0; }
    const allDone = stage.subItems.every((_, i) => cluster.subDone[`${stageIndex}-${i}`]);
    if (allDone && stageIndex === cluster.stageIndex) {
      cluster.stageIndex = stageIndex + 1;
      cluster.subIndex = 0;
      cluster.stageDays = 0;
      if (cluster.stageIndex >= D.stages.length) { cluster.state = 'past'; cluster.end = D.asOf; }
    } else if (stageIndex === cluster.stageIndex) {
      const next = stage.subItems.findIndex((_, i) => !cluster.subDone[`${stageIndex}-${i}`]);
      cluster.subIndex = next === -1 ? stage.subItems.length : next;
    }
    cluster.next = `推进「${D.stages[Math.min(cluster.stageIndex, D.stages.length - 1)].name}」及子项`;
    persistCluster(cluster);
    closeSubEditor();
    refreshClusterDrawer(cluster);
    toast(`已标记「${sub.name}」为完成`);
  }
  function openCurrentStageEdit() {
    const cluster = clusterById(currentDrawer.id);
    if (!cluster || cluster.state === 'past') return;
    toggleStageEdit(cluster.stageIndex);
  }

  function clusterDrawer(cluster) {
    const site = siteById(cluster.siteId);
    const stageIndex = Math.min(cluster.stageIndex, D.stages.length - 1);
    const stage = D.stages[stageIndex];
    const isPast = cluster.state === 'past';
    const isFuture = cluster.state === 'future';
    const planDays = daysBetween(cluster.start, cluster.end);
    const elapsed = isPast ? daysBetween(cluster.start, cluster.end) : isFuture ? null : daysBetween(cluster.start, D.asOf);
    const sla = cluster.slaDays || SLA_DAYS;
    const stageOver = (!isPast && !isFuture) ? (cluster.stageDays - cluster.stagePlan[stageIndex]) : 0;
    const risk = cluster.risk
      ? `<span class="chip ${cluster.risk.level === 'err' ? 'chip-err' : 'chip-warn'}">${cluster.risk.level === 'err' ? '阻塞' : '依赖预警'}</span>`
      : '';
    const stateChip = isPast
      ? '<span class="chip chip-ok">已交付</span>'
      : isFuture
        ? '<span class="chip chip-neutral">规划中</span>'
        : '<span class="chip chip-info">建设中</span>';
    const stageLabel = isPast ? '6/6 已完成' : isFuture ? '未启动 · 确认需求' : `${cluster.stageIndex + 1}/${D.stages.length} · ${stage.name}`;
    const stageSub = isPast ? '六阶段全部完成' : isFuture ? '等待确认需求' : `子项 ${(cluster.subIndex || 0) + 1}/${stage.subItems.length} · ${esc(stage.subItems[cluster.subIndex || 0]?.name || '')}`;
    const originNote = cluster.origin === 'new-first'
      ? `<div class="cd-origin-note new-first"><span class="mat">domain</span><div><b>新机房首批建设</b><p>与机房电力、网络、验收里程碑并行推进前置阶段；上线交付以机房验收为前置。</p></div></div>`
      : `<div class="cd-origin-note existing-add"><span class="mat">dns</span><div><b>存量机房扩容</b><p>不进入机房建设阶段，复用现有电力、网络与运维体系，独立排期交付。</p></div></div>`;
    const siblings = cluster.batchId
      ? allClusters().filter((item) => item.batchId === cluster.batchId && item.id !== cluster.id)
      : [];
    const noteSection = cluster.note
      ? `<section><h3>需求说明</h3><p class="cd-dep-note">${esc(cluster.note)}</p></section>`
      : '';
    return `<div class="cd-drawer-badges">${stateChip}<span class="chip ${cluster.origin === 'new-first' ? 'chip-violet' : 'chip-neutral'}">${ORIGIN_LABEL[cluster.origin]}</span>${risk ? ` ${risk}` : ''}</div>
      ${originNote}
      <div class="cd-drawer-grid">
        <div class="cd-drawer-cell"><label>${isPast ? '交付结果' : isFuture ? '计划启动' : '当前阶段'}</label><b>${stageLabel}</b><small>${stageSub}</small></div>
        <div class="cd-drawer-cell"><label>负责人</label><b>${esc(cluster.owner)}</b></div>
        <div class="cd-drawer-cell"><label>${isPast ? '实际耗时' : isFuture ? '计划窗口' : '已耗时 / 计划'}</label><b>${isFuture ? `${planDays} 天` : `${elapsed} / ${planDays} 天`}</b><small>SLA ${sla} 天${elapsed !== null && elapsed > sla ? ` · 超 ${elapsed - sla} 天` : ''}</small></div>
        <div class="cd-drawer-cell"><label>${isPast ? '交付日期' : '目标交付'}</label><b>${fmtDate(cluster.end)}</b></div>
      </div>
      ${cluster.risk ? `<div class="cd-callout cd-callout--${cluster.risk.level}"><span class="mat">${cluster.risk.level === 'err' ? 'error' : 'warning'}</span><div><b>${esc(cluster.risk.short)}</b><p>${esc(cluster.risk.text)}</p></div></div>` : ''}
      <section><h3>阶段与子项${stageOver > 0 ? ` · 当前阶段超基线 ${stageOver} 天` : ''}</h3><div class="cd-stage-list">${stageAccordion(cluster)}</div><div class="cd-stage-current" data-cd-next><span class="mat">arrow_forward</span><b>${isPast ? '交付结果：' : '下一步：'}</b>${esc(cluster.next)}</div></section>
      ${noteSection}
      ${siblings.length ? `<section><h3>同批集群</h3><div class="cd-batch-members">${siblings.map((item) => `<button type="button" class="cd-batch-member" data-cluster="${esc(item.id)}"><b>${esc(item.name)}</b><small>${D.stages[Math.min(item.stageIndex, D.stages.length - 1)].name} · ${esc(item.owner)}</small></button>`).join('')}</div></section>` : ''}
      <p class="rb-data-note">示例数据：阶段时长、子项进度、负责人、风险与日期用于演示，不代表实时交付状态。</p>`;
  }

  function openCluster(id) {
    const cluster = clusterById(id);
    if (!cluster) return;
    ensureDrawer();
    const site = siteById(cluster.siteId);
    const drawer = document.querySelector('#cd-drawer');
    document.querySelector('#cd-drawer-title').textContent = cluster.name;
    document.querySelector('#cd-drawer-sub').textContent = `${site?.name || ''} · ${STATE_LABEL[cluster.state]} · ${ORIGIN_LABEL[cluster.origin]}`;
    document.querySelector('#cd-drawer-body').innerHTML = clusterDrawer(cluster);
    currentDrawer = { type: 'cluster', id };
    if (!drawer.classList.contains('open')) openDrawer();
  }

  /* ---------------- 登记集群建设需求 ---------------- */
  function registerFormHTML() {
    const sites = D.sites;
    const siteOptions = sites.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} · ${esc(s.code)} · ${s.kind === 'new' ? '新机房' : '存量机房'}</option>`).join('');
    const defaultSite = sites.find((s) => s.kind === 'new')?.id || sites[0]?.id || '';
    const defaultEnd = iso(day(D.asOf) + 90 * DAY);
    return `<form class="cd-form" id="cd-register-form" novalidate>
      <div class="cd-form-grid">
        <label class="cd-form-field"><span>机房</span><select name="siteId" required>${siteOptions}</select></label>
        <label class="cd-form-field"><span>集群名称</span><input name="name" required placeholder="如 core-wlby-01" autocomplete="off" /></label>
        <label class="cd-form-field"><span>集群组</span><input name="group" placeholder="如 Core" value="Core" /></label>
        <label class="cd-form-field"><span>业务线</span><input name="business" placeholder="如 TCE" value="TCE" /></label>
        <label class="cd-form-field"><span>类型</span><select name="type" required><option>训练</option><option>推理</option><option>通用 / 微服务</option><option>弹性池</option></select></label>
        <label class="cd-form-field"><span>交付来源</span><select name="origin" required><option value="new-first">新机房首批</option><option value="existing-add">存量机房扩容</option></select></label>
        <label class="cd-form-field"><span>计划启动</span><input type="date" name="start" required value="${D.asOf}" min="${D.rangeStart}" max="${D.rangeEnd}" /></label>
        <label class="cd-form-field"><span>目标交付</span><input type="date" name="end" required value="${defaultEnd}" min="${D.rangeStart}" max="${D.rangeEnd}" /></label>
        <label class="cd-form-field"><span>负责人</span><input name="owner" placeholder="负责人姓名" value="杨明磊" /></label>
        <label class="cd-form-field"><span>SLA 天数</span><input type="number" name="slaDays" value="${SLA_DAYS}" min="1" max="180" /></label>
      </div>
      <label class="cd-form-field full"><span>需求说明（选填）</span><textarea name="note" placeholder="补充业务场景、依赖说明、机房要求等" rows="2"></textarea></label>
      <div class="cd-form-error" hidden></div>
      <div class="cd-form-hint">提交后即时同步到供给时间轴与集群清单；登记数据仅保存在当前浏览器会话，刷新后恢复示例数据。</div>
      <div class="cd-form-actions">
        <button type="button" class="btn btn-ghost btn-sm" data-cd-cancel>取消</button>
        <button type="submit" class="btn btn-primary btn-sm"><span class="mat mat-sm">add</span>提交登记</button>
      </div>
    </form>`;
  }

  function submitRegister(form) {
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const siteId = String(data.get('siteId') || '');
    const type = String(data.get('type') || '训练');
    const origin = String(data.get('origin') || 'existing-add');
    const start = String(data.get('start') || '');
    const end = String(data.get('end') || '');
    const owner = String(data.get('owner') || '').trim();
    const group = String(data.get('group') || '').trim() || 'Core';
    const business = String(data.get('business') || '').trim() || type;
    const slaDays = Math.max(1, Number(data.get('slaDays')) || SLA_DAYS);
    const note = String(data.get('note') || '').trim();
    const error = form.querySelector('.cd-form-error');
    const fail = (message) => { error.textContent = message; error.hidden = false; };
    if (!name) return fail('请填写集群名称');
    if (allClusters().some((c) => c.name === name)) return fail(`集群名称「${name}」已存在`);
    if (!siteId || !siteById(siteId)) return fail('请选择机房');
    if (!start || !end) return fail('请填写计划启动与目标交付日期');
    if (day(end) <= day(start)) return fail('目标交付日期需晚于计划启动日期');
    error.hidden = true;
    const cluster = {
      id: `req-${Date.now()}`, name, group, business, siteId, batchId: null,
      type, owner: owner || '杨明磊', origin,
      state: 'future', start, planEnd: end, end,
      stageIndex: 0, stageDays: 0, subIndex: 0, subDone: {}, subItemData: {},
      stagePlan: D.stages.map((s) => s.baseline),
      slaDays, risk: null, next: '推进「确认需求」及子项', note,
      isNew: true, synthetic: false,
    };
    D.clusters.push(cluster);
    closeDrawer();
    render();
    window.setTimeout(() => {
      const orig = D.clusters.find((item) => item.id === cluster.id);
      if (orig) orig.isNew = false;
    }, 2600);
    toast(`已登记「${name}」，同步到供给时间轴与集群清单`);
  }

  function openRegister() {
    ensureDrawer();
    const drawer = document.querySelector('#cd-drawer');
    document.querySelector('#cd-drawer-title').textContent = '登记集群建设需求';
    document.querySelector('#cd-drawer-sub').textContent = '提交后即时同步到供给时间轴与集群清单';
    document.querySelector('#cd-drawer-body').innerHTML = registerFormHTML();
    currentDrawer = { type: 'register' };
    if (!drawer.classList.contains('open')) {
      document.querySelector('#cd-drawer-backdrop').classList.add('open');
      drawer.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('cd-drawer-open');
      ['#main', '#app-sidebar', '.app-header'].forEach((selector) => {
        const element = document.querySelector(selector);
        if (element) element.inert = true;
      });
    }
    const form = document.querySelector('#cd-register-form');
    form.addEventListener('submit', (event) => { event.preventDefault(); submitRegister(form); });
    form.querySelector('[data-cd-cancel]').addEventListener('click', closeDrawer);
    const siteSelect = form.querySelector('[name="siteId"]');
    const originSelect = form.querySelector('[name="origin"]');
    const typeSelect = form.querySelector('[name="type"]');
    const businessInput = form.querySelector('[name="business"]');
    siteSelect.value = D.sites.find((s) => s.kind === 'new')?.id || D.sites[0]?.id || '';
    originSelect.value = siteById(siteSelect.value)?.kind === 'new' ? 'new-first' : 'existing-add';
    siteSelect.addEventListener('change', () => {
      const site = siteById(siteSelect.value);
      originSelect.value = site?.kind === 'new' ? 'new-first' : 'existing-add';
    });
    const businessDefaults = { '训练': 'Seed', '推理': 'Infer', '通用 / 微服务': 'TCE', '弹性池': 'Pool' };
    typeSelect.addEventListener('change', () => { businessInput.value = businessDefaults[typeSelect.value] || ''; });
    drawer.querySelector('[data-cd-close]').focus({ preventScroll: true });
    requestAnimationFrame(() => form.querySelector('input')?.focus({ preventScroll: true }));
  }

  /* ---------------- 导出 ---------------- */
  function toast(message) {
    let element = document.querySelector('#cd-toast');
    if (!element) {
      element = document.createElement('div');
      element.id = 'cd-toast';
      element.className = 'cd-toast';
      element.setAttribute('role', 'status');
      document.body.append(element);
    }
    element.textContent = message;
    requestAnimationFrame(() => element.classList.add('show'));
    clearTimeout(element._timer);
    element._timer = setTimeout(() => element.classList.remove('show'), 2600);
  }

  function exportCsv() {
    const rows = [['集群', '集群组', 'VDC', '类型', '业务', '时间阶段', '建设阶段', '启动', '目标/交付', '负责人', '耗时', 'SLA', '阻塞/下一步', '交付来源']];
    visibleClusters().forEach((cluster) => {
      const site = siteById(cluster.siteId);
      const stageName = cluster.state === 'past' ? '已完成' : D.stages[Math.min(cluster.stageIndex, D.stages.length - 1)].name;
      const elapsed = cluster.state === 'past' ? daysBetween(cluster.start, cluster.end) : cluster.state === 'present' ? daysBetween(cluster.start, D.asOf) : '';
      rows.push([
        cluster.name, cluster.group, site?.code || '', cluster.type, cluster.business,
        STATE_LABEL[cluster.state], `${cluster.state === 'past' ? D.stages.length : cluster.stageIndex}/${D.stages.length} ${stageName}`,
        cluster.start, cluster.end, cluster.owner, elapsed, cluster.slaDays || SLA_DAYS,
        cluster.risk ? cluster.risk.text : cluster.next, ORIGIN_LABEL[cluster.origin],
      ]);
    });
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `集群交付清单_${D.asOf}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`已导出 ${rows.length - 1} 个集群`);
  }

  /* ---------------- 页面与事件 ---------------- */
  function filterHTML() {
    return `<div class="filterbar cd-filterbar">
      <label class="selwrap"><span class="flab">区域</span><select class="filt" data-cd-filter="area" aria-label="区域"><option value="">全部区域</option><option value="cn">中国</option><option value="overseas">非中</option></select></label>
      <label class="selwrap"><span class="flab">机房</span><select class="filt" data-cd-filter="kind" aria-label="机房类型"><option value="">全部机房</option><option value="new">新机房</option><option value="existing">存量机房</option></select></label>
      <label class="selwrap"><span class="flab">类型</span><select class="filt" data-cd-filter="type" aria-label="集群类型"><option value="">全部类型</option><option>训练</option><option>推理</option><option>通用</option><option>微服务</option><option>弹性池</option></select></label>
      <label class="rb-search cd-search"><span class="mat mat-sm">search</span><input id="cd-search" type="search" placeholder="搜索机房 / 集群 / 负责人" aria-label="搜索机房、集群或负责人" autocomplete="off" /></label>
      <button type="button" class="btn btn-ghost btn-sm" data-cd-reset>重置</button>
      <span class="cd-filter-scope">数据截至 ${D.asOf}</span>
    </div>`;
  }

  function render() {
    renderKpis();
    renderTimeline();
    renderPipeline();
  }

  function bindEvents() {
    const main = document.querySelector('#main');
    main.addEventListener('click', (event) => {
      const toastTarget = event.target.closest('[data-cd-toast]');
      if (toastTarget) { event.preventDefault(); toast(toastTarget.dataset.cdToast); return; }
      const source = event.target.closest('[data-cd-source]');
      if (source) {
        state.source = source.dataset.cdSource;
        render();
        document.querySelector(`[data-cd-source="${state.source}"]`)?.focus({ preventScroll: true });
        return;
      }
      if (event.target.closest('[data-cd-expand]')) {
        state.expanded = !state.expanded;
        renderTimeline();
        return;
      }
      const clusterTarget = event.target.closest('[data-cluster]');
      if (clusterTarget) { openCluster(clusterTarget.dataset.cluster); return; }
      if (event.target.closest('[data-cd-register]')) { openRegister(); return; }
      if (event.target.closest('[data-cd-reset]')) {
        Object.assign(state, { area: '', kind: '', type: '', source: 'all', query: '' });
        main.querySelectorAll('[data-cd-filter]').forEach((select) => { select.value = ''; });
        const search = document.querySelector('#cd-search');
        if (search) search.value = '';
        render();
        return;
      }
      if (event.target.closest('[data-cd-export]')) exportCsv();
    });
    main.addEventListener('change', (event) => {
      const select = event.target.closest('[data-cd-filter]');
      if (!select) return;
      state[select.dataset.cdFilter] = select.value;
      render();
    });
    main.addEventListener('input', (event) => {
      if (event.target.id !== 'cd-search') return;
      state.query = event.target.value;
      render();
    });
    main.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const row = event.target.closest('.cd-cluster-row[role="button"]');
      if (!row) return;
      event.preventDefault();
      openCluster(row.dataset.cluster);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const subDrawer = document.querySelector('#cd-sub-drawer.open');
      if (subDrawer) { event.preventDefault(); closeSubEditor(); return; }
      const drawer = document.querySelector('#cd-drawer.open');
      if (drawer) { event.preventDefault(); closeDrawer(); }
    });
  }

  function mount() {
    const shell = computePageShell({
      view: 'cluster-delivery',
      group: '交付与准入',
      title: '集群交付',
      description: '登记集群建设需求、补充 SRE 建设方案，按六个阶段人工推进搭建与交付。',
      showDataStatus: true,
      dataStatus: '示例数据',
      tools: '<button type="button" class="btn btn-primary btn-sm" data-cd-register><span class="mat mat-sm">add</span>登记集群建设需求</button><button type="button" class="btn btn-ghost btn-sm" data-cd-export><span class="mat mat-sm">download</span>导出清单</button>',
      guidance: {
        purpose: '回答两件事：各机房 / 各状态下建了多少集群，每个集群在六阶段中走到哪一步、谁负责、耗时与 SLA。登记的新集群即时同步到时间轴与清单。',
        focus: '每个时间轴条带就是一个集群，与清单行同源，点击均可打开同一个集群详情。详情中区分新机房首批建设与存量机房扩容：前者与机房里程碑并行推进前置阶段，上线交付依赖机房验收；后者不进入机房建设流程，复用现有体系独立排期。在建集群按「确认需求 → 资源准备 + 机器重装 → BKE 创建 → 人工补齐 → 交付前检查 → 后置通知」六阶段推进，每阶段再拆子项。',
        readingPath: [
          '先看供给时间轴：每行一个机房，三条泳道分别是已交付 / 在建 / 规划；一个条带就是一个集群，长度即建设窗口，颜色和标记给出进度与风险。',
          '新机房行的琥珀色虚线是机房验收节点；点击条带或下方清单行，都会打开同一个集群详情，详情顶部明确区分新机房首批与存量机房扩容。',
          '集群清单按集群列出：集群名称与集群组、VDC、类型 / 业务、六阶段步骤环、建设时间、负责人、耗时 / SLA、阻塞或下一步；点击行查看六阶段明细与上游依赖。',
          '需要新建集群时，点右上角「登记集群建设需求」，填写机房、名称、阶段、负责人与 SLA，提交后即时同步到时间轴与清单（会话内有效，刷新后恢复示例数据）。',
        ],
        dataBoundary: '示例数据：机房与集群名称参考原型快照；日期、进度、负责人分配、风险与耗时均为演示，不代表实时交付承诺。阶段口径：确认需求 → 资源准备 + 机器重装 → BKE 创建 → 人工补齐 → 交付前检查 → 后置通知。登记的新集群仅保存在当前浏览器会话，刷新后恢复示例数据；页面不连接生产系统。',
      },
      filter: filterHTML(),
      body: `<div class="cd-page">
        <div id="cd-kpis"></div>
        ${computeSection({ title: '供给时间轴', icon: 'timeline', meta: '<span class="csys-section-meta">2026.01 – 2027.12 · 按机房 · 三态同屏 · 条带即集群</span>', body: '<div id="cd-timeline"></div>' })}
        ${computeSection({ title: '集群清单', icon: 'table_rows', meta: '<span class="csys-section-meta">集群 × VDC × 阶段 × 负责人 × SLA</span>', body: '<div id="cd-pipeline"></div>' })}
        <p class="rb-data-note">示例数据 · 截至 ${D.asOf} · 阶段口径：确认需求 → 资源准备 + 机器重装 → BKE 创建 → 人工补齐 → 交付前检查 → 后置通知 · 条带即集群，与清单行同源可点击。</p>
      </div>`,
    });
    document.querySelector('#main').innerHTML = shell;
    ensureDrawer();
    bindEvents();
    render();
  }

  window.mountClusterDelivery = mount;
})();