import { useState } from 'react';
import type { ClusterStageDef, ClusterView } from '@shared/types';
import { Chip, Empty, Icon } from '../../ui/primitives';
import './room-detail.css';

const CLUSTER_STATUS_LABEL: Record<string, string> = {
  delivered: '已交付',
  building: '建设中',
  blocked: '有阻塞',
  planned: '规划中',
  pending: '待开始',
};

const CLUSTER_STATUS_TONE: Record<string, 'ok' | 'info' | 'warn' | 'err' | 'neutral'> = {
  delivered: 'ok',
  building: 'info',
  blocked: 'err',
  planned: 'neutral',
  pending: 'neutral',
};

const STAGE_STATUS_LABEL: Record<string, string> = { todo: '待处理', doing: '进行中', done: '已完成', skip: '不适用' };
const CLUSTER_TYPES = ['训练', '推理', '存储', '通用', '控制面'];

const dateText = (value: string | null | undefined) => value || '待确认';
const daysText = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${value} 天`);

function dotClass(status: string): string {
  if (status === 'delivered') return 'delivered';
  if (status === 'blocked') return 'blocked';
  if (status === 'building') return 'building';
  return '';
}

function stageNameOf(cluster: ClusterView, stages: ClusterStageDef[]): string {
  return cluster.stageIndex >= stages.length ? '已完成' : stages[cluster.stageIndex]?.name ?? '待处理';
}

export interface ClusterListPanelProps {
  clusters: ClusterView[];
  stages: ClusterStageDef[];
  busy: boolean;
  onOpen: (id: string) => void;
  onAdd: () => void;
}

/** 机房内集群清单：名称 / 类型 · 业务方 / 阶段 / 负责人 / 日期 / 阻塞。 */
export function ClusterListPanel({ clusters, stages, busy, onOpen, onAdd }: ClusterListPanelProps) {
  return (
    <section className="rb-cluster-detail">
      <div className="rb-cluster-detail-head">
        <div>
          <span className="rb-eyebrow">机房内集群</span>
          <h3>机房内集群</h3>
        </div>
        <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={onAdd}>
          <Icon name="add" />
          登记集群
        </button>
      </div>
      <div className="rbd-cluster-toolbar">
        <span>共 {clusters.length} 个集群 · 点击任意集群查看六阶段与子项</span>
      </div>
      {clusters.length === 0 ? (
        <Empty
          title="暂无已录入集群"
          hint="集群计划待补充，可点上方「登记集群」补充"
          action={
            <button type="button" className="btn btn-soft btn-sm" disabled={busy} onClick={onAdd}>
              <Icon name="add" />
              登记集群
            </button>
          }
        />
      ) : (
        <div className="rbd-cluster-list">
          {clusters.map((cluster) => (
            <div
              key={cluster.id}
              className="rbd-cluster-row"
              role="button"
              tabIndex={0}
              data-cluster-row={cluster.id}
              onClick={() => onOpen(cluster.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(cluster.id);
                }
              }}
            >
              <div>
                <b>
                  <span className={`rb-cluster-dot ${dotClass(cluster.status)}`} style={{ display: 'inline-block', marginRight: 7, verticalAlign: 1 }} />
                  {cluster.name}
                </b>
                <small>
                  {cluster.type} · {cluster.tenant} · {stageNameOf(cluster, stages)}
                </small>
              </div>
              <div className="rbd-cluster-row-meta">
                <span>负责人 {cluster.owner}</span>
                <span>
                  {dateText(cluster.startDate)} → {dateText(cluster.deliveredDate || cluster.planEndDate)}
                </span>
                {cluster.blocker ? (
                  <span className="rbd-cluster-blocker" title={cluster.blocker}>
                    <Icon name="error_outline" />
                    有阻塞
                  </span>
                ) : (
                  <Chip tone={CLUSTER_STATUS_TONE[cluster.status] ?? 'neutral'}>{CLUSTER_STATUS_LABEL[cluster.status] ?? cluster.status}</Chip>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export interface AddClusterInput {
  name: string;
  type: string;
  tenant: string;
  owner: string;
  vdc: string | null;
  group: string | null;
  startDate: string | null;
  planEndDate: string | null;
}

export interface ClusterAddPanelProps {
  roomName: string;
  busy: boolean;
  onCreate: (input: AddClusterInput) => Promise<string | null>;
  onCancel: () => void;
}

/** 登记集群：名称必填，其余可稍后补充。 */
export function ClusterAddPanel({ roomName, busy, onCreate, onCancel }: ClusterAddPanelProps) {
  const [form, setForm] = useState({
    name: '',
    vdc: '',
    group: '',
    type: '训练',
    tenant: '',
    owner: '',
    start: '',
    end: '',
  });
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    if (busy) return;
    const name = form.name.trim();
    if (!name) {
      setError('请填写集群名称');
      return;
    }
    setError(null);
    const result = await onCreate({
      name,
      type: form.type,
      tenant: form.tenant.trim() || '待确认',
      owner: form.owner.trim() || '待确认',
      vdc: form.vdc.trim() || null,
      group: form.group.trim() || null,
      startDate: form.start || null,
      planEndDate: form.end || null,
    });
    if (result) setError(result);
  };

  return (
    <section className="rb-cluster-detail">
      <div className="rb-cluster-detail-head">
        <div>
          <span className="rb-eyebrow">{roomName} › 机房内集群</span>
          <h3>登记集群</h3>
        </div>
      </div>
      <p className="rb-data-note">
        登记后出现在左侧「机房内集群」中，并计入该机房的集群交付数；集群名称必填，其余可稍后在集群详情中补充。
      </p>
      <div className="rb-cluster-form rb-sp-section">
        <div className="rb-sp-grid">
          <label className="rb-sp-field span-2">
            <span>
              集群名称 <i>*</i>
            </span>
            <small className="rb-sp-desc">用于清单与详情展示，如 Core ×1</small>
            <input
              type="text"
              maxLength={40}
              value={form.name}
              disabled={busy}
              placeholder="例如：Core ×1"
              autoComplete="off"
              data-cf="name"
              onChange={(event) => set('name', event.target.value)}
            />
          </label>
          <label className="rb-sp-field">
            <span>VDC</span>
            <input type="text" maxLength={20} value={form.vdc} disabled={busy} placeholder="如 vdc-01" autoComplete="off" onChange={(event) => set('vdc', event.target.value)} />
          </label>
          <label className="rb-sp-field">
            <span>集群组</span>
            <input type="text" maxLength={30} value={form.group} disabled={busy} placeholder="如 Seed 训练组" autoComplete="off" onChange={(event) => set('group', event.target.value)} />
          </label>
          <label className="rb-sp-field">
            <span>集群类型</span>
            <select value={form.type} disabled={busy} onChange={(event) => set('type', event.target.value)}>
              {CLUSTER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="rb-sp-field">
            <span>业务方</span>
            <input type="text" maxLength={30} value={form.tenant} disabled={busy} placeholder="如 Seed" autoComplete="off" onChange={(event) => set('tenant', event.target.value)} />
          </label>
          <label className="rb-sp-field">
            <span>集群负责人</span>
            <input type="text" maxLength={20} value={form.owner} disabled={busy} placeholder="填写负责人姓名" autoComplete="off" onChange={(event) => set('owner', event.target.value)} />
          </label>
          <label className="rb-sp-field">
            <span>预计启动</span>
            <input type="date" value={form.start} disabled={busy} onChange={(event) => set('start', event.target.value)} />
          </label>
          <label className="rb-sp-field span-2">
            <span>预计交付</span>
            <input type="date" value={form.end} disabled={busy} onChange={(event) => set('end', event.target.value)} />
          </label>
        </div>
        {error ? (
          <p className="rb-modal-error" data-cf-error>
            {error}
          </p>
        ) : null}
        <div className="rb-cluster-form-foot">
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void submit()}>
            <Icon name="add" />
            登记集群
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onCancel}>
            取消
          </button>
          <span>登记后可在集群详情中维护六阶段</span>
        </div>
      </div>
    </section>
  );
}

export interface ClusterDetailPanelProps {
  roomName: string;
  cluster: ClusterView;
  stages: ClusterStageDef[];
  busy: boolean;
  onToggleCheck: (stageIndex: number, key: string, value: boolean) => Promise<boolean>;
  onSave: (patch: Record<string, unknown>) => Promise<string | null>;
  onDelete: () => Promise<boolean>;
  onBack: () => void;
}

/** 集群详情：阶段时间线 + 六阶段子项勾选 + 负责人 / 日期 / 阻塞编辑 + 删除。 */
export function ClusterDetailPanel({ roomName, cluster, stages, busy, onToggleCheck, onSave, onDelete, onBack }: ClusterDetailPanelProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    owner: cluster.owner,
    start: cluster.startDate ?? '',
    end: cluster.planEndDate ?? '',
    blocker: cluster.blocker,
  });

  const startEdit = () => {
    setForm({ owner: cluster.owner, start: cluster.startDate ?? '', end: cluster.planEndDate ?? '', blocker: cluster.blocker });
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setError(null);
    const result = await onSave({
      owner: form.owner.trim() || '待确认',
      startDate: form.start || null,
      planEndDate: form.end || null,
      blocker: form.blocker.trim(),
    });
    if (result) setError(result);
    else setEditing(false);
  };

  return (
    <section className="rb-cluster-detail">
      <div className="rb-cluster-detail-head">
        <div>
          <span className="rb-eyebrow">{roomName} › 集群建设</span>
          <h3>{cluster.name}</h3>
        </div>
        <div className="rbd-head-actions">
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onBack}>
            <Icon name="arrow_back" />
            返回清单
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy || editing} onClick={startEdit}>
            <Icon name="edit" />
            编辑集群
          </button>
          <button type="button" className="btn btn-ghost btn-sm rbd-danger" disabled={busy} onClick={() => setConfirming(true)}>
            <Icon name="delete" />
            删除集群
          </button>
        </div>
      </div>

      {confirming ? (
        <div className="rbd-confirm">
          <Icon name="error_outline" />
          <div>
            <b>删除集群 {cluster.name}</b>
            <p>删除后该集群的六阶段与子项记录将一并移除，且不可恢复。</p>
          </div>
          <div className="rbd-confirm-actions">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirming(false)}>
              取消
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void onDelete()}>
              确认删除
            </button>
          </div>
        </div>
      ) : null}

      <div className="rb-cluster-facts">
        <Fact label="所属机房" value={roomName} />
        <Fact label="VDC / 集群组" value={`${dateText(cluster.vdc)} / ${dateText(cluster.group)}`} />
        <Fact label="集群负责人" value={cluster.owner} />
        <Fact label="类型 / 业务" value={`${cluster.type} / ${cluster.tenant}`} />
        <Fact label="启动时间" value={dateText(cluster.startDate)} />
        <Fact label={cluster.phase === 'past' ? '实际交付' : '预计交付'} value={dateText(cluster.phase === 'past' ? cluster.deliveredDate : cluster.planEndDate)} />
        <Fact label="累计耗时" value={cluster.phase === 'future' ? '未启动' : daysText(cluster.duration.actual)} />
        <Fact label="SLA" value={daysText(cluster.duration.sla)} />
      </div>

      {editing ? (
        <div className="rbd-panel">
          <div className="rbd-panel-head">
            <b>编辑集群</b>
            <span className="rb-data-note">负责人 / 日期 / 阻塞说明</span>
          </div>
          <div className="rb-sp-grid">
            <label className="rb-sp-field">
              <span>集群负责人</span>
              <input type="text" maxLength={20} value={form.owner} disabled={busy} placeholder="填写负责人姓名" onChange={(event) => setForm((prev) => ({ ...prev, owner: event.target.value }))} />
            </label>
            <label className="rb-sp-field">
              <span>预计启动</span>
              <input type="date" value={form.start} disabled={busy} onChange={(event) => setForm((prev) => ({ ...prev, start: event.target.value }))} />
            </label>
            <label className="rb-sp-field">
              <span>预计交付</span>
              <input type="date" value={form.end} disabled={busy} onChange={(event) => setForm((prev) => ({ ...prev, end: event.target.value }))} />
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
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save()}>
              <Icon name="check" />
              保存修改
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setEditing(false)}>
              取消
            </button>
          </div>
        </div>
      ) : null}

      <div className="rb-stage-heading">
        <b>集群建设阶段</b>
        <span>
          {Math.min(cluster.stageIndex, stages.length)} / {stages.length} 环节完成
        </span>
      </div>
      <ol className="rb-stage-list">
        {stages.map((stage, index) => {
          const delivery = cluster.delivery[index];
          const status = delivery?.status ?? 'todo';
          const done = status === 'done' || status === 'skip';
          const atStage = !done && index === cluster.stageIndex;
          const current = atStage && cluster.phase !== 'future';
          const label = done ? STAGE_STATUS_LABEL[status] : current ? (cluster.blocker ? '有阻塞' : '进行中') : '待开始';
          return (
            <li key={stage.key} className={done ? 'done' : current ? (cluster.blocker ? 'blocked' : 'current') : ''}>
              <span className="rb-stage-mark">{done ? '✓' : index + 1}</span>
              <div>
                <b>{stage.name}</b>
                <small>{stage.desc}</small>
                <details className="rb-sop-items" open={current}>
                  <summary>
                    {stage.subItems.length} 个子项 · 查看明细
                  </summary>
                  <div className="rbd-check-list">
                    {stage.subItems.map((sub) => {
                      const checked = Boolean(delivery?.checks?.[sub.key]);
                      return (
                        <label key={sub.key} className={checked ? 'is-done' : ''}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy}
                            onChange={(event) => void onToggleCheck(index, sub.key, event.target.checked)}
                          />
                          <span>
                            {sub.name}
                            {sub.detail ? <small className="rbd-sub-note">{sub.detail.join(' · ')}</small> : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>
              <span className="rb-stage-state">{label}</span>
            </li>
          );
        })}
      </ol>

      <div className={`rb-next-action ${cluster.blocker || cluster.risk ? 'blocked' : ''}`}>
        <Icon name={cluster.blocker || cluster.risk ? 'error_outline' : 'arrow_forward'} />
        <div>
          <b>{cluster.blocker ? '当前阻塞' : cluster.risk ? `风险提示 · ${cluster.risk.short}` : '下一步'}</b>
          <p>{cluster.blocker || cluster.risk?.text || cluster.next || '推进集群六阶段建设'}</p>
          {cluster.blocker && cluster.next ? <small>{cluster.next}</small> : null}
        </div>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <small>{label}</small>
      <b>{value || '待确认'}</b>
    </div>
  );
}

/** 供抽屉复用的集群阶段名。 */
export function clusterStageName(cluster: ClusterView, stages: ClusterStageDef[]): string {
  return stageNameOf(cluster, stages);
}
