FROM node:20-alpine

WORKDIR /app

# Copy shared utilities
COPY backend/shared ./backend/shared

# Copy gateway service files
COPY backend/gateway/package*.json ./backend/gateway/
WORKDIR /app/backend/gateway
RUN npm install --omit=dev --legacy-peer-deps

COPY backend/gateway ./

EXPOSE 8000

CMD ["node", "index.js"]
