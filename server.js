const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');
const helmet = require('helmet');
const sanitizeFilename = require('sanitize-filename');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Ensure upload and processed directories exist
const uploadDir = path.join(__dirname, 'uploads');
const processedDir = path.join(__dirname, 'processed');
fs.ensureDirSync(uploadDir);
fs.ensureDirSync(processedDir);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      mediaSrc: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  }
}));

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);

// Middleware
app.use(express.static('public'));
app.use('/processed', express.static(processedDir));
app.use(fileUpload({
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  abortOnLimit: true,
  useTempFiles: true,
  tempFileDir: uploadDir,
  debug: false,
  safeFileNames: true,
  preserveExtension: true,
  createParentPath: false,
  defParamCharset: 'utf8'
}));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to process video
app.post('/api/process-video', async (req, res) => {
  try {
    if (!req.files || !req.files.video) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const videoFile = req.files.video;
    
    // Validate mimetype
    if (!videoFile.mimetype.startsWith('video/')) {
      return res.status(400).json({ error: 'Invalid file type. Only video files are allowed.' });
    }

    // Sanitize filename
    const sanitizedName = sanitizeFilename(videoFile.name);
    if (!sanitizedName) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const fileId = uuidv4();
    const inputPath = path.join(uploadDir, `${fileId}-${sanitizedName}`);
    const outputPath = path.join(processedDir, `fixed-${fileId}-${sanitizedName}`);

    // Move uploaded file to uploads directory
    await videoFile.mv(inputPath);

    // Process the video with ffmpeg
    await fixVideoTimeline(inputPath, outputPath);

    // Return the path to the processed video
    res.json({
      success: true,
      message: 'Video processed successfully',
      videoUrl: `/processed/fixed-${fileId}-${sanitizedName}`
    });

    // Clean up the input file after a delay
    const inputCleanupTime = process.env.INPUT_CLEANUP_TIME || 60000; // Default 1 minute
    const outputCleanupTime = process.env.OUTPUT_CLEANUP_TIME || 3600000; // Default 1 hour
    
    setTimeout(() => {
      fs.remove(inputPath).catch(err => console.error('Error removing input file:', err));
    }, inputCleanupTime);

    setTimeout(() => {
      fs.remove(outputPath).catch(err => console.error('Error removing processed file:', err));
    }, outputCleanupTime);

  } catch (error) {
    console.error('Error processing video:', error);
    console.error('Request details:', {
      fileName: req.files?.video?.name || 'unknown',
      fileSize: req.files?.video?.size || 'unknown',
      ip: req.ip
    });
    res.status(500).json({ error: 'Failed to process video', details: process.env.NODE_ENV === 'production' ? 'Server error' : error.message });
  }
});

// Function to fix video timeline using FFmpeg
function fixVideoTimeline(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // Verify input path is within the uploads directory (prevent path traversal)
    const normalizedInputPath = path.normalize(inputPath);
    if (!normalizedInputPath.startsWith(path.normalize(uploadDir))) {
      return reject(new Error('Invalid input path'));
    }

    // Verify output path is within the processed directory
    const normalizedOutputPath = path.normalize(outputPath);
    if (!normalizedOutputPath.startsWith(path.normalize(processedDir))) {
      return reject(new Error('Invalid output path'));
    }

    ffmpeg(normalizedInputPath)
      .outputOptions([
        '-c:v copy',           // Copy video codec
        '-c:a copy',           // Copy audio codec
        '-movflags +faststart', // Optimize for web streaming
        '-fflags +genpts',     // Generate presentation timestamps
        '-video_track_timescale 90000', // Set a standard timescale
      ])
      .output(normalizedOutputPath)
      .on('progress', (progress) => {
        console.log(`Processing: ${Math.floor(progress.percent)}% done`);
      })
      .on('end', () => {
        console.log('Video processing completed successfully');
        resolve();
      })
      .on('error', (err) => {
        console.error('Error during processing:', err);
        reject(err);
      })
      .run();
  });
}

// Add security headers
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-XSS-Protection', '1; mode=block');
  res.set('X-Frame-Options', 'DENY');
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const server = app.listen(port, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
  console.log(`Visit http://localhost:${port} in your browser`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});
