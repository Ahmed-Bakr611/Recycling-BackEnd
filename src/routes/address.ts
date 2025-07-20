import express from "express";
import {
  createAddress,
  updateAddress,
  deleteAddress,
  getAddressByUserId,
  getAllAddresses,
  getAddresses,
} from "../controllers/addressController";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";

export default (router: express.Router) => {
  router.get("/addresses", authenticate, getAddresses);
  router.get("/addresses/:id", authenticate, getAddressByUserId);
  router.get(
    "/adminAllAdresses",
    authenticate,
    authorize(["admin"]),
    getAllAddresses
  );
  router.post("/addresses", authenticate, createAddress);
  router.put("/addresses/:id", authenticate, updateAddress);
  router.delete("/addresses/:id", authenticate, deleteAddress);
};
