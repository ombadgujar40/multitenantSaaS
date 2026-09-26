FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

COPY prisma ./prisma

RUN npm ci

COPY . .

RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

EXPOSE 2000

CMD ["node", "src/server.js"]