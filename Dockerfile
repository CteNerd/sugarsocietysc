# Optional containerized run of packages/api for local dev (default flow is
# `npm run dev` on the host via tsx — use this only if you prefer a container).
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json

RUN npm install

COPY packages/shared packages/shared
COPY packages/api packages/api

EXPOSE 3001

CMD ["npm", "run", "dev", "--workspace=@sugarsocietysc/api"]
