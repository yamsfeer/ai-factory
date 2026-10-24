import type { ReactNode } from 'react';

export function Icon({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  return <span className={size === 'sm' ? 'mat mat-sm' : 'mat'} aria-hidden="true">{name}</span>;
}

export type ChipTone = 'ok' | 'warn' | 'err' | 'info' | 'violet' | 'neutral';

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: ChipTone }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

const TONE_KPI: Record<string, string> = {
  ok: 'kpi-status-ok',
  warn: 'kpi-status-warn',
  bad: 'kpi-status-err',
  err: 'kpi-status-err',
  info: 'kpi-status-info',
  violet: 'kpi-status-violet',
  cyan: 'kpi-status-cyan',
  neutral: 'kpi-status-neutral',
};

export interface KpiItem {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: ReactNode;
  tone?: string;
  icon?: string;
}

export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className="csys-kpi-strip">
      {items.map((kpi) => (
        <div key={kpi.label} className={`csys-kpi ${TONE_KPI[kpi.tone ?? 'info'] ?? TONE_KPI.info}`}>
          <div className="csys-kpi-label">
            {kpi.icon ? <Icon name={kpi.icon} /> : null}
            <span>{kpi.label}</span>
          </div>
          <div className="csys-kpi-value">
            {kpi.value}
            {kpi.unit ? <small>{kpi.unit}</small> : null}
          </div>
          {kpi.detail ? <div className="csys-kpi-detail">{kpi.detail}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function Section({
  title,
  icon = 'article',
  meta,
  badge,
  children,
}: {
  title: string;
  icon?: string;
  meta?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="csys-section">
      <div className="csys-section-head">
        <div className="csys-section-title">
          <span className="mat mat-sm">{icon}</span>
          {title}
        </div>
        <div className="csys-meta">
          {badge}
          {meta}
        </div>
      </div>
      <div className="csys-section-body">{children}</div>
    </section>
  );
}

export function PageShell({
  title,
  description,
  group = '交付与准入',
  tools,
  filter,
  children,
}: {
  title: string;
  description?: string;
  group?: string;
  tools?: ReactNode;
  filter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="csys-shell">
      <div className="crumb mb-1">
        <span>AI Factory</span>
        <span className="mat">chevron_right</span>
        <span>计算场景</span>
        <span className="mat">chevron_right</span>
        <span>{group}</span>
        <span className="mat">chevron_right</span>
        <b style={{ color: 'var(--text-2)' }}>{title}</b>
      </div>
      <div className="csys-shell-head">
        <div className="csys-shell-title">
          <h1>{title}</h1>
          {description ? <div className="csys-shell-desc">{description}</div> : null}
        </div>
        <div className="csys-meta">{tools}</div>
      </div>
      <div className="csys-page-help-content">
        {filter ? (
          <div className="csys-filter-slot" data-csys-sticky-scope>
            {filter}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

export function Loading({ label = '加载中…' }: { label?: string }) {
  return <div className="af-loading">{label}</div>;
}

export function ErrorBox({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="af-error" role="alert">
      加载失败：{error.message}
      {onRetry ? (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: 12 }} onClick={onRetry}>
          重试
        </button>
      ) : null}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rb-empty">
      <span className="mat">search_off</span>
      <b>{title}</b>
      {hint ? <p>{hint}</p> : null}
      {action}
    </div>
  );
}
