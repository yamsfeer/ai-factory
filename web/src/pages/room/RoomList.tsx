import type { Phase, RoomStageDef, RoomView } from '@shared/types';
import { Chip, type ChipTone } from '../../ui/primitives';

export type RoomPhaseFilter = 'all' | Phase;
export type SortKey = 'date' | 'name' | 'owner';

/** 原型 hierarchy-view.js 的 phaseMeta：时间去 · 状态 · 色调 · 图标 · 卡片副标题。 */
export const PHASE_META: Record<Phase, { time: string; label: string; tone: string; icon: string; subtitle: string }> = {
  past: { time: '过去', label: '已交付', tone: 'ok', icon: 'task_alt', subtitle: '何时交付 · 谁负责' },
  present: { time: '现在', label: '建设中', tone: 'info', icon: 'pending_actions', subtitle: '当前进度 · 目标时间 · 阻塞' },
  future: { time: '未来', label: '规划中', tone: 'violet', icon: 'event_upcoming', subtitle: '何时启动 · 计划建什么' },
};

export const PHASE_ORDER: Phase[] = ['past', 'present', 'future'];

const PHASE_TABS: [RoomPhaseFilter, string][] = [
  ['all', '全部机房'],
  ...PHASE_ORDER.map((phase): [RoomPhaseFilter, string] => [phase, `${PHASE_META[phase].time} · ${PHASE_META[phase].label}`]),
];

const STAGE_STATUS_LABEL: Record<string, string> = { todo: '待处理', doing: '进行中', done: '已完成', skip: '不适用' };

const ROOM_STATUS: Record<string, { label: string; tone: ChipTone }> = {
  delivered: { label: '已交付', tone: 'ok' },
  building: { label: '建设中', tone: 'info' },
  blocked: { label: '有阻塞', tone: 'warn' },
  pending: { label: '待开始', tone: 'neutral' },
  planned: { label: '规划中', tone: 'violet' },
};

const areaText = (area: string) => (area === 'cn' ? '中国' : '非中');
const dateOr = (date: string | null | undefined) => date || '待确认';
export const daysText = (days: number | null) => (days === null ? '—' : `${days} 天`);

function sortKeyOf(room: RoomView): string {
  if (room.phase === 'past') return room.deliveredDate || '9999';
  if (room.phase === 'future') return room.startDate || '9999';
  return room.targetDate || '9999';
}

function sortRooms(rooms: RoomView[], sort: SortKey): RoomView[] {
  const selected = rooms.slice();
  selected.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'zh');
    if (sort === 'owner') return (a.owner || '').localeCompare(b.owner || '', 'zh');
    return sortKeyOf(a).localeCompare(sortKeyOf(b));
  });
  return selected;
}

