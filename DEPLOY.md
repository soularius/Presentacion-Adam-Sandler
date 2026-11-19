# DEPLOY — The Sandler Show (presentación + control remoto)

> Instrucciones para quien despliegue (persona o agente). Síguelas en orden y **no te saltes la verificación del paso 6**.

## 1. Qué es

- Un solo contenedor Docker: **Python 3.12 + FastAPI + Uvicorn**, escucha en el puerto **8000**.
- Rutas:
  | Ruta | Qué es |
  |---|---|
  | `/` | La presentación (pantalla del salón). |
  | `/admin` | La misma presentación + panel de control. Pide la clave. |
  | `/ws` | **WebSocket** que sincroniza `/` y `/admin`. El proxy **debe** permitir el *upgrade*. |
  | `/healthz` | Devuelve `ok` (lo usa el `HEALTHCHECK` del contenedor). |
- **No hay base de datos ni volúmenes.** El estado (diapositiva actual) vive en memoria; si el contenedor se reinicia, la pantalla y el panel siguen funcionando y se vuelven a sincronizar al siguiente clic.
- La imagen solo contiene `index.html`, `styles.css`, `script.js` y `assets/{gifs,thumbs,chars}`. El servidor además usa una lista blanca: cualquier otra ruta (`/.env`, `/.git/…`, `/PROJECT.pdf`, `/GUION.md`…) responde **404**.

## 2. Requisitos del servidor

- Docker Engine con el plugin **Docker Compose v2** (`docker compose version`).
- Un subdominio apuntando al servidor (ej. `sandler.tudominio.com`) y un proxy inverso con HTTPS (nginx, Caddy o Traefik).
- ~300 MB libres en disco (imagen ≈ 220 MB: Python slim + 57 MB de GIFs).

## 3. Obtener el código

```bash
git clone https://github.com/soularius/Presentacion-Adam-Sandler.git
cd Presentacion-Adam-Sandler
git checkout presentacion-adam-sandler   # rama con la presentación y el servidor (si aún no está en main)
```

Archivos que usa el despliegue: `Dockerfile`, `docker-compose.yml`, `.env.example`, `.dockerignore`, `server/`.

## 4. La clave del `/admin` → archivo `.env`

La clave **solo** va en un archivo llamado **`.env`**, en la **raíz del proyecto** (la misma carpeta donde está `docker-compose.yml`):

```bash
cp .env.example .env
nano .env        # o el editor que tengas
```

Contenido de `.env` (una sola línea):

```dotenv
ADMIN_PASSWORD=pon-aqui-tu-clave
```

Reglas:
- Mínimo 4 caracteres (el servidor no arranca con menos). Recomendado: 12+ caracteres.
- Sin espacios alrededor del `=` y sin comillas.
- **Nunca** subas `.env` a git: ya está en `.gitignore` y en `.dockerignore` (no entra en la imagen; Compose la pasa como variable de entorno al arrancar).
- Para cambiar la clave: edita `.env` y ejecuta `docker compose up -d` (recrea el contenedor; no hace falta reconstruir).

> Si `docker compose` dice `Pon ADMIN_PASSWORD en el archivo .env`, el `.env` no existe, está en otra carpeta o la variable está vacía.

## 5. Construir y arrancar

```bash
docker compose up -d --build
docker compose ps            # STATUS debe llegar a "healthy" en ~30 s
docker compose logs -f       # Ctrl+C para salir
```

**Puerto:** `docker-compose.yml` publica `8000:8000`. Si el 8000 está ocupado, cambia **solo el de la izquierda** (ej. `"8090:8000"`) y usa ese puerto en el proxy.
Si el proxy corre en el mismo host, puedes limitarlo a localhost: `"127.0.0.1:8000:8000"`.

### Proxy inverso (elige uno)

**nginx** (`/etc/nginx/sites-available/sandler`, luego `nginx -t && systemctl reload nginx`; HTTPS con certbot):

```nginx
server {
    server_name sandler.tudominio.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;      # obligatorio para /ws
        proxy_set_header Connection "upgrade";       # obligatorio para /ws
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;                    # que no corte el WebSocket
    }
}
```

**Caddy** (HTTPS y WebSocket automáticos):

```caddy
sandler.tudominio.com {
    reverse_proxy 127.0.0.1:8000
}
```

