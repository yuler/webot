FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run web:build

FROM oven/bun:1.3
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY src ./src
COPY run_bot.ts ./
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY --from=build /app/.output ./.output

ENV HOST=0.0.0.0
ENV PORT=3000
ENV SQLITE_PATH=/data/webot.sqlite
EXPOSE 3000
VOLUME ["/data"]

CMD ["bun", "run", "src/index.ts"]
