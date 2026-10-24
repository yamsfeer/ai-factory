import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AuditEntry, BootstrapPayload, ClusterStageDef, ClusterView, StageStatus } from '@shared/types';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { Chip, ErrorBox, Icon, Loading, type ChipTone } from '../../ui/primitives';
import ClusterStageEditor from './ClusterStageEditor';
import { useToast } from '../../ui/feedback';
import './delivery-drawer.css';

export interface ClusterDrawerProps {
  clusterId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

interface ClusterDetailPayload {
  cluster: ClusterView;
  audit: AuditEntry[];
}

const STAGE_STATUS_META: Record<StageStatus, { label: string; tone: ChipTone }> = {
  todo: { label: '待处理', tone: 'neutral' },
  doing: { label: '进行中', tone: 'info' },
  done: { label: '已完成', tone: 'ok' },
  skip: { label: '不适用', tone: 'neutral' },
};

const STAGE_STATUS_OPTIONS: StageStatus[] = ['todo', 'doing', 'done', 'skip'];

const CLUSTER_STATUS_META: Record<string, { label: string; tone: ChipTone }> = {
  delivered: { label: '已交付', tone: 'ok' },
  building: { label: '建设中', tone: 'info' },
  blocked: { label: '有阻塞', tone: 'err' },
  planned: { label: '规划中', tone: 'neutral' },
  pending: { label: '待启动', tone: 'warn' },
};

const FALLBACK_TYPES = ['训练', '推理', '通用', '微服务', '弹性池'];

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function fmtDate(value: string | null | undefined) {
  return value ? value.replaceAll('-', '.') : '待确认';
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const start = Date.parse(`${a}T00:00:00Z`);
  const end = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 86400000);
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : '请求失败，请稍后重试';
}

