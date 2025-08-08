// routes/courierRoutes.ts
import { Router } from 'express';
import { authorize } from '../middlewares/authorize';
import { assignCourierToOrder, getCourierAssignedOrders, getOrdersByCourier,  } from '../controllers/courierController';
import { authenticate } from '../middlewares/authenticate';

export default (router: Router) => {
  router.put('/orders/:orderId/assign-courier', authenticate,authorize(['admin']), assignCourierToOrder);
  router.get('/my-orders', authenticate , authorize(['delivery']), getCourierAssignedOrders);
router.get("/orders/courier/:courierId", getOrdersByCourier);

};
