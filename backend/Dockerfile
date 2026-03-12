FROM node:20-slim

# Install Python for yfinance subprocess
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip3 install yfinance --break-system-packages

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Create db directory
RUN mkdir -p /data
ENV DB_PATH=/data/briefing.db

EXPOSE 3001
CMD ["node", "server.js"]
