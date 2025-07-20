import express from "express";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "../controllers/addressController";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";

export default (router: express.Router) => {
  router.get("/addresses", authenticate,authorize(["customer","admin"]), getAddresses);
  router.post("/addresses", authenticate, createAddress);
  router.put("/addresses/:id", authenticate, updateAddress);
  router.delete("/addresses/:id", authenticate, deleteAddress);
};
