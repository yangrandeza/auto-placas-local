# Auto Placas

Aplicacao React + Vite para aplicar template de placa em fotos com marcacao de 4 pontos, zoom, pan, lupa de precisao e exportacao em lote para ZIP.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Docker

```bash
docker build -t auto-placas .
docker run --rm -p 8080:80 auto-placas
```

O container ja esta pronto para deploy em plataformas como Easypanel.
