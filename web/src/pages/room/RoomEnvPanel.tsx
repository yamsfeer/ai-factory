import { useMemo, useState } from 'react';
import type { EnvItem, EnvStatus, EnvTemplateItem } from '@shared/types';
import { Icon } from '../../ui/primitives';

const ENV_ORDER: EnvStatus[] = ['pending', 'doing', 'done', 'skip'];
const ENV_STATUS_LABEL: Record<EnvStatus, string> = { pending: '待处理', doing: '进行中', done: '已完成', skip: '不适用' };
const CATEGORY_ORDER = ['Basic', '域名', '其他', '故障链路', 'Karl'];

export function nextEnvStatus(status: EnvStatus): EnvStatus {
  return ENV_ORDER[(ENV_ORDER.indexOf(status) + 1) % ENV_ORDER.length];
}

export interface RoomEnvPanelProps {
  items: EnvItem[];
  templates: EnvTemplateItem[];
  busy: boolean;
  onCycle: (key: string, next: EnvStatus) => Promise<boolean>;
  onAdd: (name: string, category: string) => Promise<boolean>;
  onDelete: (key: string) => Promise<boolean>;
}

/** 机房部署阶段的环境项方块：点击循环状态，支持自定义项增删。 */
export default function RoomEnvPanel({ items, templates, busy, onCycle, onAdd, onDelete }: RoomEnvPanelProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');

  const scenesOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const tpl of templates) map.set(tpl.key, tpl.scenes.join('') === '*' ? '全场景' : tpl.scenes.join(' / '));
    return map;
  }, [templates]);

  const counts = useMemo(() => {
    const result: Record<EnvStatus, number> = { pending: 0, doing: 0, done: 0, skip: 0 };
    for (const item of items) result[item.status] += 1;
    return result;
  }, [items]);

  const groups = useMemo(() => {
    const cats = [...CATEGORY_ORDER];
    for (const item of items) if (!cats.includes(item.category)) cats.push(item.category);
    return cats
      .map((cat) => ({ cat, items: items.filter((item) => item.category === cat).sort((a, b) => a.sort - b.sort) }))
      .filter((group) => group.items.length > 0);
  }, [items]);

  const submitAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    const ok = await onAdd(trimmed, category.trim() || '其他');
    if (ok) {
      setName('');
      setCategory('');
    }
  };

  return (
    <div className="rb-env-wrap">
      <div className="rb-env-legend">
        <b>机房环境项</b>
        <span>点击方块切换 待处理 → 进行中 → 已完成 → 不适用</span>
        <span className="rb-env-counts">
          {ENV_ORDER.map((status) => (
            <span key={status} className={`lg st-${status}`}>
              <i />
              {ENV_STATUS_LABEL[status]} <b>{counts[status]}</b>
            </span>
          ))}
        </span>
      </div>
      {groups.map((group) => (
        <div key={group.cat} className="rb-env-cat">
          <span className="rb-env-cat-name">{group.cat}</span>
          <div className="rb-env-grid">
            {group.items.map((item) => {
              const scenes = scenesOf.get(item.key) || '';
              return (
                <div
                  key={item.key}
                  role="button"
                  tabIndex={busy ? -1 : 0}
                  aria-disabled={busy}
                  className={`rb-env-block rbd-env-block st-${item.status}`}
                  data-env-item={item.key}
                  title={`${item.category}${scenes ? ` · ${scenes}` : ''}：点击切换状态`}
                  onClick={() => {
                    if (!busy) void onCycle(item.key, nextEnvStatus(item.status));
                  }}
                  onKeyDown={(event) => {
                    if (busy) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      void onCycle(item.key, nextEnvStatus(item.status));
                    }
                  }}
                >
                  <span className="rb-env-top">
                    <i className="rb-env-dot" aria-hidden="true" />
                    <em>{ENV_STATUS_LABEL[item.status]}</em>
                  </span>
                  <b>{item.name}</b>
                  <small>
                    <span>{item.category}</span>
                    {scenes ? <span>{scenes}</span> : null}
                    {item.custom ? <span>自定义</span> : null}
                  </small>
                  {item.custom ? (
                    <button
                      type="button"
                      className="rbd-env-del"
                      aria-label={`删除环境项 ${item.name}`}
                      title="删除自定义环境项"
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDelete(item.key);
                      }}
                    >
                      <Icon name="close" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className="rb-env-add rbd-env-add">
        <input
          type="text"
          value={name}
          maxLength={40}
          placeholder="环境项名称，如 TLB - XX"
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void submitAdd();
            }
          }}
        />
        <input
          type="text"
          value={category}
          maxLength={12}
          placeholder="分类，如 域名"
          disabled={busy}
          onChange={(event) => setCategory(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void submitAdd();
            }
          }}
        />
        <button type="button" className="btn btn-soft btn-sm" disabled={busy || !name.trim()} onClick={() => void submitAdd()}>
          <Icon name="add" />
          添加
        </button>
      </div>
    </div>
  );
}
