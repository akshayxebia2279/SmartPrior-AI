import { Request, Response, NextFunction } from 'express';
import { HealthService } from '../services/health.service';

export class HealthController {
  private healthService: HealthService;

  constructor() {
    this.healthService = new HealthService();
  }

  public getHealth = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const healthStatus = await this.healthService.checkHealth();
      res.status(200).json(healthStatus);
    } catch (error) {
      next(error);
    }
  };
}
