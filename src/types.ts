export const TIPOS = ['grafito', 'color', 'mecanico', 'carboncillo', 'acuarelable'] as const;
export type TipoLapiz = (typeof TIPOS)[number];

export const ETIQUETA_TIPO: Record<TipoLapiz, string> = {
  grafito: 'Grafito',
  color: 'Color',
  mecanico: 'Mecánico',
  carboncillo: 'Carboncillo',
  acuarelable: 'Acuarelable',
};

export interface Lapiz {
  id: string;
  marca: string;
  modelo: string;
  tipo: TipoLapiz;
  dureza: string | null;
  color: string | null;
  cantidad: number;
  stock_minimo: number;
  precio: number;
  creado_en: string;
  actualizado_en: string;
  /** Solo en cliente: true mientras el cambio no ha llegado al servidor. */
  pendiente?: boolean;
}

export type LapizEditable = Pick<Lapiz, 'marca' | 'modelo' | 'tipo' | 'dureza' | 'color' | 'stock_minimo' | 'precio'>;
export type LapizNuevo = LapizEditable & { cantidad: number };

export interface Movimiento {
  id: string;
  lapiz_id: string;
  tipo: 'entrada' | 'salida';
  cantidad: number;
  nota: string | null;
  creado_en: string;
  recibido_en?: string;
  marca?: string;
  modelo?: string;
  pendiente?: boolean;
}

export type TipoOperacion = 'crear_lapiz' | 'editar_lapiz' | 'eliminar_lapiz' | 'crear_movimiento';

/** Operación guardada en la cola offline (IndexedDB) hasta que el servidor la confirme. */
export interface Operacion {
  seq?: number;
  op_id: string;
  tipo: TipoOperacion;
  recurso_id: string;
  datos: Record<string, unknown>;
  descripcion: string;
  creado_en: string;
  intentos: number;
  estado: 'pendiente' | 'error';
  ultimo_error?: string;
}

export interface ResumenServidor {
  referencias: number;
  unidades: number;
  valor_total: number;
  bajo_stock: number;
  por_tipo: { tipo: TipoLapiz; referencias: number; unidades: number }[];
  movimientos_hoy: { tipo: 'entrada' | 'salida'; unidades: number }[];
  generado_en: string;
}

export interface EntradaLog {
  fecha: string;
  nivel: 'ok' | 'info' | 'error';
  mensaje: string;
}
