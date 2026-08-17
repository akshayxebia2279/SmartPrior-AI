import { Request, Response, NextFunction } from 'express';
import { PrismaClient, RoleName } from '@prisma/client';

export class ReferenceDataController {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  private requireReadAccess = (req: Request) => {
    const role = req.user?.role as RoleName | undefined;
    if (!role || ![RoleName.ADMIN, RoleName.PROVIDER, RoleName.REVIEWER].includes(role)) {
      const err: any = new Error('Access denied');
      err.statusCode = 403;
      throw err;
    }
  };

  public listPatients = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireReadAccess(req);
      const items = await this.prisma.patient.findMany({
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          memberId: true,
          mrn: true,
          dateOfBirth: true,
          email: true,
          phone: true,
        },
      });
      res.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  };

  public listProviders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireReadAccess(req);
      const items = await this.prisma.provider.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          npi: true,
          contactEmail: true,
          phone: true,
          isActive: true,
        },
      });
      res.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  };

  public listInsurancePlans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      this.requireReadAccess(req);
      const items = await this.prisma.insurancePlan.findMany({
        orderBy: { name: 'asc' },
        include: {
          insuranceCompany: {
            select: { id: true, name: true, code: true },
          },
        },
      });
      res.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  };
}
