import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BootstrapPayload, RoomView } from '@shared/types';
import { api, ApiError } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { Icon } from '../../ui/primitives';
import { useToast } from '../../ui/feedback';
import './delivery-drawer.css';

export interface RegisterClusterModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (clusterId: string) => void;
}

interface FormFields {
  name: string;
  roomId: string;
  type: string;
  tenant: string;
  owner: string;
  vdc: string;
  group: string;
  startDate: string;
  planEndDate: string;
  slaDays: string;
  origin: 'new-first' | 'existing-add';
}

type FormErrors = Partial<Record<keyof FormFields | 'form', string>>;

const FALLBACK_TYPES = ['训练', '推理', '通用', '微服务', '弹性池'];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDays(date: string, days: number) {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(parsed) ? isoDate(new Date(parsed + days * 86400000)) : date;
}

function emptyFields(): FormFields {
  const today = localToday();
  return {
    name: '',
    roomId: '',
    type: '训练',
    tenant: '',
    owner: '',
    vdc: '',
    group: 'Core',
    startDate: today,
    planEndDate: addDays(today, 90),
    slaDays: '30',
    origin: 'new-first',
  };
}

export default function RegisterClusterModal({ open, onClose, onCreated }: RegisterClusterModalProps) {
  const { push: toast } = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [fields, setFields] = useState<FormFields>(emptyFields);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const rooms = useApi<RoomView[]>(() => (open ? api.rooms() : Promise.resolve([])), [open]);
  const boot = useApi<BootstrapPayload | null>(() => (open ? api.bootstrap() : Promise.resolve(null)), [open]);

  const roomOptions = rooms.data ?? [];
  const typeOptions = (() => {
    const values = [...(boot.data?.options.types ?? []), ...FALLBACK_TYPES];
    return [...new Set(values.filter(Boolean))];
  })();
  const tenantOptions = boot.data?.options.tenants ?? [];
  const ownerOptions = boot.data?.options.owners ?? [];

  /* 每次打开重置表单与错误。 */
  useEffect(() => {
    if (!open) return;
    setFields(emptyFields());
    setErrors({});
    setSubmitting(false);
    const timer = window.setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 60);
    return () => window.clearTimeout(timer);
  }, [open]);

  /* 机房列表到达后补默认机房：优先未开工的机房，否则取第一个。 */
  useEffect(() => {
    if (!open || !roomOptions.length) return;
    setFields((previous) => {
      if (previous.roomId && roomOptions.some((room) => room.id === previous.roomId)) return previous;
      const preferred = roomOptions.find((room) => room.phase === 'future') ?? roomOptions[0];
      return { ...previous, roomId: preferred?.id ?? '' };
    });
  }, [open, roomOptions]);

  /* 打开期间锁定页面滚动、归还焦点。 */
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    document.body.classList.add('rb-modal-open');
    return () => {
      document.body.classList.remove('rb-modal-open');
      returnFocus.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || submitting) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const update = (key: keyof FormFields, value: string) => {
    setFields((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!previous[key] && !previous.form) return previous;
      const next = { ...previous };
      delete next[key];
      delete next.form;
      return next;
    });
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!fields.name.trim()) next.name = '请填写集群名称';
    if (!fields.roomId) next.roomId = '请选择机房';
    if (fields.startDate && fields.planEndDate && fields.planEndDate < fields.startDate) {
      next.planEndDate = '计划完成日期不能早于开始日期';
    }
    if (fields.slaDays.trim() !== '') {
      const sla = Number(fields.slaDays);
      if (!Number.isFinite(sla) || sla < 0 || !Number.isInteger(sla)) next.slaDays = 'SLA 天数需为不小于 0 的整数';
    }
    return next;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    const name = fields.name.trim();
    setSubmitting(true);
    setErrors({});
    try {
      const payload = await api.addCluster(fields.roomId, {
        name,
        type: fields.type,
        tenant: fields.tenant.trim() || undefined,
        owner: fields.owner.trim() || undefined,
        vdc: fields.vdc.trim() || null,
        group: fields.group.trim() || null,
        startDate: fields.startDate || null,
        planEndDate: fields.planEndDate || null,
        slaDays: fields.slaDays.trim() === '' ? null : Number(fields.slaDays),
        origin: fields.origin,
      });
      const created = payload.clusters.find((cluster) => cluster.name === name);
      toast(`已登记「${name}」，同步到供给时间轴与集群清单`);
      onCreated(created?.id ?? '');
      onClose();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 409 || error.code === 'duplicate_cluster_name')) {
        setErrors({ name: error.message, form: `集群名称「${name}」已存在，请换一个名称` });
      } else {
        setErrors({ form: error instanceof Error ? error.message : '登记失败，请稍后重试' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const roomLoading = rooms.loading && !roomOptions.length;

  return createPortal(
    <>
      <div className="cd-drawer-backdrop open delivery-register-backdrop" onClick={onClose} />
      <aside
        className="cd-drawer open delivery-register"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-register-title"
      >
        <div className="cd-drawer-head">
          <div className="cd-drawer-title">
            <b id="delivery-register-title">登记集群建设需求</b>
            <span className="delivery-register-sub">填写后即时同步到供给时间轴与集群清单</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="关闭登记表单">
            <Icon name="close" />
          </button>
        </div>
        <div className="cd-drawer-body">
          <form className="cd-form" onSubmit={(event) => void submit(event)} noValidate>
            <div className="cd-form-grid">
              <label className="cd-form-field">
                <span>
                  集群名称<i className="delivery-required">*</i>
                </span>
                <input
                  ref={nameRef}
                  name="name"
                  value={fields.name}
                  onChange={(event) => update('name', event.target.value)}
                  className={errors.name ? 'delivery-input-invalid' : undefined}
                  placeholder="如 core-wlby-01"
                  autoComplete="off"
                  maxLength={60}
                />
                {errors.name ? <span className="delivery-field-error" role="alert">{errors.name}</span> : null}
              </label>
              <label className="cd-form-field">
                <span>
                  机房<i className="delivery-required">*</i>
                </span>
                <select
                  name="roomId"
                  value={fields.roomId}
                  onChange={(event) => update('roomId', event.target.value)}
                  className={errors.roomId ? 'delivery-input-invalid' : undefined}
                  disabled={roomLoading}
                >
                  <option value="">{roomLoading ? '加载机房…' : '请选择机房'}</option>
                  {roomOptions.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
                {errors.roomId ? <span className="delivery-field-error" role="alert">{errors.roomId}</span> : null}
                {rooms.error ? <span className="delivery-field-error">机房加载失败：{rooms.error.message}</span> : null}
              </label>
              <label className="cd-form-field">
                <span>类型</span>
                <select name="type" value={fields.type} onChange={(event) => update('type', event.target.value)}>
                  {typeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="cd-form-field">
                <span>业务方</span>
                <input
                  name="tenant"
                  value={fields.tenant}
                  onChange={(event) => update('tenant', event.target.value)}
                  placeholder="如 Seed / Flow"
                  list="register-tenant-options"
                  maxLength={20}
                />
                <datalist id="register-tenant-options">
                  {tenantOptions.map((tenant) => (
                    <option key={tenant} value={tenant} />
                  ))}
                </datalist>
              </label>
              <label className="cd-form-field">
                <span>负责人</span>
                <input
                  name="owner"
                  value={fields.owner}
                  onChange={(event) => update('owner', event.target.value)}
                  placeholder="负责人姓名"
                  list="register-owner-options"
                  maxLength={20}
                />
                <datalist id="register-owner-options">
                  {ownerOptions.map((owner) => (
                    <option key={owner} value={owner} />
                  ))}
                </datalist>
              </label>
              <label className="cd-form-field">
                <span>VDC</span>
                <input
                  name="vdc"
                  value={fields.vdc}
                  onChange={(event) => update('vdc', event.target.value)}
                  placeholder="留空跟随机房"
                  maxLength={20}
                />
              </label>
              <label className="cd-form-field">
                <span>集群组</span>
                <input
                  name="group"
                  value={fields.group}
                  onChange={(event) => update('group', event.target.value)}
                  placeholder="如 Core"
                  maxLength={30}
                />
              </label>
              <label className="cd-form-field">
                <span>交付来源</span>
                <select name="origin" value={fields.origin} onChange={(event) => update('origin', event.target.value as FormFields['origin'])}>
                  <option value="new-first">新机房首批</option>
                  <option value="existing-add">存量机房扩容</option>
                </select>
              </label>
              <label className="cd-form-field">
                <span>SLA 天数</span>
                <input
                  name="slaDays"
                  type="number"
                  min={0}
                  max={365}
                  value={fields.slaDays}
                  onChange={(event) => update('slaDays', event.target.value)}
                  className={errors.slaDays ? 'delivery-input-invalid' : undefined}
                />
                {errors.slaDays ? <span className="delivery-field-error" role="alert">{errors.slaDays}</span> : null}
              </label>
              <label className="cd-form-field">
                <span>开始日期</span>
                <input
                  name="startDate"
                  type="date"
                  value={fields.startDate}
                  onChange={(event) => update('startDate', event.target.value)}
                />
              </label>
              <label className="cd-form-field">
                <span>计划完成</span>
                <input
                  name="planEndDate"
                  type="date"
                  value={fields.planEndDate}
                  onChange={(event) => update('planEndDate', event.target.value)}
                  className={errors.planEndDate ? 'delivery-input-invalid' : undefined}
                />
                {errors.planEndDate ? <span className="delivery-field-error" role="alert">{errors.planEndDate}</span> : null}
              </label>
            </div>
            {rooms.loading ? <p className="delivery-form-loading">正在加载机房列表…</p> : null}
            {errors.form ? <div className="cd-form-error" role="alert">{errors.form}</div> : null}
            <p className="cd-form-hint">提交后即时同步到供给时间轴与集群清单；名称在同一机房内不能重复。</p>
            <div className="cd-form-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={submitting}>
                取消
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || roomLoading}>
                <Icon name="add" />
                {submitting ? '提交中…' : '提交登记'}
              </button>
            </div>
          </form>
        </div>
      </aside>
    </>,
    document.body,
  );
}
