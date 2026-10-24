import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RoomView } from '@shared/types';
import { api } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { ErrorBox, KpiStrip, Loading, PageShell, Section } from '../../ui/primitives';
import RoomDetailDrawer from './RoomDetailDrawer';
import CreateRoomModal from './CreateRoomModal';
import RoomTimeline from './RoomTimeline';
import RoomList, { PHASE_META, PHASE_ORDER, daysText, type RoomPhaseFilter, type SortKey } from './RoomList';

const EMPTY_ROOMS: RoomView[] = [];

interface Totals {
  rooms: number;
  cn: number;
  overseas: number;
  recorded: number;
  delivered: number;
  blocked: number;
  building: number;
  unplannedRooms: number;
  avgRoomDays: number | null;
}

/** 与原型 cluster-model.js totals() 同口径：全部来自机房 summary + past 机房实际耗时。 */
function summarize(rooms: RoomView[]): Totals {
  const totals: Totals = {
    rooms: rooms.length,
    cn: rooms.filter((room) => room.area === 'cn').length,
    overseas: rooms.filter((room) => room.area !== 'cn').length,
    recorded: 0,
    delivered: 0,
    blocked: 0,
    building: 0,
    unplannedRooms: 0,
    avgRoomDays: null,
  };
  for (const room of rooms) {
    totals.recorded += room.summary.recorded;
    totals.delivered += room.summary.delivered;
    totals.blocked += room.summary.blocked;
    totals.building += room.summary.building;
    if (room.summary.planned === null) totals.unplannedRooms += 1;
  }
  const durations = rooms
    .filter((room) => room.phase === 'past')
    .map((room) => room.duration.actual)
    .filter((days): days is number => days !== null);
  if (durations.length) totals.avgRoomDays = Math.round(durations.reduce((sum, days) => sum + days, 0) / durations.length);
  return totals;
}

const PHASE_FILTERS: string[] = ['all', ...PHASE_ORDER];

