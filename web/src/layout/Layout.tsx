import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useOperator } from '../ui/feedback';

const NAV_ICONS: Record<string, string> = {
  'local_shipping': '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"></path><circle cx="7" cy="18" r="2"></circle><circle cx="18" cy="18" r="2"></circle>',
  foundation: '<path d="M3 21h18M4 21V9l8-5 8 5v12"></path><rect x="8.5" y="12" width="7" height="4" rx="1"></rect><path d="M8.5 14h-3M18.5 14h-3"></path>',
};

function NavIcon({ name }: { name: string }) {
  return (
    <span className="csys-nav-icon-wrap">
      <svg className="csys-nav-icon" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: NAV_ICONS[name] ?? '' }} />
    </span>
  );
}

export function Header() {
  const [operator, setOperator] = useOperator();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(operator);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(operator);
  }, [operator]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    const target = location.pathname.startsWith('/cluster-delivery') ? '/cluster-delivery' : '/room-buildout';
    const params = new URLSearchParams(location.search);
    if (value) params.set('query', value);
    else params.delete('query');
    navigate(`${target}?${params.toString()}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b app-header" style={{ borderColor: 'var(--border)' }}>
      <div className="h-14 px-5 flex items-center gap-6">
        <div className="flex items-center gap-2.5" style={{ minWidth: 208 }}>
          <div className="w-8 h-8 rounded-lg site-brand-mark flex items-center justify-center">
            <span className="mat filled" style={{ color: '#fff', fontSize: 20 }}>hub</span>
          </div>
          <div className="leading-tight">
            <div className="topbar-brand-line">
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>AI Factory SRE</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>资源管理 · 稳定性运营平台</div>
          </div>
        </div>

        <form className="topbar-tools ml-auto flex items-center gap-3 shrink-0" onSubmit={submit} role="search">
          <label className="rb-search topbar-search">
            <span className="mat mat-sm">search</span>
            <input
              type="search"
              aria-label="搜索机房或集群"
              placeholder="搜索机房 / 集群 / 负责人"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="w-px h-6" style={{ background: 'var(--border)' }} />
          <div className="af-operator" ref={panelRef}>
            <button
              type="button"
              className="topbar-user__trigger"
              aria-label={`当前操作人：${operator}`}
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              <span className="topbar-user__avatar brand-grad text-white">{operator.slice(0, 1)}</span>
            </button>
            {open ? (
              <div className="topbar-user__popover" role="dialog" aria-label="设置操作人">
                <div className="topbar-user__identity">
                  <span className="topbar-user__avatar topbar-user__avatar--detail brand-grad text-white">{operator.slice(0, 1)}</span>
                  <div>
                    <b style={{ fontSize: 13 }}>{operator}</b>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>当前操作人</div>
                  </div>
                </div>
                <label className="rb-field" style={{ marginTop: 12, display: 'block' }}>
                  <span>修改为</span>
                  <input
                    value={draft}
                    maxLength={20}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        setOperator(draft);
                        setOpen(false);
                      }
                    }}
                    placeholder="输入你的名字"
                  />
                </label>
                <p className="af-operator__hint">没有登录。这个名字只用于记录谁改了机房与集群。</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>取消</button>
                  <button
                    type="button"
                    className="btn btn-soft btn-sm"
                    onClick={() => {
                      setOperator(draft);
                      setOpen(false);
                    }}
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </header>
  );
}

export function Sidebar() {
  return (
    <aside id="app-sidebar" className="w-[210px] shrink-0 border-r px-3 py-4 app-sidebar" tabIndex={0} aria-label="主导航">
      <div className="sidebar-block" data-scene="compute">
        <div className="sidebar-subhead">交付与准入</div>
        <div className="sidebar-subwrap">
          <NavLink to="/cluster-delivery" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
            <NavIcon name="local_shipping" />
            <span className="csys-nav-label">集群交付</span>
          </NavLink>
          <NavLink to="/room-buildout" className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}>
            <NavIcon name="foundation" />
            <span className="csys-nav-label">机房建设</span>
          </NavLink>
        </div>
      </div>
    </aside>
  );
}
