FROM node:26.10.0-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --chown=node:node src/package.json src/index.js ./

USER node

EXPOSE 3000

CMD ["node", "index.js"]