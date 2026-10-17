import { useEffect, useState } from 'react';
import { Splash } from './components/Splash';
import { Home } from './components/Home';
import { useInventario } from './hooks/useInventario';
import './App.css';

/** Tiempo mínimo del splash para que la marca sea visible aunque los datos locales carguen al instante. */
const SPLASH_MIN_MS = 1600;
const SALIDA_MS = 400;

export default function App() {
  const inv = useInventario();
  const [minimoCumplido, setMinimoCumplido] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setMinimoCumplido(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  const saliendo = inv.listo && minimoCumplido;
  useEffect(() => {
    if (!saliendo) return;
    const t = setTimeout(() => setSplashVisible(false), SALIDA_MS);
    return () => clearTimeout(t);
  }, [saliendo]);

  return (
    <>
      {inv.listo && <Home inv={inv} />}
      {splashVisible && <Splash saliendo={saliendo} />}
    </>
  );
}
