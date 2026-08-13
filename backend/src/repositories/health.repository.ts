export interface HealthStatus {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
}

export class HealthRepository {
  public async getHealthStatus(): Promise<HealthStatus> {
    return {
      status: 'ok',
      service: 'smartprior-ai-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
