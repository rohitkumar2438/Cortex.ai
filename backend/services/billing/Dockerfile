FROM node:20-alpine

WORKDIR /app

# Copy shared utilities
COPY backend/shared ./backend/shared

# Copy billing service files
COPY backend/services/billing/package*.json ./backend/services/billing/
WORKDIR /app/backend/services/billing
RUN npm install --omit=dev --legacy-peer-deps

COPY backend/services/billing ./

EXPOSE 8004

CMD ["node", "index.js"]
