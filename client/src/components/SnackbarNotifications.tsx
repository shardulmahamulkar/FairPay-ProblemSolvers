import { useEffect, useState } from "react";
import { X, Clock, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ApiService } from "@/services/ApiService";

interface Notification {
  id: string;
  type: "reminder" | "payer";
  message: string;
}

const SnackbarNotifications = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Only fetch and show notifications when user is logged in
    if (!user?.id) return;

    const fetchNotifications = async () => {
      const notifs: Notification[] = [];

      try {
        // Check for pending settlement requests (reminders)
        const pendingRequests: any = await ApiService.get(`/api/balance-requests/pending/${user.id}`);
        if (pendingRequests && pendingRequests.length > 0) {
          notifs.push({
            id: "settle-reminder",
            type: "reminder",
            message: `You have ${pendingRequests.length} pending settlement request${pendingRequests.length > 1 ? "s" : ""} to review`,
          });
        }
      } catch { /* endpoint might not be deployed yet */ }

      try {
        // Check for unsettled balances (next to pay)
        const summary: any = await ApiService.get(`/api/expenses/summary/${user.id}`);
        if (summary?.owedDocs?.length > 0) {
          // Find the highest owed amount and show "next to pay" notification
          const sorted = [...summary.owedDocs].sort((a: any, b: any) => b.amount - a.amount);
          const top = sorted[0];
          if (top?.groupName) {
            notifs.push({
              id: "next-to-pay",
              type: "payer",
              message: `You're next to pay for ${top.groupName}`,
            });
          }
        }
      } catch { /* ignore */ }

      setNotifications(notifs);

      // Show them with staggered timing
      notifs.forEach((n, i) => {
        setTimeout(() => {
          setVisible(prev => [...prev, n.id]);
          setTimeout(() => {
            setVisible(prev => prev.filter(id => id !== n.id));
          }, 6000);
        }, 1500 + i * 4000);
      });
    };

    fetchNotifications();
  }, [user?.id]);

  const dismiss = (id: string) => {
    setDismissed(prev => [...prev, id]);
    setVisible(prev => prev.filter(nid => nid !== id));
  };

  // Don't render anything if not logged in
  if (!user?.id) return null;

  const activeNotifs = notifications.filter(n => visible.includes(n.id) && !dismissed.includes(n.id));
  if (activeNotifs.length === 0) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md space-y-2 pointer-events-none">
      {activeNotifs.map(n => {
        const Icon = n.type === "reminder" ? Clock : UserCheck;
        return (
          <div
            key={n.id}
            className={cn(
              "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-md animate-fade-in",
              n.type === "reminder" && "bg-owed/95 text-white",
              n.type === "payer" && "bg-receive/95 text-white",
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <p className="text-sm font-medium flex-1">{n.message}</p>
            <button onClick={() => dismiss(n.id)} className="p-1 rounded-full hover:bg-white/20">
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default SnackbarNotifications;
