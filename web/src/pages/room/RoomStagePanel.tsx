import { useEffect, useRef, useState } from 'react';
import type { ClusterStageDef, ClusterView, EnvStatus, EnvTemplateItem, RoomStageDef, RoomView, StageFieldDef, StageStatus } from '@shared/types';
import { Icon } from '../../ui/primitives';
import RoomEnvPanel from './RoomEnvPanel';
import './room-detail.css';

const STAGE_STATUS_ORDER: StageStatus[] = ['todo', 'doing', 'done', 'skip'];
const STAGE_STATUS_LABEL: Record<StageStatus, string> = { todo: '待处理', doing: '进行中', done: '已完成', skip: '不适用' };

function dotClass(status: string): string {
  if (status === 'delivered' || status === 'done') return 'delivered';
  if (status === 'blocked') return 'blocked';
  if (status === 'building' || status === 'doing') return 'building';
  return '';
}

/** 子项输入：失焦 / 变更即保存；保存失败回滚为服务端值。 */
function FieldControl({
  item,
  value,
  disabled,
  onCommit,
}: {
  item: StageFieldDef;
  value: string;
  disabled: boolean;
  onCommit: (next: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(value);
  const lastCommitted = useRef(value);

  useEffect(() => {
    setDraft(value);
    lastCommitted.current = value;
  }, [value]);

  const commit = async (next: string) => {
    if (next === value || next === lastCommitted.current) return;
    lastCommitted.current = next;
    const ok = await onCommit(next);
    if (!ok) {
      setDraft(value);
      lastCommitted.current = value;
    }
  };

  if (item.type === 'check') {
    const checked = draft === '1';
    return (
      <label className="rb-sp-check">
        <input
          type="checkbox"
          data-field={item.id}
          checked={checked}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.checked ? '1' : '';
            setDraft(next);
            void commit(next);
          }}
        />
        <span>{checked ? '已确认' : '待确认'}</span>
      </label>
    );
  }

  if (item.type === 'date') {
    return (
      <input
        type="date"
        data-field={item.id}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => void commit(event.currentTarget.value)}
      />
    );
  }

  return (
    <input
      type="text"
      data-field={item.id}
      maxLength={160}
      value={draft}
      disabled={disabled}
      placeholder={item.placeholder || '填写后自动保存'}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => void commit(event.currentTarget.value)}
    />
  );
}

function MetaControl({
  metaKey,
  label,
  value,
  type,
  placeholder,
  wide,
  disabled,
  onCommit,
}: {
  metaKey: 'owner' | 'plan' | 'done' | 'note';
  label: string;
  value: string;
  type: 'text' | 'date' | 'textarea';
  placeholder?: string;
  wide?: boolean;
  disabled: boolean;
  onCommit: (next: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(value);
  const lastCommitted = useRef(value);

  useEffect(() => {
    setDraft(value);
    lastCommitted.current = value;
  }, [value]);

  const commit = async (next: string) => {
    if (next === value || next === lastCommitted.current) return;
    lastCommitted.current = next;
    const ok = await onCommit(next);
    if (!ok) {
      setDraft(value);
      lastCommitted.current = value;
    }
  };

  return (
    <label className={`rb-sp-field ${wide ? 'span-2' : ''}`}>
      <span>{label}</span>
      {type === 'textarea' ? (
        <textarea
          data-meta={metaKey}
          rows={3}
          maxLength={300}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => void commit(event.currentTarget.value)}
        />
      ) : (
        <input
          type={type}
          data-meta={metaKey}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => void commit(event.currentTarget.value)}
        />
      )}
    </label>
  );
}

export interface RoomStagePanelProps {
  room: RoomView;
  stageIndex: number;
  definition: RoomStageDef;
  clusterStages: ClusterStageDef[];
  envTemplates: EnvTemplateItem[];
  clusters: ClusterView[];
  busy: boolean;
  onClose: () => void;
  onSetStatus: (index: number, status: StageStatus) => Promise<boolean>;
  onCommitField: (index: number, itemId: string, value: string) => Promise<boolean>;
  onCommitMeta: (index: number, key: string, value: string) => Promise<boolean>;
  onCycleEnv: (key: string, next: EnvStatus) => Promise<boolean>;
  onAddEnv: (name: string, category: string) => Promise<boolean>;
  onDeleteEnv: (key: string) => Promise<boolean>;
  onOpenCluster: (id: string) => void;
  onAddCluster: () => void;
}

