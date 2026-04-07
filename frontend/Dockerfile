# Official bun image — lean, fast
FROM oven/bun:1-slim

WORKDIR /app

# Copy manifests first — layer cache for deps
COPY package.json bun.lockb* ./

# bun install is dramatically faster than npm/yarn
RUN bun install

# Copy source — changes here don't bust the dep layer
COPY . .

EXPOSE 5173

# --host exposes dev server outside the container
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]
