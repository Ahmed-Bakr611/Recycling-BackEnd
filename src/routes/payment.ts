import { Router } from "express";
import { getAllPayments, getPaymentById, getPaymentStats, refundPayment } from "../controllers/stripePayment";

export default (router: Router) => {
    router.get('/payment', getAllPayments);

router.get('/payment/stats', getPaymentStats);

router.get('/payment/:id', getPaymentById);
  router.post('/payment/:id/refund', refundPayment);

};
