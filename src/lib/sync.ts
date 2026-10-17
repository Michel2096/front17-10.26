import { api, ErrorApi } from './api';
import { idb } from './idb';
import type { Lapiz, Movimiento, Operacion } from '../types';

export interface ResultadoSync {
  enviadas: number;
  duplicadas: number;
  errores: number;
  restantes: number;
  sinConexion: boolean;
  descargado: boolean;
}

/** Envía una operación de la cola al endpoint correspondiente. Devuelve true si el servidor ya la tenía. */
async function enviar(op: Operacion): Promise<boolean> {
  switch (op.tipo) {
    case 'crear_lapiz':
      return (await api.crearLapiz(op.datos)).duplicado;
    case 'editar_lapiz':
      await api.editarLapiz(op.recurso_id, op.datos);
      return false;
    case 'eliminar_lapiz':
      await api.eliminarLapiz(op.recurso_id);
      return false;
    case 'crear_movimiento':
      return (await api.crearMovimiento(op.datos)).duplicado;
  }
}

let enCurso: Promise<ResultadoSync> | null = null;

/**
 * Procesa la cola offline en orden (FIFO).
 *
 * Garantías contra duplicados:
 *  1. Un solo proceso de sincronización a la vez (`enCurso`), aunque se dispare por
 *     el evento `online`, el temporizador y el botón al mismo tiempo.
 *  2. La operación solo se borra de la cola cuando el servidor responde 2xx.
 *  3. Cada registro lleva un UUID generado en el cliente; el servidor usa ese id como
 *     clave primaria, así que un reintento (p. ej. si se perdió la respuesta) devuelve
 *     `duplicado: true` en lugar de crear otro registro.
 */
export function sincronizar(): Promise<ResultadoSync> {
  enCurso ??= ejecutar().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

async function ejecutar(): Promise<ResultadoSync> {
  const r: ResultadoSync = { enviadas: 0, duplicadas: 0, errores: 0, restantes: 0, sinConexion: false, descargado: false };
  const cola = (await idb.todos('outbox')).sort((a, b) => a.seq! - b.seq!);

  for (const op of cola) {
    if (op.estado === 'error') continue;
    try {
      const duplicada = await enviar(op);
      await idb.borrar('outbox', op.seq!);
      r.enviadas++;
      if (duplicada) r.duplicadas++;
    } catch (e) {
      if (e instanceof ErrorApi && e.status >= 400 && e.status < 500) {
        // El servidor rechazó la operación (validación, stock insuficiente, recurso borrado…).
        // Reintentar no la va a arreglar: se marca como error para que el usuario decida.
        await idb.guardar('outbox', { ...op, estado: 'error', intentos: op.intentos + 1, ultimo_error: e.message });
        r.errores++;
        continue;
      }
      // Fallo de red, timeout o 5xx: se conserva y se detiene para respetar el orden.
      await idb.guardar('outbox', {
        ...op,
        intentos: op.intentos + 1,
        ultimo_error: e instanceof Error ? e.message : String(e),
      });
      r.sinConexion = true;
      break;
    }
  }

  const quedan = await idb.todos('outbox');
  r.restantes = quedan.filter((o) => o.estado === 'pendiente').length;

  // Sin operaciones pendientes, el servidor es la fuente de verdad: se descarga el estado real.
  if (!r.sinConexion && r.restantes === 0) {
    try {
      await descargar();
      r.descargado = true;
    } catch {
      r.sinConexion = true;
    }
  }
  return r;
}

/** Trae inventario y movimientos del servidor y reemplaza la copia local. */
export async function descargar() {
  const [lapices, movimientos] = await Promise.all([api.lapices(), api.movimientos(200)]);
  // Si mientras descargábamos el usuario registró algo nuevo, no se pisa su cambio local.
  if ((await idb.todos('outbox')).some((o) => o.estado === 'pendiente')) return;
  await idb.reemplazar('lapices', lapices satisfies Lapiz[]);
  await idb.reemplazar('movimientos', movimientos satisfies Movimiento[]);
}
