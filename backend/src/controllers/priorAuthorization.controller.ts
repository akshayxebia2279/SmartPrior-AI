import { Request, Response, NextFunction } from 'express';
import { PriorAuthorizationService } from '../services/priorAuthorization.service';
import { RuleValidationService } from '../services/ruleValidation.service';
import { AIAnalysisService } from '../services/aiAnalysis.service';

export class PriorAuthorizationController {
  private service: PriorAuthorizationService;
  private ruleValidationService: RuleValidationService;
  private aiAnalysisService: AIAnalysisService;

  constructor() {
    this.service = new PriorAuthorizationService();
    this.ruleValidationService = new RuleValidationService();
    this.aiAnalysisService = new AIAnalysisService();
  }

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user?.userId as string;
      const actorRole = req.user?.role as any;
      const created = await this.service.create(req.body, actorId, actorRole);
      res.status(201).json({ priorAuthorization: created });
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const item = await this.service.getById(req.params.id);
      res.status(200).json({ priorAuthorization: item });
    } catch (error) {
      next(error);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined;
      const status = req.query.status ? (req.query.status as string) : undefined;
      const result = await this.service.list({ page, pageSize, status });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorRole = req.user?.role as any;
      const updated = await this.service.updateStatus(req.params.id, req.body.status, actorRole);
      res.status(200).json({ priorAuthorization: updated });
    } catch (error) {
      next(error);
    }
  };

  public evaluate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorRole = req.user?.role as any;
      const result = await this.ruleValidationService.evaluate(req.params.id, actorRole);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public getEvaluation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorRole = req.user?.role as any;
      const result = await this.ruleValidationService.getLatestEvaluation(req.params.id, actorRole);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public analyze = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorRole = req.user?.role as any;
      const result = await this.aiAnalysisService.analyze(req.params.id, actorRole);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public getAnalysis = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorRole = req.user?.role as any;
      const result = await this.aiAnalysisService.getLatestAnalysis(req.params.id, actorRole);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public recordDecision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user?.userId as string;
      const actorRole = req.user?.role as any;
      const result = await this.service.recordReviewerDecision(req.params.id, req.body, actorId, actorRole);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
