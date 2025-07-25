import express from "express";
import authentication from "./auth";
import orderRoute from "./pickupRoutes";
import addressRoute from "./address";
import profile from "./profile";
import users from "./usersRoute";
import categoryRoutes from "./categoryRoutes";
import cartRoutes from "./cartRoutes";
import courierRoutes from './courierRoutes'
import subscribe from '../routes/subscribe'
const router = express.Router();

export default (): express.Router => {
  authentication(router);
  orderRoute(router);
  addressRoute(router);
  profile(router);
  users(router);
  categoryRoutes(router);
  cartRoutes(router);
  courierRoutes(router)
  subscribe(router)
  return router;
};
