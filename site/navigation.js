(()=>{
const NAV_GROUPS = [
  ['总览', [
    ['全局总览', 'core-metrics', 'dashboard', false],
    ['资源总览', 'res-overview', 'inventory_2', false],
    ['关键事项进展', 'key-progress', 'fact_check', true],
  ]],
  ['集群视图', [
    ['集群总览', 'cluster-overview', 'dns', false],
    ['集群详情', 'cluster-detail', 'view_in_ar', false],
    ['集群观测', 'realtime-metrics', 'monitor_heart', false],
  ]],
  ['业务指标运营', [
    ['训练抖动归因', 'train-jitter', 'vibration', false],
    ['推理异常归因', 'infer-anomaly', 'bolt', false],
    ['弹性池供给运营', 'pool-supply', 'recycling', false],
  ]],
  ['主机运营', [
    ['主机管理', 'host-overview', 'lan', false],
    ['在线率运营', 'host-online', 'wifi', false],
    ['故障机运营', 'cluster-fault', 'warning', true],
    ['资源池运营', 'host-pool', 'category', true],
    ['主机画像', 'host-detail', 'memory', false],
    ['内存减配', 'memory-reduction', 'memory_alt', false],
  ]],
  ['交付与准入', [
    ['机型导入', 'host-model', 'developer_board', true],
    ['IaC', 'iac', 'account_tree', true],
    ['集群交付', 'cluster-delivery', 'local_shipping', false],
    ['机房建设', 'room-buildout', 'foundation', true],
    ['准入规则', 'host-admission', 'verified_user', true],
  ]],
  ['运维操作', [
    ['主机运维', 'host-ops', 'memory', true],
    ['集群运维', 'cluster-ops', 'hub', true],
    ['其他', 'other-ops', 'account_tree', true],
  ]],
  ['环境与基线', [
    ['基线目录', 'baseline-catalog', 'library_books', true],
    ['集群环境', 'cluster-env', 'fact_check', true],
  ]],
];
const ACTIVE_VIEW = new URLSearchParams(location.search).get('view') === 'cluster-delivery' ? 'cluster-delivery' : 'room-buildout';

function mountSidebar() {
  document.querySelector('#compute-sidebar-nav').innerHTML = NAV_GROUPS.map(([group, items], index) => `
    <div class="${index === 0 ? 'mb-2' : 'mt-4'}" data-compute-nav-group="${esc(group)}">
      <div class="sidebar-subhead">${esc(group)}</div><div class="sidebar-subwrap">
      ${items.map(([label, viewId, icon, mock]) => `<button type="button" class="sidebar-item${viewId === ACTIVE_VIEW ? ' active' : ''}" data-view="${esc(viewId)}" aria-label="${esc(label)}"><span class="csys-nav-icon-wrap">${computeNavIcon(icon)}</span><span class="csys-nav-label">${esc(label)}</span>${mock ? '<span class="csys-nav-badge mock">mock</span>' : ''}</button>`).join('')}
      </div>
    </div>`).join('');
}


mountSidebar();

document.querySelector('#compute-sidebar-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-view]');
  if (!button) return;
  const view = button.dataset.view;
  if (view === ACTIVE_VIEW) return;
  if (view !== 'room-buildout' && view !== 'cluster-delivery') return;
  const url = new URL(location.href);
  url.searchParams.set('view', view);
  location.href = url.toString();
});

// 本原型只实现交付与准入中的两个页面，其余入口保持禁用，避免产生“可点但无内容”的误导。
document.querySelectorAll('#compute-sidebar-nav button').forEach((button) => {
  if (button.dataset.view === 'room-buildout' || button.dataset.view === 'cluster-delivery') return;
  button.disabled = true;
  button.title = '此独立原型仅展示交付与准入相关页面';
});
document.querySelectorAll('.topbar-tools button, .scene-switch-btn').forEach((button) => {
  button.disabled = true;
  button.title = '此独立原型仅展示交付与准入相关页面';
});
})();
