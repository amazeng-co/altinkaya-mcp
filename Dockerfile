# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/amazeng-co/altinkaya-mcp" \
      org.opencontainers.image.description="MCP server for the Altınkaya enclosure catalog" \
      org.opencontainers.image.licenses="MIT" \
      io.modelcontextprotocol.server.name="io.github.amazeng-co/altinkaya-mcp"
ENV NODE_ENV=production ALTINKAYA_MCP_CACHE_DIR=/tmp/altinkaya-mcp
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json LICENSE ./
COPY data ./data
USER node
# stdio by default; for HTTP: docker run -p 3000:3000 <image> --http --host 0.0.0.0
EXPOSE 3000
ENTRYPOINT ["node", "dist/index.js"]
