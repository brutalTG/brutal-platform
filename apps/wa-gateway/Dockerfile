# Gateway de WhatsApp de AMIGOS DE MIERDA. Proceso permanente con un volumen para la sesión.
# Se construye desde la raíz del repo: docker build -f apps/wa-gateway/Dockerfile .
FROM node:22-slim
WORKDIR /app
COPY apps/wa-gateway/package.json ./package.json
RUN npm install --omit=dev --no-audit --no-fund
COPY apps/wa-gateway/src ./src
ENV NODE_ENV=production AUTH_DIR=/data/auth PORT=8080
VOLUME ["/data"]
EXPOSE 8080
CMD ["node", "src/index.mjs"]
