import type { EntradaLog } from '../types';

/**
 * localStorage para datos sencillos: pestaña activa, tema, filtros, fecha del último sync
 * y una bitácora corta de sincronización. Todo envuelto en try/catch (modo privado, cuota llena…).
 */
const PREFIJO = 'lapistock:';

export function leer<T>(clave: string, defecto: T): T {
  try {
    const raw = localStorage.getItem(PREFIJO + clave);
    return raw === null ? defecto : (JSON.parse(raw) as T);
  } catch {
    return defecto;
  }
}

export function escribir(clave: string, valor: unknown) {
  try {
    localStorage.setItem(PREFIJO + clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento disponible: se ignora */
  }
}

const MAX_LOG = 60;

export function registrarLog(nivel: EntradaLog['nivel'], mensaje: string): EntradaLog[] {
  const log = [{ fecha: new Date().toISOString(), nivel, mensaje }, ...leer<EntradaLog[]>('log', [])].slice(0, MAX_LOG);
  escribir('log', log);
  return log;
}
