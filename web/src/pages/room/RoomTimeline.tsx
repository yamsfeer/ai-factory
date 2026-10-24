import { Fragment, type CSSProperties } from 'react';
import type { RoomStageDef, RoomView } from '@shared/types';
import { timelineBar, timelineMonths, timelinePosition } from '@shared/domain';
import { PHASE_META, PHASE_ORDER } from './RoomList';

const dateOr = (date: string | null | undefined) => date || '待确认';
const areaText = (area: string) => (area === 'cn' ? '中国' : '非中');

export default function RoomTimeline({
  rooms,
  today,
  defs,
  expanded,
  onToggle,
  onOpenRoom,
}: {
  rooms: RoomView[];
  today: string;
  defs: RoomStageDef[];
  expanded: boolean;
  onToggle: () => void;
  onOpenRoom: (id: string) => void;
}) {
  const months = timelineMonths(rooms.flatMap((room) => [room.startDate, room.targetDate, room.deliveredDate]));
  const todayPosition = timelinePosition(today, months);

  if (!rooms.length) return <div className="rb-empty-inline">当前筛选无可展示机房</div>;

  const groups = PHASE_ORDER.map((phase) => ({
    phase,
    rooms: rooms.filter((room) => room.phase === phase),
  })).filter((group) => group.rooms.length);

  const scale = months.map((month, index) => {
    const left = timelinePosition(`${month.key}-01`, months) ?? 0;
    const next = index === months.length - 1 ? 100 : timelinePosition(`${months[index + 1].key}-01`, months) ?? 100;
    return (
      <span key={month.key} style={{ left: `${left}%`, width: `${next - left}%` }}>
        {month.label}
      </span>
    );
  });

  return (
    <>
      <div className="rb-timeline-tools">
        <div className="rb-tl-legend">
          {PHASE_ORDER.map((phase) => (
            <span key={phase} className="legend-item">
              <span className={`legend-swatch tone-${PHASE_META[phase].tone}`}></span>
              {PHASE_META[phase].time} · {PHASE_META[phase].label}
            </span>
          ))}
          <span className="legend-item">
            <span className="rb-tl-today-key"></span>
            今天 {today}
          </span>
        </div>
        <button className="btn btn-ghost btn-sm" type="button" data-timeline-expand onClick={onToggle}>
          {expanded ? '收起时间线' : '展开完整时间线'}
          <span className="mat mat-sm">{expanded ? 'unfold_less' : 'unfold_more'}</span>
        </button>
      </div>
      <div className={`rb-timeline-scroll ${expanded ? 'full' : ''}`}>
        <div className="rb-timeline-inner">
          <div className="rb-tl-header">
            <b>机房 / 负责人</b>
            <div className="rb-tl-scale-new">{scale}</div>
            <b>完成 / 预计启动</b>
          </div>
          <div className="rb-tl-body">
            {todayPosition !== null && todayPosition >= 0 && todayPosition <= 100 ? (
              <span
                className="rb-tl-today"
                style={{
                  left: `calc(var(--rb-tl-label) + (100% - var(--rb-tl-label) - var(--rb-tl-end)) * ${todayPosition / 100})`,
                }}
              ></span>
            ) : null}
            {groups.map((group) => (
              <Fragment key={group.phase}>
                <div className={`rb-tl-phase-label tone-${PHASE_META[group.phase].tone}`}>
                  {PHASE_META[group.phase].time} · {PHASE_META[group.phase].label} · {group.rooms.length} 个机房
                  {!expanded && group.rooms.length > 2 ? ' · 预览 2 个' : ''}
                </div>
                {(expanded ? group.rooms : group.rooms.slice(0, 2)).map((room) => (
                  <TimelineRow key={room.id} room={room} months={months} defs={defs} onOpen={onOpenRoom} />
                ))}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
      <p className="rb-data-note">
        横条为启动 → 完成 / 目标；菱形为仅有目标日期的里程碑。时间线默认各阶段预览最多 2 个机房，展开后查看全部；随区域、业务与搜索联动。
      </p>
    </>
  );
}

function TimelineRow({
  room,
  months,
  defs,
  onOpen,
}: {
  room: RoomView;
  months: { key: string; label: string }[];
  defs: RoomStageDef[];
  onOpen: (id: string) => void;
}) {
  const meta = PHASE_META[room.phase];
  const bar = timelineBar(room.startDate, room.deliveredDate || room.targetDate, months);
  const currentStageName = room.currentStage >= defs.length ? '已完成' : defs[room.currentStage]?.name ?? '待确认';
  const label =
    room.phase === 'past'
      ? `已交付 ${dateOr(room.deliveredDate)}`
      : room.phase === 'future'
        ? `预计启动 ${room.startDate ? dateOr(room.startDate) : '待定'}${room.targetDate ? ` · 目标 ${dateOr(room.targetDate)}` : ''}`
        : `目标 ${dateOr(room.targetDate)} · 当前 ${currentStageName}`;
  const endText =
    room.phase === 'past' ? dateOr(room.deliveredDate) : room.phase === 'future' ? (room.startDate ? dateOr(room.startDate) : dateOr(room.targetDate || '待定')) : dateOr(room.targetDate);

  return (
    <div className="rb-tl-row">
      <button type="button" className="rb-tl-name rb-name-button" data-room={room.id} title={room.name} onClick={() => onOpen(room.id)}>
        {room.name}
        <small>
          {room.owner} · {areaText(room.area)}
        </small>
      </button>
      <div className="rb-tl-track" style={{ '--months': months.length || 1 } as CSSProperties}>
        {bar ? (
          <>
            <button
              type="button"
              className={`rb-tl-bar tone-${meta.tone} ${bar.milestone ? 'milestone' : ''}`}
              data-room={room.id}
              style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
              aria-label={`${room.name} ${label}`}
              title={label}
              onClick={() => onOpen(room.id)}
            ></button>
            {bar.openEnd ? (
              <span className="rb-tl-open-hint" style={{ left: `${bar.left}%` }}>
                仅完成节点 · 补预计启动即显示时间段
              </span>
            ) : null}
          </>
        ) : room.startDate || room.targetDate ? (
          <span className="rb-tl-unknown">缺少预计启动时间 · 仅有完成节点</span>
        ) : (
          <span className="rb-tl-unknown">排期待确认 · 阶段在机房详情登记</span>
        )}
      </div>
      <span className="rb-tl-end" title={label}>
        {endText}
      </span>
    </div>
  );
}
