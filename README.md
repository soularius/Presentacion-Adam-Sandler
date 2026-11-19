# ADAM SANDLER — The Sandler Show

Presentación interactiva (HTML/CSS/JS) de Yined y Majo para *Celebrity Speaking*, con control remoto desde el celular.

## Formas de usarla

| Cómo | Qué pasa |
|---|---|
| Doble clic en `index.html` o en `iniciar-presentacion.bat` | Funciona sola, con teclado, clicker o deslizando el dedo. Sin control remoto. |
| En el servidor (Docker) | `/` = la presentación en la pantalla del salón · `/admin` = la misma presentación + panel de control con clave. Todo lo que haces en `/admin` (diapositivas, pósters, quiz, swing, frases, videos ⏯, confeti) se repite en la pantalla. |

Guion completo: [GUION.md](GUION.md) · Fichas: [GUION-YINED.md](GUION-YINED.md), [GUION-MAJO.md](GUION-MAJO.md) / [PDF](GUION-MAJO.pdf)

## Subirla al servidor (Docker)

> 📦 Guía completa paso a paso (clave en `.env`, proxy, verificación y problemas comunes): **[DEPLOY.md](DEPLOY.md)**. Resumen:

```bash
git clone https://github.com/soularius/Presentacion-Adam-Sandler.git
cd Presentacion-Adam-Sandler
cp .env.example .env          # y cambia ADMIN_PASSWORD
docker compose up -d --build
curl http://localhost:8000/healthz   # -> ok
```

El contenedor escucha en el puerto **8000** e incluye solo los archivos de la presentación (no el PDF, ni los guiones, ni el `.env`).

### Proxy con HTTPS (el WebSocket `/ws` necesita el "upgrade")

**nginx**

```nginx
server {
    server_name sandler.tudominio.com;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }
}
```

**Caddy** (WebSocket incluido): `sandler.tudominio.com { reverse_proxy 127.0.0.1:8000 }`

**Traefik**: quita `ports:` del `docker-compose.yml` y agrega las labels de tu router apuntando al puerto `8000` (Traefik maneja WebSocket solo).

## El día de la presentación

1. **Computador del salón:** abre `https://sandler.tudominio.com/`, escribe la **clave** en *"Click to start the show!"* y presiona **▶ START** (activa sonido, videos y pantalla completa). La clave se recuerda en ese computador.
   - Con clave, la pantalla queda **sincronizada en los dos sentidos**: si alguien usa el teclado, el clicker o hace clic en la pantalla, el `/admin` también cambia.
   - Sin clave (dejarla vacía), esa pantalla **solo mira**: no se puede controlar desde ahí (así un compañero que abra el link no puede mover tu presentación).
2. **Celular:** abre `https://sandler.tudominio.com/admin`, escribe la clave y listo: ◀ ▶ grandes, ⏯ para el video, ✖ para cerrar, 🎉 confeti y el **texto de quien habla** abajo. Arriba ves la misma presentación: tocar un póster, una casilla o una respuesta del quiz también se refleja en la pantalla.
   - En **horizontal** la mini-presentación es más grande y es más fácil tocar cosas.
   - Pueden entrar las dos (Yined y Majo) al `/admin` a la vez.
3. Si se cae el internet: la pantalla sigue funcionando con teclado/clicker como siempre.

## Desarrollo local

```bash
pip install -r server/requirements.txt
ADMIN_PASSWORD=prueba123 python -m uvicorn app:app --app-dir server --port 8000
# http://localhost:8000/  y  http://localhost:8000/admin
```
