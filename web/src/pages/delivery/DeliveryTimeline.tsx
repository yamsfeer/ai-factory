import { Fragment, type CSSProperties } from 'react';
import type { BatchView, ClusterView, RoomView } from '@shared/types';

const PREVIEW_ROWS = 2;

const PHASES = [
  { key: 'past' as const, title: '过去 · 已交付' },
  { key: 'present' as const, title: '现在 · 建设中' },
  { key: 'future' as const, title: '未来 · 规划中' },
];

export interface TimelineMonth {
  key: string;
  year: number;
  month: number;
}

export interface TimelineAxis {
  months: TimelineMonth[];
  startMs: number;
  endMs: number;
  /** 0..1，今天在时间轴中的位置；今天不在轴内时为 null。 */
  todayPct: number | null;
  label: string;
}

export function toDay(date: string | null | undefined): number | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

export function clusterEndDate(cluster: ClusterView): string | null {
  return cluster.deliveredDate ?? cluster.planEndDate ?? cluster.startDate ?? null;
}

/**
 * 时间轴范围由真实数据推导：最早日期前一个月 → 最晚日期后一个月。
 * 与原型固定 24 个月不同，这里保证筛选变化时轴保持稳定（用全部集群计算）。
 */
export function buildTimelineAxis(clusters: ClusterView[], today: string): TimelineAxis {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  const consider = (date: string | null | undefined) => {
    const ms = toDay(date);
    if (ms === null) return;
    const d = new Date(ms);
    const index = d.getUTCFullYear() * 12 + d.getUTCMonth();
    min = Math.min(min, index);
    max = Math.max(max, index);
  };

  for (const cluster of clusters) {
    consider(cluster.startDate);
    consider(cluster.planEndDate);
    consider(cluster.deliveredDate);
  }
  consider(today);

  if (!Number.isFinite(min)) {
    const ms = toDay(today) ?? Date.now();
    const d = new Date(ms);
    min = d.getUTCFullYear() * 12 + d.getUTCMonth();
    max = min;
  }

  min -= 1;
  max += 1;

  const months: TimelineMonth[] = [];
  for (let index = min; index <= max; index += 1) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    months.push({ key: `${year}-${String(month).padStart(2, '0')}`, year, month });
  }

  const first = months[0];
  const last = months[months.length - 1];
  const startMs = Date.UTC(first.year, first.month - 1, 1);
  const endMs = Date.UTC(last.year, last.month, 1);
  const todayMs = toDay(today);
  const todayPct =
    todayMs === null || endMs <= startMs
      ? null
      : Math.min(1, Math.max(0, (todayMs - startMs) / (endMs - startMs)));

  return {
    months,
    startMs,
    endMs,
    todayPct,
    label: `${first.year}.${String(first.month).padStart(2, '0')} – ${last.year}.${String(last.month).padStart(2, '0')}`,
  };
}

interface DeliveryTimelineProps {
  clusters: ClusterView[];
  roomById: Map<string, RoomView>;
  batchById: Map<string, BatchView>;
  axis: TimelineAxis;
  today: string;
  expanded: boolean;
  hasFilters: boolean;
  origin: 'all' | 'new-first' | 'existing-add';
  sourceCounts: { all: number; 'new-first': number; 'existing-add': number };
  onOriginChange: (value: 'all' | 'new-first' | 'existing-add') => void;
  onToggleExpand: () => void;
  onOpenCluster: (id: string) => void;
  onReset: () => void;
}

function datePct(date: string | null | undefined, axis: TimelineAxis): number | null {
  const ms = toDay(date);
  if (ms === null || axis.endMs <= axis.startMs) return null;
  return Math.min(100, Math.max(0, ((ms - axis.startMs) / (axis.endMs - axis.startMs)) * 100));
}

function startValue(cluster: ClusterView): number {
  const ms = toDay(cluster.startDate);
  return ms === null ? Number.POSITIVE_INFINITY : ms;
}

