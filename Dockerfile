FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json .
RUN npm install

FROM node:24-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules

COPY index.js .

EXPOSE 8080

CMD ["npm", "start"]
