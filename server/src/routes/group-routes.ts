import { Router } from "express";
import { GroupService } from "../services/group-services";

export const groupRoutes = Router();

// Create group
groupRoutes.post("/", async (req, res) => {
  try {
    const result = await GroupService.createGroup(req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get groups for a user
groupRoutes.get("/user/:userId", async (req, res) => {
  try {
    const result = await GroupService.getUserGroups(req.params.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get single group by ID
groupRoutes.get("/:groupId", async (req, res) => {
  try {
    const result = await GroupService.getGroupById(req.params.groupId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Update group (name, description, etc.)
groupRoutes.put("/:groupId", async (req, res) => {
  try {
    const result = await GroupService.updateGroup(req.params.groupId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Delete group
groupRoutes.delete("/:groupId", async (req, res) => {
  try {
    await GroupService.deleteGroup(req.params.groupId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Add member
groupRoutes.post("/add-member", async (req, res) => {
  try {
    const result = await GroupService.addMember(req.body.groupId, req.body.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Remove member
groupRoutes.post("/remove-member", async (req, res) => {
  try {
    const result = await GroupService.removeMember(req.body.groupId, req.body.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Archive group
groupRoutes.patch("/archive", async (req, res) => {
  try {
    const result = await GroupService.archiveGroup(req.body.groupId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
