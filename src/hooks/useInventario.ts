import { useCallback, useEffect, useRef, useState } from 'react';
import { idb } from '../lib/idb';
import { sincronizar } from '../lib/sync';
import { escribir, leer, registrarLog } from '../lib/preferencias';
import { useOnline } from './useOnline';
import type { EntradaLog, Lapiz, LapizEditable, LapizNuevo, Movimiento, Operacion } from '../types';

const REINTENTO_MS = 30_000;

/** UUID v4. crypto.randomUUID solo existe en contextos seguros; se cae a getRandomValues. */
export function nuevoId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const porNombre = (a: Lapiz, b: Lapiz) => `${a.marca} ${a.modelo}`.localeCompare(`${b.marca} ${b.modelo}`);
const porFechaDesc = (a: Movimiento, b: Movimiento) => b.creado_en.localeCompare(a.creado_en);

export function useInventario() {
  const online = useOnline();
  const [listo, setListo] = useState(false);
  const [lapices, setLapices] = useState<Lapiz[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [cola, setCola] = useState<Operacion[]>([]);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimoSync, setUltimoSync] = useState<string | null>(() => leer('ultimoSync', null));
  const [log, setLog] = useState<EntradaLog[]>(() => leer('log', []));

  const anotar = useCallback((nivel: EntradaLog['nivel'], mensaje: string) => setLog(registrarLog(nivel, mensaje)), []);

  const recargarLocal = useCallback(async () => {
    const [l, m, c] = await Promise.all([idb.todos('lapices'), idb.todos('movimientos'), idb.todos('outbox')]);
    setLapices(l.sort(porNombre));
    setMovimientos(m.sort(porFechaDesc));
    setCola(c.sort((a, b) => a.seq! - b.seq!));
  }, []);

  const sincronizarAhora = useCallback(
    async (origen: string) => {
      if (!navigator.onLine) {
        anotar('info', `Sincronización (${origen}) pospuesta: sin conexión`);
        return;
      }
      setSincronizando(true);
      try {
        const r = await sincronizar();
        await recargarLocal();
        if (r.descargado) {
          const f = new Date().toISOString();
          setUltimoSync(f);
          escribir('ultimoSync', f);
        }
        const silencioso = origen === 'automático' && !r.enviadas && !r.errores && !r.sinConexion;
        if (silencioso) return;
        if (r.sinConexion) {
          anotar('error', `Sync (${origen}): servidor no disponible. ${r.enviadas} enviadas, ${r.restantes} siguen en cola.`);
        } else if (r.errores) {
          anotar('error', `Sync (${origen}): ${r.enviadas} enviadas, ${r.errores} rechazadas por el servidor.`);
        } else if (r.enviadas) {
          const dup = r.duplicadas ? ` (${r.duplicadas} ya existían: no se duplicaron)` : '';
          anotar('ok', `Sync (${origen}): ${r.enviadas} operaciones enviadas${dup}.`);
        } else {
          anotar('ok', `Sync (${origen}): datos actualizados desde el servidor.`);
        }
      } catch (e) {
        anotar('error', `Sync (${origen}) falló: ${e instanceof Error ? e.message : e}`);
      } finally {
        setSincronizando(false);
      }
    },
    [anotar, recargarLocal],
  );

  // Arranque: abrir IndexedDB, pintar datos locales y luego intentar sincronizar.
  useEffect(() => {
    (async () => {
      await idb.abrir();
      await recargarLocal();
      setListo(true);
      sincronizarAhora('inicio');
    })();
  }, [recargarLocal, sincronizarAhora]);

  // Reintento al recuperar la conexión.
  const estabaOnline = useRef(online);
  useEffect(() => {
    if (online && !estabaOnline.current) {
      anotar('info', 'Conexión recuperada: reintentando envío de pendientes');
      sincronizarAhora('reconexión');
    } else if (!online && estabaOnline.current) {
      anotar('info', 'Sin conexión: los cambios se guardarán en la cola local');
    }
    estabaOnline.current = online;
  }, [online, anotar, sincronizarAhora]);

  // Reintento periódico mientras haya pendientes (navigator.onLine puede ser true sin servidor).
  const hayPendientes = cola.some((o) => o.estado === 'pendiente');
  useEffect(() => {
    if (!online || !hayPendientes) return;
    const t = setInterval(() => sincronizarAhora('automático'), REINTENTO_MS);
    return () => clearInterval(t);
  }, [online, hayPendientes, sincronizarAhora]);

  const encolar = useCallback(
    async (op: Pick<Operacion, 'tipo' | 'recurso_id' | 'datos' | 'descripcion'>) => {
      await idb.guardar('outbox', {
        ...op,
        op_id: nuevoId(),
        creado_en: new Date().toISOString(),
        intentos: 0,
        estado: 'pendiente',
      });
      await recargarLocal();
      if (navigator.onLine) sincronizarAhora('cambio');
      else anotar('info', `Guardado sin conexión: ${op.descripcion}`);
    },
    [recargarLocal, sincronizarAhora, anotar],
  );

  const crearLapiz = useCallback(
    async (datos: LapizNuevo) => {
      const id = nuevoId();
      const ahora = new Date().toISOString();
      await idb.guardar('lapices', { ...datos, id, creado_en: ahora, actualizado_en: ahora, pendiente: true });
      await encolar({
        tipo: 'crear_lapiz',
        recurso_id: id,
        datos: { ...datos, id, creado_en: ahora },
        descripcion: `Alta: ${datos.marca} ${datos.modelo}`,
      });
    },
    [encolar],
  );

  const editarLapiz = useCallback(
    async (id: string, datos: LapizEditable) => {
      const actual = await idb.obtener('lapices', id);
      if (!actual) return;
      await idb.guardar('lapices', { ...actual, ...datos, actualizado_en: new Date().toISOString(), pendiente: true });
      await encolar({ tipo: 'editar_lapiz', recurso_id: id, datos: { ...datos }, descripcion: `Edición: ${datos.marca} ${datos.modelo}` });
    },
    [encolar],
  );

  const eliminarLapiz = useCallback(
    async (lapiz: Lapiz) => {
      await idb.borrar('lapices', lapiz.id);
      for (const m of await idb.todos('movimientos')) if (m.lapiz_id === lapiz.id) await idb.borrar('movimientos', m.id);
      await encolar({ tipo: 'eliminar_lapiz', recurso_id: lapiz.id, datos: {}, descripcion: `Baja: ${lapiz.marca} ${lapiz.modelo}` });
    },
    [encolar],
  );

  /** Devuelve un mensaje de error si la validación local falla. */
  const registrarMovimiento = useCallback(
    async (m: Pick<Movimiento, 'lapiz_id' | 'tipo' | 'cantidad' | 'nota'>): Promise<string | null> => {
      const lapiz = await idb.obtener('lapices', m.lapiz_id);
      if (!lapiz) return 'El lápiz seleccionado no existe';
      if (!Number.isInteger(m.cantidad) || m.cantidad <= 0) return 'La cantidad debe ser un entero mayor que 0';
      if (m.tipo === 'salida' && m.cantidad > lapiz.cantidad) return `Stock insuficiente: solo hay ${lapiz.cantidad}`;

      const id = nuevoId();
      const creado_en = new Date().toISOString();
      const delta = m.tipo === 'entrada' ? m.cantidad : -m.cantidad;
      await idb.guardar('lapices', { ...lapiz, cantidad: lapiz.cantidad + delta, pendiente: true });
      await idb.guardar('movimientos', { ...m, id, creado_en, marca: lapiz.marca, modelo: lapiz.modelo, pendiente: true });
      await encolar({
        tipo: 'crear_movimiento',
        recurso_id: id,
        datos: { ...m, id, creado_en },
        descripcion: `${m.tipo === 'entrada' ? 'Entrada' : 'Salida'} de ${m.cantidad}: ${lapiz.marca} ${lapiz.modelo}`,
      });
      return null;
    },
    [encolar],
  );

  const reintentarOperacion = useCallback(
    async (op: Operacion) => {
      await idb.guardar('outbox', { ...op, estado: 'pendiente' });
      await recargarLocal();
      sincronizarAhora('manual');
    },
    [recargarLocal, sincronizarAhora],
  );

  const descartarOperacion = useCallback(
    async (op: Operacion) => {
      await idb.borrar('outbox', op.seq!);
      anotar('info', `Operación descartada: ${op.descripcion}`);
      await recargarLocal();
      if (navigator.onLine) sincronizarAhora('manual');
    },
    [anotar, recargarLocal, sincronizarAhora],
  );

  const limpiarLog = useCallback(() => {
    escribir('log', []);
    setLog([]);
  }, []);

  return {
    listo,
    online,
    lapices,
    movimientos,
    cola,
    sincronizando,
    ultimoSync,
    log,
    sincronizarAhora,
    crearLapiz,
    editarLapiz,
    eliminarLapiz,
    registrarMovimiento,
    reintentarOperacion,
    descartarOperacion,
    limpiarLog,
  };
}

export type Inventario = ReturnType<typeof useInventario>;