/** 阶段登记面板：阶段状态 + 子项 + （机房部署）环境项 / 业务集群 + 阶段登记。 */
export default function RoomStagePanel({
  room,
  stageIndex,
  definition,
  clusterStages,
  envTemplates,
  clusters,
  busy,
  onClose,
  onSetStatus,
  onCommitField,
  onCommitMeta,
  onCycleEnv,
  onAddEnv,
  onDeleteEnv,
  onOpenCluster,
  onAddCluster,
}: RoomStagePanelProps) {
  const stage = room.stages[stageIndex];
  const status = stage?.status ?? 'todo';
  const fields = stage?.fields ?? {};
  const meta = stage?.meta ?? {};
  const isEnvStage = definition.items.some((item) => item.type === 'env');
  const stageNameOf = (cluster: ClusterView) =>
    cluster.stageIndex >= clusterStages.length ? '已完成' : clusterStages[cluster.stageIndex]?.name ?? '待处理';

  return (
    <div className="rb-stage-panel" role="dialog" aria-modal="false" aria-label={`${definition.name}登记`}>
      <div className="rb-sp-head">
        <div>
          <b>{definition.name}</b>
          <span>{room.name} › 阶段登记 · 人工确认</span>
          <small className="rbd-stage-meaning">{definition.meaning}</small>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" data-stage-panel-close aria-label="关闭阶段登记" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="rb-sp-body">
        <section className="rb-sp-section">
          <div className="rb-sp-section-head">
            <b>阶段状态</b>
            <span>人工确认当前进展</span>
          </div>
          <div className="rb-sp-status">
            {STAGE_STATUS_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                className={`rb-sp-status-btn ${key === status ? 'active' : ''} st-${key}`}
                data-stage-status={key}
                disabled={busy}
                onClick={() => void onSetStatus(stageIndex, key)}
              >
                {STAGE_STATUS_LABEL[key]}
              </button>
            ))}
          </div>
        </section>

        <section className="rb-sp-section">
          <div className="rb-sp-section-head">
            <b>{definition.panelTitle}</b>
            <span>{definition.panelHint}</span>
          </div>
          <div className="rb-sp-grid">
            {definition.items
              .filter((item) => item.type !== 'env')
              .map((item) => {
                const value = fields[item.id] ?? '';
                return (
                  <label key={item.id} className={`rb-sp-field ${item.wide ? 'span-2' : ''} ${value ? 'is-filled' : ''}`}>
                    <span>{item.label}</span>
                    {item.desc ? <small className="rb-sp-desc">{item.desc}</small> : null}
                    <FieldControl
                      item={item}
                      value={value}
                      disabled={busy}
                      onCommit={(next) => onCommitField(stageIndex, item.id, next)}
                    />
                  </label>
                );
              })}
          </div>
        </section>

        {isEnvStage ? (
          <>
            <section className="rb-sp-section">
              <RoomEnvPanel
                items={room.envItems}
                templates={envTemplates}
                busy={busy}
                onCycle={onCycleEnv}
                onAdd={onAddEnv}
                onDelete={onDeleteEnv}
              />
            </section>
            <section className="rb-sp-section">
              <div className="rb-sp-section-head">
                <b>业务集群</b>
                <span>该机房下涉及建设的集群 · {clusters.length} 个</span>
              </div>
              {clusters.length ? (
                <div className="rb-sp-clusters">
                  {clusters.map((cluster) => (
                    <button
                      key={cluster.id}
                      type="button"
                      className="rb-sp-cluster"
                      onClick={() => onOpenCluster(cluster.id)}
                    >
                      <b>{cluster.name}</b>
                      <span className={`rb-cluster-dot ${dotClass(cluster.status)}`} />
                      <small>
                        {cluster.type} · {stageNameOf(cluster)}
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="rbd-panel-section-note">暂无已录入集群，可登记该机房下需要建设的集群。</p>
              )}
              <div>
                <button type="button" className="btn btn-ghost btn-sm" data-cluster-add disabled={busy} onClick={onAddCluster}>
                  <Icon name="add" />
                  登记集群
                </button>
              </div>
            </section>
          </>
        ) : null}

        <section className="rb-sp-section">
          <div className="rb-sp-section-head">
            <b>阶段登记</b>
            <span>人工填写，失焦即保存</span>
          </div>
          <div className="rb-sp-grid">
            <MetaControl
              metaKey="owner"
              label="阶段负责人"
              type="text"
              value={meta.owner ?? ''}
              placeholder="填写负责人姓名"
              disabled={busy}
              onCommit={(next) => onCommitMeta(stageIndex, 'owner', next)}
            />
            <MetaControl
              metaKey="plan"
              label="计划时间"
              type="date"
              value={meta.plan ?? ''}
              disabled={busy}
              onCommit={(next) => onCommitMeta(stageIndex, 'plan', next)}
            />
            <MetaControl
              metaKey="done"
              label="完成时间"
              type="date"
              value={meta.done ?? ''}
              disabled={busy}
              onCommit={(next) => onCommitMeta(stageIndex, 'done', next)}
            />
            <MetaControl
              metaKey="note"
              label="备注"
              type="textarea"
              wide
              value={meta.note ?? ''}
              placeholder="补充单号、会议纪要链接或其他说明"
              disabled={busy}
              onCommit={(next) => onCommitMeta(stageIndex, 'note', next)}
            />
          </div>
        </section>
      </div>
      <div className="rb-sp-foot">
        <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
          <Icon name="check" />
          完成
        </button>
        <span>修改即时保存，并同步到机房建设清单与时间线</span>
      </div>
    </div>
  );
}
