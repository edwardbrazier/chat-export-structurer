FROM node:20-slim

WORKDIR /app

# Install Python and build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for TypeScript build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose API port
EXPOSE 5000

# Start in API mode by default
ENV MODE=api
CMD ["npm", "run", "start:api"]
