import { useEffect, useRef, useState } from 'react';
import type {
  BootstrapPayload,
  ClusterView,
  EnvStatus,
  RoomDetailPayload,
  RoomView,
  StageStatus,
} from '@shared/types';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useToast } from '../../ui/feedback';
import { Chip, ErrorBox, Icon, Loading } from '../../ui/primitives';
import RoomStagePanel from './RoomStagePanel';
import { ClusterAddPanel, ClusterDetailPanel, ClusterListPanel, clusterStageName } from './RoomClusterList';
import './room-detail.css';

export interface RoomDetailDrawerProps {
  roomId: string | null;
  initialClusterId?: string | null;
  onClose: () => void;
  onChanged: () => void;
}

type DrawerView =
  | { kind: 'overview' }
  | { kind: 'clusters' }
  | { kind: 'addCluster' }
  | { kind: 'cluster'; id: string };

const AREA_LABEL: Record<string, string> = { cn: '中国', overseas: '非中' };
const ROOM_STATUS_LABEL: Record<string, string> = { delivered: '已交付', building: '建设中', blocked: '有阻塞', planned: '规划中' };
const ROOM_STATUS_TONE: Record<string, 'ok' | 'info' | 'warn' | 'neutral'> = {
  delivered: 'ok',
  building: 'info',
  blocked: 'warn',
  planned: 'neutral',
};
const STAGE_STATUS_LABEL: Record<string, string> = { todo: '待处理', doing: '进行中', done: '已完成', skip: '不适用' };
const ENV_STATUS_LABEL: Record<EnvStatus, string> = { pending: '待处理', doing: '进行中', done: '已完成', skip: '不适用' };

const errorMessage = (error: unknown) => (error instanceof Error && error.message ? error.message : '操作失败，请重试');

const dotClass = (status: string) => {
  if (status === 'delivered') return 'delivered';
  if (status === 'blocked') return 'blocked';
  if (status === 'building') return 'building';
  return '';
};

const dateText = (value: string | null | undefined) => value || '待确认';

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <small>{label}</small>
      <b>{value || '待确认'}</b>
      {hint ? <span className="rbd-fact-hint">{hint}</span> : null}
    </div>
  );
}

