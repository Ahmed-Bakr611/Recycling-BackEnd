import express from "express";
import { reportDeliveryUser } from "../controllers/reportController";
import { authenticate } from "../middlewares/authenticate";

const router = express.Router();

router.post("/delivery/:deliveryUserId", authenticate, reportDeliveryUser);

export default router;


