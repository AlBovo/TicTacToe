FROM node:20-alpine

COPY . .

RUN npm install

CMD ["node", "server.js"]