FROM node:20-alpine AS base

RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    libc6-compat \
    python3 \
    py3-pip \
    py3-qrcode \
    font-noto \
    fribidi \
    harfbuzz \
    libraqm \
    && pip install --no-cache-dir --break-system-packages pillow python-barcode

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile || pnpm install

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start", "-p", "3000"]
