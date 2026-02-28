import { useQuery } from "@tanstack/react-query";
import { ApiService } from "@/services/ApiService";

export function useExpenses(userId: string | undefined) {
    return useQuery({
        queryKey: ["expenses", userId],
        queryFn: async () => {
            if (!userId) return [];
            const res = await ApiService.get(`/api/expenses/user/${userId}`);
            return (res as any[]) || [];
        },
        enabled: !!userId,
    });
}
