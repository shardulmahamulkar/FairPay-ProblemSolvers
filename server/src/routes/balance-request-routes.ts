import { Router } from "express";
import { BalanceRequestService } from "../services/balance-request-services";

export const balanceRequestRoutes = Router();

// Create a settlement request
balanceRequestRoutes.post("/settle", async (req, res) => {
    try {
        const { owedBorrowId, requestedBy, paymentMethod } = req.body;
        const result = await BalanceRequestService.createSettlement(owedBorrowId, requestedBy, paymentMethod);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Create a dispute request
balanceRequestRoutes.post("/dispute", async (req, res) => {
    try {
        const { owedBorrowId, requestedBy, reason, proposedAmount } = req.body;
        const result = await BalanceRequestService.createDispute(owedBorrowId, requestedBy, reason, proposedAmount);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Accept a request
balanceRequestRoutes.post("/:id/accept", async (req, res) => {
    try {
        const { userId } = req.body;
        const result = await BalanceRequestService.acceptRequest(req.params.id, userId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Reject a request
balanceRequestRoutes.post("/:id/reject", async (req, res) => {
    try {
        const { userId } = req.body;
        const result = await BalanceRequestService.rejectRequest(req.params.id, userId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Get pending requests for a user (for notifications)
balanceRequestRoutes.get("/pending/:userId", async (req, res) => {
    try {
        const result = await BalanceRequestService.getPendingRequests(req.params.userId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Get all requests for a user (activity log)
balanceRequestRoutes.get("/activity/:userId", async (req, res) => {
    try {
        const result = await BalanceRequestService.getUserRequests(req.params.userId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});
