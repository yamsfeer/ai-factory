import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useApi, useDebounced } from '../../lib/hooks';
import { ErrorBox, KpiStrip, Loading, PageShell, Section } from '../../ui/primitives';
import type { RoomView } from '@shared/types';
import RoomDetailDrawer from './RoomDetailDrawer';
import CreateRoomModal from './CreateRoomModal';

const PHASE_LABEL: Record<string, string> = { past: '过去 · 已交付', present: '现在 · 在建', future: '未来 · 规划', all: '全部机房' };

export default function RoomBuildoutPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('query') ?? '');
  const debounced = useDebounced(query);
  const phase = params.get('phase') ?? 'present';
  const area = params.get('area') ?? '';
  const type = params.get('type') ?? '';
  const tenant = params.get('tenant') ?? '';
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const rooms = useApi(() => api.rooms({ phase, area, type, tenant, query: debounced }), [phase, area, type, tenant, debounced]);
  const all = rooms.data ?? [];

  const totals = useMemo(() => {
    const recorded = all.reduce((sum, r) => sum + r.summary.recorded, 0);
    const delivered = all.reduce((sum, r) => sum + r.summary.delivered, 0);
    const blocked = all.reduce((sum, r) => sum + r.summary.blocked, 0);
    const building = all.reduce((sum, r) => sum + r.summary.building, 0);
    return { recorded, delivered, blocked, building, rooms: all.length };
  }, [all]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <PageShell
      title="机房建设"
      description="登记机房建设需求，跟踪机房六阶段进度、机房部署环境项与集群交付排期。"
      tools={
        <button type="button" className="btn btn-soft btn-sm" onClick={() => setCreating(true)}>
          <span className="mat mat-sm">add</span>登记机房建设需求
        </button>
      }
      filter={
        <div className="filterbar rb-filterbar">
          <label className="selwrap">
            <span className="flab">区域</span>
            <select className="filt" value={area} onChange={(e) => setParam('area', e.target.value)}>
              <option value="">全部区域</option>
              <option value="cn">中国</option>
              <option value="overseas">非中</option>
            </select>
          </label>
          <label className="selwrap">
            <span className="flab">集群类型</span>
            <select className="filt" value={type} onChange={(e) => setParam('type', e.target.value)}>
              <option value="">全部集群类型</option>
              {['通用', '训练', '推理', '微服务'].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="selwrap">
            <span className="flab">业务</span>
            <select className="filt" value={tenant} onChange={(e) => setParam('tenant', e.target.value)}>
              <option value="">全部业务</option>
              {['AML', 'TCE', 'Seed', '财经支付', 'Flow', 'Stone', 'Engine'].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="rb-search">
            <span className="mat mat-sm">search</span>
            <input
              type="search"
              aria-label="搜索机房或集群"
              placeholder="搜索机房 / 集群 / VDC / 负责人"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setParam('query', e.target.value);
              }}
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setQuery('');
              setParams(new URLSearchParams({ phase: 'all' }), { replace: true });
            }}
          >
            重置
          </button>
          <span className="rb-filter-scope">内场 · 新建</span>
        </div>
      }
    >
      <div className="cmp space-y-4">
        <KpiStrip
          items={[
            { label: '新建机房', value: totals.rooms, unit: '个', detail: `中国 ${all.filter((r) => r.area === 'cn').length} · 非中 ${all.filter((r) => r.area !== 'cn').length}`, tone: 'info', icon: 'foundation' },
            { label: '已录入集群', value: totals.recorded, unit: '个', detail: `${all.filter((r) => r.planCount === null).length} 个机房计划总数待确认`, tone: 'violet', icon: 'dns' },
            { label: '已交付集群', value: totals.delivered, unit: '个', detail: '完成集群全部 6 个环节', tone: 'ok', icon: 'task_alt' },
            { label: '阻塞集群', value: totals.blocked, unit: '个', detail: `${totals.building} 个集群正在建设`, tone: totals.blocked ? 'warn' : 'ok', icon: 'pending_actions' },
          ]}
        />
        <div className="rb-org-chips">
          {['all', 'past', 'present', 'future'].map((key) => (
            <button
              key={key}
              type="button"
              className={`rb-org-chip ${phase === key ? 'active' : ''}`}
              onClick={() => setParam('phase', key)}
            >
              {PHASE_LABEL[key]}
              <span className="rb-status-count">{all.filter((r) => key === 'all' || r.phase === key).length}</span>
            </button>
          ))}
        </div>
        <Section title="机房建设清单" icon="account_tree" meta={<span className="csys-section-meta">机房六阶段 · 环境项 · 集群在机房详情中查看与登记</span>}>
          {rooms.loading ? <Loading /> : rooms.error ? <ErrorBox error={rooms.error} onRetry={rooms.reload} /> : (
            <div className="rb-room-groups">
              {all.map((room) => (
                <RoomRow key={room.id} room={room} onOpen={() => setSelected(room.id)} />
              ))}
            </div>
          )}
        </Section>
      </div>
      <RoomDetailDrawer
        roomId={selected}
        onClose={() => setSelected(null)}
        onChanged={() => rooms.reload()}
      />
      <CreateRoomModal open={creating} onClose={() => setCreating(false)} onCreated={() => rooms.reload()} />
    </PageShell>
  );
}

function RoomRow({ room, onOpen }: { room: RoomView; onOpen: () => void }) {
  return (
    <div className="rb-room-row" style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" className="rb-name-button rb-room-name" onClick={onOpen}>{room.name}</button>
        <span className="chip chip-neutral">{room.phase === 'past' ? '已交付' : room.phase === 'future' ? '规划中' : '建设中'}</span>
        <span style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 12 }}>{room.owner} · {room.startDate ?? '待确认'} → {room.deliveredDate ?? room.targetDate ?? '待确认'}</span>
      </div>
    </div>
  );
}
