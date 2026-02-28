import { Types } from "mongoose";
import { Expense } from "../models/Expense";
import { Stats } from "../models/Stats";
import { OwedBorrow } from "../models/OwedBorrow";
import { Group } from "../models/Group";

export class ExpenseService {

    // Create a new expense
    static async createExpense(data: {
        groupId: string;
        userId: string;
        expenseNote?: string;
        amount: number;
        currency?: string;
        paymentMethod?: string;
        billPhoto?: string;
        participatorsInvolved: { userId: string; splitPercentage?: number; amount: number }[];
    }) {

        // 1. Create the Expense document
        const expense = await Expense.create({
            groupId: new Types.ObjectId(data.groupId),
            userId: data.userId,
            expenseNote: data.expenseNote,
            amount: data.amount,
            currency: data.currency || "INR",
            paymentMethod: data.paymentMethod,
            billPhoto: data.billPhoto,
            participatorsInvolved: data.participatorsInvolved.map(p => ({
                userId: p.userId,
                splitPercentage: p.splitPercentage,
                amount: p.amount
            }))
        });

        // 2. Update Group Stats (increase spent amount)
        const stats = await Stats.findOne({ groupId: data.groupId });
        if (stats) {
            stats.spent += data.amount;
            stats.moneyLeft = stats.budget - stats.spent;
            await stats.save();
        }

        // 3. Update OwedBorrow balances for all participators
        const payerId = data.userId;
        const expenseCurrency = data.currency || "INR";
        for (const participator of data.participatorsInvolved) {
            // User doesn't owe themselves
            if (participator.userId === payerId) continue;

            const owedAmount = participator.amount;
            const payeeId = participator.userId;

            // Check if an exact OwedBorrow exists in the SAME currency (someone owes the payer)
            let debt = await OwedBorrow.findOne({
                groupId: data.groupId,
                payerId: payeeId,
                payeeId: payerId,
                currency: expenseCurrency,
                status: "pending"
            });

            if (debt) {
                debt.amount += owedAmount;
                await debt.save();
            } else {
                // Check if reverse debt exists in the SAME currency
                let reverseDebt = await OwedBorrow.findOne({
                    groupId: data.groupId,
                    payerId: payerId,
                    payeeId: payeeId,
                    currency: expenseCurrency,
                    status: "pending"
                });

                if (reverseDebt) {
                    if (reverseDebt.amount > owedAmount) {
                        reverseDebt.amount -= owedAmount;
                        await reverseDebt.save();
                    } else if (reverseDebt.amount < owedAmount) {
                        const remainder = owedAmount - reverseDebt.amount;
                        reverseDebt.status = "completed";
                        await reverseDebt.save();

                        await OwedBorrow.create({
                            groupId: new Types.ObjectId(data.groupId),
                            payerId: payeeId,
                            payeeId: payerId,
                            amount: remainder,
                            currency: expenseCurrency,
                            status: "pending"
                        });
                    } else {
                        reverseDebt.status = "completed";
                        await reverseDebt.save();
                    }
                } else {
                    await OwedBorrow.create({
                        groupId: new Types.ObjectId(data.groupId),
                        payerId: payeeId,
                        payeeId: payerId,
                        amount: owedAmount,
                        currency: expenseCurrency,
                        status: "pending"
                    });
                }
            }
        }

        return expense;
    }

    // Get all expenses for a group
    // Get expenses for a group, indicating if they are settled
    static async getGroupExpenses(groupId: string) {
        const expenses = await Expense.find({ groupId }).lean().sort({ expenseTime: -1 });
        const completedBorrows = await OwedBorrow.find({ groupId, status: "completed" }).lean();

        const hasSettled = (u1: string, u2: string) => {
            return completedBorrows.some((b: any) =>
                (b.payerId === u1 && b.payeeId === u2) ||
                (b.payerId === u2 && b.payeeId === u1)
            );
        };

        return expenses.map((exp: any) => {
            const isSettled = exp.participatorsInvolved?.some((p: any) =>
                p.userId !== exp.userId && hasSettled(exp.userId, p.userId)
            );
            return { ...exp, status: isSettled ? "settled" : "pending" };
        });
    }

