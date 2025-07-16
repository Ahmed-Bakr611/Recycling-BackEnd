import express from "express";
import authentication from "./auth";
import orderRoute from './pickupRoutes'
const router = express.Router();

export default (): express.Router => {
  authentication(router);
  orderRoute(router)
  
  return router;
};
