import express from "express";
import {
  createGuestSession,
  getUserSessions,
  invalidateSession,
  upgradeGuestSession,
} from "../controllers/sessionController";
import { authenticate } from "../middlewares/authenticate"; // for authenticated routes

export default (router: express.Router) => {
  // Guest creates a new session
  router.post("/sessions/guest", createGuestSession);

  // Authenticated user: get all their sessions
  router.get("/sessions", authenticate, getUserSessions);

  // Authenticated user: invalidate specific session
  router.patch(
    "/sessions/:sessionId/invalidate",
    authenticate,
    invalidateSession
  );

  // Optional: upgrade guest to authenticated session
  router.post("/sessions/upgrade", authenticate, upgradeGuestSession);
};