export default function RoomBuildoutPage() {
  const [params, setParams] = useSearchParams();
  const rawPhase = params.get('phase') ?? '';
  const phase: RoomPhaseFilter = PHASE_FILTERS.includes(rawPhase) ? (rawPhase as RoomPhaseFilter) : 'present';
  const area = params.get('area') ?? '';
  const type = params.get('type') ?? '';
  const tenant = params.get('tenant') ?? '';
  const queryParam = params.get('query') ?? '';
  const [query, setQuery] = useState(queryParam);
  const debouncedQuery = useDebounced(query);
  const [sort, setSort] = useState<SortKey>('date');
  const [timelineExpanded, setTimelineExpanded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const bootstrap = useApi(() => api.bootstrap(), []);
  const rooms = useApi(() => api.rooms({ area, type, tenant, query: debouncedQuery }), [area, type, tenant, debouncedQuery]);

  useEffect(() => {
    setQuery(queryParam);
  }, [queryParam]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const setPhase = (value: RoomPhaseFilter) => setParam('phase', value);

  const reset = () => {
    setSort('date');
    setParams(new URLSearchParams({ phase: 'all' }), { replace: true });
  };

  const boot = bootstrap.data;
  const defs = boot?.stages.room ?? [];
  const scoped = rooms.data ?? EMPTY_ROOMS;
  const totals = useMemo(() => summarize(scoped), [scoped]);
  const groups = useMemo(
    () => PHASE_ORDER.map((groupPhase) => ({ phase: groupPhase, rooms: scoped.filter((room) => room.phase === groupPhase) })),
    [scoped],
  );

  const error = bootstrap.error ?? rooms.error;
  const initialLoading = (bootstrap.loading && !bootstrap.data) || (rooms.loading && rooms.data === null);

  const reloadAll = () => {
    bootstrap.reload();
    rooms.reload();
  };

  const filter = (
    <div className="filterbar rb-filterbar">
      <label className="selwrap">
        <span className="flab">区域</span>
        <select className="filt" data-filter="area" aria-label="区域" value={area} onChange={(event) => setParam('area', event.target.value)}>
          <option value="">全部区域</option>
          {(boot?.options.areas ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="selwrap">
        <span className="flab">集群类型</span>
        <select className="filt" data-filter="type" aria-label="集群类型" value={type} onChange={(event) => setParam('type', event.target.value)}>
          <option value="">全部集群类型</option>
          {(boot?.options.types ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="selwrap">
        <span className="flab">业务</span>
        <select className="filt" data-filter="tenant" aria-label="业务" value={tenant} onChange={(event) => setParam('tenant', event.target.value)}>
          <option value="">全部业务</option>
          {(boot?.options.tenants ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="rb-search">
        <span className="mat mat-sm">search</span>
        <input
          type="search"
          aria-label="搜索机房或集群"
          placeholder="搜索机房 / 集群 / VDC / 负责人"
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setParam('query', event.target.value);
          }}
        />
      </label>
      <button type="button" className="btn btn-ghost btn-sm" data-reset onClick={reset}>
        重置
      </button>
      <span className="rb-filter-scope">内场 · 新建</span>
    </div>
  );

  return (
    <PageShell
      title="机房建设"
      description="登记机房建设需求，跟踪机房六阶段进度、机房部署环境项与集群交付排期。"
      tools={
        <button type="button" className="btn btn-soft btn-sm" data-request-add onClick={() => setCreating(true)}>
          <span className="mat mat-sm">add</span>登记机房建设需求
        </button>
      }
      filter={filter}
    >
      <div className="cmp space-y-4">
        {error ? (
          <ErrorBox error={error} onRetry={reloadAll} />
        ) : initialLoading ? (
          <Loading label="正在加载机房建设数据…" />
        ) : (
          <>
            <KpiStrip
              items={[
                {
                  label: '新建机房',
                  value: totals.rooms,
                  unit: '个',
                  detail: `中国 ${totals.cn} · 非中 ${totals.overseas}`,
                  tone: 'info',
                  icon: 'foundation',
                },
                {
                  label: '已录入集群',
                  value: totals.recorded,
                  unit: '个',
                  detail: `${totals.unplannedRooms} 个机房计划总数待确认`,
                  tone: 'violet',
                  icon: 'dns',
                },
                {
                  label: '已交付集群',
                  value: totals.delivered,
                  unit: '个',
                  detail: '完成集群全部 6 个环节',
                  tone: 'ok',
                  icon: 'task_alt',
                },
                {
                  label: '阻塞集群',
                  value: totals.blocked,
                  unit: '个',
                  detail: `${totals.building} 个集群正在建设`,
                  tone: totals.blocked ? 'warn' : 'ok',
                  icon: 'pending_actions',
                },
              ]}
            />
            <div className="rb-phase-grid">
              {groups.map((group) => {
                const meta = PHASE_META[group.phase];
                const groupTotals = summarize(group.rooms);
                return (
                  <button
                    key={group.phase}
                    type="button"
                    className={`rb-phase-card tone-${meta.tone} ${phase === group.phase ? 'active' : ''}`}
                    data-phase={group.phase}
                    aria-pressed={phase === group.phase}
                    onClick={() => setPhase(group.phase)}
                  >
                    <div className="rb-phase-card-head">
                      <span className={`rb-phase-mark tone-${meta.tone}`}>
                        <span className="mat">{meta.icon}</span>
                      </span>
                      <div>
                        <b>
                          {meta.time} · {meta.label}机房
                        </b>
                        <small>{meta.subtitle}</small>
                      </div>
                      <strong>
                        {group.rooms.length}
                        <small>个机房</small>
                      </strong>
                    </div>
                    <div className="rb-phase-card-stats">
                      {group.phase === 'past' ? (
                        <>
                          <span>
                            <b>{groupTotals.delivered}</b> 集群已交付
                          </span>
                          <span>
                            机房平均 <b>{daysText(groupTotals.avgRoomDays)}</b>
                          </span>
                        </>
                      ) : group.phase === 'present' ? (
                        <>
                          <span>
                            <b>{groupTotals.building}</b> 集群在建
                          </span>
                          <span className="rb-blocked-count">
                            <b>{groupTotals.blocked}</b> 集群阻塞
                          </span>
                        </>
                      ) : (
                        <>
                          <span>
                            <b>{groupTotals.recorded}</b> 集群规划已录入
                          </span>
                          <span>
                            <b>{groupTotals.unplannedRooms}</b> 机房计划待补充
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <Section
              title="机房建设时间线"
              icon="timeline"
              meta={<span className="csys-section-meta">全阶段排期 · 中国与非中 · 含登记需求</span>}
            >
              <RoomTimeline
                rooms={scoped}
                today={boot?.today ?? ''}
                defs={defs}
                expanded={timelineExpanded}
                onToggle={() => setTimelineExpanded((value) => !value)}
                onOpenRoom={setSelected}
              />
            </Section>
            <Section
              title="机房建设清单"
              icon="account_tree"
              meta={<span className="csys-section-meta">机房六阶段 · 环境项 · 集群在机房详情中查看与登记</span>}
            >
              <RoomList
                rooms={scoped}
                phase={phase}
                onPhaseChange={setPhase}
                sort={sort}
                onSortChange={setSort}
                defs={defs}
                onOpenRoom={setSelected}
                onReset={reset}
              />
            </Section>
            <p className="rb-data-note">内场新建 · 机房六阶段进度由机房详情阶段登记自动同步 · 集群在机房详情中登记与跟踪 · 今天 {boot?.today ?? '—'}</p>
          </>
        )}
      </div>
      <RoomDetailDrawer
        roomId={selected}
        onClose={() => setSelected(null)}
        onChanged={reloadAll}
      />
      <CreateRoomModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          const next = new URLSearchParams(params);
          next.set('phase', 'all');
          setParams(next, { replace: true });
          reloadAll();
        }}
      />
    </PageShell>
  );
}
