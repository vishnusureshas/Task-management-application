# PERN task backend — API + workers image (plan §27).
# One image, different commands per compose service (api / task-worker / image-worker / email-worker).
FROM node:20-slim

WORKDIR /app

# Install production deps first (better layer caching). package-lock.json is committed.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Application source (knexfile needed for migrate:latest on boot).
COPY knexfile.js ./
COPY src ./src

# Uploads live here at runtime (backed by a compose named volume).
RUN mkdir -p uploads/originals uploads/thumbnails uploads/tmp

ENV NODE_ENV=production \
    PORT=5000 \
    UPLOAD_DIR=uploads

EXPOSE 5000

CMD ["node", "src/server.js"]
