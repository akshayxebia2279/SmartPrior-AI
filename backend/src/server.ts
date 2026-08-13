import { createApp } from './app';
import { env } from './config/env.config';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`🚀 SmartPrior-AI API Server listening on port ${env.PORT} [${env.NODE_ENV}]`);
  console.log(`Health check: http://localhost:${env.PORT}/api/v1/health`);
});
