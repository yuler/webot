FROM oven/bun:1.3
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY run_bot.ts ./

ENV HOST=0.0.0.0
ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
