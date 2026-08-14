import { Request, Response, NextFunction } from 'express';
import { DocumentService } from '../services/document.service';

export class DocumentController {
  private service: DocumentService;

  constructor() {
    this.service = new DocumentService();
  }

  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user?.userId as string;
      const actorRole = req.user?.role as any;
      const document = await this.service.create(req.body, actorId, actorRole);
      res.status(201).json({ document });
    } catch (error) {
      next(error);
    }
  };

  public upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorId = req.user?.userId as string;
      const actorRole = req.user?.role as any;
      const file = req.file as Express.Multer.File | undefined;
      const document = await this.service.createUpload(req.body, actorId, actorRole, file);
      res.status(201).json({ document });
    } catch (error) {
      next(error);
    }
  };

  public getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const document = await this.service.getById(req.params.id);
      res.status(200).json({ document });
    } catch (error) {
      next(error);
    }
  };

  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : undefined;
      const priorAuthorizationId = req.query.priorAuthorizationId ? (req.query.priorAuthorizationId as string) : undefined;
      const documentType = req.query.documentType ? (req.query.documentType as any) : undefined;
      const uploadStatus = req.query.uploadStatus ? (req.query.uploadStatus as any) : undefined;

      const result = await this.service.list({ page, pageSize, priorAuthorizationId, documentType, uploadStatus });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public listByPriorAuthorization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.listByPriorAuthorization(req.params.id);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