export default function ClusterDrawer({ clusterId, onClose, onChanged }: ClusterDrawerProps) {
  const { push: toast } = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [openStages, setOpenStages] = useState<Set<number>>(new Set());
  const [editStage, setEditStage] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState<StageStatus>('todo');
  const [subEditor, setSubEditor] = useState<{ stageIndex: number; subIndex: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const detail = useApi<ClusterDetailPayload | null>(
    () => (clusterId ? api.cluster(clusterId) : Promise.resolve(null)),
    [clusterId],
  );
  const boot = useApi<BootstrapPayload>(() => api.bootstrap(), []);

  const cluster = detail.data?.cluster && detail.data.cluster.id === clusterId ? detail.data.cluster : null;
  const stages: ClusterStageDef[] = boot.data?.stages.cluster ?? [];

  const typeOptions = useMemo(() => {
    const values = [...(boot.data?.options.types ?? []), ...FALLBACK_TYPES];
    if (cluster?.type) values.unshift(cluster.type);
    return [...new Set(values.filter(Boolean))];
  }, [boot.data?.options.types, cluster?.type]);

  const tenantOptions = boot.data?.options.tenants ?? [];
  const ownerOptions = boot.data?.options.owners ?? [];

  /* 切换集群时清空抽屉内的临时视图状态。 */
  useEffect(() => {
    setOpenStages(new Set());
    setEditStage(null);
    setSubEditor(null);
    setEditing(false);
    setBusy(null);
  }, [clusterId]);

  /* 首次拿到集群数据时默认展开当前环节。 */
  useEffect(() => {
    if (!cluster) return;
    setOpenStages((previous) => (previous.size ? previous : new Set([Math.min(cluster.stageIndex, 5)])));
  }, [cluster?.id]);

  /* 抽屉打开期间锁定页面、把页面主体移出可访问树。 */
  useEffect(() => {
    if (!clusterId) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    document.body.classList.add('cd-drawer-open');
    const background = ['#main', '#app-sidebar', '.app-header']
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .filter((element): element is HTMLElement => Boolean(element));
    background.forEach((element) => {
      element.inert = true;
    });
    const timer = window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 0);
    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove('cd-drawer-open');
      background.forEach((element) => {
        element.inert = false;
      });
      returnFocus.current?.focus?.({ preventScroll: true });
    };
  }, [clusterId]);

  /* Esc：先关子项编辑器，再退出编辑表单，最后关抽屉。 */
  useEffect(() => {
    if (!clusterId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (subEditor) {
        setSubEditor(null);
      } else if (editing) {
        setEditing(false);
      } else {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [clusterId, subEditor, editing, onClose]);

  if (!clusterId) return null;

  const statusMeta = cluster ? CLUSTER_STATUS_META[cluster.status] ?? CLUSTER_STATUS_META.building : null;
  const stageStatus = (index: number): StageStatus =>
    cluster?.delivery.find((stage) => stage.index === index)?.status ?? 'todo';

  const close = () => {
    setSubEditor(null);
    setEditing(false);
    onClose();
  };

  const apply = (payload: ClusterDetailPayload) => {
    detail.setData(payload);
    onChanged();
  };

  const toggleStage = (index: number) => {
    setOpenStages((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const beginEditStage = (index: number) => {
    setSubEditor(null);
    setOpenStages((previous) => new Set(previous).add(index));
    setEditStage((previous) => (previous === index ? null : index));
    setDraftStatus(stageStatus(index));
  };

  const changeStageStatus = async (index: number, status: StageStatus) => {
    if (!cluster) return;
    const definition = stages[index];
    setBusy(`stage:${index}`);
    try {
      const payload = await api.setDeliveryStatus(cluster.id, index, status);
      apply(payload);
      setEditStage(null);
      toast(`「${definition?.name ?? '环节'}」已更新为${STAGE_STATUS_META[status].label}`);
    } catch (error) {
      toast(errorMessage(error), 'err');
    } finally {
      setBusy(null);
    }
  };

  const toggleCheck = async (stageIndex: number, key: string, value: boolean, name: string): Promise<boolean> => {
    if (!cluster || busy) return false;
    setBusy(`check:${stageIndex}:${key}`);
    try {
      const payload = await api.setDeliveryCheck(cluster.id, stageIndex, key, value);
      apply(payload);
      toast(`${value ? '已勾选' : '已取消'}「${name}」`);
      return true;
    } catch (error) {
      toast(errorMessage(error), 'err');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const openSubEditor = (stageIndex: number, subIndex: number) => {
    setEditStage(null);
    setOpenStages((previous) => new Set(previous).add(stageIndex));
    setSubEditor({ stageIndex, subIndex });
  };

  const saveCluster = async (body: Record<string, unknown>) => {
    if (!cluster) return;
    setBusy('cluster');
    try {
      const payload = await api.updateCluster(cluster.id, body);
      apply(payload);
      setEditing(false);
      toast('集群信息已保存');
    } catch (error) {
      toast(errorMessage(error), 'err');
    } finally {
      setBusy(null);
    }
  };

  const deleteCluster = async () => {
    if (!cluster) return;
    setBusy('delete');
    try {
      await api.deleteCluster(cluster.id);
      toast(`已删除「${cluster.name}」`);
      onClose();
      onChanged();
    } catch (error) {
      toast(errorMessage(error), 'err');
    } finally {
      setBusy(null);
    }
  };

  const subEditorOverlay = (() => {
    if (!subEditor || !cluster) return null;
    const definition = stages[subEditor.stageIndex];
    const sub = definition?.subItems[subEditor.subIndex];
    if (!definition || !sub) return null;
    const delivery = cluster.delivery.find((stage) => stage.index === subEditor.stageIndex);
    const checked = Boolean(delivery?.checks?.[sub.key]);
    const status = stageStatus(subEditor.stageIndex);
    return (
      <ClusterStageEditor
        stageIndex={subEditor.stageIndex}
        stageName={definition.name}
        stageDesc={definition.desc}
        sub={sub}
        checked={checked}
        status={status}
        busy={busy !== null}
        onClose={() => setSubEditor(null)}
        onToggle={async () => {
          const ok = await toggleCheck(subEditor.stageIndex, sub.key, !checked, sub.name);
          if (ok) setSubEditor(null);
        }}
      />
    );
  })();

  const body = (() => {
    if (detail.loading || boot.loading) return <Loading label="加载集群详情…" />;
    if (detail.error) return <ErrorBox error={detail.error} onRetry={detail.reload} />;
    if (boot.error) return <ErrorBox error={boot.error} onRetry={boot.reload} />;
    if (!cluster) return null;
    if (editing) {
      return (
        <ClusterEditForm
          cluster={cluster}
          types={typeOptions}
          tenants={tenantOptions}
          owners={ownerOptions}
          busy={busy === 'cluster' || busy === 'delete'}
          onSave={saveCluster}
          onDelete={deleteCluster}
          onCancel={() => setEditing(false)}
        />
      );
    }

    const doneCount = stages.filter((_, index) => {
      const status = stageStatus(index);
      return status === 'done' || status === 'skip';
    }).length;
    const stageIndex = cluster.stageIndex;
    const currentDefinition = stageIndex < stages.length ? stages[stageIndex] : null;
    const currentDelivery = cluster.delivery.find((stage) => stage.index === stageIndex);
    const currentChecked = currentDefinition
      ? currentDefinition.subItems.filter((item) => currentDelivery?.checks?.[item.key]).length
      : 0;
    const duration = cluster.duration;
    const planDays = daysBetween(cluster.startDate, cluster.planEndDate);
    const durationMain = duration.actual === null ? '—' : `${duration.actual} 天`;
    const over = duration.over;
    const overText = over === null ? '' : over > 0 ? ` · 超 ${over} 天` : ` · 余 ${Math.abs(over)} 天`;
    const risk = cluster.phase === 'past' ? null : cluster.risk;
    const nextText =
      cluster.phase === 'past'
        ? '六环节流程已完成'
        : cluster.next || '推进当前环节及子项';
    const currentSubText =
      stageIndex >= stages.length
        ? '六环节全部完成'
        : currentDefinition
          ? `子项 ${currentChecked}/${currentDefinition.subItems.length} 已完成`
          : '—';

    return (
      <>
        <div className="cd-drawer-badges">
          {statusMeta ? <Chip tone={statusMeta.tone}>{statusMeta.label}</Chip> : null}
          <Chip tone="neutral">{cluster.type}</Chip>
          {risk ? <Chip tone={risk.level === 'err' ? 'err' : 'warn'}>{risk.short}</Chip> : null}
        </div>

        <div className="delivery-progress-summary">
          <div className="delivery-progress" aria-label="六环节进度">
            {stages.map((stage, index) => {
              const status = stageStatus(index);
              const state =
                status === 'done'
                  ? 'done'
                  : status === 'skip'
                    ? 'skip'
                    : index === stageIndex
                      ? 'current'
                      : 'todo';
              return (
                <div key={stage.key} className={`delivery-progress-step ${state}`}>
                  <span className="delivery-progress-dot">{state === 'done' ? '✓' : index + 1}</span>
                  <span className="delivery-progress-name">{stage.short || stage.name}</span>
                </div>
              );
            })}
          </div>
          <div className="delivery-progress-meta">
            <span>
              {doneCount}/{stages.length} 环节完成
              {currentDefinition ? ` · 当前「${currentDefinition.name}」` : ' · 已交付'}
            </span>
            <span>{currentSubText}</span>
          </div>
        </div>

        <div className="cd-drawer-grid">
          <div className="cd-drawer-cell">
            <label>当前环节</label>
            <b>
              {stageIndex >= stages.length ? '6/6 · 已完成' : `${stageIndex + 1}/${stages.length} · ${currentDefinition?.name ?? '—'}`}
            </b>
            <small>{currentSubText}</small>
          </div>
          <div className="cd-drawer-cell">
            <label>负责人</label>
            <b>{cluster.owner || '待确认'}</b>
            <small>{cluster.phase === 'past' ? '已交付' : cluster.phase === 'future' ? '尚未启动' : '交付推进中'}</small>
          </div>
          <div className="cd-drawer-cell">
            <label>类型 / 业务方</label>
            <b>{cluster.type}</b>
            <small>{cluster.tenant || '业务方待确认'}</small>
          </div>
          <div className="cd-drawer-cell">
            <label>耗时 / SLA</label>
            <b>{durationMain}</b>
            <small>
              {planDays === null ? '计划窗口待确认' : `计划 ${planDays} 天`} · SLA {duration.sla ?? cluster.slaDays ?? '待定'} 天
              {overText}
            </small>
          </div>
          <div className="cd-drawer-cell">
            <label>开始 / 计划完成</label>
            <b>{fmtDate(cluster.startDate)}</b>
            <small>计划完成 {fmtDate(cluster.planEndDate)}</small>
          </div>
          <div className="cd-drawer-cell">
            <label>交付日期</label>
            <b>{cluster.deliveredDate ? fmtDate(cluster.deliveredDate) : '未交付'}</b>
            <small>{cluster.origin === 'batch' ? '来自批次计划' : '独立登记'}</small>
          </div>
          <div className={`cd-drawer-cell delivery-span-2${cluster.blocker ? ' delivery-blocker-cell' : ''}`}>
            <label>阻塞原因</label>
            <b className={cluster.blocker ? 'delivery-blocker' : 'delivery-muted'}>
              {cluster.blocker ? <Icon name="error" /> : null}
              {cluster.blocker || '无阻塞'}
            </b>
          </div>
        </div>

        {risk ? (
          <div className={`cd-callout cd-callout--${risk.level}`}>
            <span className="mat">{risk.level === 'err' ? 'error' : 'warning'}</span>
            <div>
              <b>{risk.short}</b>
              <p>{risk.text}</p>
            </div>
          </div>
        ) : null}

        <section>
          <h3>阶段与子项</h3>
          <div className="cd-stage-list">
            {stages.map((stage, index) => {
              const status = stageStatus(index);
              const delivery = cluster.delivery.find((item) => item.index === index);
              const checkedCount = stage.subItems.filter((item) => delivery?.checks?.[item.key]).length;
              const isDone = status === 'done' || status === 'skip';
              const firstUnchecked = stage.subItems.findIndex((item) => !delivery?.checks?.[item.key]);
              const meta = isDone
                ? `${checkedCount}/${stage.subItems.length} 项完成 · 基线 ${stage.baseline} 天`
                : status === 'doing'
                  ? `${checkedCount}/${stage.subItems.length} 项完成 · 基线 ${stage.baseline} 天`
                  : `${stage.subItems.length} 项 · 基线 ${stage.baseline} 天`;
              const dotClass = status === 'done' ? 'done' : status === 'doing' ? 'doing' : status === 'skip' ? 'skip' : '';
              return (
                <details
                  key={stage.key}
                  className="cd-stage-acc"
                  open={openStages.has(index)}
                  onToggle={(event) => {
                    if (event.currentTarget.open !== openStages.has(index)) toggleStage(index);
                  }}
                >
                  <summary>
                    <span className={`cd-stage-acc-dot ${dotClass}`} />
                    <span className="cd-stage-acc-sum">
                      <span className="cd-stage-acc-name">
                        {pad2(index + 1)} {stage.name}
                        <Chip tone={STAGE_STATUS_META[status].tone}>{STAGE_STATUS_META[status].label}</Chip>
                      </span>
                      <span className="cd-stage-acc-meta">{meta}</span>
                    </span>
                    <span className="mat cd-stage-acc-chevron">expand_more</span>
                    <button
                      type="button"
                      className="cd-stage-edit-btn"
                      title="编辑阶段状态"
                      aria-label={`编辑「${stage.name}」阶段状态`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        beginEditStage(index);
                      }}
                    >
                      <Icon name="edit" />
                    </button>
                  </summary>
                  <div className="cd-stage-acc-body">
                    <p className="cd-stage-desc-inline">{stage.desc}</p>
                    <div className="cd-sub-list">
                      {stage.subItems.map((sub, subIndex) => {
                        const checked = Boolean(delivery?.checks?.[sub.key]);
                        const rowState = checked ? 'done' : index === cluster.stageIndex && subIndex === firstUnchecked ? 'doing' : 'todo';
                        return (
                          <div key={sub.key} className={`cd-sub-item delivery-sub ${rowState}`}>
                            <label
                              className="delivery-check"
                              title={isDone ? '该环节已完成，请先把环节状态改回进行中' : checked ? '取消完成' : '标记完成'}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={isDone || busy !== null}
                                aria-label={`${checked ? '取消完成' : '标记完成'}「${sub.name}」`}
                                onChange={(event) => void toggleCheck(index, sub.key, event.target.checked, sub.name)}
                              />
                              <span className="delivery-check-box" aria-hidden="true" />
                            </label>
                            <button
                              type="button"
                              className="delivery-sub-open"
                              onClick={() => openSubEditor(index, subIndex)}
                              aria-label={`查看子项：${sub.name}`}
                            >
                              <span className="cd-sub-label">
                                <span className="cd-sub-name">{sub.name}</span>
                                {sub.detail?.length ? (
                                  <span className="cd-sub-tags">
                                    {sub.detail.map((line) => (
                                      <span key={line}>{line}</span>
                                    ))}
                                  </span>
                                ) : null}
                              </span>
                              <span className="mat cd-sub-chevron">chevron_right</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {editStage === index ? (
                      <div className="cd-stage-edit-panel">
                        <div className="cd-stage-edit-form">
                          <label className="cd-form-field cd-form-field--inline">
                            <span>环节状态</span>
                            <select
                              value={draftStatus}
                              onChange={(event) => setDraftStatus(event.target.value as StageStatus)}
                              disabled={busy !== null}
                              aria-label="环节状态"
                            >
                              {STAGE_STATUS_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                  {STAGE_STATUS_META[option].label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="cd-stage-edit-actions">
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditStage(null)}>
                              取消
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={busy !== null || draftStatus === status}
                              onClick={() => void changeStageStatus(index, draftStatus)}
                            >
                              {busy === `stage:${index}` ? '保存中…' : '保存'}
                            </button>
                          </div>
                        </div>
                        <p className="delivery-stage-hint">
                          标记「已完成」会同时勾选本环节全部子项；六个环节全部完成或不适用后，集群自动记为已交付。
                        </p>
                      </div>
                    ) : null}
                  </div>
                </details>
              );
            })}
          </div>
          <div className="delivery-next">
            <Icon name="arrow_forward" />
            <span>
              <b>下一步：</b>
              {nextText}
            </span>
          </div>
        </section>
      </>
    );
  })();

  return createPortal(
    <>
      <div className="cd-drawer-backdrop open" onClick={close} />
      <aside
        className="cd-drawer open"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-drawer-title"
        data-delivery-drawer
      >
        <div className="cd-drawer-head">
          <div className="cd-drawer-title">
            <b id="delivery-drawer-title">{cluster?.name ?? '集群详情'}</b>
            <span id="delivery-drawer-sub" className="delivery-drawer-crumb">
              {cluster ? (
                <>
                  <span>{cluster.roomName}</span>
                  <Icon name="chevron_right" />
                  <span>{cluster.vdc || 'VDC 待确认'}</span>
                  <span>· {statusMeta?.label ?? '建设中'}</span>
                </>
              ) : (
                '加载中…'
              )}
            </span>
          </div>
          <div className="delivery-drawer-actions">
            {cluster && !editing ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSubEditor(null);
                  setEditing(true);
                  setEditStage(null);
                }}
                aria-label="编辑集群"
              >
                <Icon name="edit" />
                编辑
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={close}
              aria-label="关闭详情"
              ref={closeRef}
            >
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className="cd-drawer-body">{body}</div>
        {subEditorOverlay}
      </aside>
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------------ */
/* 编辑集群表单                                                        */
/* ------------------------------------------------------------------ */

function ClusterEditForm({
  cluster,
  types,
  tenants,
  owners,
  busy,
  onSave,
  onDelete,
  onCancel,
}: {
  cluster: ClusterView;
  types: string[];
  tenants: string[];
  owners: string[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}) {
  const [owner, setOwner] = useState(cluster.owner ?? '');
  const [type, setType] = useState(cluster.type);
  const [tenant, setTenant] = useState(cluster.tenant ?? '');
  const [vdc, setVdc] = useState(cluster.vdc ?? '');
  const [group, setGroup] = useState(cluster.group ?? '');
  const [startDate, setStartDate] = useState(cluster.startDate ?? '');
  const [planEndDate, setPlanEndDate] = useState(cluster.planEndDate ?? '');
  const [slaDays, setSlaDays] = useState(cluster.slaDays === null ? '' : String(cluster.slaDays));
  const [blocker, setBlocker] = useState(cluster.blocker ?? '');
  const [next, setNext] = useState(cluster.next ?? '');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (startDate && planEndDate && planEndDate < startDate) {
      setError('计划完成日期不能早于开始日期');
      return;
    }
    setWorking(true);
    try {
      await onSave({
        owner: owner.trim() || '待确认',
        type,
        tenant: tenant.trim() || '待确认',
        vdc: vdc.trim() || null,
        group: group.trim() || null,
        startDate: startDate || null,
        planEndDate: planEndDate || null,
        slaDays: slaDays.trim() === '' ? null : Math.max(0, Number(slaDays) || 0),
        blocker: blocker.trim(),
        next: next.trim(),
      });
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    setWorking(true);
    try {
      await onDelete();
    } finally {
      setWorking(false);
    }
  };

  return (
    <section>
      <h3>编辑集群</h3>
      <form className="cd-form" onSubmit={(event) => void submit(event)}>
        <div className="cd-form-grid">
          <label className="cd-form-field">
            <span>负责人</span>
            <input value={owner} onChange={(event) => setOwner(event.target.value)} list="delivery-owner-options" placeholder="负责人姓名" />
            <datalist id="delivery-owner-options">
              {owners.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
          <label className="cd-form-field">
            <span>类型</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              {types.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="cd-form-field">
            <span>业务方</span>
            <input value={tenant} onChange={(event) => setTenant(event.target.value)} list="delivery-tenant-options" placeholder="如 Seed / Flow" />
            <datalist id="delivery-tenant-options">
              {tenants.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
          <label className="cd-form-field">
            <span>VDC</span>
            <input value={vdc} onChange={(event) => setVdc(event.target.value)} placeholder="如 wlby" />
          </label>
          <label className="cd-form-field">
            <span>集群组</span>
            <input value={group} onChange={(event) => setGroup(event.target.value)} placeholder="如 Core" />
          </label>
          <label className="cd-form-field">
            <span>SLA 天数</span>
            <input
              type="number"
              min={0}
              max={365}
              value={slaDays}
              onChange={(event) => setSlaDays(event.target.value)}
              placeholder="如 30"
            />
          </label>
          <label className="cd-form-field">
            <span>开始日期</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="cd-form-field">
            <span>计划完成</span>
            <input type="date" value={planEndDate} onChange={(event) => setPlanEndDate(event.target.value)} />
          </label>
          <label className="cd-form-field full">
            <span>阻塞原因</span>
            <input value={blocker} onChange={(event) => setBlocker(event.target.value)} placeholder="留空表示无阻塞" />
          </label>
          <label className="cd-form-field full">
            <span>下一步</span>
            <input value={next} onChange={(event) => setNext(event.target.value)} placeholder="如：推进「BKE 创建」及子项" />
          </label>
        </div>
        {error ? <div className="cd-form-error" role="alert">{error}</div> : null}
        <div className="cd-form-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={working || busy}>
            取消
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={working || busy}>
            {working ? '保存中…' : '保存'}
          </button>
        </div>
      </form>
      <div className="delivery-delete">
        {confirmDelete ? (
          <div className="delivery-delete-confirm" role="alert">
            <span>确认删除「{cluster.name}」？删除后不可恢复。</span>
            <div className="delivery-delete-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)} disabled={working}>
                取消
              </button>
              <button type="button" className="btn btn-sm delivery-btn-danger" onClick={() => void remove()} disabled={working}>
                {working ? '删除中…' : '确认删除'}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm delivery-danger-text" onClick={() => setConfirmDelete(true)}>
            <Icon name="delete" />
            删除集群
          </button>
        )}
      </div>
    </section>
  );
}

