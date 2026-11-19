FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PUBLIC_DIR=/app/public

WORKDIR /app
COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/app.py .
# only the files the presentation needs (no PDF, scripts or originals)
COPY index.html styles.css script.js public/
COPY assets/gifs public/assets/gifs
COPY assets/thumbs public/assets/thumbs
COPY assets/chars/yined.png assets/chars/majo.png public/assets/chars/

RUN useradd --create-home --uid 10001 sandler && chown -R sandler /app
USER sandler

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz')"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
