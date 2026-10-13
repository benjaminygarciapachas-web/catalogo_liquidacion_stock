FROM node:22-slim

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY backend/package*.json ./backend/

# Instalar dependencias
RUN npm install --production=false
RUN cd backend && npm install --production=false

# Copiar código fuente
COPY . .

# Inicializar base de datos limpia
RUN cd backend && node seed.mjs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "backend/index.js"]
