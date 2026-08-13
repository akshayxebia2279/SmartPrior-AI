# Backend Dockerfile for SmartPrior-AI
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and backend configs
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/

# Install dependencies
RUN npm install

# Copy backend source code
COPY backend ./backend

# Build TypeScript backend
WORKDIR /app/backend
RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
