import express from "express";
import authentication from "./auth";
import orderRoute from './pickupRoutes'
import addressRoute from './address'
const router = express.Router();

export default (): express.Router => {
  authentication(router);
  orderRoute(router)
  addressRoute(router)
  
  return router;
};
