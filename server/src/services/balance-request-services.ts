import { Types } from "mongoose";
import { BalanceRequest } from "../models/BalanceRequest";
import { OwedBorrow } from "../models/OwedBorrow";
import { Stats } from "../models/Stats";

export class BalanceRequestService {

    // Create a settlement request (User A asks User B to acknowledge payment)
    static async createSettlement(owedBorrowId: string, requestedBy: string, paymentMethod?: string) {
        const debt = await OwedBorrow.findById(owedBorrowId);
        if (!debt) throw new Error("Balance record not found");
        if (debt.status !== "pending") throw new Error("This balance is already settled or disputed");

        // If paid via UPI, auto-accept and bypass acknowledgment flow
        if (paymentMethod === "upi") {
            debt.status = "completed";
            await debt.save();
            return { autoAccepted: true };
        }

        // Check if a pending request already exists
        const existing = await BalanceRequest.findOne({ owedBorrowId, status: "pending", type: "settlement" });
        if (existing) throw new Error("A settlement request already exists for this balance");

        // The payer initiates → target is the payee
        // The payee initiates (claiming they paid) → target is the payer
        const targetUserId = debt.payerId === requestedBy ? debt.payeeId : debt.payerId;

        return BalanceRequest.create({
            type: "settlement",
            owedBorrowId: new Types.ObjectId(owedBorrowId),
            groupId: debt.groupId,
            requestedBy,
            targetUserId,
            status: "pending",
        });
    }

    // Create a dispute request with reason and proposed amount
    static async createDispute(owedBorrowId: string, requestedBy: string, reason: string, proposedAmount: number) {
        const debt = await OwedBorrow.findById(owedBorrowId);
        if (!debt) throw new Error("Balance record not found");
        if (debt.status === "completed") throw new Error("Cannot dispute a completed balance");

        // Remove any existing open dispute
        await BalanceRequest.deleteOne({ owedBorrowId, status: "pending", type: "dispute" });

        const targetUserId = debt.payerId === requestedBy ? debt.payeeId : debt.payerId;

        return BalanceRequest.create({
            type: "dispute",
            owedBorrowId: new Types.ObjectId(owedBorrowId),
            groupId: debt.groupId,
            requestedBy,
            targetUserId,
            reason,
            proposedAmount,
            status: "pending",
        });
    }

    // Accept a settlement → mark OwedBorrow as completed
    static async acceptRequest(requestId: string, userId: string) {
        const request = await BalanceRequest.findById(requestId);
        if (!request) throw new Error("Request not found");
        if (request.targetUserId !== userId) throw new Error("Not authorized");
        if (request.status !== "pending") throw new Error("Request already resolved");

        if (request.type === "settlement") {
            await OwedBorrow.findByIdAndUpdate(request.owedBorrowId, { status: "completed" });
        } else {
            // Dispute accepted → update amount
            const debt = await OwedBorrow.findById(request.owedBorrowId);
            if (debt && request.proposedAmount != null) {
                const diff = debt.amount - request.proposedAmount;
                // Adjust group stats
                const stats = await Stats.findOne({ groupId: debt.groupId });
                if (stats && diff > 0) {
                    stats.spent = Math.max(0, stats.spent - diff);
                    stats.moneyLeft = stats.budget - stats.spent;
                    await stats.save();
                }
                await OwedBorrow.findByIdAndUpdate(request.owedBorrowId, { amount: request.proposedAmount, status: "pending" });
            }
        }

        request.status = "accepted";
        await request.save();
        return request;
    }

    // Reject a request
    static async rejectRequest(requestId: string, userId: string) {
        const request = await BalanceRequest.findById(requestId);
        if (!request) throw new Error("Request not found");
        if (request.targetUserId !== userId) throw new Error("Not authorized");
        if (request.status !== "pending") throw new Error("Request already resolved");

        request.status = "rejected";
        await request.save();
        return request;
    }

    // Get pending requests targeting a user (what they need to acknowledge)
    static async getPendingRequests(userId: string) {
        const requests = await BalanceRequest.find({ targetUserId: userId, status: "pending" })
            .sort({ createdAt: -1 });

        // Enrich with debt details
        const enriched = await Promise.all(requests.map(async (r) => {
            const debt = await OwedBorrow.findById(r.owedBorrowId);
            return {
                _id: r._id,
                type: r.type,
                status: r.status,
                requestedBy: r.requestedBy,
                groupId: r.groupId,
                owedBorrowId: r.owedBorrowId,
                amount: debt?.amount || 0,
                reason: r.reason,
                proposedAmount: r.proposedAmount,
                createdAt: r.createdAt,
            };
        }));

        return enriched;
    }

    // Get all requests related to a user's balances (for activity)
    static async getUserRequests(userId: string) {
        return BalanceRequest.find({
            $or: [{ requestedBy: userId }, { targetUserId: userId }],
        }).sort({ createdAt: -1 }).limit(50);
    }
}
