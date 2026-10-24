import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { BatchView, RoomView } from '@shared/types';
import { api } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { ErrorBox, Loading, PageShell, Section } from '../../ui/primitives';
import { useToast } from '../../ui/feedback';
import ClusterDrawer from './ClusterDrawer';
import RegisterClusterModal from './RegisterClusterModal';
import DeliveryTimeline, { buildTimelineAxis } from './DeliveryTimeline';
import ClusterTable from './ClusterTable';
import './delivery-page.css';

const TYPE_ORDER = ['训练', '推理', '通用', '微服务', '弹性池'];

export default function ClusterDeliveryPage() {
  const [params, setParams] = useSearchParams();
  const area = params.get('area') ?? '';
  const roomId = params.get('roomId') ?? '';
  const type = params.get('type') ?? '';
  const originParam = params.get('origin') ?? 'all';
  const origin: 'all' | 'new-first' | 'existing-add' =
    originParam === 'new-first' || originParam === 'existing-add' ? originParam : 'all';

  const [query, setQuery] = useState(params.get('query') ?? '');
  const debouncedQuery = useDebounced(query, 220);
  const [expanded, setExpanded] = useState(false);
  const [openCluster, setOpenCluster] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const next = params.get('query') ?? '';
    setQuery((previous) => (previous === next ? previous : next));
  }, [params]);

  const boot = useApi(() => api.bootstrap(), []);
  const rooms = useApi(() => api.rooms(), []);
  const clusters = useApi(
    () => api.clusters({ area, roomId, type, origin, query: debouncedQuery.trim() || undefined }),
    [area, roomId, type, origin, debouncedQuery],
  );
  const allClusters = useApi(() => api.clusters(), []);
  const batches = useApi(() => api.batches(), []);

  const today = boot.data?.today ?? '';
  const stageDefs = boot.data?.stages.cluster ?? [];
  const visible = clusters.data ?? [];

  const roomById = useMemo(() => new Map((rooms.data ?? []).map((room) => [room.id, room])), [rooms.data]);
  const batchById = useMemo(
    () => new Map((batches.data ?? []).map((batch) => [batch.id, batch])),
    [batches.data],
  );

  const typeOptions = useMemo(() => {
    const present = new Set([
      ...(boot.data?.options.types ?? []),
      ...(allClusters.data ?? []).map((cluster) => cluster.type),
    ]);
    return [
      ...TYPE_ORDER,
      ...[...present].filter((value) => !TYPE_ORDER.includes(value)).sort(),
    ];
  }, [boot.data, allClusters.data]);

  const axis = useMemo(
    () => buildTimelineAxis(allClusters.data ?? clusters.data ?? [], today),
    [allClusters.data, clusters.data, today],
  );

  const baseline = useMemo(() => {
    let sum = 0;
    return stageDefs.map((stage) => {
      sum += stage.baseline;
      return sum;
    });
  }, [stageDefs]);

  const stats = useMemo(() => {
    const past = visible.filter((cluster) => cluster.phase === 'past');
    const present = visible.filter((cluster) => cluster.phase === 'present');
    const future = visible.filter((cluster) => cluster.phase === 'future');
    const cycles = past
      .map((cluster) => cluster.duration.actual)
      .filter((value): value is number => value !== null);
    const avgCycle = cycles.length ? Math.round(cycles.reduce((sum, value) => sum + value, 0) / cycles.length) : null;
    const riskCount = present.filter((cluster) => cluster.risk).length;
    const stageOver = present.filter((cluster) => {
      if (cluster.duration.actual === null) return false;
      const index = Math.min(cluster.stageIndex, Math.max(baseline.length - 1, 0));
      const planned = baseline[index] ?? 30;
      return cluster.duration.actual > planned;
    }).length;
    const sourceOf = (cluster: (typeof visible)[number]) => {
      const batch = cluster.batchId ? batchById.get(cluster.batchId) : undefined;
      return batch?.origin === 'new-first' || cluster.origin === 'new-first' ? 'new-first' : 'existing-add';
    };
    const futureNew = future.filter((cluster) => sourceOf(cluster) === 'new-first').length;
    return {
      past: past.length,
      present: present.length,
      future: future.length,
      pastSites: new Set(past.map((cluster) => cluster.roomId)).size,
      avgCycle,
      riskCount,
      stageOver,
      futureNew,
      futureOld: future.length - futureNew,
    };
  }, [visible, baseline, batchById]);

  const sourceCounts = useMemo(() => {
    const all = allClusters.data ?? [];
    return {
      all: all.length,
      'new-first': all.filter((cluster) => cluster.origin === 'new-first').length,
      'existing-add': all.filter((cluster) => cluster.origin === 'existing-add').length,
    };
  }, [allClusters.data]);

  const hasFilters = Boolean(area || roomId || type || query.trim() || origin !== 'all');

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const reset = () => {
    setQuery('');
    setParams(new URLSearchParams(), { replace: true });
  };

  const reloadAll = () => {
    clusters.reload();
    allClusters.reload();
    batches.reload();
  };

  const handleExport = () => {
    const href = api.exportClustersUrl({
      area,
      roomId,
      type,
      origin,
      query: debouncedQuery.trim() || undefined,
    });
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `集群交付清单_${today || 'export'}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    toast.push(`已导出 ${visible.length} 个集群`);
  };

  const error = boot.error ?? clusters.error;
  const initialLoading = (boot.loading && !boot.data) || (clusters.loading && !clusters.data);

  return (
    <PageShell
      title="集群交付"
      description="登记集群建设需求、补充 SRE 建设方案，按六个阶段人工推进搭建与交付。"
      tools={
        <>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            data-cd-register
            onClick={() => setRegisterOpen(true)}
          >
            <span className="mat mat-sm">add</span>登记集群建设需求
          </button>
          <button type="button" className="btn btn-ghost btn-sm" data-cd-export onClick={handleExport}>
            <span className="mat mat-sm">download</span>导出清单
          </button>
        </>
      }
      filter={
        <div className="filterbar cd-filterbar">
          <label className="selwrap">
            <span className="flab">区域</span>
            <select
              className="filt"
              data-cd-filter="area"
              aria-label="区域"
              value={area}
              onChange={(event) => setParam('area', event.target.value)}
            >
              <option value="">全部区域</option>
              {(boot.data?.options.areas ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="selwrap">
            <span className="flab">机房</span>
            <select
              className="filt cd-room-select"
              data-cd-filter="roomId"
              aria-label="机房"
              value={roomId}
              onChange={(event) => setParam('roomId', event.target.value)}
            >
              <option value="">全部机房</option>
              {(rooms.data ?? []).map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label className="selwrap">
            <span className="flab">类型</span>
            <select
              className="filt"
              data-cd-filter="type"
              aria-label="集群类型"
              value={type}
              onChange={(event) => setParam('type', event.target.value)}
            >
              <option value="">全部类型</option>
              {typeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="rb-search cd-search">
            <span className="mat mat-sm">search</span>
            <input
              id="cd-search"
              type="search"
              aria-label="搜索机房、集群或负责人"
              placeholder="搜索机房 / 集群 / 负责人"
              autoComplete="off"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setParam('query', event.target.value);
              }}
            />
          </label>
          <button type="button" className="btn btn-ghost btn-sm" data-cd-reset onClick={reset}>
            重置
          </button>
          <span className="cd-filter-scope">数据截至 {today || '—'}</span>
        </div>
      }
    >
      {initialLoading ? (
        <Loading label="加载集群交付数据…" />
      ) : error ? (
        <ErrorBox
          error={error}
          onRetry={() => {
            boot.reload();
            rooms.reload();
            clusters.reload();
            allClusters.reload();
            batches.reload();
          }}
        />
      ) : (
        <div className="cd-page">
          <div className="cd-summary-cards">
            <div className="cd-summary-card past">
              <div className="cd-summary-top">
                <span className="cd-summary-icon">
                  <span className="mat">history</span>
                </span>
                <span className="cd-summary-label">过去 · 已交付集群</span>
                <span className="cd-summary-value">{stats.past}</span>
                <span className="cd-summary-unit">个集群</span>
              </div>
              <div className="cd-summary-sub">何时交付 · 谁负责</div>
              <div className="cd-summary-metrics">
                <span className="cd-summary-metric">
                  {stats.avgCycle === null ? (
                    '暂无已交付样本'
                  ) : (
                    <>
                      平均耗时 <b>{stats.avgCycle}</b> 天
                    </>
                  )}
                </span>
                <span className="cd-summary-metric">
                  <b>{stats.pastSites}</b> 个机房
                </span>
              </div>
            </div>
            <div className="cd-summary-card present">
              <div className="cd-summary-top">
                <span className="cd-summary-icon">
                  <span className="mat">pending_actions</span>
                </span>
                <span className="cd-summary-label">现在 · 在建集群</span>
                <span className="cd-summary-value">{stats.present}</span>
                <span className="cd-summary-unit">个集群</span>
              </div>
              <div className="cd-summary-sub">当前进度 · 目标时间 · 阻塞</div>
              <div className="cd-summary-metrics">
                <span className={`cd-summary-metric${stats.riskCount ? ' alert' : ''}`}>
                  <b>{stats.riskCount}</b> 有风险
                </span>
                <span className={`cd-summary-metric${stats.stageOver ? ' alert' : ''}`}>
                  <b>{stats.stageOver}</b> 阶段超基线
                </span>
              </div>
            </div>
            <div className="cd-summary-card future">
              <div className="cd-summary-top">
                <span className="cd-summary-icon">
                  <span className="mat">event_upcoming</span>
                </span>
                <span className="cd-summary-label">未来 · 规划中集群</span>
                <span className="cd-summary-value">{stats.future}</span>
                <span className="cd-summary-unit">个集群</span>
              </div>
              <div className="cd-summary-sub">何时启动 · 计划建什么</div>
              <div className="cd-summary-metrics">
                <span className="cd-summary-metric">
                  <b>{stats.futureNew}</b> 新机房首批
                </span>
                <span className="cd-summary-metric">
                  <b>{stats.futureOld}</b> 存量扩容
                </span>
              </div>
            </div>
          </div>

          <Section
            title="供给时间轴"
            icon="timeline"
            meta={<span className="csys-section-meta">{axis.label} · 按集群 · 三态同屏 · 条带即集群</span>}
          >
            <DeliveryTimeline
              clusters={visible}
              roomById={roomById}
              batchById={batchById}
              axis={axis}
              today={today}
              expanded={expanded}
              hasFilters={hasFilters}
              origin={origin}
              sourceCounts={sourceCounts}
              onOriginChange={(value) => setParam('origin', value === 'all' ? '' : value)}
              onToggleExpand={() => setExpanded((value) => !value)}
              onOpenCluster={setOpenCluster}
              onReset={reset}
            />
          </Section>

          <Section
            title="集群清单"
            icon="table_rows"
            meta={
              <span className="csys-section-meta">
                共 {visible.length} 个集群 · 集群 × VDC × 阶段 × 负责人 × SLA
              </span>
            }
          >
            <ClusterTable
              clusters={visible}
              roomById={roomById}
              stages={stageDefs}
              hasFilters={hasFilters}
              onOpenCluster={setOpenCluster}
              onReset={reset}
            />
          </Section>

          <p className="rb-data-note">
            截至 {today || '—'} · 阶段口径：确认需求 → 资源准备 + 机器重装 → BKE 创建 → 人工补齐 → 交付前检查 → 后置通知 ·
            条带即集群，与清单行同源可点击。
          </p>
        </div>
      )}

      <ClusterDrawer clusterId={openCluster} onClose={() => setOpenCluster(null)} onChanged={reloadAll} />
      <RegisterClusterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onCreated={() => reloadAll()}
      />
    </PageShell>
  );
}
