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
