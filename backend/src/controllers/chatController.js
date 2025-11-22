// controllers/chatRoutes.js
import express from "express";
import { verifyToken } from "../middleware/verifytoken.js"; // adjust path to your middleware
import {
  getUserGroups,
  getGroupMessages,
  postMessageToGroup,
  createGroup,
  addMemberToGroup,
  getGroupMembers,
} from "../routes/chatsRoutes.js";

const router = express.Router();

/**
 * Routes:
 * GET    /groups                        -> get groups for current user
 * GET    /groups/:groupId/messages      -> get messages (cursor pagination)
 * POST   /groups/:groupId/messages      -> post a message (persist + broadcast)
 * POST   /groups                         -> create a new group (admin only)
 * POST   /groups/:groupId/members       -> add a member to group (admin)
 *
 * You can change mount point when wiring router (e.g., app.use('/chat', chatRoutes))
 */

// all routes require authentication
router.use(verifyToken);

// Get groups user belongs to
router.get("/groups", getUserGroups);

// Get messages for a group
router.get("/groups/:groupId/messages", getGroupMessages);

// Post message to a group
router.post("/groups/:groupId/messages", postMessageToGroup);

// Create a new group (admin)
router.post("/groups", createGroup);

// Add a member to group
router.post("/groups/:groupId/members", addMemberToGroup);

// get a member to group
router.get("/groups/:groupId/members", getGroupMembers);

export default router;
