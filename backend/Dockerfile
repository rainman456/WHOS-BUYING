# Use slim Python image — minimal attack surface, smaller layer
FROM python:3.12-slim

# Copy uv binary from official image — no pip, no bloat
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency manifest first — Docker layer cache:
# if pyproject.toml hasn't changed, this layer is cached
COPY pyproject.toml .

# uv sync is significantly faster than pip install
# --no-cache: don't store uv's cache in the image layer
RUN uv sync --no-cache

# Copy source after deps — changes here don't invalidate dep layer
COPY src/ src/

EXPOSE 8000

# Run via uv so it uses the managed venv
CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
