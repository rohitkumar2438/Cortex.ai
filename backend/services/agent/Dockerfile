FROM node:20-alpine

WORKDIR /app

# Copy shared utilities
COPY backend/shared ./backend/shared

# Copy agent service files
COPY backend/services/agent/package*.json ./backend/services/agent/
WORKDIR /app/backend/services/agent
RUN npm install --omit=dev --legacy-peer-deps
RUN ln -s /app/backend/services/agent/node_modules /app/node_modules

COPY backend/services/agent ./

# Create uploads directory for locally stored generated artifacts
RUN mkdir -p uploads

EXPOSE 8003

CMD ["node", "index.js"]
