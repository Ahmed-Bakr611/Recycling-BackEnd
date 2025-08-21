import express from "express";
import authentication from "./auth";
import orderRoute from "./pickupRoutes";
import addressRoute from "./address";
import profile from "./profile";
import users from "./usersRoute";
import categoryRoutes from "./categoryRoutes";
import cartRoutes from "./cartRoutes";
import courierRoutes from "./courierRoutes";
import notificationRoutes from "./notificationRoutes";
import session from "./sessionRoutes";
import delivery from "./delivery";
import subscribe from "../routes/subscribe";
import payment from "./payment";
import contactus from './contact-us'
import reportRoutes from "./reportRoutes";
const router = express.Router();

export default (): express.Router => {
  authentication(router);
  session(router);
  orderRoute(router);
  addressRoute(router);
  profile(router);
  users(router);
  categoryRoutes(router);
  cartRoutes(router);
  courierRoutes(router);
  subscribe(router);
  delivery(router);
  courierRoutes(router);
  subscribe(router);
  contactus(router);
  payment(router);
  router.use("/reports", reportRoutes);
  router.use("/notifications", notificationRoutes);
  return router;
};
