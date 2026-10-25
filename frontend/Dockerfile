# Full server image: Next.js app + the Python town generator (python -m overturemaps).
# Used by Railway (and anywhere else with Docker). Vercel does not use this file.
#
#   Root directory for the service: frontend/
#   Persistent disk: mount a volume at /app/data/towns (generated towns live there)
#   Env: NOMINATIM_CONTACT=<your email> (town search identifies itself to the geocoder)
#
FROM node:22-bookworm-slim

# Python 3 + the Overture Maps downloader the town generator shells out to
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 python3-pip ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && pip3 install --no-cache-dir --break-system-packages overturemaps

WORKDIR /app

# Dependencies first so they cache across source changes
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PYTHON=python3 \
    HOSTNAME=0.0.0.0

# Generated towns go here; mount a volume on it so they survive deploys
RUN mkdir -p /app/data/towns
VOLUME ["/app/data/towns"]

EXPOSE 3000
# Railway sets PORT; fall back to 3000 locally
CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]
