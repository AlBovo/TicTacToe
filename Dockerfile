FROM node:23-slim

WORKDIR /app
COPY package.json package-lock.json ./
COPY server.js ./

RUN npm install

COPY . .

CMD ["node", "server.js"]