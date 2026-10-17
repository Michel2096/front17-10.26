import { useState, type FormEvent } from 'react';
import { ETIQUETA_TIPO, TIPOS, type Lapiz, type LapizNuevo, type TipoLapiz } from '../types';

interface Props {
  inicial?: Lapiz;
  onGuardar: (datos: LapizNuevo) => Promise<void>;
  onCerrar: () => void;
}

/** Formulario de alta/edición. Valida en el cliente; el servidor vuelve a validar al sincronizar. */
export function LapizForm({ inicial, onGuardar, onCerrar }: Props) {
  const [f, setF] = useState({
    marca: inicial?.marca ?? '',
    modelo: inicial?.modelo ?? '',
    tipo: (inicial?.tipo ?? 'grafito') as TipoLapiz,
    dureza: inicial?.dureza ?? '',
    color: inicial?.color ?? '',
    cantidad: String(inicial?.cantidad ?? 0),
    stock_minimo: String(inicial?.stock_minimo ?? 5),
    precio: String(inicial?.precio ?? 0),
  });
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const campo = (k: keyof typeof f) => ({
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const cantidad = Number(f.cantidad);
    const stock_minimo = Number(f.stock_minimo);
    const precio = Number(f.precio);
    if (!f.marca.trim() || !f.modelo.trim()) return setError('Marca y modelo son obligatorios');
    if (!Number.isInteger(cantidad) || cantidad < 0) return setError('La cantidad debe ser un entero ≥ 0');
    if (!Number.isInteger(stock_minimo) || stock_minimo < 0) return setError('El stock mínimo debe ser un entero ≥ 0');
    if (!Number.isFinite(precio) || precio < 0) return setError('El precio debe ser ≥ 0');
    setGuardando(true);
    await onGuardar({
      marca: f.marca.trim(),
      modelo: f.modelo.trim(),
      tipo: f.tipo,
      dureza: f.dureza.trim() || null,
      color: f.color.trim() || null,
      cantidad,
      stock_minimo,
      precio: Math.round(precio * 100) / 100,
    });
    onCerrar();
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="form-titulo" onClick={onCerrar}>
      <form className="modal__caja" onSubmit={enviar} onClick={(e) => e.stopPropagation()} noValidate>
        <h2 id="form-titulo">{inicial ? 'Editar lápiz' : 'Nuevo lápiz'}</h2>
        <div className="form-grid">
          <label>
            Marca*
            <input {...campo('marca')} maxLength={60} autoFocus placeholder="Faber-Castell" />
          </label>
          <label>
            Modelo*
            <input {...campo('modelo')} maxLength={60} placeholder="Castell 9000" />
          </label>
          <label>
            Tipo
            <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoLapiz })}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Dureza
            <input {...campo('dureza')} maxLength={10} placeholder="HB, 2B, 4H…" />
          </label>
          <label>
            Color
            <input {...campo('color')} maxLength={30} placeholder="Opcional" />
          </label>
          <label>
            Precio unitario
            <input {...campo('precio')} type="number" min="0" step="0.01" inputMode="decimal" />
          </label>
          {!inicial && (
            <label>
              Cantidad inicial
              <input {...campo('cantidad')} type="number" min="0" step="1" inputMode="numeric" />
            </label>
          )}
          <label>
            Stock mínimo
            <input {...campo('stock_minimo')} type="number" min="0" step="1" inputMode="numeric" />
          </label>
        </div>
        {inicial && <p className="nota">La cantidad se modifica desde «Movimientos» (entradas y salidas).</p>}
        {error && <p className="alerta alerta--error">{error}</p>}
        <div className="acciones">
          <button type="button" className="btn btn--fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <button className="btn" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
}
