import { ExpenseService } from "../services/expense-services";

export const ExpenseController = {
    create: async ({ body }: { body: any }) => {
        return ExpenseService.createExpense(body);
    },

    listByGroup: async ({ params }: { params: { groupId: string } }) => {
        return ExpenseService.getGroupExpenses(params.groupId);
    },

    getStats: async ({ params }: { params: { groupId: string } }) => {
        return ExpenseService.getGroupStats(params.groupId);
    },

    getBalances: async ({ params }: { params: { groupId: string } }) => {
        return ExpenseService.getGroupBalances(params.groupId);
    },
};
