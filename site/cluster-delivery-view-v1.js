(() => {
  const D = window.CLUSTER_DELIVERY_DATA;
  if (!D) return;

  const DAY = 86400000;
  const START = Date.parse(`${D.rangeStart}T00:00:00Z`);
  const END = Date.parse(`${D.rangeEnd}T00:00:00Z`);
  const STATE_LABEL = { past: '已交付', present: '在建', future: '规划' };
  const ORIGIN_LABEL = { 'new-first': '新机房首批', 'existing-add': '存量机房扩容' };
  const state = { area: '', kind: '', type: '', source: 'all', query: '' };
  let currentDrawer = null;

  const siteById = (id) => D.sites.find((site) => site.id === id);
  const batchById = (id) => D.sites.flatMap((site) => site.batches).find((batch) => batch.id === id);
  const clusterById = (id) => D.clusters.find((cluster) => cluster.id === id);

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

  function batchPass(site, batch) {
    if (state.type && !batch.type.includes(state.type)) return false;
    if (state.source !== 'all' && batch.origin !== state.source) return false;
    const memberNames = (batch.members || []).map((id) => clusterById(id)?.name || id).join(' ');
    return qMatch(site.name, site.region, site.code, site.owner, batch.type, batch.id, memberNames);
  }

  function visibleSites() {
    return D.sites
      .filter(sitePass)
      .map((site) => ({ ...site, batches: site.batches.filter((batch) => batchPass(site, batch)) }))
      .filter((site) => site.batches.length);
  }

  function visibleClusters() {
    const ids = new Set(visibleSites().flatMap((site) => site.batches.map((batch) => batch.id)));
    return D.clusters.filter((cluster) => ids.has(cluster.batchId));
  }

  function siteTotals(site) {
    const totals = { past: 0, present: 0, future: 0, count: 0 };
    site.batches.forEach((batch) => {
      totals[batch.state] += batch.count;
      totals.count += batch.count;
    });
    return totals;
  }

  /* ---------------- KPI ---------------- */
  function kpiValues() {
    const sites = visibleSites();
    const batches = sites.flatMap((site) => site.batches);
    const sumCount = (target) => batches.filter((batch) => batch.state === target).reduce((all, batch) => all + batch.count, 0);
    const pastCount = sumCount('past');
    const presentCount = sumCount('present');
    const futureCount = sumCount('future');
    const pastBatches = batches.filter((batch) => batch.state === 'past');
    const avgCycle = pastCount
      ? Math.round(pastBatches.reduce((all, batch) => all + daysBetween(batch.start, batch.end) * batch.count, 0) / pastCount)
      : null;
    const clusters = visibleClusters();
    const risks = clusters.filter((cluster) => cluster.risk);
    const blocked = risks.filter((cluster) => cluster.risk.level === 'err').length;
    const stageOver = clusters.filter((cluster) => cluster.stageDays > cluster.stagePlan[cluster.stageIndex]).length;
    const futureNew = batches.filter((batch) => batch.state === 'future' && batch.origin === 'new-first').reduce((all, batch) => all + batch.count, 0);
    const futureOld = futureCount - futureNew;
    const pastSites = new Set(sites.filter((site) => site.batches.some((batch) => batch.state === 'past')).map((site) => site.id)).size;
    return { sites, batches, pastCount, presentCount, futureCount, avgCycle, pastSites, riskCount: risks.length, blocked, stageOver, futureNew, futureOld, clusters };
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
  function packBatches(batches) {
    const rows = [];
    batches
      .slice()
      .sort((a, b) => day(a.start) - day(b.start))
      .forEach((batch) => {
        const row = rows.find((items) => day(batch.start) >= day(items[items.length - 1].end));
        if (row) row.push(batch);
        else rows.push([batch]);
      });
    return rows;
  }

  function barHTML(batch, rowIndex) {
    const left = pct(batch.start);
    const right = pct(batch.end);
    const width = Math.max(right - left, 0.6);
    const stateClass = batch.state === 'past' ? 'past' : batch.state === 'present' ? 'present' : 'future';
    let cls = `cd-bar cd-bar--${stateClass}`;
    if (batch.state === 'present' && batch.risk === 'err') cls += ' cd-bar--err';
    else if (batch.state === 'present' && batch.risk) cls += ' cd-bar--risk';
    const fill = batch.state === 'present' ? `<i class="cd-bar-fill" style="width:${Math.round(batch.progress * 100)}%"></i>` : '';
    const flag = batch.risk ? '<i class="cd-bar-flag"></i>' : '';
    let label = `${batch.type} ×${batch.count}`;
    if (batch.state === 'present') label += ` · ${Math.round(batch.progress * 100)}%`;
    const tagSide = right > 68 ? 'right' : 'left';
    const tagStyle = tagSide === 'right' ? `right:calc(${100 - left}% + 5px)` : `left:calc(${right}% + 5px)`;
    const title = `${batch.type} · ${batch.count} 个 · ${batch.start} → ${batch.end} · ${batch.owner}${batch.risk ? ' · 有风险' : ''}`;
    return `<div class="cd-bar-slot" style="top:${2 + rowIndex * 24}px">
      <button type="button" class="${cls}" style="left:${left}%;width:${width}%" data-batch="${esc(batch.id)}" title="${esc(title)}" aria-label="${esc(title)}">${fill}${flag}</button>
      <span class="cd-bar-tag cd-bar-tag--${tagSide}${batch.state === 'past' ? ' cd-bar-tag--past' : ''}" style="${tagStyle}">${esc(label)}</span>
    </div>`;
  }

  function axisHTML() {
    const quarters = [];
    const months = [];
    const firstYear = Number(D.rangeStart.slice(0, 4));
    const lastYear = Number(D.rangeEnd.slice(0, 4));
    for (let year = firstYear; year < lastYear; year++) {
      for (let q = 1; q <= 4; q++) quarters.push(`${year} Q${q}`);
      for (let m = 1; m <= 12; m++) months.push({ year, month: m });
    }
    return `<div class="cd-tl-head">
      <div class="cd-tl-head-site">机房 / 规模</div>
      <div class="cd-tl-head-label">状态</div>
      <div class="cd-tl-axis">
        <div class="cd-tl-quarters">${quarters.map((label) => `<span>${esc(label)}</span>`).join('')}</div>
        <div class="cd-tl-months">${months.map(({ year, month }) => `<span title="${year}-${String(month).padStart(2, '0')}">${month}</span>`).join('')}</div>
        <div class="cd-today-pill" style="left:${pct(D.asOf)}%">今天 ${fmtMD(D.asOf)}</div>
      </div>
    </div>`;
  }

  function siteHTML(site) {
    const packed = {
      past: packBatches(site.batches.filter((batch) => batch.state === 'past')),
      present: packBatches(site.batches.filter((batch) => batch.state === 'present')),
      future: packBatches(site.batches.filter((batch) => batch.state === 'future')),
    };
    const heights = {
      past: Math.max(20, packed.past.length * 24 + 4),
      present: Math.max(20, packed.present.length * 24 + 4),
      future: Math.max(20, packed.future.length * 24 + 4),
    };
    const totals = siteTotals(site);
    const lane = (key) => `<div class="cd-lane-block" style="height:${heights[key]}px" data-state="${key}">${packed[key].flatMap((items, rowIndex) => items.map((batch) => barHTML(batch, rowIndex))).join('')}</div>`;
    const milestone = site.kind === 'new' && site.acceptDate
      ? `<span class="cd-milestone" style="left:${pct(site.acceptDate)}%" title="机房验收 ${fmtDate(site.acceptDate)}"></span>`
      : '';
    return `<div class="cd-tl-site">
      <div class="cd-site-info">
        <div class="cd-site-title">${esc(site.name)}<span class="chip ${site.kind === 'new' ? 'chip-violet' : 'chip-neutral'}">${site.kind === 'new' ? '新机房' : '存量机房'}</span></div>
        <div class="cd-site-meta">${esc(site.region)} · ${esc(site.code)} · ${totals.count} 个</div>
        <div class="cd-site-owner">负责 ${esc(site.owner)}</div>
        ${site.acceptDate ? `<div class="cd-site-accept"><span class="mat">flag</span>机房验收 ${fmtDate(site.acceptDate)}</div>` : ''}
      </div>
      <div class="cd-lane-labels">
        <span class="cd-lane-label past" style="height:${heights.past}px"><i></i>已交付</span>
        <span class="cd-lane-label present" style="height:${heights.present}px"><i></i>在建</span>
        <span class="cd-lane-label future" style="height:${heights.future}px"><i></i>规划</span>
      </div>
      <div class="cd-tl-lanes">
        ${milestone}
        ${lane('past')}
        ${lane('present')}
        ${lane('future')}
      </div>
    </div>`;
  }

  function sourceCounts() {
    const all = D.sites.flatMap((site) => site.batches);
    return {
      all: all.reduce((sum, batch) => sum + batch.count, 0),
      'new-first': all.filter((batch) => batch.origin === 'new-first').reduce((sum, batch) => sum + batch.count, 0),
      'existing-add': all.filter((batch) => batch.origin === 'existing-add').reduce((sum, batch) => sum + batch.count, 0),
    };
  }

  function renderTimeline() {
    const sites = visibleSites();
    const counts = sourceCounts();
    const toolbar = `<div class="cd-tl-toolbar">
      <div class="cd-source"><span class="flab">交付来源</span><div class="cd-seg" role="group" aria-label="按交付来源筛选">
        <button type="button" class="${state.source === 'all' ? 'active' : ''}" data-cd-source="all" aria-pressed="${state.source === 'all'}">全部 ${counts.all}</button>
        <button type="button" class="${state.source === 'new-first' ? 'active' : ''}" data-cd-source="new-first" aria-pressed="${state.source === 'new-first'}">新机房首批 ${counts['new-first']}</button>
        <button type="button" class="${state.source === 'existing-add' ? 'active' : ''}" data-cd-source="existing-add" aria-pressed="${state.source === 'existing-add'}">存量机房扩容 ${counts['existing-add']}</button>
      </div></div>
      <div class="cd-legend">
        <span><i class="lg-past"></i>已交付</span>
        <span><i class="lg-present"></i>在建</span>
        <span><i class="lg-future"></i>规划</span>
        <span><i class="lg-milestone"></i>机房验收</span>
        <span><i class="lg-risk"></i>风险</span>
      </div>
    </div>
    <div class="cd-tl-note"><span class="mat">info</span><span><b>新机房首批</b>集群与机房里程碑并行推进前置阶段，但上线交付以机房验收为前置；<b>存量机房扩容</b>不进入机房建设阶段，独立排期交付。</span></div>`;

    if (!sites.length) {
      document.querySelector('#cd-timeline').innerHTML = toolbar + emptyStateHTML({ icon: 'filter_alt_off', text: '当前筛选下没有匹配的交付批次', tone: 'muted', pad: '26px' });
      return;
    }

    const groups = [
      { key: 'new', label: '新机房首批', note: '依赖机房验收节点 · 集群可并行推进前置阶段', sites: sites.filter((site) => site.kind === 'new') },
      { key: 'existing', label: '存量机房扩容', note: '不进入机房建设阶段 · 独立排期与交付', sites: sites.filter((site) => site.kind === 'existing') },
    ].filter((group) => group.sites.length);

    const body = groups.map((group) => {
      const groupBatches = group.sites.flatMap((site) => site.batches);
      const clusterCount = groupBatches.reduce((sum, batch) => sum + batch.count, 0);
      return `<div class="cd-tl-group"><div><b>${group.label}</b> <span>${group.sites.length} 个机房 · ${clusterCount} 个集群</span></div><p>${group.note}</p></div>
        ${group.sites.map(siteHTML).join('')}`;
    }).join('');

    document.querySelector('#cd-timeline').innerHTML = `${toolbar}
      <div class="cd-tl-scroll"><div class="cd-tl">
        ${axisHTML()}
        <div class="cd-tl-body">
          ${body}
          <div class="cd-tl-today-track"><i style="left:${pct(D.asOf)}%"></i></div>
        </div>
      </div></div>`;
  }

  /* ---------------- 在建流水线 ---------------- */
  function stageBoard(clusters) {
    return `<div class="cd-stage-board-scroll"><div class="cd-stage-board">${D.stages.map((stage, index) => {
      const count = clusters.filter((cluster) => cluster.stageIndex === index).length;
      const subs = stage.subItems.map((sub, subIndex) => {
        const active = clusters.some((cluster) => cluster.stageIndex === index && (cluster.subIndex || 0) >= subIndex);
        const tags = sub.detail ? `<div class="cd-sub-tags">${sub.detail.map((item) => `<span>${esc(item)}</span>`).join('')}</div>` : '';
        const name = sub.link
          ? `<button type="button" class="cd-sub-link" data-cd-toast="TCE Checklist：示例数据，接入后可跳转到实际检查清单"><span class="cd-sub-link-label">${esc(sub.name)}</span><span class="mat">open_in_new</span></button>`
          : `<span>${esc(sub.name)}</span>`;
        return `<li class="${active ? 'has' : ''}"><i></i><div>${name}${tags}</div></li>`;
      }).join('');
      return `<div class="cd-stage-card${count ? ' has' : ''}">
        <div class="cd-stage-card-head"><span class="cd-stage-num">${String(index + 1).padStart(2, '0')}</span><b>${esc(stage.name)}</b><span class="cd-stage-count${count ? ' has' : ''}" title="${count} 个在建集群">${count}</span></div>
        <p class="cd-stage-desc">${esc(stage.desc)}</p>
        <ul class="cd-stage-sub-list">${subs}</ul>
        <div class="cd-stage-card-foot">基线 ${stage.baseline} 天</div>
      </div>`;
    }).join('')}</div></div>`;
  }

  function stageTrack(cluster) {
    const risk = cluster.risk?.level === 'err' ? ' risk' : '';
    return `<div class="cd-stage-track">${D.stages.map((_, index) => {
      const cls = index < cluster.stageIndex ? 's-done' : index === cluster.stageIndex ? `s-doing${risk}` : '';
      return `<i class="${cls}" title="${esc(D.stages[index].name)}"></i>`;
    }).join('')}</div>`;
  }

  function pipelineRow(cluster) {
    const site = siteById(cluster.siteId);
    const stage = D.stages[cluster.stageIndex];
    const elapsed = daysBetween(cluster.start, D.asOf);
    const planDays = daysBetween(cluster.start, cluster.planEnd);
    const remain = daysBetween(D.asOf, cluster.planEnd);
    const stageOver = cluster.stageDays - cluster.stagePlan[cluster.stageIndex];
    const durationPct = Math.min(100, Math.round((elapsed / planDays) * 100));
    const riskHTML = cluster.risk
      ? `<span class="chip ${cluster.risk.level === 'err' ? 'chip-err' : 'chip-warn'}">${cluster.risk.level === 'err' ? '阻塞' : '预警'}</span><span class="cd-muted">${esc(cluster.risk.short)}</span>`
      : '<span class="cd-muted">正常</span>';
    const sub = stage.subItems[cluster.subIndex || 0] || stage.subItems[0];
    return `<div class="cd-pipe-row" role="button" tabindex="0" data-cluster="${esc(cluster.id)}" aria-label="查看 ${esc(cluster.name)} 的阶段详情">
      <div class="cd-pipe-cluster"><b>${esc(cluster.name)}</b><small>${esc(site.name)} · ${esc(cluster.type)}</small></div>
      <div><span class="chip ${cluster.origin === 'new-first' ? 'chip-violet' : 'chip-neutral'}">${ORIGIN_LABEL[cluster.origin]}</span></div>
      <div>${stageTrack(cluster)}<div class="cd-stage-info"><b>${String(cluster.stageIndex + 1).padStart(2, '0')}/06</b> ${esc(stage.name)}${stageOver > 0 ? ` · <span style="color:var(--warn-text)">超基线 ${stageOver} 天</span>` : ''}</div><div class="cd-sub-info">子项 ${(cluster.subIndex || 0) + 1}/${stage.subItems.length} · ${esc(sub.name)}</div></div>
      <div class="cd-owner"><span class="cd-avatar">${esc(ownerInitial(cluster.owner))}</span>${esc(cluster.owner)}</div>
      <div class="cd-dur${elapsed > planDays ? ' over' : ''}"><b>${elapsed} / ${planDays} 天</b><span class="cd-dur-bar"><i style="width:${durationPct}%"></i></span><small>${stageOver > 0 ? `当前阶段基线 ${cluster.stagePlan[cluster.stageIndex]} 天` : '按计划推进'}</small></div>
      <div class="cd-plan${remain < 0 ? ' late' : ''}"><b>${fmtMD(cluster.planEnd)}</b><small>${remain < 0 ? `已超 ${-remain} 天` : `剩 ${remain} 天`}</small></div>
      <div class="cd-risk-wrap">${riskHTML}</div>
    </div>`;
  }

  function renderPipeline() {
    const clusters = visibleClusters().slice().sort((a, b) => {
      const rank = (c) => (c.risk?.level === 'err' ? 0 : c.risk ? 1 : 2);
      return rank(a) - rank(b) || day(a.planEnd) - day(b.planEnd);
    });
    if (!clusters.length) {
      document.querySelector('#cd-pipeline').innerHTML = emptyStateHTML({ icon: 'task_alt', text: '当前筛选下没有在建集群', tone: 'muted', pad: '26px' });
      return;
    }
    const head = `<div class="cd-pipe-row cd-pipe-head"><span>集群</span><span>来源</span><span>阶段 / 子项</span><span>负责人</span><span>耗时</span><span>计划交付</span><span>风险</span></div>`;
    document.querySelector('#cd-pipeline').innerHTML = `${stageBoard(clusters)}<div class="cd-pipe-scroll"><div class="cd-pipe">${head}${clusters.map(pipelineRow).join('')}</div></div>`;
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
    drawer.innerHTML = `<div class="cd-drawer-head"><div class="cd-drawer-title"><b id="cd-drawer-title"></b><span id="cd-drawer-sub"></span></div><button type="button" class="btn btn-ghost btn-sm" data-cd-close aria-label="关闭详情"><span class="mat mat-sm">close</span></button></div><div class="cd-drawer-body" id="cd-drawer-body"></div>`;
    drawer.querySelector('[data-cd-close]').addEventListener('click', closeDrawer);
    drawer.addEventListener('click', (event) => {
      const toastTarget = event.target.closest('[data-cd-toast]');
      if (toastTarget) { event.preventDefault(); toast(toastTarget.dataset.cdToast); return; }
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
      const planDays = cluster.stagePlan[index];
      const planStart = iso(cursor);
      const planEnd = iso(cursor + planDays * DAY);
      const status = index < cluster.stageIndex ? 'done' : index === cluster.stageIndex ? 'doing' : 'todo';
      const actualDays = status === 'done' ? planDays + (cluster.slip?.[index] || 0) : status === 'doing' ? cluster.stageDays : null;
      cursor += planDays * DAY;
      return { ...stage, planStart, planEnd, status, planDays, actualDays, over: actualDays !== null && actualDays > planDays };
    });
  }

  function subStatus(cluster, stageIndex, subIndex) {
    if (stageIndex < cluster.stageIndex) return 'done';
    if (stageIndex > cluster.stageIndex) return 'todo';
    const current = cluster.subIndex || 0;
    if (subIndex < current) return 'done';
    if (subIndex === current) return 'doing';
    return 'todo';
  }

  function subItemHTML(sub, status) {
    const tags = sub.detail ? `<div class="cd-sub-tags">${sub.detail.map((item) => `<span>${esc(item)}</span>`).join('')}</div>` : '';
    const name = sub.link
      ? `<button type="button" class="cd-sub-link" data-cd-toast="TCE Checklist：示例数据，接入后可跳转到实际检查清单"><span class="cd-sub-link-label">${esc(sub.name)}</span><span class="mat">open_in_new</span></button>`
      : `<span class="cd-sub-name">${esc(sub.name)}</span>`;
    return `<div class="cd-sub-item ${status}"><span class="cd-sub-dot"></span><div>${name}${tags}</div></div>`;
  }

  function stageAccordion(cluster) {
    return stageSchedule(cluster).map((stage, index) => {
      const isCurrent = index === cluster.stageIndex;
      const isDone = index < cluster.stageIndex;
      const status = isDone ? 'done' : isCurrent ? 'doing' : 'todo';
      const chip = isDone
        ? '<span class="chip chip-ok">已完成</span>'
        : isCurrent
          ? `<span class="chip ${cluster.risk?.level === 'err' ? 'chip-err' : 'chip-info'}">进行中</span>`
          : '<span class="cd-muted">待开始</span>';
      const subCount = stage.subItems.length;
      const currentSub = cluster.subIndex || 0;
      let meta;
      if (isDone) meta = `${subCount}/${subCount} 项完成 · <span class="${stage.over ? 'cd-over' : ''}">实际 ${stage.actualDays} 天</span> · 基线 ${stage.planDays} 天`;
      else if (isCurrent) meta = `子项 ${currentSub + 1}/${subCount} · <span class="${cluster.stageDays > stage.planDays ? 'cd-over' : ''}">已停留 ${cluster.stageDays} 天</span> · 基线 ${stage.planDays} 天`;
      else meta = `${subCount} 项 · 计划 ${fmtMD(stage.planStart)}–${fmtMD(stage.planEnd)}`;
      const subs = stage.subItems.map((sub, subIndex) => subItemHTML(sub, subStatus(cluster, index, subIndex))).join('');
      return `<details class="cd-stage-acc"${isCurrent ? ' open' : ''}>
        <summary>
          <span class="cd-stage-acc-dot ${status}"></span>
          <span class="cd-stage-acc-sum">
            <span class="cd-stage-acc-name">${String(index + 1).padStart(2, '0')} ${esc(stage.name)} ${chip}</span>
            <span class="cd-stage-acc-meta">${meta}</span>
          </span>
          <span class="mat cd-stage-acc-chevron">expand_more</span>
        </summary>
        <div class="cd-stage-acc-body">
          <p class="cd-stage-desc-inline">${esc(stage.desc)}</p>
          <div class="cd-sub-list">${subs}</div>
        </div>
      </details>`;
    }).join('');
  }

  function dependencyHTML(site, cluster) {
    if (site.kind !== 'new') {
      return `<p class="cd-dep-note">存量机房扩容不进入机房建设阶段，无上游里程碑依赖；集群交付可独立排期，直接复用现有电力、网络与运维体系。</p>`;
    }
    const rows = (site.milestones || []).map((milestone) => {
      const label = milestone.status === 'done' ? '已完成' : milestone.status === 'doing' ? '进行中' : '未开始';
      const cls = milestone.status === 'done' ? 'chip-ok' : milestone.status === 'doing' ? 'chip-info' : 'chip-neutral';
      return `<div class="cd-dep-row"><span class="cd-dep-dot ${milestone.status}"></span><span class="cd-dep-name">${esc(milestone.name)}</span><span class="cd-dep-date">${fmtDate(milestone.date)}</span><span class="chip ${cls}">${label}</span></div>`;
    }).join('');
    return `${rows}<p class="cd-dep-note">集群前置阶段可与机房并行；上线交付需在机房验收（${fmtDate(site.acceptDate)}）后完成。当前批次计划 ${fmtDate(cluster.start)} 启动，${fmtDate(cluster.planEnd)} 交付。</p>`;
  }

  function clusterDrawer(cluster) {
    const site = siteById(cluster.siteId);
    const batch = batchById(cluster.batchId);
    const stage = D.stages[cluster.stageIndex];
    const elapsed = daysBetween(cluster.start, D.asOf);
    const planDays = daysBetween(cluster.start, cluster.planEnd);
    const stageOver = cluster.stageDays - cluster.stagePlan[cluster.stageIndex];
    const risk = cluster.risk
      ? `<span class="chip ${cluster.risk.level === 'err' ? 'chip-err' : 'chip-warn'}">${cluster.risk.level === 'err' ? '阻塞' : '依赖预警'}</span>`
      : '<span class="chip chip-ok">正常</span>';
    const siblings = (batch?.members || []).filter((id) => id !== cluster.id).map(clusterById).filter(Boolean);
    return `<div class="cd-drawer-badges">
        <span class="chip chip-info">在建</span>
        <span class="chip ${cluster.origin === 'new-first' ? 'chip-violet' : 'chip-neutral'}">${ORIGIN_LABEL[cluster.origin]}</span>
        ${risk}
      </div>
      <div class="cd-drawer-grid">
        <div class="cd-drawer-cell"><label>当前阶段</label><b>${cluster.stageIndex + 1}/6 · ${esc(stage.name)}</b><small>子项 ${(cluster.subIndex || 0) + 1}/${stage.subItems.length} · ${esc(stage.subItems[cluster.subIndex || 0]?.name || '')}</small></div>
        <div class="cd-drawer-cell"><label>负责人</label><b>${esc(cluster.owner)}</b></div>
        <div class="cd-drawer-cell"><label>已耗时 / 计划</label><b>${elapsed} / ${planDays} 天</b></div>
        <div class="cd-drawer-cell"><label>计划交付</label><b>${fmtDate(cluster.planEnd)}</b></div>
      </div>
      ${cluster.risk ? `<div class="cd-callout cd-callout--${cluster.risk.level}"><span class="mat">${cluster.risk.level === 'err' ? 'error' : 'warning'}</span><div><b>${esc(cluster.risk.short)}</b><p>${esc(cluster.risk.text)}</p></div></div>` : ''}
      <section><h3>阶段与子项${stageOver > 0 ? ` · 当前阶段超基线 ${stageOver} 天` : ''}</h3><div class="cd-stage-list">${stageAccordion(cluster)}</div><div class="cd-stage-current"><span class="mat">arrow_forward</span><b>下一步：</b>${esc(cluster.next)}</div></section>
      <section><h3>${site.kind === 'new' ? '上游机房依赖' : '机房依赖'}</h3>${dependencyHTML(site, cluster)}</section>
      ${siblings.length ? `<section><h3>同批集群</h3><div class="cd-batch-members">${siblings.map((item) => `<button type="button" class="cd-batch-member" data-cluster="${esc(item.id)}"><b>${esc(item.name)}</b><small>${D.stages[item.stageIndex].name} · ${esc(item.owner)}</small></button>`).join('')}</div></section>` : ''}
      <p class="rb-data-note">示例数据：阶段时长、子项进度、负责人、风险与日期用于演示，不代表实时交付状态。阶段口径：确认需求 → 资源准备 + 机器重装 → BKE 创建 → 人工补齐 → 交付前检查 → 后置通知。</p>`;
  }

  function batchDrawer(batch) {
    const targetSite = D.sites.find((item) => item.batches.some((entry) => entry.id === batch.id));
    const stateLabel = STATE_LABEL[batch.state];
    const members = (batch.members || []).map(clusterById).filter(Boolean);
    return `<div class="cd-drawer-badges">
        <span class="chip ${batch.state === 'past' ? 'chip-ok' : batch.state === 'present' ? 'chip-info' : 'chip-violet'}">${stateLabel}</span>
        <span class="chip ${batch.origin === 'new-first' ? 'chip-violet' : 'chip-neutral'}">${ORIGIN_LABEL[batch.origin]}</span>
      </div>
      <div class="cd-drawer-grid">
        <div class="cd-drawer-cell"><label>集群数</label><b>${batch.count} 个</b></div>
        <div class="cd-drawer-cell"><label>负责人</label><b>${esc(batch.owner)}</b></div>
        <div class="cd-drawer-cell"><label>交付窗口</label><b>${fmtDate(batch.start)} → ${fmtDate(batch.end)}</b></div>
      </div>
      <div class="cd-callout"><span class="mat">info</span><div><b>${esc(targetSite?.name || '')} · ${esc(batch.type)}</b><p>${batch.state === 'past' ? `已完成交付，实际周期 ${daysBetween(batch.start, batch.end)} 天。` : batch.state === 'future' ? `规划交付窗口 ${daysBetween(batch.start, batch.end)} 天，启动前排期与机房节点将再次校准。` : '正在推进中，可下钻查看成员集群的阶段与耗时。'}</p></div></div>
      ${members.length ? `<section><h3>成员集群</h3><div class="cd-batch-members">${members.map((item) => `<button type="button" class="cd-batch-member" data-cluster="${esc(item.id)}"><b>${esc(item.name)}</b><small>${D.stages[item.stageIndex].name} · ${esc(item.owner)}</small></button>`).join('')}</div></section>` : ''}
      <p class="rb-data-note">示例数据；批次为时间轴上同一机房、同一类型、同一交付窗口的集群聚合。</p>`;
  }

  function openCluster(id) {
    const cluster = clusterById(id);
    if (!cluster) return;
    ensureDrawer();
    const site = siteById(cluster.siteId);
    const drawer = document.querySelector('#cd-drawer');
    document.querySelector('#cd-drawer-title').textContent = cluster.name;
    document.querySelector('#cd-drawer-sub').textContent = `${site.name} · ${cluster.type} · ${ORIGIN_LABEL[cluster.origin]}`;
    document.querySelector('#cd-drawer-body').innerHTML = clusterDrawer(cluster);
    currentDrawer = { type: 'cluster', id };
    if (!drawer.classList.contains('open')) openDrawer();
  }

  function openBatch(id) {
    const batch = batchById(id);
    if (!batch) return;
    if (batch.state === 'present' && batch.members?.length) {
      openCluster(batch.members[0]);
      return;
    }
    ensureDrawer();
    const site = D.sites.find((item) => item.batches.some((entry) => entry.id === id));
    document.querySelector('#cd-drawer-title').textContent = `${batch.type} · ${batch.count} 个集群`;
    document.querySelector('#cd-drawer-sub').textContent = `${site?.name || ''} · ${STATE_LABEL[batch.state]} · ${ORIGIN_LABEL[batch.origin]}`;
    document.querySelector('#cd-drawer-body').innerHTML = batchDrawer(batch);
    currentDrawer = { type: 'batch', id };
    openDrawer();
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
    const rows = [['机房', '区域', '机房类型', '交付来源', '集群类型', '集群数', '状态', '开始', '结束/计划', '负责人']];
    visibleSites().forEach((site) => site.batches.forEach((batch) => {
      rows.push([site.name, site.region, site.kind === 'new' ? '新机房' : '存量机房', ORIGIN_LABEL[batch.origin], batch.type, batch.count, STATE_LABEL[batch.state], batch.start, batch.end, batch.owner]);
    }));
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
    toast(`已导出 ${rows.length - 1} 条交付批次`);
  }

  /* ---------------- 页面壳与事件 ---------------- */
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
      const bar = event.target.closest('[data-batch]');
      if (bar) { openBatch(bar.dataset.batch); return; }
      const row = event.target.closest('[data-cluster]');
      if (row) { openCluster(row.dataset.cluster); return; }
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
      const row = event.target.closest('.cd-pipe-row[role="button"]');
      if (!row) return;
      event.preventDefault();
      openCluster(row.dataset.cluster);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const drawer = document.querySelector('#cd-drawer.open');
      if (drawer) {
        event.preventDefault();
        closeDrawer();
      }
    });
  }

  function mount() {
    const shell = computePageShell({
      view: 'cluster-delivery',
      group: '交付与准入',
      title: '集群交付',
      description: '登记集群需求、补充 SRE 建设方案，按六个阶段人工推进搭建与交付。',
      showDataStatus: true,
      dataStatus: '示例数据',
      tools: '<button type="button" class="btn btn-ghost btn-sm" data-cd-export><span class="mat mat-sm">download</span>导出清单</button>',
      guidance: {
        purpose: '回答两件事：过去、现在、未来分别在哪个机房、什么时候、建多少个什么类型的集群；在建集群当前处于六阶段中的哪一步、谁负责、耗时与基线差多少。',
        focus: '集群交付不是机房建设的子阶段。新机房首批集群需要与机房里程碑协同：前置阶段可以并行，但上线交付依赖机房验收。存量机房扩容不进入机房建设流程，走独立交付线。时间轴按机房分行，每行三条泳道分别承载已交付、在建、规划，避免把两种来源混成一条流水线。在建集群按「确认需求 → 资源准备 + 机器重装 → BKE 创建 → 人工补齐 → 交付前检查 → 后置通知」六阶段推进，每阶段再拆子项。',
        readingPath: [
          '先看供给时间轴：每行一个机房，三条泳道分别是已交付 / 在建 / 规划；条带长度即交付窗口，标签给出类型、规模与集群数。',
          '新机房行的琥珀色虚线是机房验收节点，条带与它的相对位置表示集群交付窗口与机房节点的关系。',
          '再看在建集群的阶段看板：六个阶段与子项同屏，数字表示当前有多少集群停在该阶段；蓝色顶边表示该阶段有在建集群。',
          '下方表格按集群列出当前阶段、当前子项、负责人、耗时与风险；点击行查看逐项清单、阶段说明与下一步。',
        ],
        dataBoundary: '示例数据：机房与集群名称参考 2026-10-12 原型快照；日期、进度、负责人分配、风险与耗时均为演示，不代表实时交付承诺。阶段与子项口径参考《集群搭建》流程表（确认需求 → 资源准备 + 机器重装 → BKE 创建 → 人工补齐 → 交付前检查 → 后置通知）。页面不连接生产系统，不会创建集群、变更工单或发送通知。',
      },
      filter: filterHTML(),
      body: `<div class="cd-page">
        <div id="cd-kpis"></div>
        ${computeSection({ title: '供给时间轴', icon: 'timeline', meta: '<span class="csys-section-meta">2026.01 – 2027.12 · 按机房 · 三态同屏</span>', body: '<div id="cd-timeline"></div>' })}
        ${computeSection({ title: '在建集群', icon: 'precision_manufacturing', meta: '<span class="csys-section-meta">阶段 × 子项 × 负责人 × 耗时</span>', body: '<div id="cd-pipeline"></div>' })}
        <p class="rb-data-note">示例数据 · 截至 ${D.asOf} · 阶段口径：确认需求 → 资源准备 + 机器重装 → BKE 创建 → 人工补齐 → 交付前检查 → 后置通知 · 集群交付与机房建设分别跟踪。</p>
      </div>`,
    });
    document.querySelector('#main').innerHTML = shell;
    ensureDrawer();
    bindEvents();
    render();
  }

  window.mountClusterDelivery = mount;
})();