export default function DeliveryTimeline({
  clusters,
  roomById,
  batchById,
  axis,
  today,
  expanded,
  hasFilters,
  origin,
  sourceCounts,
  onOriginChange,
  onToggleExpand,
  onOpenCluster,
  onReset,
}: DeliveryTimelineProps) {
  const sorted = [...clusters].sort((a, b) => {
    const left = startValue(a);
    const right = startValue(b);
    if (left === right) return 0;
    return left - right;
  });

  const groups = PHASES.map((phase) => ({
    ...phase,
    items: sorted.filter((cluster) => cluster.phase === phase.key),
  })).filter((group) => group.items.length > 0);

  if (!groups.length) {
    return (
      <div className="empty-state">
        <span className="mat">domain_disabled</span>
        <div>当前筛选下没有集群数据</div>
        {hasFilters ? (
          <button type="button" className="btn btn-ghost btn-sm cd-empty-action" onClick={onReset}>
            重置筛选
          </button>
        ) : null}
      </div>
    );
  }

  const hasMore = groups.some((group) => group.items.length > PREVIEW_ROWS);

  const years: { year: number; count: number }[] = [];
  for (const month of axis.months) {
    const lastYear = years[years.length - 1];
    if (lastYear && lastYear.year === month.year) lastYear.count += 1;
    else years.push({ year: month.year, count: 1 });
  }

  const bodyStyle = { '--pct': axis.todayPct ?? 0.5 } as CSSProperties;
  const gridStyle = {
    backgroundImage: `repeating-linear-gradient(to right, var(--border-2) 0 1px, transparent 1px calc(100% / ${axis.months.length}))`,
  };

  return (
    <>
      <div className="cd-tl-toolbar">
        <div className="cd-source">
          <span className="flab">交付来源</span>
          <div className="cd-seg" role="group" aria-label="按交付来源筛选">
            {([
              ['all', '全部', sourceCounts.all],
              ['new-first', '新机房首批', sourceCounts['new-first']],
              ['existing-add', '存量机房扩容', sourceCounts['existing-add']],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={origin === key ? 'active' : ''}
                aria-pressed={origin === key}
                onClick={() => onOriginChange(key)}
              >
                {label} {count}
              </button>
            ))}
          </div>
        </div>
        {hasMore ? (
          <button type="button" className="cd-tl-expand" data-cd-expand onClick={onToggleExpand}>
            {expanded ? '收起时间线' : '展开完整时间线'}
            <span className="mat">{expanded ? 'unfold_less' : 'unfold_more'}</span>
          </button>
        ) : null}
      </div>

      <div className="cd-tl-legend">
        <span className="lg">
          <i className="past" />过去 · 已交付
        </span>
        <span className="lg">
          <i className="present" />现在 · 建设中
        </span>
        <span className="lg">
          <i className="future" />未来 · 规划中
        </span>
        <span className="lg">
          <i className="today" />今天 {today}
        </span>
      </div>

      <div className="cd-tl-frame">
        <div className="cd-tl-head">
          <div className="cd-tl-head-label">集群 / 机房 · 负责人</div>
          <div className="cd-tl-head-axis">
            <div className="cd-tl-years">
              {years.map((item) => (
                <span key={item.year} style={{ flexGrow: item.count }}>
                  {item.year}
                </span>
              ))}
            </div>
            <div className="cd-tl-months">
              {axis.months.map((month) => (
                <span key={month.key} className={month.month === 1 ? 'year-start' : undefined}>
                  {String(month.month).padStart(2, '0')}
                </span>
              ))}
            </div>
          </div>
          <div className="cd-tl-head-date">完成 / 目标</div>
        </div>
        <div className="cd-tl-body" style={bodyStyle}>
          <div className="cd-tl-grid" style={gridStyle} />
          {axis.todayPct !== null ? <div className="cd-tl-today" title={`今天 ${today}`} /> : null}
          {groups.map((group) => {
            const total = group.items.length;
            const visibleCount = expanded ? total : Math.min(PREVIEW_ROWS, total);
            const showPreview = !expanded && total > PREVIEW_ROWS;
            return (
              <Fragment key={group.key}>
                <div className={`cd-tl-group ${group.key}`}>
                  <div className="cd-tl-group-main">
                    <span className="cd-tl-group-dot" />
                    <b className="cd-tl-group-title">{group.title}</b>
                    <span className="cd-tl-group-count">· {total} 个集群</span>
                  </div>
                  {showPreview ? <span className="cd-tl-group-preview">预览 {visibleCount} 个</span> : null}
                </div>
                {group.items.slice(0, visibleCount).map((cluster) => {
                  const room = roomById.get(cluster.roomId);
                  const batch = cluster.batchId ? batchById.get(cluster.batchId) : undefined;
                  const endDate = clusterEndDate(cluster);
                  const startPct = datePct(cluster.startDate, axis);
                  const endPct = datePct(endDate, axis);
                  const left = startPct !== null && endPct !== null ? Math.min(startPct, endPct) : startPct ?? endPct;
                  const width =
                    startPct !== null && endPct !== null
                      ? Math.max(Math.abs(endPct - startPct), 0.3)
                      : 0.3;
                  const hasRisk = Boolean(cluster.risk || cluster.blocker);
                  const dotPct = endPct ?? startPct;
                  const titleParts = [
                    cluster.name,
                    cluster.type,
                    room?.name ?? cluster.roomName,
                    `${cluster.startDate ?? '开始待定'} → ${endDate ?? '完成待定'}`,
                    cluster.owner,
                  ];
                  if (batch) {
                    titleParts.push(
                      `批次 ${batch.type} · 计划 ${batch.planCount} 个 · ${batch.startDate ?? '待定'} → ${batch.endDate ?? '待定'}`,
                    );
                  }
                  if (cluster.risk) titleParts.push(`风险：${cluster.risk.text}`);
                  else if (cluster.blocker) titleParts.push(`阻塞：${cluster.blocker}`);
                  const title = titleParts.join(' · ');
                  return (
                    <button
                      type="button"
                      key={cluster.id}
                      className={`cd-tl-row ${cluster.phase}`}
                      data-cluster={cluster.id}
                      title={title}
                      aria-label={title}
                      onClick={() => onOpenCluster(cluster.id)}
                    >
                      <div className="cd-tl-row-label">
                        <b>{cluster.name}</b>
                        <span>
                          {room?.name ?? cluster.roomName} · {cluster.owner} · {room?.region ?? '区域待确认'}
                        </span>
                      </div>
                      <div className="cd-tl-row-track">
                        {left !== null ? (
                          <span
                            className={`cd-tl-bar ${cluster.phase}`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          />
                        ) : null}
                        {hasRisk && dotPct !== null ? (
                          <span className="cd-tl-bar-risk" style={{ left: `calc(${dotPct}% + 5px)` }} />
                        ) : null}
                      </div>
                      <div className="cd-tl-row-date">{endDate ?? '待确认'}</div>
                    </button>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>

      <p className="cd-tl-foot">
        横条为启动 → 完成 / 目标；点击条带或行打开集群详情。默认各阶段预览最多 2 个集群，展开后查看全部；随区域、机房、类型与搜索联动。红点表示存在阻塞或依赖风险。
      </p>
    </>
  );
}
