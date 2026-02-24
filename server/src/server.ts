import 'dotenv/config';
import http from 'http';
import app from './app';
import connectDB from './config/db';
import fs from 'fs';
import path from 'path';

const PORT = parseInt(process.env.PORT || '5000', 10);

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log(`📁  Created upload directory: ${uploadDir}`);
}

const startServer = async (): Promise<void> => {
  try {
    // Connect to MongoDB
    await connectDB();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      console.log(`🚀  Narrator API server running on port ${PORT}`);
      console.log(`🌍  Environment: ${process.env.NODE_ENV}`);
      console.log(`📍  Health check: http://localhost:${PORT}/health`);
    });

    // ─── Graceful Shutdown ──────────────────────────────────────────────────
    const shutdown = (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully…`);
      server.close(() => {
        console.log('✅  HTTP server closed');
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        console.error('❌  Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('unhandledRejection', (reason: unknown) => {
      console.error('❌  Unhandled Promise Rejection:', reason);
      shutdown('UNHANDLED_REJECTION');
    });

    process.on('uncaughtException', (err: Error) => {
      console.error('❌  Uncaught Exception:', err);
      shutdown('UNCAUGHT_EXCEPTION');
    });
  } catch (error) {
    console.error('❌  Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
