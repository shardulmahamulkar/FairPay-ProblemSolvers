import { Router } from "express";
import { ExpenseService } from "../services/expense-services";

export const expenseRoutes = Router();

// Create expense
expenseRoutes.post("/", async (req, res) => {
    try {
        const result = await ExpenseService.createExpense(req.body);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Get expenses for a group
expenseRoutes.get("/group/:groupId", async (req, res) => {
    try {
        const result = await ExpenseService.getGroupExpenses(req.params.groupId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Get stats for a group
expenseRoutes.get("/stats/:groupId", async (req, res) => {
    try {
        const result = await ExpenseService.getGroupStats(req.params.groupId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Update stats (e.g. set budget)
expenseRoutes.put("/stats/:groupId", async (req, res) => {
    try {
        const result = await ExpenseService.updateGroupStats(req.params.groupId, req.body);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Get balances for a group
expenseRoutes.get("/balances/:groupId", async (req, res) => {
    try {
        const result = await ExpenseService.getGroupBalances(req.params.groupId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Get simplified (optimized) settlements for a group
expenseRoutes.get("/simplified-balances/:groupId", async (req, res) => {
    try {
        const result = await ExpenseService.getSimplifiedBalances(req.params.groupId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Delete an expense
expenseRoutes.delete("/:expenseId", async (req, res) => {
    try {
        await ExpenseService.deleteExpense(req.params.expenseId);
        res.json({ success: true });
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Update an expense
expenseRoutes.put("/:expenseId", async (req, res) => {
    try {
        const result = await ExpenseService.updateExpense(req.params.expenseId, req.body);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Get all expenses across all groups for a user (for activity page)
expenseRoutes.get("/user/:userId", async (req, res) => {
    try {
        const result = await ExpenseService.getUserExpenses(req.params.userId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// Get total owed/receivable for a user across all groups  
expenseRoutes.get("/summary/:userId", async (req, res) => {
    try {
        const result = await ExpenseService.getUserSummary(req.params.userId);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});
