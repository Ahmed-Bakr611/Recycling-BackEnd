import express from "express";
import multer from "multer";
import {
  deleteUser,
  getAllUsers,
  getUserById,
  searchUsers,
  updateUserByAdmin,
} from "../controllers/userController";
import { authenticate } from "../middlewares/authenticate";
import { authorize } from "../middlewares/authorize";

export default (appRouter: express.Router) => {
  appRouter.get("/users", authenticate, authorize(["admin"]), getAllUsers);
  appRouter.get("/users/:id", authenticate, authorize(["admin"]), getUserById);

  appRouter.delete(
    "/users/:id",
    authenticate,
    authorize(["admin"]),
    deleteUser
  );
  appRouter.patch(
    "/users/:id",
    authenticate,
    authorize(["admin"]),
    updateUserByAdmin
  );
};
