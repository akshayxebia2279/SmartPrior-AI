# Frontend Dockerfile for SmartPrior-AI
FROM node:20-alpine

WORKDIR /app

# Copy root and frontend package configs
COPY package*.json ./
COPY frontend/package*.json ./frontend/

RUN npm install

COPY frontend ./frontend

WORKDIR /app/frontend

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host"]
