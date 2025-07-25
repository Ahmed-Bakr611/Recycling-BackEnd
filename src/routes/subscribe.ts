// routes/subscribe.ts
import { Router } from "express";
import { handleSubscription } from "../controllers/subscribeController";

export default (router: Router) => {
  router.post("/subscribe", handleSubscription);
};
