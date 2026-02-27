import { useState, useEffect } from "react";
import { Receipt, Check, Flag, AlertTriangle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ApiService } from "@/services/ApiService";
import { useToast } from "@/hooks/use-toast";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryIcons";
import { getCurrencySymbol } from "@/lib/currency";
import { ExpenseDetailsDialog } from "@/components/ExpenseDetailsDialog";

const ActivityPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);

  const getName = (uid: string) => {
    if (uid === user?.id) return "You";
    return userNames[uid] || uid.substring(0, 8);
  };

  const fetchData = async () => {
    if (!user?.id) return;
    try {
      const [expRes, reqRes] = await Promise.all([
        ApiService.get(`/api/expenses/user/${user.id}`).catch(() => []),
        ApiService.get(`/api/balance-requests/pending/${user.id}`).catch(() => []),
      ]);
      const expList = expRes as any[] || [];
      const requests = reqRes as any[] || [];
      setExpenses(expList);
      setPendingRequests(requests);

      // Resolve names for all unique user IDs (expense payers + request senders)
      const ids = new Set<string>();
      expList.forEach((e: any) => { if (e.userId && e.userId !== user?.id) ids.add(e.userId); });
      requests.forEach((r: any) => { if (r.requestedBy !== user?.id) ids.add(r.requestedBy); });

      const nameMap: Record<string, string> = {};
      await Promise.all([...ids].map(async (uid) => {
        try {
          const u: any = await ApiService.get(`/api/users/${uid}`);
          nameMap[uid] = u.username || u.email?.split("@")[0] || uid.substring(0, 8);
        } catch { nameMap[uid] = uid.substring(0, 8); }
      }));
      setUserNames(nameMap);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleAccept = async (requestId: string) => {
    try {
      await ApiService.post(`/api/balance-requests/${requestId}/accept`, { userId: user?.id });
      toast({ title: "Accepted", description: "Balance updated." });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await ApiService.post(`/api/balance-requests/${requestId}/reject`, { userId: user?.id });
      toast({ title: "Declined", description: "Request declined." });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pt-4">
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-xl font-bold text-foreground">Activity</h2>
        {pendingRequests.length > 0 && (
          <Badge className="bg-owed text-white border-0">{pendingRequests.length} pending</Badge>
        )}
      </div>

      <Tabs defaultValue={pendingRequests.length > 0 ? "requests" : "expenses"}>
        <TabsList className="w-full bg-muted/50 rounded-xl p-1 h-auto flex">
          <TabsTrigger value="expenses" className="flex-1 text-xs rounded-lg py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Expenses
          </TabsTrigger>
          <TabsTrigger value="requests" className="flex-1 text-xs rounded-lg py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
            Requests {pendingRequests.length > 0 && <span className="ml-1 bg-owed text-white text-[10px] rounded-full px-1.5">{pendingRequests.length}</span>}
          </TabsTrigger>
        </TabsList>

        {/* Expenses tab */}
        <TabsContent value="expenses" className="mt-4 space-y-2">
          {expenses.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No transactions yet</p>
          )}
          {expenses.map((exp) => {
            const isMyExpense = exp.userId === user?.id;
            return (
              <Card
                key={exp._id}
                onClick={() => setSelectedExpense(exp)}
                className="flex items-center justify-between p-3 rounded-xl border-0 shadow-sm cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden p-1.5 ${getCategoryColor(exp.category, exp.expenseNote).bg}`}>
                    <img
                      src={getCategoryIcon(exp.category, exp.expenseNote)}
                      alt={exp.category || "expense"}
                      className="w-full h-full object-contain invert"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{exp.expenseNote || "Expense"}</p>
                    <p className="text-xs text-muted-foreground">
                      {isMyExpense ? "You paid" : `Paid by ${getName(exp.userId)}`} • {new Date(exp.expenseTime).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {getCurrencySymbol(exp.currency)}{Number(exp.amount).toFixed(2)}
                </p>
              </Card>
            );
          })}
        </TabsContent>

        {/* Requests tab — incoming settle/dispute requests */}
        <TabsContent value="requests" className="mt-4 space-y-2">
          {pendingRequests.length === 0 && (
            <div className="text-center py-8 space-y-2">
              <Check className="w-8 h-8 text-receive mx-auto" />
              <p className="text-sm text-muted-foreground">No pending requests</p>
            </div>
          )}
          {pendingRequests.map((req) => (
            <Card key={req._id} className="p-4 rounded-xl border-0 shadow-sm space-y-3 border-l-2 border-l-primary">
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                  req.type === "settlement" ? "bg-receive/10" : "bg-owed/10"
                )}>
                  {req.type === "settlement"
                    ? <Check className="w-4 h-4 text-receive" />
                    : <AlertTriangle className="w-4 h-4 text-owed" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {req.type === "settlement" ? "Settlement Request" : "Dispute"}
                  </p>
                  <p className="text-xs text-muted-foreground">From {getName(req.requestedBy)}</p>
                  {req.type === "settlement" && (
                    <p className="text-xs text-foreground mt-1">
                      Wants to mark <strong>{getCurrencySymbol()}{req.amount?.toLocaleString()}</strong> as settled
                    </p>
                  )}
                  {req.type === "dispute" && (
                    <div className="mt-1 space-y-0.5">
                      <p className="text-xs text-foreground">
                        Current: <strong>{getCurrencySymbol()}{req.amount?.toLocaleString()}</strong> → Proposed: <strong>{getCurrencySymbol()}{req.proposedAmount?.toLocaleString()}</strong>
                      </p>
                      <p className="text-xs text-muted-foreground italic">"{req.reason}"</p>
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 rounded-xl h-8 text-xs bg-receive hover:bg-receive/90 text-white" onClick={() => handleAccept(req._id)}>
                  <Check className="w-3 h-3 mr-1" /> Accept
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-xl h-8 text-xs text-owed border-owed/30" onClick={() => handleReject(req._id)}>
                  Decline
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <ExpenseDetailsDialog
        expense={selectedExpense}
        open={!!selectedExpense}
        onOpenChange={(open) => !open && setSelectedExpense(null)}
        getName={getName}
      />
    </div>
  );
};

export default ActivityPage;
