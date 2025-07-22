import express from "express";
import authentication from "./auth";
import orderRoute from "./pickupRoutes";
import addressRoute from "./address";
import profile from "./profile";
import users from "./usersRoute";
import pickupRoutes from "./pickupRoutes"
const router = express.Router();

export default (): express.Router => {
  authentication(router);
  orderRoute(router);
  addressRoute(router);
  profile(router);
  users(router);
  pickupRoutes(router);
  return router;
};
