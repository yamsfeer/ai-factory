import { useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../../lib/api';
import { useToast } from '../../ui/feedback';
import { Icon } from '../../ui/primitives';
import './room-detail.css';

export interface CreateRoomModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (roomId: string) => void;
}

const EMPTY_FORM = {
  name: '',
  area: 'cn',
  'business-side': '',
  'ko-plan': '',
  'deploy-estimate': '',
  'gpu-arrival': '',
  'poc-room': '',
  'poc-project': '',
  'poc-budget': '',
  'poc-bke-tce': '',
  'poc-business': '',
};

type FormState = typeof EMPTY_FORM;

/** 登记机房建设需求：字段全部映射到「确认机房信息」阶段。 */
export default function CreateRoomModal({ open, onClose, onCreated }: CreateRoomModalProps) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY_FORM);
    setError(null);
    const timer = window.setTimeout(() => nameRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('rb-modal-open');
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', handler);
    return () => {
      document.body.classList.remove('rb-modal-open');
      window.removeEventListener('keydown', handler);
    };
  }, [open, onClose]);

  if (!open) return null;

  const set = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    if (busy) return;
    const name = form.name.trim();
    if (!name) {
      setError('请填写机房项目名');
      nameRef.current?.focus();
      return;
    }
    const fields: Record<string, string> = {};
    for (const key of ['ko-plan', 'deploy-estimate', 'gpu-arrival', 'poc-room', 'poc-project', 'poc-budget', 'poc-bke-tce', 'poc-business', 'business-side'] as const) {
      const value = form[key].trim();
      if (value) fields[key] = value;
    }
    setError(null);
    setBusy(true);
    try {
      const payload = await api.createRoom({
        name,
        area: form.area,
        tenants: form['business-side'].trim() ? [form['business-side'].trim()] : [],
        owner: form['poc-room'].trim() || '待确认',
        fields,
      });
      toast.push('机房建设需求已登记');
      setForm(EMPTY_FORM);
      onCreated(payload.room.id);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError('已存在同名机房 / 需求登记');
      else setError(err instanceof Error && err.message ? err.message : '登记失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rb-modal-root open" role="dialog" aria-modal="true" aria-labelledby="rb-request-title">
      <div className="rb-modal-backdrop" onClick={onClose} aria-hidden="true" />
      <form
        className="rb-modal-card rb-modal-card-wide"
        id="rb-request-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="rb-modal-head">
          <b id="rb-request-title">登记机房建设需求</b>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="关闭">
            <Icon name="close" />
          </button>
        </div>
        <p className="rb-modal-desc">
          登记后将出现在「机房建设时间线」与「机房建设清单」中。以下为「确认机房信息」阶段内容，机房项目名为必填，其余可先登记、稍后在机房详情中继续补全。
          填写「预计启动时间」与「机房部署时间」后，时间线将按两者绘制为一个建设时间段。
        </p>
        <div className="rb-modal-scroll">
          <fieldset className="rb-form-set">
            <legend>机房项目</legend>
            <div className="rb-form-grid">
              <label className="rb-field span-2">
                <span>
                  机房项目名 <i>*</i>
                </span>
                <input
                  ref={nameRef}
                  name="name"
                  required
                  maxLength={40}
                  value={form.name}
                  disabled={busy}
                  placeholder="例如：Seed 乌兰察布新区机房"
                  autoComplete="off"
                  onChange={(event) => set('name', event.target.value)}
                />
              </label>
              <label className="rb-field">
                <span>区域</span>
                <select name="area" value={form.area} disabled={busy} onChange={(event) => set('area', event.target.value)}>
                  <option value="cn">中国</option>
                  <option value="overseas">非中</option>
                </select>
              </label>
              <label className="rb-field">
                <span>业务方</span>
                <input
                  name="business-side"
                  maxLength={30}
                  value={form['business-side']}
                  disabled={busy}
                  placeholder="如 Seed / Flow / AML"
                  autoComplete="off"
                  onChange={(event) => set('business-side', event.target.value)}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="rb-form-set">
            <legend>关键时间</legend>
            <div className="rb-form-grid">
              <label className="rb-field">
                <span>预计启动时间</span>
                <input type="date" name="ko-plan" value={form['ko-plan']} disabled={busy} onChange={(event) => set('ko-plan', event.target.value)} />
                <small className="rb-field-hint">时间线起点</small>
              </label>
              <label className="rb-field">
                <span>预计完成 · 机房部署时间</span>
                <input
                  type="date"
                  name="deploy-estimate"
                  value={form['deploy-estimate']}
                  disabled={busy}
                  onChange={(event) => set('deploy-estimate', event.target.value)}
                />
                <small className="rb-field-hint">时间线终点</small>
              </label>
              <label className="rb-field span-2">
                <span>机器到付时间</span>
                <input type="date" name="gpu-arrival" value={form['gpu-arrival']} disabled={busy} onChange={(event) => set('gpu-arrival', event.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset className="rb-form-set">
            <legend>PoC 对接人</legend>
            <div className="rb-form-grid">
              {[
                ['poc-room', '机房 PoC'],
                ['poc-project', '项目 PoC'],
                ['poc-budget', '预算 PoC'],
                ['poc-bke-tce', 'BKE & TCE PoC'],
              ].map(([key, label]) => (
                <label key={key} className="rb-field">
                  <span>{label}</span>
                  <input
                    name={key}
                    maxLength={20}
                    value={form[key as keyof FormState]}
                    disabled={busy}
                    placeholder="填写对接人姓名"
                    autoComplete="off"
                    onChange={(event) => set(key as keyof FormState, event.target.value)}
                  />
                </label>
              ))}
              <label className="rb-field span-2">
                <span>业务 PoC</span>
                <input
                  name="poc-business"
                  maxLength={20}
                  value={form['poc-business']}
                  disabled={busy}
                  placeholder="填写对接人姓名"
                  autoComplete="off"
                  onChange={(event) => set('poc-business', event.target.value)}
                />
              </label>
            </div>
          </fieldset>
        </div>

        {error ? (
          <p className="rb-modal-error" id="rb-request-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="rb-modal-actions">
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn btn-soft btn-sm" disabled={busy}>
            <Icon name="add" />
            {busy ? '登记中…' : '登记需求'}
          </button>
        </div>
      </form>
    </div>
  );
}
