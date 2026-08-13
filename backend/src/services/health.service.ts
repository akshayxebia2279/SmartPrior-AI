import { HealthRepository, HealthStatus } from '../repositories/health.repository';

export class HealthService {
  private healthRepository: HealthRepository;

  constructor() {
    this.healthRepository = new HealthRepository();
  }

  public async checkHealth(): Promise<HealthStatus> {
    return this.healthRepository.getHealthStatus();
  }
}