export default function RoomList({
  rooms,
  phase,
  onPhaseChange,
  sort,
  onSortChange,
  defs,
  onOpenRoom,
  onReset,
}: {
  rooms: RoomView[];
  phase: RoomPhaseFilter;
  onPhaseChange: (phase: RoomPhaseFilter) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  defs: RoomStageDef[];
  onOpenRoom: (id: string) => void;
  onReset: () => void;
}) {
  const counts: Record<RoomPhaseFilter, number> = {
    all: rooms.length,
    past: rooms.filter((room) => room.phase === 'past').length,
    present: rooms.filter((room) => room.phase === 'present').length,
    future: rooms.filter((room) => room.phase === 'future').length,
  };
  const selected = sortRooms(
    rooms.filter((room) => phase === 'all' || room.phase === phase),
    sort,
  );

  return (
    <>
      <div className="rb-hierarchy-toolbar">
        <div className="rb-org-chips">
          {PHASE_TABS.map(([key, label]) => (
            <button
              key={key}
              className={`rb-org-chip ${phase === key ? 'active' : ''}`}
              type="button"
              data-phase={key}
              aria-pressed={phase === key}
              onClick={() => onPhaseChange(key)}
            >
              {label}
              <span className="rb-status-count">{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="rb-list-actions">
          <select data-sort aria-label="机房排序" value={sort} onChange={(event) => onSortChange(event.target.value as SortKey)}>
            <option value="date">按关键日期</option>
            <option value="name">按机房名称</option>
            <option value="owner">按负责人</option>
          </select>
          <button type="button" className="btn btn-ghost btn-sm" data-sort-reset onClick={() => onSortChange('date')}>
            恢复默认排序
          </button>
        </div>
      </div>
      <div className="rb-hierarchy-meta">
        <b>{selected.length} 个机房</b>
        <span>机房行：建设进度与排期</span>
        <span className="rb-hint-inline">
          <span className="mat mat-sm">open_in_new</span>
          机房内集群请在「机房详情」中查看与登记
        </span>
      </div>
      <div className="rb-room-groups">
        {selected.length ? (
          selected.map((room) => <RoomRow key={room.id} room={room} defs={defs} onOpen={onOpenRoom} />)
        ) : (
          <div className="rb-empty">
            <span className="mat">search_off</span>
            <b>当前筛选下没有机房</b>
            <p>尝试切换阶段或清除搜索与筛选条件。</p>
            <button type="button" className="btn btn-soft btn-sm" data-reset onClick={onReset}>
              重置筛选
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function RoomRow({ room, defs, onOpen }: { room: RoomView; defs: RoomStageDef[]; onOpen: (id: string) => void }) {
  const current = room.currentStage;
  const currentDef = defs[current];
  const currentStatus = current >= defs.length ? 'done' : room.stages[current]?.status ?? 'todo';
  const currentLabel = current >= defs.length ? `${defs.length} / ${defs.length} 环节完成` : `当前：${currentDef?.name ?? '待确认'}`;
  const elapsed = room.duration.actual;
  const status = ROOM_STATUS[room.status] ?? ROOM_STATUS.planned;

  const open = () => onOpen(room.id);
  const progress = room.summary;

  return (
    <article className="rb-room-group" data-room-group={room.id}>
      <div className="rb-room-row-scroll" role="region" aria-label={`${room.name}机房建设信息`} tabIndex={0}>
        <div className="rb-group-head rb-room-row">
          <div className="rb-room-identity">
            <span className="rb-room-icon">
              <span className="mat">foundation</span>
            </span>
            <div>
              <div className="rb-room-name-line">
                <button type="button" className="rb-name-button rb-room-name" data-room={room.id} title={room.name} onClick={open}>
                  {room.name}
                </button>
              </div>
              <div
                className="rb-room-location"
                title={`${room.region} · VDC ${room.vdc || '待确认'} · ${room.line} · ${room.tenants.join(' / ')}`}
              >
                <span>
                  {areaText(room.area)} · VDC {room.vdc || '待确认'}
                </span>
                <span>{room.region}</span>
                <span>
                  {room.line}
                  {room.tenants.length ? ` · ${room.tenants.join(' / ')}` : ''}
                </span>
              </div>
            </div>
          </div>
          <div className="rb-room-facts">
            <div className="rb-room-sop">
              <small>机房建设 · 六阶段进度</small>
              <div className="rb-mini-steps room" aria-label="机房建设阶段">
                {defs.map((stage, index) => {
                  const stageStatus = room.stages[index]?.status ?? 'todo';
                  const mark = stageStatus === 'done' ? '✓' : stageStatus === 'skip' ? '–' : index + 1;
                  return (
                    <span key={stage.key} className={`st-${stageStatus}`} title={`${stage.name} · ${STAGE_STATUS_LABEL[stageStatus]}`}>
                      <i>{mark}</i>
                    </span>
                  );
                })}
              </div>
              <div className="rb-stage-track-wrap">
                <div className="rb-stage-track" aria-hidden="true">
                  {defs.map((stage, index) => {
                    const stageStatus = room.stages[index]?.status ?? 'todo';
                    return (
                      <span
                        key={stage.key}
                        className={`rb-stage-seg st-${stageStatus}`}
                        title={`${index + 1}. ${stage.name} · ${STAGE_STATUS_LABEL[stageStatus]}`}
                      >
                        <i></i>
                        <em>{index + 1}</em>
                      </span>
                    );
                  })}
                </div>
                <div className="rb-stage-track-foot">
                  <span className="rb-current-stage">
                    {currentLabel} · <em className={`st-${currentStatus}`}>{STAGE_STATUS_LABEL[currentStatus]}</em>
                  </span>
                  <span className="rb-stage-sync" title="阶段状态在机房详情的阶段登记中人工确认">
                    <span className="mat mat-sm">sync</span>
                    自动同步
                  </span>
                </div>
              </div>
            </div>
            <div>
              <small>机房负责人</small>
              <b>{room.owner || '待确认'}</b>
            </div>
            <div>
              <small>{room.phase === 'future' ? '预计启动' : '启动时间'}</small>
              <b>{dateOr(room.startDate)}</b>
            </div>
            <div>
              <small>{room.phase === 'past' ? '实际完成' : '预计完成'}</small>
              <b>{dateOr(room.phase === 'past' ? room.deliveredDate : room.targetDate)}</b>
              <small>
                {elapsed === null
                  ? room.phase === 'future'
                    ? '尚未启动'
                    : '耗时待确认'
                  : `${room.phase === 'past' ? '总耗时' : '已推进'} ${elapsed} 天`}
              </small>
            </div>
            <div className="rb-cluster-count">
              <small>集群交付</small>
              {progress.planned === null ? (
                <>
                  <b>{progress.recorded} 个已录入</b>
                  <small>计划总数待确认</small>
                </>
              ) : (
                <>
                  <b>
                    {progress.delivered} / {progress.planned} 已交付
                  </b>
                  <div className="rb-small-track">
                    <i style={{ width: `${progress.pct ?? 0}%` }}></i>
                  </div>
                  {progress.narrowed ? <small>当前筛选子集群</small> : null}
                </>
              )}
            </div>
          </div>
          <div className="rb-room-title-actions">
            {room.blocker ? (
              <button
                type="button"
                className="rb-room-status-link"
                data-room={room.id}
                title={room.blocker}
                aria-label={`查看机房阻塞：${room.blocker}`}
                onClick={open}
              >
                <Chip tone={status.tone}>{status.label}</Chip>
              </button>
            ) : (
              <Chip tone={status.tone}>{status.label}</Chip>
            )}
            <button type="button" className="btn btn-ghost btn-sm" data-room={room.id} onClick={open}>
              机房详情<span className="mat mat-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
