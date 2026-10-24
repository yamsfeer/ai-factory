import type {
  AuditEntry,
  BatchView,
  BootstrapPayload,
  ClusterView,
  RoomDetailPayload,
  RoomView,
} from '@shared/types';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

const OPERATOR_KEY = 'af.operator';
export const OPERATOR_EVENT = 'af-operator-changed';
export const DEFAULT_OPERATOR = '本';

export function getOperator(): string {
  try {
    return localStorage.getItem(OPERATOR_KEY) || DEFAULT_OPERATOR;
  } catch {
    return DEFAULT_OPERATOR;
  }
}

export function setOperator(name: string) {
  const value = name.trim().slice(0, 20) || DEFAULT_OPERATOR;
  localStorage.setItem(OPERATOR_KEY, value);
  window.dispatchEvent(new CustomEvent(OPERATOR_EVENT, { detail: value }));
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function qs(params: Query = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('x-operator', encodeURIComponent(getOperator()));
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      const body = await res.json();
      message = body?.error?.message ?? message;
      code = body?.error?.code;
    } catch {
      /* 非 JSON 错误体 */
    }
    throw new ApiError(message, res.status, code);
  }
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? res.json() : res.text()) as Promise<T>;
}

export const api = {
  bootstrap: () => request<BootstrapPayload>('/api/bootstrap'),
  rooms: (params?: Query) => request<RoomView[]>(`/api/rooms${qs(params)}`),
  room: (id: string) => request<RoomDetailPayload>(`/api/rooms/${id}`),
  createRoom: (body: unknown) => request<RoomDetailPayload>('/api/rooms', { method: 'POST', body: JSON.stringify(body) }),
  updateRoom: (id: string, body: unknown) => request<RoomDetailPayload>(`/api/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRoom: (id: string) => request<{ ok: true }>(`/api/rooms/${id}`, { method: 'DELETE' }),
  setStageStatus: (id: string, index: number, status: string) =>
    request<RoomDetailPayload>(`/api/rooms/${id}/stages/${index}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  setStageField: (id: string, index: number, itemId: string, value: string) =>
    request<RoomDetailPayload>(`/api/rooms/${id}/stages/${index}/fields`, { method: 'PATCH', body: JSON.stringify({ itemId, value }) }),
  setEnvStatus: (id: string, key: string, status: string) =>
    request<RoomDetailPayload>(`/api/rooms/${id}/env/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  addEnvItem: (id: string, name: string, category: string) =>
    request<RoomDetailPayload>(`/api/rooms/${id}/env`, { method: 'POST', body: JSON.stringify({ name, category }) }),
  deleteEnvItem: (id: string, key: string) =>
    request<RoomDetailPayload>(`/api/rooms/${id}/env/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  addCluster: (roomId: string, body: unknown) =>
    request<RoomDetailPayload>(`/api/rooms/${roomId}/clusters`, { method: 'POST', body: JSON.stringify(body) }),
  clusters: (params?: Query) => request<ClusterView[]>(`/api/clusters${qs(params)}`),
  cluster: (id: string) => request<{ cluster: ClusterView; audit: AuditEntry[] }>(`/api/clusters/${id}`),
  updateCluster: (id: string, body: unknown) =>
    request<{ cluster: ClusterView; audit: AuditEntry[] }>(`/api/clusters/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCluster: (id: string) => request<{ ok: true }>(`/api/clusters/${id}`, { method: 'DELETE' }),
  setDeliveryStatus: (id: string, index: number, status: string) =>
    request<{ cluster: ClusterView; audit: AuditEntry[] }>(`/api/clusters/${id}/delivery/${index}`, { method: 'PUT', body: JSON.stringify({ status }) }),
  setDeliveryCheck: (id: string, index: number, key: string, value: boolean) =>
    request<{ cluster: ClusterView; audit: AuditEntry[] }>(`/api/clusters/${id}/delivery/${index}/checks`, { method: 'PATCH', body: JSON.stringify({ key, value }) }),
  batches: (params?: Query) => request<BatchView[]>(`/api/batches${qs(params)}`),
  createBatch: (body: unknown) => request<BatchView>('/api/batches', { method: 'POST', body: JSON.stringify(body) }),
  updateBatch: (id: string, body: unknown) => request<BatchView>(`/api/batches/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  audit: (params?: Query) => request<AuditEntry[]>(`/api/audit${qs(params)}`),
  exportClustersUrl: (params?: Query) => `/api/export/clusters.csv${qs(params)}`,
};
