// routes/courierRoutes.ts
import { Router } from 'express';
import { authorize } from '../middlewares/authorize';
import { assignCourierToOrder } from '../controllers/courierController';
import { authenticate } from '../middlewares/authenticate';

export default (router: Router) => {
  router.put('/orders/:orderId/assign-courier', authenticate,authorize(['admin']), assignCourierToOrder);
};
