FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.mjs providers.mjs ./
ENV NODE_ENV=production
EXPOSE 8080
USER node
CMD ["node", "server.mjs"]