    // Get stats for a group
    static async getGroupStats(groupId: string) {
        return Stats.findOne({ groupId });
    }

    // Update stats for a group (e.g. set budget)
    static async updateGroupStats(groupId: string, updates: { budget?: number }) {
        let stats = await Stats.findOne({ groupId });
        if (!stats) {
            stats = await Stats.create({ groupId, budget: updates.budget || 0, spent: 0, moneyLeft: updates.budget || 0 });
        } else {
            if (updates.budget !== undefined) {
                stats.budget = updates.budget;
                stats.moneyLeft = stats.budget - stats.spent;
            }
            await stats.save();
        }
        return stats;
    }

    // Get balances (who owes who) for a group
    static async getGroupBalances(groupId: string) {
        return OwedBorrow.find({ groupId, status: "pending" });
    }

    // Get simplified (minimized) settlements for a group
    // Uses greedy algorithm: compute net balance per member, then match largest creditor with largest debtor
    static async getSimplifiedBalances(groupId: string) {
        const rawBalances = await OwedBorrow.find({ groupId, status: "pending" }).lean();

        if (rawBalances.length === 0) return { simplified: [], rawBalances: [] };

        // 1. Compute net balance per member
        // Positive = net creditor (is owed money), Negative = net debtor (owes money)
        const netMap: Record<string, number> = {};
        for (const b of rawBalances) {
            const payer = b.payerId;  // person who owes
            const payee = b.payeeId;  // person who is owed
            netMap[payer] = (netMap[payer] || 0) - b.amount;
            netMap[payee] = (netMap[payee] || 0) + b.amount;
        }

        // 2. Separate into creditors (positive) and debtors (negative)
        const creditors: { userId: string; amount: number }[] = [];
        const debtors: { userId: string; amount: number }[] = [];

        for (const [userId, net] of Object.entries(netMap)) {
            if (net > 0.01) {
                creditors.push({ userId, amount: net });
            } else if (net < -0.01) {
                debtors.push({ userId, amount: -net }); // store as positive
            }
        }

        // 3. Greedy algorithm: match largest debtor with largest creditor
        creditors.sort((a, b) => b.amount - a.amount);
        debtors.sort((a, b) => b.amount - a.amount);

        const simplified: { from: string; to: string; amount: number }[] = [];
        let ci = 0, di = 0;

        while (ci < creditors.length && di < debtors.length) {
            const transferAmount = Math.min(creditors[ci].amount, debtors[di].amount);

            if (transferAmount > 0.01) {
                simplified.push({
                    from: debtors[di].userId,
                    to: creditors[ci].userId,
                    amount: Math.round(transferAmount * 100) / 100,
                });
            }

            creditors[ci].amount -= transferAmount;
            debtors[di].amount -= transferAmount;

            if (creditors[ci].amount < 0.01) ci++;
            if (debtors[di].amount < 0.01) di++;
        }

        // 4. Enrich with group name and user info
        const group = await Group.findById(groupId).select("groupName").lean();
        const groupName = (group as any)?.groupName || "";

        // Collect all user IDs involved
        const userIds = new Set<string>();
        simplified.forEach(s => { userIds.add(s.from); userIds.add(s.to); });

        const { User } = await import("../models/User");
        const users = await User.find({ authId: { $in: [...userIds] } }).lean();
        const userLookup: Record<string, any> = {};
        for (const u of users) {
            userLookup[(u as any).authId] = u;
        }

        const enrichedSimplified = simplified.map(s => ({
            ...s,
            groupId,
            groupName,
            fromName: (userLookup[s.from] as any)?.displayName || (userLookup[s.from] as any)?.username || s.from.substring(0, 8),
            toName: (userLookup[s.to] as any)?.displayName || (userLookup[s.to] as any)?.username || s.to.substring(0, 8),
            fromAvatar: (userLookup[s.from] as any)?.avatar || "",
            toAvatar: (userLookup[s.to] as any)?.avatar || "",
            toUpiId: (userLookup[s.to] as any)?.upiId || "",
        }));

        // Also return the raw OwedBorrow IDs so the frontend can settle the underlying records
        // Map: for each simplified transaction (from→to), find the raw OwedBorrow records that contribute
        const rawMapping = simplified.map(s => {
            // Find all raw balances where 'from' owes 'to' (directly or indirectly via net calculation)
            return rawBalances
                .filter((b: any) => b.payerId === s.from || b.payeeId === s.to)
                .map((b: any) => String(b._id));
        });

        return {
            simplified: enrichedSimplified,
            rawBalances: rawBalances.map((b: any) => ({
                ...b,
                _id: String(b._id),
                groupName,
            })),
            rawMapping,
        };
    }

