import React, { useEffect, useState } from 'react';
import { XIcon } from './Icons';

export const DEVICE_DETAIL_FIELDS = [
  ['기기 상태', 'sourceStatus'],
  ['구분', 'category'],
  ['제조사', 'manufacturer'],
  ['모델 번호', 'modelNumber'],
  ['칩셋', 'chipset'],
  ['CPU', 'cpu'],
  ['GPU', 'gpu'],
  ['메모리', 'memory'],
  ['Bluetooth', 'bluetooth'],
  ['화면 크기', 'screenSize'],
  ['해상도', 'resolution'],
  ['등록일', 'registeredAt'],
  ['확인일', 'checkedAt'],
  ['UDID', 'udid'],
  ['비고', 'note'],
];

const WIDE_FIELDS = new Set(['chipset', 'cpu', 'gpu', 'udid', 'note']);

const DeviceDetailsModal = ({ device, canEdit = false, saving = false, onClose, onSave }) => {
  const [draft, setDraft] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!device) return;
    setDraft({
      deviceInfo: device.deviceInfo || '',
      modelName: device.modelName || '',
      osName: device.osName || '',
      osVersion: device.osVersion || '',
      details: {
        sourceSheet: device.details?.sourceSheet || '',
        ...Object.fromEntries(DEVICE_DETAIL_FIELDS.map(([, key]) => [key, device.details?.[key] || ''])),
      },
    });
  }, [device]);

  const resetDraft = () => {
    setDraft({
      deviceInfo: device.deviceInfo || '',
      modelName: device.modelName || '',
      osName: device.osName || '',
      osVersion: device.osVersion || '',
      details: {
        sourceSheet: device.details?.sourceSheet || '',
        ...Object.fromEntries(DEVICE_DETAIL_FIELDS.map(([, key]) => [key, device.details?.[key] || ''])),
      },
    });
  };

  const cancelEditing = () => {
    resetDraft();
    setIsEditing(false);
  };

  if (!device || !draft) return null;

  const updateRoot = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const updateDetail = (key, value) => setDraft((current) => ({
    ...current,
    details: { ...current.details, [key]: value },
  }));

  const renderValue = (label, key, value, onChange, wide = false) => (
    <div className="modal-note" key={key} style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <label className="field-label" htmlFor={`detail-${key}`}>{label}</label>
      {isEditing ? (
        wide ? (
          <textarea
            id={`detail-${key}`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="input w-full resize-none"
            rows={key === 'note' ? 3 : 2}
          />
        ) : (
          <input
            id={`detail-${key}`}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="input w-full"
          />
        )
      ) : (
        <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value || 'N/A'}</div>
      )}
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 780 }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="modal-title">디바이스 상세 정보</div>
            <div className="text-xs text-sub mt-0.5"><span className="td-mono">{device.serialNumber}</span></div>
          </div>
          <div className="flex gap-2 items-center">
            {canEdit && (
              <button className="btn btn-outline btn-sm" onClick={() => isEditing ? cancelEditing() : setIsEditing(true)}>
                {isEditing ? '편집 취소' : '수정'}
              </button>
            )}
            <button className="icon-btn" aria-label="닫기" onClick={onClose}><XIcon size={14} /></button>
          </div>
        </div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {renderValue('기기명', 'modelName', draft.modelName, (value) => {
              updateRoot('modelName', value);
              updateRoot('deviceInfo', value);
            })}
            {renderValue('운영체제', 'osName', draft.osName, (value) => updateRoot('osName', value))}
            {renderValue('OS 버전', 'osVersion', draft.osVersion, (value) => updateRoot('osVersion', value))}
            {DEVICE_DETAIL_FIELDS.map(([label, key]) => renderValue(
              label,
              key,
              draft.details[key],
              (value) => updateDetail(key, value),
              WIDE_FIELDS.has(key),
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button onClick={isEditing ? cancelEditing : onClose} className="btn btn-outline">{isEditing ? '취소' : '닫기'}</button>
          {isEditing && <button onClick={() => onSave(draft)} className="btn btn-primary" disabled={saving}>{saving ? '저장 중...' : '저장'}</button>}
        </div>
      </div>
    </div>
  );
};

export default DeviceDetailsModal;
