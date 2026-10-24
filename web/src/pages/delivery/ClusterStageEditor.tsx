import { Icon } from '../../ui/primitives';
import { STAGE_STATUS_LABEL } from '@shared/stages';
import type { ClusterStageDef, StageStatus } from '@shared/types';
import './delivery-drawer.css';

export interface ClusterStageEditorProps {
  stageIndex: number;
  stageName: string;
  stageDesc: string;
  sub: ClusterStageDef['subItems'][number];
  checked: boolean;
  status: StageStatus;
  busy: boolean;
  onClose: () => void;
  onToggle: () => Promise<void>;
}

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

/** 子项详情 / 完成编辑器：展示所属环节、子项名称、明细与完成状态。 */
export default function ClusterStageEditor({
  stageIndex,
  stageName,
  stageDesc,
  sub,
  checked,
  status,
  busy,
  onClose,
  onToggle,
}: ClusterStageEditorProps) {
  const locked = status === 'done' || status === 'skip';
  return (
    <>
      <div className="cd-sub-drawer-backdrop open" onClick={onClose} />
      <div className="cd-sub-drawer open" role="dialog" aria-modal="true" aria-labelledby="delivery-sub-title">
        <div className="cd-sub-drawer-head">
          <div className="cd-sub-drawer-title">
            <b id="delivery-sub-title">
              {pad2(stageIndex + 1)} {stageName}
            </b>
            <span>{sub.name}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="关闭子项详情">
            <Icon name="close" />
          </button>
        </div>
        <div className="cd-sub-drawer-body">
          <div className="cd-sub-editor">
            <p className="cd-sub-editor-desc">{stageDesc}</p>
            <div className="delivery-sub-block">
              <div className="delivery-sub-block-label">子项</div>
              <p className="delivery-sub-name-text">{sub.name}</p>
              {sub.detail?.length ? (
                <ul className="delivery-detail-list">
                  {sub.detail.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="delivery-sub-meta">本子项没有补充明细；勾选后即视为完成。</p>
              )}
            </div>
            <div className={`delivery-sub-state${checked ? ' done' : ''}`}>
              <Icon name={checked ? 'check_circle' : 'radio_button_unchecked'} />
              <span>
                {checked ? '已完成' : '待处理'}
                {locked ? ` · 本环节当前为「${STAGE_STATUS_LABEL[status]}」` : ''}
              </span>
            </div>
            <div className="cd-sub-editor-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
                取消
              </button>
              <button type="button" className="btn btn-primary btn-sm" disabled={locked || busy} onClick={() => void onToggle()}>
                {checked ? '取消完成' : '标记完成'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
