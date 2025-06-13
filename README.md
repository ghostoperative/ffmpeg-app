# Video Timeline Fixer

A web application that fixes video timeline issues using FFmpeg.

## Prerequisites

Before running this application, make sure you have:

1. Node.js installed (version 14.x or higher recommended)
2. FFmpeg installed and available in your system PATH

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```
   npm install
   ```

## Running the Application

Start the server with:
```
npm start
```

For development with auto-restart:
```
npm run dev
```

The application will be available at http://localhost:3000

## How It Works

This application:
1. Accepts video uploads through a web interface
2. Processes the video using FFmpeg to fix timeline issues by:
   - Generating proper presentation timestamps
   - Setting a standard timescale
   - Optimizing for web streaming
3. Provides the fixed video for download or playback

## Directory Structure

- `/public` - Static web files (HTML, CSS, JavaScript)
- `/uploads` - Temporary storage for uploaded videos
- `/processed` - Storage for processed videos (auto-cleaned after 1 hour)
- `server.js` - Main application server

## Notes

- Maximum upload size is set to 500MB
- Uploaded videos are deleted after 1 minute
- Processed videos are deleted after 1 hour
