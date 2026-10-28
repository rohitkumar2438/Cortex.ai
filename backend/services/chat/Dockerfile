FROM node:20-alpine

WORKDIR /app

# Copy shared utilities
COPY backend/shared ./backend/shared

# Copy chat service files
COPY backend/services/chat/package*.json ./backend/services/chat/
WORKDIR /app/backend/services/chat
RUN npm install --omit=dev

COPY backend/services/chat ./

EXPOSE 8002

CMD ["node", "index.js"]