**Traefik** (si los contenedores ya van por Traefik): quita la sección `ports:` y añade al servicio, ajustando la red y el `certresolver` a los tuyos:

```yaml
    networks: [proxy]
    labels:
      - traefik.enable=true
      - traefik.http.routers.sandler.rule=Host(`sandler.tudominio.com`)
      - traefik.http.routers.sandler.entrypoints=websecure
      - traefik.http.routers.sandler.tls.certresolver=letsencrypt
      - traefik.http.services.sandler.loadbalancer.server.port=8000
networks:
  proxy:
    external: true
```

> Usa **una sola réplica**: el estado de sincronización está en memoria del proceso.

## 6. Verificación (obligatoria)

Reemplaza `sandler.tudominio.com` y `TU_CLAVE`.

```bash
# 6.1 salud y archivos
curl -fsS https://sandler.tudominio.com/healthz                         # -> ok
curl -fsS -o /dev/null -w "%{http_code}\n" https://sandler.tudominio.com/          # -> 200
curl -fsS -o /dev/null -w "%{http_code}\n" https://sandler.tudominio.com/admin     # -> 200
curl -s  -o /dev/null -w "%{http_code}\n" https://sandler.tudominio.com/.env       # -> 404  (¡debe ser 404!)

# 6.2 WebSocket dentro del contenedor (clave correcta -> welcome admin)
docker compose exec sandler-show python -c "
import asyncio, json, os, websockets
async def t():
    async with websockets.connect('ws://127.0.0.1:8000/ws') as w:
        await w.send(json.dumps({'t':'hello','role':'admin','kind':'panel','pw':os.environ['ADMIN_PASSWORD']}))
        print(json.loads(await w.recv()))
asyncio.run(t())"
# -> {'t': 'welcome', 'role': 'admin', ...}
```

6.3 **A través del proxy** (lo que más falla): abre `https://sandler.tudominio.com/admin` en un navegador, escribe la clave → el punto junto al número de diapositiva debe ponerse **verde**. Si se queda rojo, el proxy no está pasando el WebSocket (ver §8).

6.4 Prueba real: abre `/` en un computador (escribe la clave en *Click to start* → **START**) y `/admin` en un celular. ▶ en el celular debe mover la pantalla y las flechas del teclado en la pantalla deben mover el celular.

## 7. Actualizar / reiniciar / quitar

```bash
git pull && docker compose up -d --build   # nueva versión
docker compose restart                      # reinicio rápido
docker compose down                         # detener y borrar el contenedor
```

## 8. Problemas comunes

| Síntoma | Causa / solución |
|---|---|
| El contenedor se reinicia en bucle; logs: `Set ADMIN_PASSWORD…` | Falta `.env` o la clave tiene menos de 4 caracteres (§4). |
| `/admin` dice *Wrong password* | La clave escrita no coincide con `.env`. Tras editar `.env` hay que ejecutar `docker compose up -d`. |
| Punto rojo en `/admin`, nada se sincroniza | El proxy no hace *upgrade* de `/ws`: faltan `Upgrade`/`Connection` (nginx) o hay un CDN/firewall que bloquea WebSocket. Probar `wss://…/ws`. |
| Se desconecta cada ~60 s | `proxy_read_timeout` bajo en nginx (subirlo a `3600s`). Uvicorn ya envía pings cada 20 s. |
| Página en blanco o sin GIFs | Mirar `docker compose logs`; los assets se sirven desde `/app/public` dentro de la imagen (reconstruir con `--build`). |
| Los videos no suenan en la pantalla | Falta el clic en **START** en esa pantalla (política de autoplay del navegador). Si un video dice *unavailable*, usar el botón rojo **OPEN ON YOUTUBE**. |
| `port is already allocated` | Cambiar el puerto izquierdo en `docker-compose.yml` (§5). |

## 9. Seguridad (resumen)

- La clave nunca se envía en la URL; viaja por el WebSocket (cifrado si usas HTTPS) y se compara en tiempo constante, con 1 s de espera tras cada intento fallido.
- Sin clave, un cliente **solo puede mirar**: el servidor ignora sus acciones.
- Solo se aceptan 14 acciones conocidas con parámetros validados (índices numéricos, IDs de YouTube alfanuméricos).
- El contenedor corre como usuario sin privilegios (`uid 10001`). Usa siempre HTTPS en producción.
