import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { escribir, leer } from '../lib/preferencias';
import { ETIQUETA_TIPO, TIPOS, type Lapiz, type ResumenServidor, type TipoLapiz } from '../types';
import type { Inventario } from '../hooks/useInventario';
import type { Vista } from './Home';

const dinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
const bajoStock = (l: Lapiz) => l.cantidad <= l.stock_minimo;

/** Estadísticas calculadas en el cliente a partir de la copia local (funcionan offline). */
function estadisticasLocales(lapices: Lapiz[]) {
  return {
    referencias: lapices.length,
    unidades: lapices.reduce((s, l) => s + l.cantidad, 0),
    valor: lapices.reduce((s, l) => s + l.cantidad * l.precio, 0),
    bajos: lapices.filter(bajoStock),
  };
}

/* ───────────────────────── Inicio ───────────────────────── */

export function VistaInicio({ inv, ir, onNuevo }: { inv: Inventario; ir: (v: Vista) => void; onNuevo: () => void }) {
  const e = useMemo(() => estadisticasLocales(inv.lapices), [inv.lapices]);
  const pendientes = inv.cola.length;
  const accesos: { vista: Vista; titulo: string; texto: string; icono: string }[] = [
    { vista: 'inventario', titulo: 'Inventario', texto: 'Consultar, buscar y editar lápices', icono: '✏️' },
    { vista: 'movimientos', titulo: 'Movimientos', texto: 'Registrar entradas y salidas', icono: '⇅' },
    { vista: 'resumen', titulo: 'Resumen', texto: 'Métricas calculadas por el servidor', icono: '📊' },
    { vista: 'sync', titulo: 'Sincronización', texto: `${pendientes} pendiente(s) · bitácora`, icono: '⟳' },
  ];
  return (
    <section className="vista">
      <div className="kpis">
        <div className="kpi">
          <span className="kpi__valor">{e.referencias}</span>
          <span className="kpi__etiqueta">Referencias</span>
        </div>
        <div className="kpi">
          <span className="kpi__valor">{e.unidades}</span>
          <span className="kpi__etiqueta">Unidades</span>
        </div>
        <div className="kpi">
          <span className="kpi__valor">{dinero.format(e.valor)}</span>
          <span className="kpi__etiqueta">Valor estimado</span>
        </div>
        <div className={`kpi ${e.bajos.length ? 'kpi--alerta' : ''}`}>
          <span className="kpi__valor">{e.bajos.length}</span>
          <span className="kpi__etiqueta">Bajo stock</span>
        </div>
      </div>

      <button className="btn btn--grande" onClick={onNuevo}>
        + Registrar nuevo lápiz
      </button>

      <div className="accesos">
        {accesos.map((a) => (
          <button key={a.vista} className="acceso" onClick={() => ir(a.vista)}>
            <span className="acceso__icono" aria-hidden="true">
              {a.icono}
            </span>
            <span>
              <strong>{a.titulo}</strong>
              <small>{a.texto}</small>
            </span>
          </button>
        ))}
      </div>

      {e.bajos.length > 0 && (
        <div className="panel">
          <h3>⚠ Reabastecer pronto</h3>
          <ul className="lista-simple">
            {e.bajos.map((l) => (
              <li key={l.id}>
                <span className="crece">
                  {l.marca} {l.modelo}
                </span>
                <span className="chip chip--alerta">
                  {l.cantidad} / mín. {l.stock_minimo}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── Inventario ───────────────────────── */

export function VistaInventario({ inv, onNuevo, onEditar }: { inv: Inventario; onNuevo: () => void; onEditar: (l: Lapiz) => void }) {
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState<TipoLapiz | ''>(() => leer('filtroTipo', ''));
  const [soloBajos, setSoloBajos] = useState(false);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return inv.lapices.filter(
      (l) =>
        (!tipo || l.tipo === tipo) &&
        (!soloBajos || bajoStock(l)) &&
        (!q || [l.marca, l.modelo, l.dureza, l.color].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [inv.lapices, busqueda, tipo, soloBajos]);

  return (
    <section className="vista">
      <div className="filtros">
        <input type="search" placeholder="Buscar marca, modelo, dureza…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <select
          value={tipo}
          onChange={(e) => {
            setTipo(e.target.value as TipoLapiz | '');
            escribir('filtroTipo', e.target.value);
          }}
        >
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO[t]}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={soloBajos} onChange={(e) => setSoloBajos(e.target.checked)} /> Solo bajo stock
        </label>
        <button className="btn" onClick={onNuevo}>
          + Nuevo
        </button>
      </div>

      {filtrados.length === 0 ? (
        <p className="vacio">{inv.lapices.length ? 'Ningún lápiz coincide con el filtro.' : 'Aún no hay lápices registrados.'}</p>
      ) : (
        <ul className="tarjetas">
          {filtrados.map((l) => (
            <li key={l.id} className={`tarjeta tarjeta--${l.tipo}`}>
              <div className="tarjeta__cab">
                <div>
                  <strong>{l.modelo}</strong>
                  <small>{l.marca}</small>
                </div>
                <span className={`stock ${bajoStock(l) ? 'stock--bajo' : ''}`} title={`Mínimo ${l.stock_minimo}`}>
                  {l.cantidad}
                </span>
              </div>
              <div className="tarjeta__chips">
                <span className="chip">{ETIQUETA_TIPO[l.tipo]}</span>
                {l.dureza && <span className="chip">{l.dureza}</span>}
                {l.color && <span className="chip">{l.color}</span>}
                <span className="chip">{dinero.format(l.precio)}</span>
                {l.pendiente && <span className="chip chip--pendiente">Sin sincronizar</span>}
              </div>
              <div className="tarjeta__acciones">
                <button className="btn btn--chico btn--fantasma" onClick={() => onEditar(l)}>
                  Editar
                </button>
                <button
                  className="btn btn--chico btn--peligro"
                  onClick={() => confirm(`¿Eliminar ${l.marca} ${l.modelo}?`) && inv.eliminarLapiz(l)}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ───────────────────────── Movimientos ───────────────────────── */

export function VistaMovimientos({ inv }: { inv: Inventario }) {
  const [lapizId, setLapizId] = useState('');
  const [tipo, setTipo] = useState<'entrada' | 'salida'>('entrada');
  const [cantidad, setCantidad] = useState('1');
  const [nota, setNota] = useState('');
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);
  const seleccionado = inv.lapices.find((l) => l.id === lapizId);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!lapizId) return setMensaje({ ok: false, texto: 'Selecciona un lápiz' });
    const error = await inv.registrarMovimiento({ lapiz_id: lapizId, tipo, cantidad: Number(cantidad), nota: nota.trim() || null });
    if (error) return setMensaje({ ok: false, texto: error });
    setMensaje({ ok: true, texto: inv.online ? 'Movimiento registrado' : 'Guardado sin conexión: se enviará al reconectar' });
    setCantidad('1');
    setNota('');
  }

  return (
    <section className="vista">
      <form className="panel form-mov" onSubmit={enviar}>
        <h3>Registrar movimiento</h3>
        <label>
          Lápiz
          <select value={lapizId} onChange={(e) => setLapizId(e.target.value)}>
            <option value="">— Selecciona —</option>
            {inv.lapices.map((l) => (
              <option key={l.id} value={l.id}>
                {l.marca} {l.modelo} {l.dureza ?? ''} (stock {l.cantidad})
              </option>
            ))}
          </select>
        </label>
        <div className="segmento" role="radiogroup" aria-label="Tipo de movimiento">
          {(['entrada', 'salida'] as const).map((t) => (
            <button type="button" key={t} role="radio" aria-checked={tipo === t} className={tipo === t ? 'activo' : ''} onClick={() => setTipo(t)}>
              {t === 'entrada' ? '↓ Entrada' : '↑ Salida'}
            </button>
          ))}
        </div>
        <label>
          Cantidad
          <input type="number" min="1" step="1" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </label>
        <label>
          Nota
          <input value={nota} maxLength={120} placeholder="Proveedor, pedido, aula…" onChange={(e) => setNota(e.target.value)} />
        </label>
        {seleccionado && (
          <p className="nota">
            Stock actual: <strong>{seleccionado.cantidad}</strong> → después:{' '}
            <strong>{seleccionado.cantidad + (tipo === 'entrada' ? 1 : -1) * (Number(cantidad) || 0)}</strong>
          </p>
        )}
        {mensaje && <p className={`alerta ${mensaje.ok ? 'alerta--ok' : 'alerta--error'}`}>{mensaje.texto}</p>}
        <button className="btn">Registrar</button>
      </form>

      <div className="panel">
        <h3>Historial</h3>
        {inv.movimientos.length === 0 ? (
          <p className="vacio">Sin movimientos todavía.</p>
        ) : (
          <ul className="lista-simple">
            {inv.movimientos.slice(0, 50).map((m) => (
              <li key={m.id}>
                <span className={`mov mov--${m.tipo}`}>{m.tipo === 'entrada' ? '+' : '−'}{m.cantidad}</span>
                <span className="crece">
                  {m.marca} {m.modelo}
                  <small>
                    {fechaCorta(m.creado_en)}
                    {m.nota ? ` · ${m.nota}` : ''}
                  </small>
                </span>
                {m.pendiente && <span className="chip chip--pendiente">Pendiente</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── Resumen (servidor) ───────────────────────── */

export function VistaResumen({ inv }: { inv: Inventario }) {
  const [resumen, setResumen] = useState<ResumenServidor | null>(() => leer('resumen', null));
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const pedirResumen = () =>
    api
      .resumen()
      .then((r) => {
        setResumen(r);
        escribir('resumen', r);
        setError(null);
      })
      .catch(() => setError('No se pudo contactar al servidor. Se muestra el último resumen guardado.'));

  function cargar() {
    setCargando(true);
    pedirResumen().finally(() => setCargando(false));
  }

  // Se vuelve a pedir tras cada sincronización (el servidor recalcula con los datos nuevos).
  useEffect(() => {
    pedirResumen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv.ultimoSync]);

  const maxUnidades = Math.max(1, ...(resumen?.por_tipo.map((t) => t.unidades) ?? [1]));
  const hoy = (t: 'entrada' | 'salida') => resumen?.movimientos_hoy.find((m) => m.tipo === t)?.unidades ?? 0;

  return (
    <section className="vista">
      <div className="fila-titulo">
        <p className="nota">
          Calculado por el servidor con SQL{resumen ? ` · ${fechaCorta(resumen.generado_en)}` : ''}
        </p>
        <button className="btn btn--chico btn--fantasma" onClick={cargar} disabled={cargando}>
          {cargando ? 'Cargando…' : 'Actualizar'}
        </button>
      </div>
      {error && <p className="alerta alerta--error">{error}</p>}
      {!resumen ? (
        <p className="vacio">Sin datos del servidor todavía.</p>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi">
              <span className="kpi__valor">{resumen.referencias}</span>
              <span className="kpi__etiqueta">Referencias</span>
            </div>
            <div className="kpi">
              <span className="kpi__valor">{resumen.unidades}</span>
              <span className="kpi__etiqueta">Unidades</span>
            </div>
            <div className="kpi">
              <span className="kpi__valor">{dinero.format(resumen.valor_total)}</span>
              <span className="kpi__etiqueta">Valor total</span>
            </div>
            <div className={`kpi ${resumen.bajo_stock ? 'kpi--alerta' : ''}`}>
              <span className="kpi__valor">{resumen.bajo_stock}</span>
              <span className="kpi__etiqueta">Bajo stock</span>
            </div>
          </div>
          <div className="panel">
            <h3>Unidades por tipo</h3>
            <ul className="barras">
              {resumen.por_tipo.map((t) => (
                <li key={t.tipo}>
                  <span>{ETIQUETA_TIPO[t.tipo] ?? t.tipo}</span>
                  <span className="barras__pista">
                    <span className={`barras__barra tarjeta--${t.tipo}`} style={{ width: `${(t.unidades / maxUnidades) * 100}%` }} />
                  </span>
                  <span className="barras__num">{t.unidades}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h3>Movimientos de hoy</h3>
            <p>
              <span className="mov mov--entrada">+{hoy('entrada')}</span> entradas ·{' '}
              <span className="mov mov--salida">−{hoy('salida')}</span> salidas
            </p>
          </div>
        </>
      )}
    </section>
  );
}

/* ───────────────────────── Sincronización ───────────────────────── */

export function VistaSync({ inv }: { inv: Inventario }) {
  return (
    <section className="vista">
      <div className="panel">
        <div className="fila-titulo">
          <h3>Cola offline ({inv.cola.length})</h3>
          <button className="btn btn--chico" disabled={!inv.online || inv.sincronizando} onClick={() => inv.sincronizarAhora('manual')}>
            {inv.sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        </div>
        <p className="nota">
          {inv.online ? 'En línea' : 'Sin conexión'} · Último sync:{' '}
          {inv.ultimoSync ? fechaCorta(inv.ultimoSync) : 'nunca'} · Reintento automático al reconectar y cada 30 s.
        </p>
        {inv.cola.length === 0 ? (
          <p className="vacio">✓ Todo está sincronizado.</p>
        ) : (
          <ul className="lista-simple">
            {inv.cola.map((op) => (
              <li key={op.op_id}>
                <span className="crece">
                  {op.descripcion}
                  <small>
                    {fechaCorta(op.creado_en)} · intentos: {op.intentos}
                    {op.ultimo_error ? ` · ${op.ultimo_error}` : ''}
                  </small>
                </span>
                {op.estado === 'error' ? (
                  <>
                    <span className="chip chip--alerta">Rechazada</span>
                    <button className="btn btn--chico btn--fantasma" onClick={() => inv.reintentarOperacion(op)}>
                      Reintentar
                    </button>
                    <button className="btn btn--chico btn--peligro" onClick={() => inv.descartarOperacion(op)}>
                      Descartar
                    </button>
                  </>
                ) : (
                  <span className="chip chip--pendiente">Pendiente</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="panel">
        <div className="fila-titulo">
          <h3>Bitácora de pruebas</h3>
          <button className="btn btn--chico btn--fantasma" onClick={inv.limpiarLog}>
            Limpiar
          </button>
        </div>
        <p className="nota">Guardada en localStorage: sirve como evidencia de las pruebas con y sin conexión.</p>
        {inv.log.length === 0 ? (
          <p className="vacio">Sin eventos.</p>
        ) : (
          <ul className="log">
            {inv.log.map((e, i) => (
              <li key={i} className={`log--${e.nivel}`}>
                <time>{fechaCorta(e.fecha)}</time> {e.mensaje}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