export default function RoomDetailDrawer({ roomId, initialClusterId, onClose, onChanged }: RoomDetailDrawerProps) {
  const toast = useToast();
  const detail = useApi<RoomDetailPayload | null>(() => (roomId ? api.room(roomId) : Promise.resolve(null)), [roomId]);
  const boot = useApi<BootstrapPayload | null>(() => api.bootstrap(), []);
  const [view, setView] = useState<DrawerView>({ kind: 'overview' });
  const [panelStage, setPanelStage] = useState<number | null>(null);
  const [editingRoom, setEditingRoom] = useState(false);
  const [confirmRoomDelete, setConfirmRoomDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const appliedInitial = useRef<string | null>(null);

  const data = detail.data;
  const room = data?.room ?? null;
  const bootData = boot.data;
  const ready = Boolean(room && bootData && room.id === roomId);
  const error = detail.error ?? boot.error;
  const clusters = data?.clusters ?? [];
  const roomStages = bootData?.stages.room ?? [];
  const clusterStages = bootData?.stages.cluster ?? [];
  const envTemplates = bootData?.stages.envTemplates ?? [];
  const activeCluster = view.kind === 'cluster' ? clusters.find((cluster) => cluster.id === view.id) ?? null : null;
  const showOverview = ready && view.kind === 'overview';
  const showClusterList = ready && (view.kind === 'clusters' || (view.kind === 'cluster' && !activeCluster));

  /* 切换机房时回到概览并清理面板。 */
  useEffect(() => {
    if (!roomId) return;
    setView({ kind: 'overview' });
    setPanelStage(null);
    setEditingRoom(false);
    setConfirmRoomDelete(false);
    appliedInitial.current = null;
  }, [roomId]);

  /* 从清单直接打开某个集群。 */
  useEffect(() => {
    if (!roomId || !initialClusterId || !data || data.room.id !== roomId) return;
    if (appliedInitial.current === initialClusterId) return;
    if (!data.clusters.some((cluster) => cluster.id === initialClusterId)) return;
    appliedInitial.current = initialClusterId;
    setView({ kind: 'cluster', id: initialClusterId });
  }, [roomId, initialClusterId, data]);

  /* 抽屉打开时锁定页面滚动。 */
  useEffect(() => {
    if (!roomId) return;
    document.body.classList.add('rb-modal-open');
    return () => document.body.classList.remove('rb-modal-open');
  }, [roomId]);

  /* Esc：先关阶段面板，再关抽屉。 */
  useEffect(() => {
    if (!roomId) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (panelStage !== null) {
        setPanelStage(null);
        return;
      }
      if (editingRoom) {
        setEditingRoom(false);
        return;
      }
      if (confirmRoomDelete) {
        setConfirmRoomDelete(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [roomId, panelStage, editingRoom, confirmRoomDelete, onClose]);

  useEffect(() => {
    if (roomId) closeRef.current?.focus({ preventScroll: true });
  }, [roomId]);

  if (!roomId) return null;

  const applyPayload = (payload: RoomDetailPayload) => {
    detail.setData(payload);
    onChanged();
  };

  const mergeCluster = (updated: ClusterView) => {
    if (!data) return;
    detail.setData({ ...data, clusters: data.clusters.map((cluster) => (cluster.id === updated.id ? updated : cluster)) });
    onChanged();
  };

  const openOverview = () => {
    setPanelStage(null);
    setEditingRoom(false);
    setConfirmRoomDelete(false);
    setView({ kind: 'overview' });
  };
  const openClusterList = () => {
    setPanelStage(null);
    setEditingRoom(false);
    setView({ kind: 'clusters' });
  };
  const openCluster = (id: string) => {
    setPanelStage(null);
    setEditingRoom(false);
    setView({ kind: 'cluster', id });
  };
  const openAddCluster = () => {
    setPanelStage(null);
    setEditingRoom(false);
    setView({ kind: 'addCluster' });
  };

  const setStageStatus = async (index: number, status: StageStatus) => {
    if (!roomId) return false;
    setBusy(`stage-status:${index}`);
    try {
      const payload = await api.setStageStatus(roomId, index, status);
      applyPayload(payload);
      toast.push('阶段状态已更新');
      return true;
    } catch (err) {
      toast.push(errorMessage(err), 'err');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const commitField = async (index: number, itemId: string, value: string) => {
    if (!roomId) return false;
    setBusy(`field:${index}:${itemId}`);
    try {
      const payload = await api.setStageField(roomId, index, itemId, value);
      applyPayload(payload);
      toast.push('阶段子项已保存');
      return true;
    } catch (err) {
      toast.push(errorMessage(err), 'err');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const commitMeta = async (index: number, key: string, value: string) => {
    if (!roomId) return false;
    setBusy(`meta:${index}:${key}`);
    try {
      const payload = await api.setStageMeta(roomId, index, key, value);
      applyPayload(payload);
      toast.push('阶段登记已保存');
      return true;
    } catch (err) {
      toast.push(errorMessage(err), 'err');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const cycleEnv = async (key: string, next: EnvStatus) => {
    if (!roomId) return false;
    setBusy(`env:${key}`);
    try {
      const payload = await api.setEnvStatus(roomId, key, next);
      applyPayload(payload);
      toast.push(`环境项已更新为${ENV_STATUS_LABEL[next]}`);
      return true;
    } catch (err) {
      toast.push(errorMessage(err), 'err');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const addEnv = async (name: string, category: string) => {
    if (!roomId) return false;
    setBusy('env-add');
    try {
      const payload = await api.addEnvItem(roomId, name, category);
      applyPayload(payload);
      toast.push('已添加自定义环境项');
      return true;
    } catch (err) {
      toast.push(errorMessage(err), 'err');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteEnv = async (key: string) => {
    if (!roomId) return false;
    setBusy(`env-delete:${key}`);
    try {
      const payload = await api.deleteEnvItem(roomId, key);
      applyPayload(payload);
      toast.push('自定义环境项已删除');
      return true;
    } catch (err) {
      toast.push(errorMessage(err), 'err');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const createCluster = async (input: Parameters<typeof api.addCluster>[1]) => {
    if (!roomId) return '机房不存在';
    setBusy('cluster-add');
    try {
      const payload = await api.addCluster(roomId, input);
      applyPayload(payload);
      setView({ kind: 'clusters' });
      toast.push('集群已登记');
      return null;
    } catch (err) {
      toast.push(errorMessage(err), 'err');
      return errorMessage(err);
    } finally {
      setBusy(null);
    }
  };

  const saveCluster = async (clusterId: string, patch: Record<string, unknown>) => {
    setBusy('cluster-save');
    try {
      const result = await api.updateCluster(clusterId, patch);
      mergeCluster(result.cluster);
      toast.push('集群信息已更新');
      return null;
    } catch (err) {
      toast.push(errorMessage(err), 'err');
      return errorMessage(err);
    } finally {
      setBusy(null);
    }
  };

  const toggleCheck = async (clusterId: string, stageIndex: number, key: string, value: boolean) => {
    setBusy(`check:${clusterId}:${stageIndex}:${key}`);
    try {
      const result = await api.setDeliveryCheck(clusterId, stageIndex, key, value);
      mergeCluster(result.cluster);
      toast.push(value ? '子项已标记完成' : '子项已取消完成');
      return true;
    } catch (err) {
      toast.push(errorMessage(err), 'err');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const deleteCluster = async (clusterId: string) => {
    if (!roomId) return false;
    setBusy('cluster-delete');
    try {
      await api.deleteCluster(clusterId);
      const payload = await api.room(roomId);
      applyPayload(payload);
      setView({ kind: 'clusters' });
      setPanelStage(null);
      toast.push('集群已删除');
      return true;
    } catch (err) {
      toast.push(errorMessage(err), 'err');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveRoom = async (patch: Record<string, unknown>) => {
    if (!roomId) return '机房不存在';
    setBusy('room-save');
    try {
      const payload = await api.updateRoom(roomId, patch);
      applyPayload(payload);
      setEditingRoom(false);
      toast.push('机房信息已更新');
      return null;
    } catch (err) {
      toast.push(errorMessage(err), 'err');
      return errorMessage(err);
    } finally {
      setBusy(null);
    }
  };

  const deleteRoom = async () => {
    if (!roomId) return;
    setBusy('room-delete');
    try {
      await api.deleteRoom(roomId);
      toast.push('机房已删除');
      onChanged();
      onClose();
    } catch (err) {
      toast.push(errorMessage(err), 'err');
    } finally {
      setBusy(null);
    }
  };

  const headTitle = activeCluster?.name ?? (view.kind === 'addCluster' ? '登记集群' : view.kind === 'clusters' ? '机房内集群' : room?.name ?? '机房详情');
  const headContext = activeCluster ? '集群详情' : view.kind === 'addCluster' ? '登记集群' : view.kind === 'clusters' ? '机房内集群' : '机房概览';
  const headSub = room ? `内场 · ${AREA_LABEL[room.area] ?? room.area} · ${room.name} › ${headContext}` : '内场 · 机房详情';

  const renderOverview = (current: RoomView) => {
    const statusLabel = ROOM_STATUS_LABEL[current.status] ?? current.status;
    const statusTone = ROOM_STATUS_TONE[current.status] ?? 'neutral';
    const durationText =
      current.phase === 'future'
        ? '未启动'
        : current.duration.actual === null
          ? '待确认'
          : `${current.duration.actual} 天`;
    const nextText =
      current.blocker ||
      (current.phase === 'past'
        ? '完成交付归档，保留验收记录'
        : current.phase === 'future'
          ? '在上方维护建设阶段，补充启动时间、机房资源与集群建设计划'
          : `推进${roomStages[current.currentStage]?.name ?? '完成'}，跟踪机房内集群交付`);
    const recorded = current.summary.recorded;
    const planned = current.planCount;

    return (
      <section className="rb-cluster-detail">
        <div className="rb-cluster-detail-head">
          <div>
            <span className="rb-eyebrow">机房建设 · 内场 · {AREA_LABEL[current.area] ?? current.area}</span>
            <h3>{current.name}</h3>
          </div>
          <Chip tone={statusTone}>{statusLabel}</Chip>
        </div>

        {data?.risk ? (
          <div className={`rbd-risk ${data.risk.level === 'err' ? 'err' : ''}`} role="status">
            <Icon name="warning" />
            <div>
              <b>风险提示</b>
              <p>{data.risk.text}</p>
            </div>
          </div>
        ) : null}

        {confirmRoomDelete ? (
          <div className="rbd-confirm" role="alert">
            <Icon name="error_outline" />
            <div>
              <b>删除机房 {current.name}</b>
              <p>删除后该机房及其 {clusters.length} 个集群将一并移除，且不可恢复。</p>
            </div>
            <div className="rbd-confirm-actions">
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => setConfirmRoomDelete(false)}>
                取消
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy !== null} onClick={() => void deleteRoom()}>
                确认删除
              </button>
            </div>
          </div>
        ) : null}

        {editingRoom ? <RoomEditForm room={current} busy={busy !== null} onCancel={() => setEditingRoom(false)} onSave={saveRoom} /> : null}

        <div className="rb-cluster-facts">
          <Fact label="Region / VDC" value={`${current.region} / ${dateText(current.vdc)}`} />
          <Fact label="机房负责人" value={current.owner} />
          <Fact label="建设方向 / 业务" value={current.tenants.length ? `${current.line} / ${current.tenants.join(' / ')}` : current.line} />
          <Fact
            label="计划集群"
            value={planned === null ? '总数待确认' : `${planned} 个`}
            hint={`已录入 ${recorded} 个${planned !== null && planned !== recorded ? ` · 计划 ${planned}` : ''}`}
          />
          <Fact label={current.phase === 'future' ? '预计启动' : '启动时间'} value={dateText(current.startDate)} />
          <Fact
            label={current.phase === 'past' ? '实际完成' : '预计完成'}
            value={dateText(current.phase === 'past' ? current.deliveredDate : current.targetDate)}
          />
          <Fact label="机房耗时" value={durationText} />
          <Fact
            label="集群交付"
            value={`${current.summary.delivered} 个已交付 · ${current.summary.blocked} 个阻塞`}
            hint={`已交付 ${current.summary.delivered} / 计划 ${planned ?? '待确认'} · 阻塞 ${current.summary.blocked}`}
          />
        </div>

        <div className="rb-stage-heading">
          <b>机房建设阶段</b>
          <span>点击任一阶段，侧拉登记进展与子项</span>
        </div>
        <ol className="rb-stage-list rb-stage-cards">
          {roomStages.map((stage, index) => {
            const stageState = current.stages[index];
            const status = stageState?.status ?? 'todo';
            const fields = stageState?.fields ?? {};
            const metaOwner = stageState?.meta?.owner ?? '';
            const realItems = stage.items.filter((item) => item.type !== 'env');
            const filled = realItems.filter((item) => Boolean(fields[item.id])).length;
            const total = realItems.length;
            return (
              <li key={stage.key} className={`stg-${status}`}>
                <button type="button" className="rb-stage-card" data-stage-panel={index} onClick={() => setPanelStage(index)}>
                  <span className="rb-stage-mark">{status === 'done' ? '✓' : index + 1}</span>
                  <span className="rb-stage-card-main">
                    <span className="rb-stage-card-top">
                      <b>{stage.name}</b>
                      <em className={`rb-stage-pill st-${status}`}>{STAGE_STATUS_LABEL[status] ?? status}</em>
                    </span>
                    <small>{stage.meaning}</small>
                    <small className="rb-stage-card-meta">
                      {metaOwner ? `负责人 ${metaOwner} · ` : ''}
                      {filled}/{total} 项已填
                    </small>
                  </span>
                  <span className={`rb-stage-card-go ${filled === total ? 'all' : ''}`}>
                    <Icon name="chevron_right" />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className={`rb-next-action ${current.blocker ? 'blocked' : ''}`}>
          <Icon name={current.blocker ? 'error_outline' : 'arrow_forward'} />
          <div>
            <b>{current.blocker ? '机房阻塞' : '下一步'}</b>
            <p>{nextText}</p>
          </div>
        </div>

        {current.note ? <p className="rb-data-note">备注：{current.note}</p> : null}
        <p className="rb-data-note">
          机房六阶段（确认机房信息 → 机房预算提交 &amp; 3V创建 → 机房 KO → 机房部署 → 机房检查 → 完成）按本轮要求归并；
          阶段状态（待处理 / 进行中 / 已完成 / 不适用）会推进机房当前进度，并同步清单与时间线；机房部署阶段含环境项方块并支持自定义添加。
          机房交付独立验收，集群全部完成不自动表示机房已交付。
        </p>
      </section>
    );
  };

  const content = !ready ? (
    error ? (
      <div className="rb-drawer-body">
        <ErrorBox
          error={error}
          onRetry={() => {
            detail.reload();
            boot.reload();
          }}
        />
      </div>
    ) : (
      <div className="rb-drawer-body">
        <Loading />
      </div>
    )
  ) : (
    <div className="rb-drawer-body">
      <div className="rb-cluster-layout">
        <nav className="rb-cluster-nav" aria-label="机房与集群详情">
          <button
            type="button"
            className={`rb-cluster-select ${showOverview ? 'active' : ''}`}
            data-detail-room
            aria-pressed={showOverview}
            onClick={openOverview}
          >
            <b>机房概览</b>
            <small>六阶段 SOP · 环境项 · 排期</small>
          </button>
          <div className="rb-cluster-nav-head">
            <button type="button" className={`rbd-nav-head-btn ${showClusterList ? 'active' : ''}`} onClick={openClusterList}>
              机房内集群 <span>{clusters.length}</span>
            </button>
            <button type="button" className="rb-cluster-add" data-cluster-add aria-label="登记集群" onClick={openAddCluster}>
              <Icon name="add" />
              登记
            </button>
          </div>
          {clusters.map((cluster) => (
            <button
              key={cluster.id}
              type="button"
              className={`rb-cluster-select ${activeCluster?.id === cluster.id ? 'active' : ''}`}
              data-detail-cluster={cluster.id}
              aria-pressed={activeCluster?.id === cluster.id}
              onClick={() => openCluster(cluster.id)}
            >
              <span className="rb-cluster-select-top">
                <b>{cluster.name}</b>
                <span className={`rb-cluster-dot ${dotClass(cluster.status)}`} />
              </span>
              <small>
                {cluster.type} · {clusterStageName(cluster, clusterStages)}
              </small>
            </button>
          ))}
          {clusters.length === 0 ? <p className="rb-data-note rb-nav-empty">集群计划待补充，可点上方「登记」补充</p> : null}
        </nav>
        <div id="rb-detail-content">
          {view.kind === 'overview' && room ? renderOverview(room) : null}
          {showClusterList ? (
            <ClusterListPanel clusters={clusters} stages={clusterStages} busy={busy !== null} onOpen={openCluster} onAdd={openAddCluster} />
          ) : null}
          {room && view.kind === 'addCluster' ? (
            <ClusterAddPanel roomName={room.name} busy={busy !== null} onCreate={createCluster} onCancel={openClusterList} />
          ) : null}
          {room && activeCluster ? (
            <ClusterDetailPanel
              roomName={room.name}
              cluster={activeCluster}
              stages={clusterStages}
              busy={busy !== null}
              onToggleCheck={(stageIndex, key, value) => toggleCheck(activeCluster.id, stageIndex, key, value)}
              onSave={(patch) => saveCluster(activeCluster.id, patch)}
              onDelete={() => deleteCluster(activeCluster.id)}
              onBack={openClusterList}
            />
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="drawer-backdrop open" onClick={onClose} aria-hidden="true" />
      <aside className="drawer rb-drawer rb-cluster-drawer open" role="dialog" aria-modal="true" aria-labelledby="rb-drawer-title" aria-hidden="false">
        <div className="rb-drawer-head">
          <div className="rb-drawer-title">
            <b id="rb-drawer-title">{headTitle}</b>
            <span id="rb-drawer-sub">{headSub}</span>
          </div>
          <div className="rbd-head-actions">
            {ready && view.kind === 'overview' ? (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy !== null}
                  onClick={() => {
                    setConfirmRoomDelete(false);
                    setEditingRoom(true);
                  }}
                >
                  <Icon name="edit" />
                  编辑机房
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm rbd-danger"
                  disabled={busy !== null}
                  onClick={() => {
                    setEditingRoom(false);
                    setConfirmRoomDelete(true);
                  }}
                >
                  <Icon name="delete" />
                  删除机房
                </button>
              </>
            ) : null}
            <button ref={closeRef} type="button" className="btn btn-ghost btn-sm" id="rb-drawer-close" aria-label="关闭详情" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
        </div>
        {content}
        {ready && room && panelStage !== null && roomStages[panelStage] ? (
          <div id="rb-stage-panel-mount">
            <RoomStagePanel
              room={room}
              stageIndex={panelStage}
              definition={roomStages[panelStage]}
              clusterStages={clusterStages}
              envTemplates={envTemplates}
              clusters={clusters}
              busy={busy !== null}
              onClose={() => setPanelStage(null)}
              onSetStatus={setStageStatus}
              onCommitField={commitField}
              onCommitMeta={commitMeta}
              onCycleEnv={cycleEnv}
              onAddEnv={addEnv}
              onDeleteEnv={deleteEnv}
              onOpenCluster={openCluster}
              onAddCluster={openAddCluster}
            />
          </div>
        ) : null}
      </aside>
    </>
  );
}

function RoomEditForm({
  room,
  busy,
  onCancel,
  onSave,
}: {
  room: RoomView;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<string | null>;
}) {
  const [form, setForm] = useState({
    name: room.name,
    area: room.area,
    region: room.region,
    owner: room.owner,
    planCount: room.planCount === null ? '' : String(room.planCount),
    line: room.line,
    tenants: room.tenants.join(' / '),
    note: room.note,
    blocker: room.blocker,
  });
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const name = form.name.trim();
    if (!name) {
      setError('请填写机房名称');
      return;
    }
    const planCountText = form.planCount.trim();
    const planCount = planCountText === '' ? null : Number(planCountText);
    if (planCount !== null && (!Number.isInteger(planCount) || planCount < 0)) {
      setError('计划集群数必须是非负整数');
      return;
    }
    setError(null);
    const result = await onSave({
      name,
      area: form.area,
      region: form.region.trim() || '待确认',
      owner: form.owner.trim() || '待确认',
      planCount,
      line: form.line.trim() || '混合',
      tenants: form.tenants
        .split(/[,，、/]+/)
        .map((tenant) => tenant.trim())
        .filter(Boolean),
      note: form.note.trim(),
      blocker: form.blocker.trim(),
    });
    if (result) setError(result);
  };

  return (
    <div className="rbd-panel">
      <div className="rbd-panel-head">
        <b>编辑机房</b>
        <span className="rb-data-note">机房名称、负责人、计划与业务信息</span>
      </div>
      <div className="rb-sp-grid">
        <label className="rb-sp-field span-2">
          <span>机房名称</span>
          <input type="text" maxLength={40} value={form.name} disabled={busy} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
        </label>
        <label className="rb-sp-field">
          <span>区域</span>
          <select value={form.area} disabled={busy} onChange={(event) => setForm((prev) => ({ ...prev, area: event.target.value as RoomView['area'] }))}>
            <option value="cn">中国</option>
            <option value="overseas">非中</option>
          </select>
        </label>
        <label className="rb-sp-field">
          <span>Region</span>
          <input type="text" maxLength={40} value={form.region} disabled={busy} onChange={(event) => setForm((prev) => ({ ...prev, region: event.target.value }))} />
        </label>
        <label className="rb-sp-field">
          <span>机房负责人</span>
          <input type="text" maxLength={20} value={form.owner} disabled={busy} onChange={(event) => setForm((prev) => ({ ...prev, owner: event.target.value }))} />
        </label>
        <label className="rb-sp-field">
          <span>计划集群数</span>
          <input
            type="number"
            min={0}
            value={form.planCount}
            disabled={busy}
            placeholder="留空表示待确认"
            onChange={(event) => setForm((prev) => ({ ...prev, planCount: event.target.value }))}
          />
        </label>
        <label className="rb-sp-field">
          <span>建设方向 / 业务线</span>
          <input type="text" maxLength={10} value={form.line} disabled={busy} onChange={(event) => setForm((prev) => ({ ...prev, line: event.target.value }))} />
        </label>
        <label className="rb-sp-field">
          <span>业务方</span>
          <input
            type="text"
            value={form.tenants}
            disabled={busy}
            placeholder="多个用 / 分隔，如 Seed / TCE"
            onChange={(event) => setForm((prev) => ({ ...prev, tenants: event.target.value }))}
          />
        </label>
        <label className="rb-sp-field span-2">
          <span>备注</span>
          <textarea rows={2} maxLength={200} value={form.note} disabled={busy} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} />
        </label>
        <label className="rb-sp-field span-2">
          <span>阻塞说明</span>
          <textarea
            rows={2}
            maxLength={200}
            value={form.blocker}
            disabled={busy}
            placeholder="填写当前阻塞原因，留空表示无阻塞"
            onChange={(event) => setForm((prev) => ({ ...prev, blocker: event.target.value }))}
          />
        </label>
      </div>
      {error ? <p className="rb-modal-error">{error}</p> : null}
      <div className="rbd-panel-foot">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submit()}>
          <Icon name="check" />
          保存修改
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onCancel}>
          取消
        </button>
      </div>
    </div>
  );
}
