import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Plus, Users, ArrowRightLeft, Receipt, ChevronRight, ArrowUpRight, ArrowDownLeft, UserCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import AnimatedCounter from "@/components/AnimatedCounter";
import { useAuth } from "@/contexts/AuthContext";
import { ApiService } from "@/services/ApiService";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryIcons";
import { getCurrencySymbol } from "@/lib/currency";
import { convertAllToBase } from "@/services/exchangeRate";
import { ExpenseDetailsDialog } from "@/components/ExpenseDetailsDialog";
import { useCurrency } from "@/contexts/CurrencyContext";

const speedTiles = [
  { icon: Plus, label: "New Expense", path: "/expenses/new" },
  { icon: Users, label: "New Group", path: "/groups/new" },
  { icon: ArrowRightLeft, label: "Settle", path: "/settle" },
  { icon: Receipt, label: "Activity", path: "/activity" },
];

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ totalOwed: number; totalReceivable: number }>({ totalOwed: 0, totalReceivable: 0 });
  const [recentExpenses, setRecentExpenses] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendBalances, setFriendBalances] = useState<Record<string, number>>({});
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const { defaultCurrency, formatAmount } = useCurrency();

  useEffect(() => {
    if (!user?.id) return;

    ApiService.get(`/api/groups/user/${user.id}`)
      .then(async (res: any) => {
        setGroups(res || []);
        const ids = new Set<string>();
        (res || []).forEach((g: any) => g.members?.forEach((m: any) => ids.add(m.userId)));
        const avatarMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};
        await Promise.all([...ids].map(async (uid) => {
          if (uid === user?.id) {
            nameMap[uid] = user.name || "You";
            avatarMap[uid] = user.avatar || "";
            return;
          }
          try {
            const u: any = await ApiService.get(`/api/users/${uid}`);
            nameMap[uid] = u.username || uid.substring(0, 8);
            avatarMap[uid] = u.avatar || "";
          } catch {
            nameMap[uid] = uid.substring(0, 8);
          }
        }));
        setUserAvatars(avatarMap);
        setUserNames(nameMap);
      })
      .catch(console.error);

    // Fetch summary and convert all amounts to INR using live exchange rates
    ApiService.get(`/api/expenses/summary/${user.id}`)
      .then(async (res: any) => {
        const owedDocs = res.owedDocs || [];
        const receivableDocs = res.receivableDocs || [];

        // Convert each debt to defaultCurrency
        const convertedOwed = await convertAllToBase(
          owedDocs.map((d: any) => ({ amount: d.amount, currency: d.currency || "INR" })),
          defaultCurrency
        );
        const convertedReceivable = await convertAllToBase(
          receivableDocs.map((d: any) => ({ amount: d.amount, currency: d.currency || "INR" })),
          defaultCurrency
        );

        const totalOwed = convertedOwed.reduce((sum, d) => sum + d.convertedAmount, 0);
        const totalReceivable = convertedReceivable.reduce((sum, d) => sum + d.convertedAmount, 0);

        setSummary({ totalOwed, totalReceivable });

        // Build per-friend converted balances
        const balMap: Record<string, number> = {};
        // They owe you (positive): receivableDocs where payerId is the friend
        receivableDocs.forEach((d: any, i: number) => {
          const friendId = d.payerId;
          balMap[friendId] = (balMap[friendId] || 0) + convertedReceivable[i].convertedAmount;
        });
        // You owe them (negative): owedDocs where payeeId is the friend
        owedDocs.forEach((d: any, i: number) => {
          const friendId = d.payeeId;
          balMap[friendId] = (balMap[friendId] || 0) - convertedOwed[i].convertedAmount;
        });
        setFriendBalances(balMap);
      })
      .catch(console.error);

    ApiService.get(`/api/expenses/user/${user.id}`)
      .then((res: any) => setRecentExpenses((res || []).slice(0, 4)))
      .catch(console.error);

    ApiService.get(`/api/friends/user/${user.id}`)
      .then((res: any) => setFriends((res || []).slice(0, 5)))
      .catch(console.error);
  }, [user, defaultCurrency]);

  const activeGroups = groups.filter(g => !g.isArchived);

  const getName = (uid: string) => {
    if (uid === user?.id) return "You";
    return userNames[uid] || uid.substring(0, 8);
  };

  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);

  return (
    <div className="space-y-6 animate-fade-in pt-4">
      {/* Soft nudge for missing UPI ID */}
      {user && !user.upiId && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 rounded-[20px] shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-amber-600 dark:text-amber-400 font-bold text-xs">UPI</span>
            </div>
            <div>
              <p className="text-[14px] font-bold text-amber-800 dark:text-amber-500 leading-tight">Update your UPI ID</p>
              <p className="text-[12px] text-amber-700 dark:text-amber-500/80 leading-snug">Add it so friends can pay you easily.</p>
            </div>
          </div>
          <Button onClick={() => navigate("/profile")} className="bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-500/20 dark:hover:bg-amber-500/30 dark:text-amber-400 h-8 text-xs font-bold rounded-xl px-4">
            Update
          </Button>
        </div>
      )}

      {/* Summary Card — always premium dark navy, intentional premium widget */}
      <Card className="p-6 border-0 rounded-[32px] relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0F1A2E 0%, #1E2A44 100%)", boxShadow: "0px 20px 48px rgba(15, 26, 46, 0.28)" }}>
        <div className="flex items-center gap-5">
          {/* Left: CTA + tagline */}
          <div className="flex-[1.2] flex flex-col justify-center items-start gap-4">
            <button
              onClick={() => navigate("/expenses/new")}
              className="w-full rounded-[20px] h-[50px] text-[15px] font-bold transition-all flex items-center justify-center gap-2 text-white"
              style={{ backgroundColor: "rgba(198,167,94,0.18)", border: "1px solid rgba(198,167,94,0.55)" }}
            >
              <Plus className="w-5 h-5 text-[#C6A75E]" strokeWidth={2.5} />
              Add Expense
            </button>
            <p className="text-white/40 text-[12px] leading-snug">Track &amp; split<br />shared expenses.</p>
          </div>

          {/* Right: Balance stats */}
          <div className="flex-1 flex flex-col gap-3">
            <div className="pl-3" style={{ borderLeft: "2px solid #C6A75E" }}>
              <span className="text-white/50 text-[11px] font-medium block mb-1">To Pay</span>
              <AnimatedCounter value={summary.totalOwed} prefix={getCurrencySymbol(defaultCurrency)} className="text-white text-[20px] font-bold leading-none tracking-tight" />
            </div>
            <div style={{ height: "1px", backgroundColor: "rgba(255,255,255,0.07)" }} />
            <div className="pl-3" style={{ borderLeft: "2px solid #C6A75E" }}>
              <span className="text-white/50 text-[11px] font-medium block mb-1">To Receive</span>
              <AnimatedCounter value={summary.totalReceivable} prefix={getCurrencySymbol(defaultCurrency)} className="text-white text-[20px] font-bold leading-none tracking-tight" />
            </div>
          </div>
        </div>
      </Card>

      {/* Speed Tiles */}
      <div className="grid grid-cols-4 gap-3">
        {speedTiles.map((tile) => (
          <button
            key={tile.label}
            onClick={() => navigate(tile.path)}
            className="flex flex-col items-center gap-2 hover-scale"
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-card" style={{ border: "1px solid rgba(15,26,46,0.08)", boxShadow: "0px 2px 8px rgba(15,26,46,0.04)" }}>
              <tile.icon className="w-6 h-6" style={{ color: "#C6A75E" }} />
            </div>
            <span className="text-[13px] text-foreground font-semibold text-center leading-tight">{tile.label}</span>
          </button>
        ))}
      </div>

      {/* Active Groups */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[19px] font-semibold text-foreground">Active Groups</h3>
          <button onClick={() => navigate("/groups")} className="text-[15px] font-medium transition-colors flex items-center" style={{ color: "#C6A75E" }}>
            See all <ChevronRight className="w-[18px] h-[18px] ml-0.5" strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {activeGroups.map((group) => (
            <Card
              key={group._id}
              onClick={() => navigate(`/groups/${group._id}`)}
              className="min-w-[160px] rounded-2xl overflow-hidden border-0 shadow-md cursor-pointer hover-scale flex-shrink-0"
            >
              <div className="h-20 bg-cover bg-center relative" style={{ backgroundImage: `url(${group.backgroundImage || 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&h=200&fit=crop'})` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <p className="absolute bottom-2 left-3 text-white font-semibold text-[15px]">{group.groupName}</p>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex -space-x-2">
                    {group.members?.slice(0, 3).map((m: any) => {
                      const avatar = userAvatars[m.userId];
                      const name = userNames[m.userId] || (m.userId === user?.id ? (user?.name || "Y") : (m.userId || "U"));
                      return avatar && avatar.startsWith("http") ? (
                        <img key={m.userId || m._id} src={avatar} alt="" className="w-6 h-6 rounded-full object-cover border-2 border-card" />
                      ) : (
                        <div key={m.userId || m._id} className="w-6 h-6 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[8px] font-bold text-secondary-foreground">
                          {name.substring(0, 2).toUpperCase()}
                        </div>
                      );
                    })}
                    {(group.members?.length || 0) > 3 && (
                      <div className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                        +{group.members.length - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-[12px] font-medium text-muted-foreground">{group.members?.length || 0} members</span>
                </div>
              </div>
            </Card>
          ))}
          <Card
            onClick={() => navigate("/groups/new")}
            className="min-w-[160px] rounded-2xl border-dashed border-2 border-muted flex items-center justify-center cursor-pointer hover-scale flex-shrink-0 h-[140px]"
          >
            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
              <Plus className="w-7 h-7" strokeWidth={2.5} />
              <span className="text-[14px] font-semibold">New Group</span>
            </div>
          </Card>
        </div>
      </section>

      {/* Friends */}
      {friends.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[19px] font-semibold text-foreground">Friends</h3>
            <button onClick={() => navigate("/friends")} className="text-[15px] font-medium transition-colors flex items-center" style={{ color: "#C6A75E" }}>
              See all <ChevronRight className="w-[18px] h-[18px] ml-0.5" strokeWidth={2.5} />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {friends.map((friend) => {
              const name = friend.displayName || friend.username || "Friend";
              const isImg = friend.avatar?.startsWith("http");
              const convertedBal = friendBalances[friend.friendId] ?? friend.owedAmount;
              return (
                <div key={friend._id} className="flex flex-col items-center gap-1.5 min-w-[64px] flex-shrink-0">
                  {isImg ? (
                    <img src={friend.avatar} alt={name} className="w-12 h-12 rounded-full object-cover border-2 border-card shadow-sm" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary border-2 border-card shadow-sm">
                      {name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[13px] text-foreground font-medium text-center leading-tight w-16 truncate mt-1">{name}</span>
                  {convertedBal !== 0 && (
                    <span className={cn("text-[12px] font-bold", convertedBal > 0 ? "text-receive" : "text-owed")}>
                      {convertedBal > 0 ? "+" : ""}{getCurrencySymbol(defaultCurrency)}{Math.abs(Math.round(convertedBal * 100) / 100)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Transactions */}
      <section>
        <Card className="pt-6 pb-4 px-6 rounded-[32px] border-0 shadow-sm bg-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[19px] font-semibold text-foreground">Transactions</h3>
            <button onClick={() => navigate("/activity")} className="text-[15px] font-medium transition-colors flex items-center" style={{ color: "#C6A75E" }}>
              All transactions <ChevronRight className="w-[18px] h-[18px] ml-0.5" strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex flex-col">
            {recentExpenses.length === 0 && (
              <p className="text-[14px] text-muted-foreground text-center py-4">No transactions yet. Add one!</p>
            )}

            {recentExpenses.map((exp, index) => {
              const groupName = groups.find(g => g._id === exp.groupId)?.groupName || "Expense";

              return (
                <div
                  key={exp._id}
                  onClick={() => setSelectedExpense(exp)}
                  className={cn(
                    "flex items-center justify-between py-[18px] cursor-pointer hover:bg-muted/30 transition-colors",
                    index !== recentExpenses.length - 1 ? "border-b border-border" : ""
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center flex-shrink-0 p-1.5 ${getCategoryColor(exp.category, exp.expenseNote).bg}`}>
                      <img
                        src={getCategoryIcon(exp.category, exp.expenseNote)}
                        alt={exp.category || "expense"}
                        className="w-full h-full object-contain filter invert"
                      />
                    </div>
                    <div className="flex flex-col justify-center gap-1 mt-0.5">
                      <p className="text-[16px] font-medium text-foreground leading-none tracking-tight">{exp.expenseNote || "Transaction"}</p>
                      <p className="text-[14px] text-muted-foreground leading-none tracking-tight">{groupName}</p>
                    </div>
                  </div>
                  <p className="text-[16px] font-semibold text-foreground tracking-tight">
                    {formatAmount(exp.amount, exp.currency)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <ExpenseDetailsDialog
        expense={selectedExpense}
        open={!!selectedExpense}
        onOpenChange={(open) => !open && setSelectedExpense(null)}
        getName={getName}
      />
    </div>
  );
};

export default HomePage;
