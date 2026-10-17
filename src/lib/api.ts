import type { Lapiz, Movimiento, ResumenServidor } from '../types';

/** En desarrollo Vite redirige /api al backend (ver vite.config.ts). */
const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

/** Error HTTP con respuesta del servidor (4xx/5xx). Un fallo de red lanza TypeError. */
export class ErrorApi extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function pedir<T>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + ruta, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    throw new ErrorApi(res.status, cuerpo.error ?? `Error HTTP ${res.status}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (metodo: string, body: unknown): RequestInit => ({ method: metodo, body: JSON.stringify(body) });

export const api = {
  salud: () => pedir<{ ok: boolean }>('/health'),
  lapices: () => pedir<Lapiz[]>('/lapices'),
  crearLapiz: (datos: unknown) => pedir<Lapiz & { duplicado: boolean }>('/lapices', json('POST', datos)),
  editarLapiz: (id: string, datos: unknown) => pedir<Lapiz>(`/lapices/${id}`, json('PUT', datos)),
  eliminarLapiz: (id: string) => pedir<void>(`/lapices/${id}`, { method: 'DELETE' }),
  movimientos: (limite = 100) => pedir<Movimiento[]>(`/movimientos?limite=${limite}`),
  crearMovimiento: (datos: unknown) => pedir<Movimiento & { duplicado: boolean }>('/movimientos', json('POST', datos)),
  resumen: () => pedir<ResumenServidor>('/resumen'),
};
