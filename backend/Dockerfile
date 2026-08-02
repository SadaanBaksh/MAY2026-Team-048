FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Dependencies are pre-compiled in python:3.12-slim wheels

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Shell form (not exec/JSON form) so ${PORT:-8000} actually expands - Render injects PORT,
# everything else (plain `docker run`, etc.) falls back to 8000. Runs migrations before serving
# since Render (unlike docker-compose.yml) uses this CMD as-is with no command override.
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
