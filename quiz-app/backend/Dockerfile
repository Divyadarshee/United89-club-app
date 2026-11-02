# syntax=docker/dockerfile:1
# 1. Update the base image to your target Python version
FROM python:3.14-slim

# 2. Install uv from the official image
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# 3. Enable performance and caching optimizations
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

# 4. Inject the uv virtual environment onto the system PATH
ENV PATH="/app/.venv/bin:$PATH"

# 5. Copy ONLY the configuration and lock files first
# This ensures Docker caches your dependencies; they won't re-install when you change code.
COPY pyproject.toml uv.lock ./

# 6. Install dependencies without the application code itself
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project

# 7. Copy the rest of your application code
COPY . .

# 8. Run a final fast sync to include your local package code
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

EXPOSE 8080

# 9. Run the application (since the PATH is set, uvicorn resolves perfectly)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
