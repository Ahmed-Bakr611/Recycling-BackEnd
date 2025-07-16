import express from "express";
import authentication from "./auth";
import categoryRoutes from "./categoryRoutes"; // Ensure this path is correct
const router = express.Router();

export default (): express.Router => {
  authentication(router);
  // categoryRoutes(router);
  return router;
};
