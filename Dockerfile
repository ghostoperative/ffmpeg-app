FROM node:18-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && apt-get clean

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Create necessary directories
RUN mkdir -p uploads processed

# Set proper permissions
RUN chmod -R 755 ./uploads ./processed

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
