import express, { Application } from 'express';
import cors from 'cors';
import v1Router from './routes/v1';
import { requestLogger } from './middleware/logger.middleware';
import { errorHandler } from './middleware/error.middleware';

export const createApp = (): Application => {
  const app = express();

  // Standard middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  // API Routes
  app.use('/api/v1', v1Router);

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
