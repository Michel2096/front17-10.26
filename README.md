# LapiStock — Front (PWA)

React 19 + TypeScript + Vite. Consulta el [README principal](../README.md) y el
[documento técnico](../docs/DOCUMENTO-TECNICO.md).

```bash
npm install
npm run dev      # http://localhost:5173 (proxy /api -> http://localhost:3000)
npm run build    # genera dist/ e inyecta la lista de precache en dist/sw.js
npm run lint
npm run iconos   # regenera public/icons/*.png
```

El Service Worker solo se registra en el build de producción.
