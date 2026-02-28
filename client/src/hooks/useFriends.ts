import { useQuery } from "@tanstack/react-query";
import { ApiService } from "@/services/ApiService";

export function useFriends(userId: string | undefined) {
    return useQuery({
        queryKey: ["friends", userId],
        queryFn: async () => {
            if (!userId) return [];
            const res = await ApiService.get(`/api/friends/user/${userId}`);
            return (res as any[]) || [];
        },
        enabled: !!userId,
    });
}
