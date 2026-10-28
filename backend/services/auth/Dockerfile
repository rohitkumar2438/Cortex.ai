FROM node:20-alpine

WORKDIR /app

# Copy shared utilities
COPY backend/shared ./backend/shared

# Copy auth service files
COPY backend/services/auth/package*.json ./backend/services/auth/
WORKDIR /app/backend/services/auth
RUN npm install --omit=dev

COPY backend/services/auth ./

EXPOSE 8001

CMD ["node", "index.js"]
