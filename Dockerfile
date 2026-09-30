# One container for Cloud Run: builds the frontend, then the backend serves it and the /api routes.
FROM node:24-slim AS build
WORKDIR /repo/app
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npm run build

FROM node:24-slim
WORKDIR /repo
ENV PORT=8080
COPY --from=build /repo/app/dist app/dist
COPY app/src/data app/src/data
COPY backend backend
EXPOSE 8080
CMD ["node", "backend/server.js"]