    // Delete an expense
    static async deleteExpense(expenseId: string) {
        const expense = await Expense.findById(expenseId);
        if (!expense) throw new Error("Expense not found");

        // Reverse the stats
        const stats = await Stats.findOne({ groupId: expense.groupId });
        if (stats) {
            stats.spent -= expense.amount;
            stats.moneyLeft = stats.budget - stats.spent;
            await stats.save();
        }

        // Note: we do NOT reverse OwedBorrow here for simplicity 
        // (a full implementation would need to undo the debt calculations)

        await Expense.findByIdAndDelete(expenseId);
    }

    // Get all expenses for a user across all groups
    static async getUserExpenses(userId: string) {
        // Find all groups where user is a member
        const groups = await Group.find({
            $or: [{ createdBy: userId }, { "members.userId": userId }],
            isArchived: false,
        });
        const groupIds = groups.map(g => g._id);

        return Expense.find({ groupId: { $in: groupIds } })
            .sort({ expenseTime: -1 })
            .limit(50);
    }

    // Get total owed/receivable summary for a user (enriched with group names + currency)
    static async getUserSummary(userId: string) {
        const [owedDocs, receivableDocs] = await Promise.all([
            OwedBorrow.find({ payerId: userId, status: "pending" }),
            OwedBorrow.find({ payeeId: userId, status: "pending" }),
        ]);

        const totalOwed = owedDocs.reduce((sum, d) => sum + d.amount, 0);
        const totalReceivable = receivableDocs.reduce((sum, d) => sum + d.amount, 0);

        // Enrich with group names; currency comes from the OwedBorrow record itself
        const enrichDoc = async (d: any) => {
            try {
                const obj = d.toObject();
                const g = await Group.findById(d.groupId).select("groupName");
                obj.groupName = g?.groupName || "";
                return obj;
            } catch { return d.toObject(); }
        };

        const [enrichedOwed, enrichedReceivable] = await Promise.all([
            Promise.all(owedDocs.map(enrichDoc)),
            Promise.all(receivableDocs.map(enrichDoc)),
        ]);

        return { totalOwed, totalReceivable, owedDocs: enrichedOwed, receivableDocs: enrichedReceivable };
    }

    // Update an expense (note, amount, category)
    static async updateExpense(expenseId: string, updates: {
        expenseNote?: string;
        amount?: number;
        category?: string;
    }) {
        const expense = await Expense.findById(expenseId);
        if (!expense) throw new Error("Expense not found");

        // If amount changed, adjust stats
        if (updates.amount !== undefined && updates.amount !== expense.amount) {
            const stats = await Stats.findOne({ groupId: expense.groupId });
            if (stats) {
                stats.spent = stats.spent - expense.amount + updates.amount;
                stats.moneyLeft = stats.budget - stats.spent;
                await stats.save();
            }
        }

        const updated = await Expense.findByIdAndUpdate(
            expenseId,
            { $set: updates },
            { new: true }
        );
        return updated;
    }
}
