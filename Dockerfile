# ============================================================
# SCORPION X – Dockerfile
# Optimized for Render, Vercel, and any Docker platform
# ============================================================

# ==================== BASE IMAGE ====================
FROM node:20-alpine

# ==================== LABELS ====================
LABEL maintainer="ZENTRIX TECH"
LABEL version="3.0.0"
LABEL description="SCORPION X – WhatsApp Automation Platform"

# ==================== INSTALL BUILD TOOLS ====================
# Required for bcrypt, sharp, and other native modules
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++ \
    build-base \
    libc6-compat

# ==================== WORK DIRECTORY ====================
WORKDIR /app

# ==================== COPY PACKAGE FILES ====================
COPY package*.json ./

# ==================== INSTALL DEPENDENCIES ====================
RUN npm install --omit=dev

# ==================== COPY APPLICATION ====================
COPY . .

# ==================== CREATE REQUIRED DIRECTORIES ====================
RUN mkdir -p data uploads chat_media auth_info_baileys logs

# ==================== SET PERMISSIONS ====================
RUN chown -R node:node /app

# ==================== SWITCH TO NON-ROOT USER ====================
USER node

# ==================== EXPOSE PORTS ====================
EXPOSE 3000
EXPOSE 3001

# ==================== HEALTH CHECK ====================
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# ==================== START APPLICATION ====================
CMD ["node", "index.js"]
