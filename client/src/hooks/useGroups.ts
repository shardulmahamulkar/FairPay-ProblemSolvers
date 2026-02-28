import { useQuery } from "@tanstack/react-query";
import { ApiService } from "@/services/ApiService";

export function useGroups(userId: string | undefined) {
    return useQuery({
        queryKey: ["groups", userId],
        queryFn: async () => {
            if (!userId) return [];
            const res = await ApiService.get(`/api/groups/user/${userId}`);
            return (res as any[]) || [];
        },
        enabled: !!userId,
    });
}
