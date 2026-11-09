# Switchboard in a container. See README.md → Hosting.
FROM node:22-slim
ENV NODE_ENV=production \
    SWITCHBOARD_DATA_DIR=/data \
    SWITCHBOARD_HOST=0.0.0.0 \
    SWITCHBOARD_PORT=4545 \
    SWITCHBOARD_NO_OPEN=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY bin ./bin
COPY src ./src
COPY public ./public
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 4545
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4545/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "bin/switchboard.js"]
