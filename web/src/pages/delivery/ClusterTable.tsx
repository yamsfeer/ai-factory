import type { ClusterStageDef, ClusterView, RoomView } from '@shared/types';

const DEFAULT_STAGES: Pick<ClusterStageDef, 'key' | 'name'>[] = [
  { key: 'demand', name: '确认需求' },
  { key: 'resource', name: '资源准备 + 机器重装' },
  { key: 'bke', name: 'BKE 创建' },
  { key: 'manual', name: '人工补齐' },
  { key: 'check', name: '交付前检查' },
  { key: 'notify', name: '后置通知' },
];

const PHASE_RANK: Record<string, number> = { present: 0, past: 1, future: 2 };

interface ClusterTableProps {
  clusters: ClusterView[];
  roomById: Map<string, RoomView>;
  stages: ClusterStageDef[];
  hasFilters: boolean;
  onOpenCluster: (id: string) => void;
  onReset: () => void;
}

function startMs(cluster: ClusterView): number {
  if (!cluster.startDate) return Number.POSITIVE_INFINITY;
  const value = Date.parse(`${cluster.startDate}T00:00:00Z`);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function statusChip(cluster: ClusterView) {
  if (cluster.phase === 'past') return <span className="chip chip-ok">已交付</span>;
  if (cluster.phase === 'future') return <span className="chip chip-neutral">规划中</span>;
  return <span className="chip chip-info">建设中</span>;
}

export default function ClusterTable({
  clusters,
  roomById,
  stages,
  hasFilters,
  onOpenCluster,
  onReset,
}: ClusterTableProps) {
  const stageList = stages.length ? stages : DEFAULT_STAGES;
  const totalStages = stageList.length;

  const sorted = [...clusters].sort((a, b) => {
    const byPhase = (PHASE_RANK[a.phase] ?? 9) - (PHASE_RANK[b.phase] ?? 9);
    if (byPhase !== 0) return byPhase;
    return startMs(a) - startMs(b);
  });

  if (!sorted.length) {
    return (
      <div className="empty-state cd-pipeline-empty">
        <span className="mat">list_alt</span>
        <div>当前筛选下没有集群</div>
        {hasFilters ? (
          <button type="button" className="btn btn-ghost btn-sm cd-empty-action" onClick={onReset}>
            重置筛选
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="cd-cluster-scroll">
      <div className="cd-cluster-table">
        <div className="cd-cluster-row cd-cluster-head">
          <span>集群 / 集群组</span>
          <span>VDC</span>
          <span>类型 / 业务</span>
          <span>时间阶段</span>
          <span>集群建设阶段</span>
          <span>建设时间</span>
          <span>负责人</span>
          <span>耗时 / SLA</span>
          <span>阻塞 / 下一步</span>
        </div>
        {sorted.map((cluster) => {
          const room = roomById.get(cluster.roomId);
          const completed =
            cluster.phase === 'past' ? totalStages : Math.min(cluster.stageIndex, totalStages);
          const currentStage =
            cluster.phase === 'past'
              ? null
              : stageList[Math.min(cluster.stageIndex, totalStages - 1)];
          const stageName =
            cluster.phase === 'past'
              ? '已完成'
              : cluster.phase === 'future'
                ? stageList[0]?.name ?? '确认需求'
                : currentStage?.name ?? '—';
          const timeLabel = cluster.phase === 'past' ? '交付' : '目标';
          const endDate =
            cluster.phase === 'past'
              ? cluster.deliveredDate ?? cluster.planEndDate
              : cluster.planEndDate;
          const sla = cluster.slaDays ?? 30;
          const actual = cluster.duration.actual;
          const over = actual === null ? null : actual - sla;

          const riskText = cluster.risk?.text ?? cluster.blocker ?? '';
          const blockText = riskText || cluster.next || '—';
          const blockClass = cluster.risk
            ? `cd-block ${cluster.risk.level === 'err' ? 'cd-block--err' : 'cd-block--warn'}`
            : cluster.blocker
              ? 'cd-block cd-block--err'
              : 'cd-block';
          const vdc = (room?.vdc ?? room?.id ?? cluster.roomId).toLowerCase();

          return (
            <div
              key={cluster.id}
              className="cd-cluster-row"
              role="button"
              tabIndex={0}
              data-cluster={cluster.id}
              aria-label={`查看 ${cluster.name} 的阶段详情`}
              onClick={() => onOpenCluster(cluster.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpenCluster(cluster.id);
                }
              }}
            >
              <div className="cd-cluster-name">
                <span className="cd-tree-mark" />
                <div>
                  <b title={cluster.name}>{cluster.name}</b>
                  <small>{cluster.group || '—'}</small>
                </div>
              </div>
              <span className="cd-cluster-vdc">{vdc}</span>
              <div className="cd-cluster-type">
                <span className="cd-cluster-type-main">{cluster.type}</span>
                <span className="cd-cluster-type-sub">{cluster.tenant || '—'}</span>
              </div>
              <div>{statusChip(cluster)}</div>
              <div className="cd-cluster-stage">
                <div className="cd-cluster-stage-name">{stageName}</div>
                <div className="cd-steps">
                  {stageList.map((stage, index) => {
                    const done = index < completed;
                    const current = index === completed && cluster.phase !== 'past';
                    return (
                      <span
                        key={stage.key}
                        className={`cd-step${done ? ' done' : current ? ' current' : ''}`}
                        title={stage.name}
                      >
                        {done ? '✓' : index + 1}
                      </span>
                    );
                  })}
                </div>
                <div className="cd-cluster-stage-meta">
                  {completed}/{totalStages} 环节完成
                </div>
              </div>
              <div className="cd-cluster-time">
                <span className="cd-cluster-time-row">启动 {cluster.startDate ?? '待确认'}</span>
                <span className="cd-cluster-time-row">
                  {timeLabel} {endDate ?? '待确认'}
                </span>
              </div>
              <div className="cd-cluster-owner">{cluster.owner}</div>
              <div className="cd-cluster-sla">
                {actual === null ? (
                  <>
                    <b>—</b>
                    <small>SLA {sla} 天</small>
                  </>
                ) : (
                  <>
                    <b className={over !== null && over > 0 ? 'cd-sla-over' : undefined}>{actual}天</b>
                    <small className={over !== null && over > 0 ? 'cd-sla-over' : undefined}>
                      SLA {sla}天{over !== null && over > 0 ? ` · 超${over}天` : ''}
                    </small>
                  </>
                )}
              </div>
              <div className={blockClass} title={blockText}>
                {riskText ? <span className="mat">warning</span> : null}
                <span className="cd-block-text">{blockText}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
