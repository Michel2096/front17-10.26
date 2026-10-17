import { Logo } from './Logo';

/**
 * Splash Screen: se muestra mientras se abre IndexedDB y se cargan los datos locales.
 * Tiene una duración mínima (ver App.tsx) para que la marca sea visible y no "parpadee".
 */
export function Splash({ saliendo }: { saliendo: boolean }) {
  return (
    <div className={`splash ${saliendo ? 'splash--fuera' : ''}`} role="status" aria-live="polite">
      <Logo size={112} className="splash__logo" />
      <h1 className="splash__titulo">LapiStock</h1>
      <p className="splash__lema">Inventario de lápices</p>
      <div className="splash__barra" aria-hidden="true">
        <span />
      </div>
      <p className="splash__estado">Cargando inventario…</p>
    </div>
  );
}
