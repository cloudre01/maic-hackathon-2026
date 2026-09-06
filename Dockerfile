# Runtime image for the Arus FastAPI backend.
# Serves the API and the pre-computed artifacts/benchmark.json report.
# Model training (benchmark.train) is a local-only workflow and its heavy
# dependencies are deliberately absent here.
FROM python:3.12-slim

# pdftoppm and tesseract are invoked as subprocesses by backend/documents.py.
RUN apt-get update && apt-get install -y --no-install-recommends \
        poppler-utils \
        tesseract-ocr \
        tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY deploy/requirements-runtime.txt ./
RUN pip install --no-cache-dir -r requirements-runtime.txt

COPY backend/ ./backend/
COPY artifacts/benchmark.json ./artifacts/benchmark.json

RUN useradd --uid 10001 --no-create-home arus && mkdir -p /data && chown arus /data
USER arus

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ARUS_DB=/data/arus.sqlite3

EXPOSE 8000
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
