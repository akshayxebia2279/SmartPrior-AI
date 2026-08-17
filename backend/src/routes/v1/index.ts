import { Router } from 'express';
import authRouter from './auth.router';
import healthRouter from './health.router';
import priorAuthRouter from './prior-authorizations.router';
import documentsRouter from './documents.router';
import referenceDataRouter from './reference-data.router';

const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/', healthRouter);
v1Router.use('/documents', documentsRouter);
v1Router.use('/', referenceDataRouter);
v1Router.use('/prior-authorizations', priorAuthRouter);

export default v1Router;
