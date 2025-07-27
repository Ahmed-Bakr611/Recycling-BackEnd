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
  router.get("/addresses/:id", authenticate, getAddressByUserId);
  router.get(
    "/adminAllAdresses",
    authenticate,
    authorize(["admin"]),
    getAllAddresses
  );

  router.get(
    "/addresses",
    authenticate,
    authorize(["customer", "buyer", "admin"]),
    getAddresses
  );
  router.post(
    "/addresses",
    authenticate,
    authorize(["customer", "buyer", "admin"]),
    createAddress
  );
  router.put(
    "/addresses/:id",
    authenticate,
    authorize(["customer", "buyer", "admin"]),
    updateAddress
  );
  router.delete(
    "/addresses/:id",
    authenticate,
    authorize(["customer", "buyer", "admin"]),
    deleteAddress
  );
};
