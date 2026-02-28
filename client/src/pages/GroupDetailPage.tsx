import { useState, useEffect, useRef, useMemo } from "react";

import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MoreVertical,
  Users,
  AlertTriangle,
  Plus,
  Trash2,
  UserPlus,
  Shield,
  Edit,
  Archive,
  Check,
  Flag,
  Banknote,
  Smartphone,
  Clock,
  Download,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LabelList,
  BarChart,
  Bar,
} from "recharts";

import { useToast } from "@/hooks/use-toast";
import AnimatedCounter from "@/components/AnimatedCounter";
import GroupHealthTab from "@/components/GroupHealthTab";
import { ApiService } from "@/services/ApiService";
import { useAuth } from "@/contexts/AuthContext";
import { getCategoryIcon, getCategoryColor } from "@/lib/categoryIcons";
import { ExpenseDetailsDialog } from "@/components/ExpenseDetailsDialog";
import { useCurrency } from "@/contexts/CurrencyContext";
import { convertAllToBase } from "@/services/exchangeRate";

/* ── Stats tab mock data & helpers ── */
/* ── Stats tab helpers ── */
const CATEGORY_COLORS: Record<string, string> = {
  Food: "#4A90D9",
  Transport: "#50C878",
  Accommodation: "#F5A623",
  Utilities: "#9B8EC4",
  Entertainment: "#FF6B6B",
  Shopping: "#4ECDC4",
  Beverages: "#FFE66D",
  Other: "#A0A0A0",
};

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function StatTooltip({ active, payload, label }: any) {
  const { formatAmount } = useCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-card/95 border border-border px-3 py-2 shadow-lg">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground">
        {formatAmount(payload[0].value)}
      </p>
    </div>
  );
}

function DonutCenter({ viewBox, total }: any) {
  const { cx, cy } = viewBox;
  const { formatAmount } = useCurrency();
  return (
    <g>
      <text
        x={cx}
        y={cy - 5}
        textAnchor="middle"
        fill="hsl(var(--muted-foreground))"
        fontSize={9}
      >
        Total
      </text>
      <text
        x={cx}
        y={cy + 13}
        textAnchor="middle"
        fill="hsl(var(--foreground))"
        fontSize={13}
        fontWeight={700}
      >
        {formatAmount(total)}
      </text>
    </g>
  );
}

const CHART_COLORS = [
  "hsl(197,50%,49%)",
  "hsl(142,60%,40%)",
  "hsl(0,72%,51%)",
  "hsl(45,93%,47%)",
  "hsl(280,60%,50%)",
];

/* ════════ StatsDashboard component ════════ */
function StatsDashboard({
  budget,
  spent,
  healthScore,
  setBudgetOpen,
  setNewBudget,
  categoryData,
  timelineData,
  memberData,
  insights,
}: {
  budget: number;
  spent: number;
  healthScore: number;
  setBudgetOpen: (v: boolean) => void;
  setNewBudget: (v: string) => void;
  categoryData: any[];
  timelineData: any[];
  memberData: any[];
  insights: string[];
}) {
  const budgetPct =
    budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0;
  const totalSpent = categoryData.reduce((s, c) => s + c.value, 0);

  const { formatAmount } = useCurrency();
  const overviewCards = [
    {
      title: "Total Spent",
      value: formatAmount(spent),
      subtitle: `${formatAmount(Math.round(spent / Math.max(memberData.length, 1)))} per person`,
    },
    {
      title: "Budget Used",
      value: `${budgetPct}%`,
      subtitle: null,
      progress: budgetPct,
    },
    {
      title: "Daily Average",
      value: formatAmount(Math.round(spent / Math.max(timelineData.length, 1))),
      subtitle: `Last ${timelineData.length} entries`,
    },
    {
      title: "Projected Spend",
      value: formatAmount(Math.round((spent / Math.max(timelineData.length, 1)) * 30)),
      subtitle: "Estimated monthly",
    },
  ];

  const overviewV = useInView(0.1);
  const categoryV = useInView(0.1);
  const timelineV = useInView(0.1);

  // const insightV  = useInView(0.1);

  const memberV = useInView(0.1);
  const insightV = useInView(0.1);

  const [hoveredCat, setHoveredCat] = useState<string | null>(null);
  const [insightIdx, setInsightIdx] = useState(0);

  useEffect(() => {
    if (insights.length === 0) return;
    const t = setInterval(
      () => setInsightIdx((i) => (i + 1) % insights.length),
      5000,
    );
    return () => clearInterval(t);
  }, [insights]);

  const fadeIn = (inView: boolean, delay = 0) =>
    `transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`;

  return (
    <div className="space-y-6 pb-4 ">
      {spent === 0 ? (
        <Card className="p-8 text-center rounded-2xl border-dashed bg-muted/20">
          <p className="text-sm text-muted-foreground">
            Add some expenses to see your spending analytics!
          </p>
        </Card>
      ) : (
        <>
          {/* ── 1. OVERVIEW CARDS ── */}
          <div ref={overviewV.ref} className={fadeIn(overviewV.inView)}>
            <div className="grid grid-cols-2 gap-3">
              {overviewCards.map((card, i) => (
                <div
                  key={card.title}
                  className="bg-card rounded-2xl p-4 shadow-sm border border-border/60
                             hover:shadow-md hover:scale-[1.025] active:scale-[0.98]
                             transition-all duration-300 ease-out cursor-default"
                  style={{ transitionDelay: `${i * 70}ms` }}
                >
                  <p className="text-[10px] font-medium text-muted-foreground tracking-wide uppercase leading-tight">
                    {card.title}
                  </p>
                  <p className="text-lg font-bold text-foreground mt-1">
                    {card.value}
                  </p>
                  {card.progress !== undefined && (
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
                        style={{
                          width: overviewV.inView ? `${card.progress}%` : "0%",
                          transitionDelay: "400ms",
                        }}
                      />
                    </div>
                  )}
                  {card.subtitle && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {card.subtitle}
                    </p>
                  )}
                  {card.title === "Budget Used" && (
                    <button
                      onClick={() => {
                        setNewBudget(String(budget));
                        setBudgetOpen(true);
                      }}
                      className="text-[9px] text-primary mt-1 hover:underline"
                    >
                      {budget > 0 ? "Update Budget" : "Set Budget"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── 2. SPENDING BY CATEGORY ── */}
          <div ref={categoryV.ref} className={fadeIn(categoryV.inView)}>
            <h3 className="text-xs font-semibold text-foreground mb-3 tracking-wide uppercase">
              Spending by Category
            </h3>
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/60">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                    animationBegin={0}
                    animationDuration={1100}
                    animationEasing="ease-out"
                    stroke="none"
                    paddingAngle={3}
                  >
                    {categoryData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                        opacity={
                          hoveredCat && hoveredCat !== entry.name ? 0.3 : 1
                        }
                        className="transition-opacity duration-200"
                      />
                    ))}
                    <LabelList content={<DonutCenter total={totalSpent} />} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-3 space-y-1.5">
                {categoryData.map((cat) => {
                  const pct = (
                    (cat.value / Math.max(totalSpent, 1)) *
                    100
                  ).toFixed(0);
                  return (
                    <div
                      key={cat.name}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl
                        transition-all duration-200 cursor-default
                        ${hoveredCat === cat.name ? "bg-muted/80 scale-[1.01]" : "hover:bg-muted/40"}`}
                      onMouseEnter={() => setHoveredCat(cat.name)}
                      onMouseLeave={() => setHoveredCat(null)}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-xs text-foreground">
                          {cat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">
                          {formatAmount(cat.value)}
                        </span>
                        <span className="text-[10px] text-muted-foreground w-6 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── 3. SPENDING TIMELINE ── */}
          <div ref={timelineV.ref} className={fadeIn(timelineV.inView)}>
            <h3 className="text-xs font-semibold text-foreground mb-3 tracking-wide uppercase">
              Spending Timeline
            </h3>
            <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/60">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={timelineData}
                  margin={{ top: 8, right: 8, bottom: 0, left: -24 }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => formatAmount(v)}
                  />
                  <RechartsTooltip content={<StatTooltip />} cursor={false} />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{
                      r: 3.5,
                      fill: "hsl(var(--primary))",
                      stroke: "hsl(var(--card))",
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 5.5,
                      fill: "hsl(var(--primary))",
                      stroke: "hsl(var(--card))",
                      strokeWidth: 2,
                    }}
                    animationDuration={1300}
                    animationEasing="ease-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── 5. SMART INSIGHT ── */}
          {insights.length > 0 && (
            <div ref={insightV.ref} className={fadeIn(insightV.inView)}>
              <div className="relative overflow-hidden rounded-2xl bg-primary/[0.06] border border-primary/20 p-4 shadow-sm">
                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-primary/10 blur-2xl pointer-events-none" />
                <div className="flex items-start gap-3 relative">
                  <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 18h6" />
                      <path d="M10 22h4" />
                      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-primary font-semibold mb-1">
                      Smart Insight
                    </p>
                    <p className="text-xs text-foreground leading-relaxed transition-all duration-500">
                      {insights[insightIdx]}
                    </p>
                  </div>
                </div>
                {insights.length > 1 && (
                  <div className="flex justify-center gap-1.5 mt-3">
                    {insights.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setInsightIdx(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === insightIdx ? "bg-primary w-4" : "bg-primary/30 w-1.5"}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── GroupStatsSection: Aggregates real expenses for the dashboard ── */
function GroupStatsSection({
  expenses,
  userNames,
  budget,
  spent,
  healthScore,
  setBudgetOpen,
  setNewBudget,
}: any) {
  // 1. Process Category Data
  const categoriesMap: Record<string, number> = {};
  const KNOWN_CATS = Object.keys(CATEGORY_COLORS);

  expenses.forEach((e: any) => {
    // Smart fallback: check category field, then note, then default to Other
    let cat = e.category || "Other";

    // If it's "Other" or missing, try matching note to a known category
    if (cat === "Other" && e.expenseNote) {
      const match = KNOWN_CATS.find((c) =>
        e.expenseNote.toLowerCase().includes(c.toLowerCase()),
      );
      if (match) cat = match;
    }

    categoriesMap[cat] = (categoriesMap[cat] || 0) + e.amount;
  });

  const categoryData = Object.entries(categoriesMap)
    .map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] || CATEGORY_COLORS["Other"],
    }))
    .sort((a, b) => b.value - a.value);

  // 2. Process Timeline Data (Last 30 entries summed by date)
  const timelineMap: Record<string, number> = {};
  [...expenses]
    .sort(
      (a, b) =>
        new Date(a.expenseTime).getTime() - new Date(b.expenseTime).getTime(),
    )
    .slice(-30)
    .forEach((e: any) => {
      const date = new Date(e.expenseTime).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      });
      timelineMap[date] = (timelineMap[date] || 0) + e.amount;
    });
  const timelineData = Object.entries(timelineMap).map(([day, amount]) => ({
    day,
    amount,
  }));

  // 3. Process Member Data
  const memberMap: Record<string, number> = {};
  expenses.forEach((e: any) => {
    const name = userNames[e.userId] || e.userId.substring(0, 8);
    memberMap[name] = (memberMap[name] || 0) + e.amount;
  });
  const memberData = Object.entries(memberMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  // 4. Generate Smart Insights
  const insights: string[] = [];
  if (spent > 0) {
    if (categoryData.length > 0) {
      const topCat = categoryData[0];
      insights.push(
        `${topCat.name} expenses account for ${((topCat.value / spent) * 100).toFixed(0)}% of total spending.`,
      );
    }
    if (budget > 0) {
      const pct = (spent / budget) * 100;
      if (pct > 80)
        insights.push("Caution: You've used over 80% of your budget.");
      else
        insights.push(
          `You have used ${pct.toFixed(0)}% of your budget so far.`,
        );
    }
    /* Removing top spender insight as per user request to reduce awkwardness */
    /*
    if (memberData.length > 1) {
      const topSpender = memberData[0];
      insights.push(`${topSpender.name} has spent the most so far (₹${topSpender.amount.toLocaleString()}).`);
    }
    */
  }

  return (
    <StatsDashboard
      budget={budget}
      spent={spent}
      healthScore={healthScore}
      setBudgetOpen={setBudgetOpen}
      setNewBudget={setNewBudget}
      categoryData={categoryData}
      timelineData={timelineData}
      memberData={memberData}
      insights={insights}
    />
  );
}

const GroupDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [group, setGroup] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [friends, setFriends] = useState<any[]>([]);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // Dialogs
  const [endGroupOpen, setEndGroupOpen] = useState(false);
  const [editDescOpen, setEditDescOpen] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [newBudget, setNewBudget] = useState("");
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<any | null>(null);
  const [editExpenseForm, setEditExpenseForm] = useState({
    expenseNote: "",
    amount: "",
    category: "",
  });
  const [removeMemberData, setRemoveMemberData] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [settleBalance, setSettleBalance] = useState<any | null>(null);
  const [disputeBalance, setDisputeBalance] = useState<any | null>(null);
  const [disputeForm, setDisputeForm] = useState({
    reason: "",
    proposedAmount: "",
  });
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | null>(null);
  const [pendingSettleIds, setPendingSettleIds] = useState<Set<string>>(new Set());
  const [selectedExpense, setSelectedExpense] = useState<any | null>(null);
  const [expandedBalances, setExpandedBalances] = useState<Record<string, boolean>>({});
  const [userUpiIds, setUserUpiIds] = useState<Record<string, string>>({});
  const [pendingRequestsMap, setPendingRequestsMap] = useState<Record<string, any>>({});
  const [upiDesktopFallback, setUpiDesktopFallback] = useState<{ link: string } | null>(null);
  const [expandedBalancePeople, setExpandedBalancePeople] = useState<Record<string, boolean>>({});
  const { defaultCurrency, formatAmount, convertAmount } = useCurrency();

  const aggregatedByOtherUser = useMemo(() => {
    if (!user?.id) return [];
    const involved = balances.filter((b: any) => b.payerId === user.id || b.payeeId === user.id);
    const otherIds = new Set<string>();
    involved.forEach((b: any) => {
      const otherId = b.payerId === user.id ? b.payeeId : b.payerId;
      otherIds.add(otherId);
    });
    return [...otherIds].map((otherId) => {
      const owedByMe = balances.filter((b: any) => b.payerId === user.id && b.payeeId === otherId);
      const owedByThem = balances.filter((b: any) => b.payerId === otherId && b.payeeId === user.id);
      const sumOwedByMe = owedByMe.reduce((s: number, b: any) => s + b.amount, 0);
      const sumOwedByThem = owedByThem.reduce((s: number, b: any) => s + b.amount, 0);
      const netAmount = sumOwedByThem - sumOwedByMe;
      const weOwe = netAmount < 0;
      const settleBalanceRecord = owedByMe.length > 0 ? owedByMe[0] : null;
      const theyOweMeBalanceRecord = owedByThem.length > 0 ? owedByThem[0] : null;
      return {
        otherId,
        netAmount,
        weOwe,
        owedByMeBalances: owedByMe,
        owedByThemBalances: owedByThem,
        settleBalanceRecord,
        theyOweMeBalanceRecord,
      };
    }).filter((a) => Math.abs(a.netAmount) > 0.01);
  }, [balances, user?.id]);

  // Resolve user IDs to display names
  const getName = (userId: string) => {
    if (userId === user?.id) return "You";
    return userNames[userId] || userId.substring(0, 8);
  };

  const isMobileDevice = (): boolean => {
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  };

  const buildUpiLink = (upiId: string, payeeName: string, amount: number): string => {
    const positiveAmount = Math.abs(amount).toFixed(2);
    const encodedPa = encodeURIComponent(upiId);
    const encodedPn = encodeURIComponent(payeeName);
    return `upi://pay?pa=${encodedPa}&pn=${encodedPn}&am=${positiveAmount}&cu=INR&tn=FairPay%20Settlement`;
  };

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [groupRes, statsRes, expensesRes, balancesRes] = await Promise.all([
        ApiService.get(`/api/groups/${id}`),
        ApiService.get(`/api/expenses/stats/${id}`).catch(() => null),
        ApiService.get(`/api/expenses/group/${id}`).catch(() => []),
        ApiService.get(`/api/expenses/balances/${id}`).catch(() => []),
      ]);
      setGroup(groupRes);
      setStats(statsRes);
      setExpenses((expensesRes as any[]) || []);
      setBalances((balancesRes as any[]) || []);

      // Fetch outgoing pending settlement requests for this user
      try {
        const activityRes: any = await ApiService.get(`/api/balance-requests/activity/${user?.id}`);
        const outgoing = new Set<string>();
        const reqMap: Record<string, any> = {};
        ((activityRes as any[]) || []).forEach((r: any) => {
          if (r.status === "pending" && r.owedBorrowId) {
            reqMap[String(r.owedBorrowId)] = r;
            if (r.requestedBy === user?.id && r.type === "settlement") {
              outgoing.add(String(r.owedBorrowId));
            }
          }
        });
        setPendingSettleIds(outgoing);
        setPendingRequestsMap(reqMap);
      } catch { /* ignore */ }

      // Resolve member names
      const members = (groupRes as any)?.members || [];
      const allUserIds = new Set<string>();
      members.forEach((m: any) => allUserIds.add(m.userId));
      ((expensesRes as any[]) || []).forEach((e: any) =>
        allUserIds.add(e.userId),
      );
      ((balancesRes as any[]) || []).forEach((b: any) => {
        allUserIds.add(b.payerId);
        allUserIds.add(b.payeeId);
      });

      // Resolving member names and UPI IDs...
      const nameMap: Record<string, string> = {};
      const avatarMap: Record<string, string> = {};
      const upiIdMap: Record<string, string> = {};
      await Promise.all(
        [...allUserIds].map(async (uid) => {
          if (uid === user?.id) {
            nameMap[uid] = "You";
            if (user?.avatar) avatarMap[uid] = user.avatar;
            return;
          }
          try {
            const u: any = await ApiService.get(`/api/users/${uid}`);
            nameMap[uid] =
              u.username || u.email?.split("@")[0] || uid.substring(0, 8);
            avatarMap[uid] = u.avatar || "";
            if (u.upiId) upiIdMap[uid] = u.upiId;
          } catch {
            nameMap[uid] = uid.substring(0, 8);
          }
        }),
      );
      setUserNames(nameMap);
      setUserAvatars(avatarMap);
      setUserUpiIds(upiIdMap);

      // Convert currencies
      let expensesArr = (expensesRes as any[]) || [];
      let balancesArr = (balancesRes as any[]) || [];

      const convertedExpenses = await convertAllToBase(
        expensesArr.map(e => ({ amount: e.amount, currency: e.currency || "INR" })),
        defaultCurrency
      );
      for (let i = 0; i < expensesArr.length; i++) {
        const originalCurrency = expensesArr[i].currency || "INR";
        expensesArr[i].amount = convertedExpenses[i].convertedAmount;
        if (expensesArr[i].participatorsInvolved) {
          for (let j = 0; j < expensesArr[i].participatorsInvolved.length; j++) {
            expensesArr[i].participatorsInvolved[j].amount = convertAmount(expensesArr[i].participatorsInvolved[j].amount, originalCurrency);
            expensesArr[i].participatorsInvolved[j].currency = defaultCurrency;
          }
        }
        expensesArr[i].currency = defaultCurrency;
      }

      const convertedBalances = await convertAllToBase(
        balancesArr.map(b => ({ amount: b.amount, currency: b.currency || "INR" })),
        defaultCurrency
      );
      for (let i = 0; i < balancesArr.length; i++) {
        balancesArr[i].amount = convertedBalances[i].convertedAmount;
        balancesArr[i].currency = defaultCurrency;
      }

      setExpenses(expensesArr);
      setBalances(balancesArr);

      // Re-calculate spent to match converted amounts
      if (statsRes) {
        (statsRes as any).spent = expensesArr.reduce((sum, e) => sum + e.amount, 0);
      }
      setStats(statsRes);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, defaultCurrency]);

  // Fetch friends for adding members
  useEffect(() => {
    if (user?.id) {
      ApiService.get(`/api/friends/user/${user.id}`)
        .then((res: any) => setFriends(res || []))
        .catch(console.error);
    }
  }, [user]);

  const handleAddMember = async (friendId: string) => {
    try {
      await ApiService.post("/api/groups/add-member", {
        groupId: id,
        userId: friendId,
      });
      toast({ title: "Member Added!" });
      setAddMemberOpen(false);
      fetchData();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };

  const handleExportExcel = () => {
    if (!group) {
      toast({ title: "No data to export", description: "Group data is missing.", variant: "destructive" });
      return;
    }

    try {
      const wb = XLSX.utils.book_new();

      // 1. Summary Sheet
      const summaryData = [{
        "Group Name": group.groupName,
        "Description": group.description || "N/A",
        "Type": group.groupType,
        "Created At": new Date(group.createdAt).toLocaleString(),
        "Budget": stats?.budget || 0,
        "Total Spent": stats?.spent || 0,
        "Member Count": group.members?.length || 0,
        "Is Archived": group.isArchived ? "Yes" : "No"
      }];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Summary");

      // 2. Members Sheet
      const membersData = (group.members || []).map((m: any) => ({
        "Name": getName(m.userId),
        "User ID": m.userId,
        "Joined At": new Date(m.addedAt).toLocaleDateString(),
        "Role": m.userId === group.createdBy ? "Admin" : "Member"
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(membersData), "Members");

      // 3. Expenses Sheet
      if (expenses.length > 0) {
        const expensesData = expenses.map(exp => ({
          "Expense ID": exp._id,
          "Date": new Date(exp.expenseTime).toLocaleString(),
          "Description": exp.expenseNote || "Untitled",
          "Category": exp.category || "Other",
          "Paid By": getName(exp.userId),
          "Amount": exp.amount,
          "Currency": exp.currency || "INR",
          "Payment Method": exp.paymentMethod || "N/A",
          "Bill Photo URL": exp.billPhoto || "None"
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expensesData), "Expenses");

        // 4. Splits Sheet
        const splitsData: any[] = [];
        expenses.forEach(exp => {
          if (exp.participatorsInvolved && Array.isArray(exp.participatorsInvolved)) {
            exp.participatorsInvolved.forEach((split: any) => {
              splitsData.push({
                "Expense Description": exp.expenseNote || "Untitled",
                "Expense Date": new Date(exp.expenseTime).toLocaleDateString(),
                "Member": getName(split.userId),
                "Amount Owed": split.amount,
                "Percentage": split.splitPercentage ? `${split.splitPercentage}%` : "N/A"
              });
            });
          }
        });
        if (splitsData.length > 0) {
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(splitsData), "Expense Splits");
        }
      }

      // 5. Unsettled Balances Sheet
      if (balances.length > 0) {
        const balancesData = balances.map(b => ({
          "Who Owes": getName(b.payerId),
          "To Whom": getName(b.payeeId),
          "Amount": b.amount,
          "Status": "Unsettled"
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(balancesData), "Balances");
      }

      const safeName = group.groupName.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      XLSX.writeFile(wb, `${safeName}_full_export.xlsx`);
      toast({ title: "Export Successful", description: "Full group database exported to Excel." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export Failed", description: err.message });
    }
  };

  if (loading)
    return <p className="p-4 text-muted-foreground">Loading group data...</p>;
  if (!group)
    return <p className="p-4 text-muted-foreground">Group not found</p>;

  const budget = stats?.budget || 0;
  const spent = stats?.spent || 0;
  const healthScore =
    budget > 0 ? Math.round(((budget - spent) / budget) * 100) : 100;
  const hasUnsettledBalances = aggregatedByOtherUser.length > 0;

  const handleEndTrip = async () => {
    try {
      await ApiService.put(`/api/groups/${id}`, { isArchived: true });
      toast({
        title: "Trip Ended",
        description: `${group.groupName} has been archived.`,
      });
      navigate("/groups");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };

  const handleUpdateDescription = async () => {
    try {
      await ApiService.put(`/api/groups/${id}`, { description: newDesc });
      setGroup({ ...group, description: newDesc });
      setEditDescOpen(false);
      toast({ title: "Updated", description: "Group description updated." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };

  const handleRename = async () => {
    try {
      await ApiService.put(`/api/groups/${id}`, { groupName: newName });
      setGroup({ ...group, groupName: newName });
      setEditNameOpen(false);
      toast({ title: "Renamed", description: "Group has been renamed." });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };

  const handleSetBudget = async () => {
    try {
      await ApiService.put(`/api/expenses/stats/${id}`, {
        budget: parseFloat(newBudget) || 0,
      });
      setStats({
        ...(stats || {}),
        budget: parseFloat(newBudget) || 0,
        moneyLeft: (parseFloat(newBudget) || 0) - spent,
      });
      setBudgetOpen(false);
      toast({
        title: "Budget Set",
        description: `Budget set to ${formatAmount(parseFloat(newBudget) || 0)}`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };

  const handleDeleteExpense = async () => {
    if (!deleteExpenseId) return;
    try {
      await ApiService.delete(`/api/expenses/${deleteExpenseId}`);
      setDeleteExpenseId(null);
      toast({ title: "Expense Deleted" });
      fetchData();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };

  const openEditExpense = (exp: any) => {
    setEditExpense(exp);
    setEditExpenseForm({
      expenseNote: exp.expenseNote || "",
      amount: String(exp.amount),
      category: exp.category || "Other",
    });
  };

  const handleUpdateExpense = async () => {
    if (!editExpense) return;
    try {
      await ApiService.put(`/api/expenses/${editExpense._id}`, {
        expenseNote: editExpenseForm.expenseNote,
        amount: parseFloat(editExpenseForm.amount),
        category: editExpenseForm.category,
        currency: defaultCurrency,
      });
      setEditExpense(null);
      toast({ title: "Expense Updated" });
      fetchData();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };

  const handleRemoveMember = async (force = false) => {
    if (!removeMemberData) return;
    try {
      await ApiService.post("/api/groups/remove-member", {
        groupId: id,
        userId: removeMemberData.userId,
      });
      setRemoveMemberData(null);
      toast({
        title: "Member Removed",
        description: `${removeMemberData.name} has been removed.`,
      });
      fetchData();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };

  const handleGroupSettle = async () => {
    if (!settleBalance || !user?.id) return;
    const isRequestOnly = settleBalance.payeeId === user.id;
    const method = isRequestOnly ? "cash" : (paymentMethod || null);
    if (!isRequestOnly && !method) return;
    try {
      if (!isRequestOnly && method === "upi") {
        const receiverId = settleBalance.payeeId;
        const receiverUpiId = userUpiIds[receiverId];
        if (!receiverUpiId) {
          toast({ variant: "destructive", title: "UPI ID Missing", description: "Receiver has not set their UPI ID in profile." });
          return;
        }
        const receiverName = getName(receiverId);
        const upiLink = buildUpiLink(receiverUpiId, receiverName, settleBalance.amount);
        if (isMobileDevice()) {
          window.location.href = upiLink;
        } else {
          setUpiDesktopFallback({ link: upiLink });
        }
      }

      await ApiService.post("/api/balance-requests/settle", {
        owedBorrowId: settleBalance._id,
        requestedBy: user.id,
        paymentMethod: method || "cash",
      });
      // Settle All: settle every owed balance in the group
      if (settleBalance.__settleAll) {
        const owedBalances = balances.filter((b) => b.payerId === user.id && !pendingSettleIds.has(String(b._id)));
        await Promise.all(
          owedBalances.map((b) =>
            ApiService.post("/api/balance-requests/settle", { owedBorrowId: b._id, requestedBy: user.id, paymentMethod })
          )
        );
      } else if (settleBalance.__personSettle) {
        // Settle per-person: settle all owed items for one specific person
        const items: any[] = settleBalance.owedItems || [];
        await Promise.all(
          items
            .filter((b) => !pendingSettleIds.has(String(b._id)))
            .map((b) =>
              ApiService.post("/api/balance-requests/settle", { owedBorrowId: b._id, requestedBy: user.id, paymentMethod })
            )
        );
      } else {
        // Single record settle
        await ApiService.post("/api/balance-requests/settle", {
          owedBorrowId: settleBalance._id,
          requestedBy: user.id,
          paymentMethod,
        });
      }
      setSettleBalance(null);
      setPaymentMethod(null);
      if (!isRequestOnly && method === "upi") {
        toast({ title: "Settlement Processing", description: "UPI payment initiated. Waiting for confirmation." });
      } else {
        toast({ title: "Settlement Requested", description: isRequestOnly ? "They will be notified to complete the payment." : "Waiting for the other party to acknowledge." });
      }
      fetchData();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };


  // Settle ALL owed balances across all persons at once
  const handleGroupSettleAll = async () => {
    if (!user?.id || !paymentMethod) return;
    const owedBalances = balances.filter((b) => b.payerId === user.id && !pendingSettleIds.has(String(b._id)));
    if (owedBalances.length === 0) return;
    try {
      await Promise.all(
        owedBalances.map((b) =>
          ApiService.post("/api/balance-requests/settle", {
            owedBorrowId: b._id,
            requestedBy: user.id,
            paymentMethod,
          })
        )
      );
      setSettleBalance(null);
      setPaymentMethod(null);
      toast({ title: "All Settlements Requested", description: "Waiting for acknowledgements from the other parties." });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleGroupDispute = async () => {
    if (!disputeBalance || !user?.id) return;
    if (!disputeForm.reason.trim()) {
      toast({ variant: "destructive", title: "Reason required" });
      return;
    }
    try {
      await ApiService.post("/api/balance-requests/dispute", {
        owedBorrowId: disputeBalance._id,
        requestedBy: user.id,
        reason: disputeForm.reason,
        proposedAmount:
          parseFloat(disputeForm.proposedAmount) || disputeBalance.amount,
      });
      setDisputeBalance(null);
      setDisputeForm({ reason: "", proposedAmount: "" });
      toast({
        title: "Dispute Filed",
        description: "The other party will be asked to review.",
      });
      fetchData();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message,
      });
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={() => navigate(-1)}
          className="p-1 rounded-full hover:bg-muted"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-foreground">
            {group.groupName}
          </h2>
          <p className="text-xs text-muted-foreground">
            {group.description || "No description"}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-2 rounded-full hover:bg-muted">
              <MoreVertical className="w-5 h-5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuItem
              onClick={() => {
                setNewName(group.groupName);
                setEditNameOpen(true);
              }}
            >
              <Edit className="w-4 h-4 mr-2" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setNewDesc(group.description || "");
                setEditDescOpen(true);
              }}
            >
              <Edit className="w-4 h-4 mr-2" /> Edit Description
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setNewBudget(String(budget));
                setBudgetOpen(true);
              }}
            >
              Set Budget
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportExcel}
            >
              <Download className="w-4 h-4 mr-2" /> Export to Excel
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-owed"
              onClick={() => setEndGroupOpen(true)}
            >
              <Archive className="w-4 h-4 mr-2" /> End Trip
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Header Card */}
      <Card className="rounded-2xl overflow-hidden border-0 shadow-md">
        <div
          className="h-32 bg-cover bg-center relative"
          style={{
            backgroundImage: `url(${group.backgroundImage || "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&h=200&fit=crop"})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
            <button
              onClick={() => setMembersDialogOpen(true)}
              className="flex items-center gap-2 hover:bg-white/20 rounded-lg px-2 py-1 transition-colors"
            >
              <Users className="w-4 h-4 text-white" />
              <span className="text-white text-sm">
                {group.members?.length || 0} members
              </span>
            </button>
            <Badge className="bg-white/20 text-white border-0 text-[10px]">
              {group.groupType}
            </Badge>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="w-full bg-muted/50 rounded-xl p-1 h-auto flex">
          {["Expenses", "Stats", "Balances", "Health"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab.toLowerCase()}
              className="flex-1 text-xs rounded-lg py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-3 mt-4">
          <Button
            onClick={() =>
              navigate("/expenses/new", { state: { groupId: id } })
            }
            size="sm"
            className="w-full rounded-xl"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Expense
          </Button>
          {expenses.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                No expenses yet. Add one!
              </p>
            </div>
          )}
          {expenses.map((exp) => (
            <Card
              key={exp._id}
              onClick={() => setSelectedExpense(exp)}
              className="p-3 rounded-xl border-0 shadow-sm cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden p-1.5 ${getCategoryColor(exp.category, exp.expenseNote).bg}`}>
                  <img
                    src={getCategoryIcon(exp.category, exp.expenseNote)}
                    alt={exp.category || "expense"}
                    className="w-full h-full object-contain filter invert"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {exp.expenseNote || "Expense"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {exp.userId === user?.id
                      ? "You paid"
                      : `Paid by ${getName(exp.userId)}`}{" "}
                    • {new Date(exp.expenseTime).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <span className="font-semibold text-sm text-foreground">
                    {formatAmount(exp.amount, exp.currency)}
                  </span>
                  {exp.status !== "settled" && (
                    <button
                      onClick={() => openEditExpense(exp)}
                      className="p-1 rounded-full hover:bg-muted"
                    >
                      <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                  <button
                    onClick={() => setDeleteExpenseId(exp._id)}
                    className="p-1 rounded-full hover:bg-muted"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="mt-4">
          <GroupStatsSection
            expenses={expenses}
            userNames={userNames}
            budget={budget}
            spent={spent}
            healthScore={healthScore}
            setBudgetOpen={setBudgetOpen}
            setNewBudget={setNewBudget}
          />
        </TabsContent>

        {/* Balances Tab — person-wise net, expanded: all unsettled expenses, per-expense and net settlement */}
        {/* Balances Tab — grouped by person, SettleHub-style layout */}
        <TabsContent value="balances" className="space-y-3 mt-4">
          {aggregatedByOtherUser.length === 0 && (
            <div className="text-center py-10 space-y-2">
              <p className="text-3xl">🎉</p>
              <p className="text-sm font-medium text-muted-foreground">All settled</p>
            </div>
          )}

          {aggregatedByOtherUser.map((agg) => {
            const isExpanded = !!expandedBalances[agg.otherId];
            const { otherId, netAmount, weOwe, settleBalanceRecord, theyOweMeBalanceRecord } = agg;
            const displayAmount = Math.abs(netAmount);

            const relevantExpenses = expenses
              .filter((exp: any) => {
                if (exp.status === "settled" || exp.status === "cleared") return false;
                const otherInvolved = exp.participatorsInvolved?.some((p: any) => p.userId === otherId);
                const iAmInvolved = exp.participatorsInvolved?.some((p: any) => p.userId === user?.id);
                return (exp.userId === user?.id && otherInvolved) || (exp.userId === otherId && iAmInvolved);
              })
              .map((exp: any) => {
                const yourShare = exp.participatorsInvolved?.find((p: any) => p.userId === user?.id)?.amount ?? 0;
                const theirShare = exp.participatorsInvolved?.find((p: any) => p.userId === otherId)?.amount ?? 0;
                const weOweForExpense = exp.userId === otherId && (exp.participatorsInvolved?.some((p: any) => p.userId === user?.id) ?? false);
                const splitAmount = weOweForExpense ? yourShare : theirShare;
                const status = exp.status === "disputed" ? "disputed" : exp.status === "settled" || exp.status === "cleared" ? "settled" : "pending";
                return { exp, weOweForExpense, splitAmount, yourShare, theirShare, status };
              })
              .filter((item: any) => (item.yourShare > 0.01 || item.theirShare > 0.01))
              .sort((a: any, b: any) => new Date(b.exp.expenseTime || 0).getTime() - new Date(a.exp.expenseTime || 0).getTime());

            const isPendingSettle = settleBalanceRecord && pendingSettleIds.has(String(settleBalanceRecord._id));
            const isPendingTheyOwe = theyOweMeBalanceRecord && pendingSettleIds.has(String(theyOweMeBalanceRecord._id));
            const avatar = userAvatars[otherId];
            const groupName = group?.groupName ?? "Group";

            return (
              <Card key={otherId} className="rounded-xl border-0 shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedBalances((prev) => ({ ...prev, [otherId]: !prev[otherId] }))}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {(avatar?.startsWith("http") || avatar?.startsWith("data:")) ? (
                      <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                        {(getName(otherId) || "?").substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-foreground">{getName(otherId)}</p>
                      <p className="text-xs text-muted-foreground">
                        {weOwe ? "You owe" : "They owe you"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("font-bold text-base", weOwe ? "text-owed" : "text-receive")}>
                      {weOwe ? "-" : "+"}{formatAmount(displayAmount, defaultCurrency)}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-in-out",
                    isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-border/40 bg-muted/5">
                      {/* Net settlement at top */}
                      {displayAmount > 0.01 && (
                        <div className="px-4 py-3 border-b border-border/30">
                          {weOwe && settleBalanceRecord ? (
                            <div className="flex gap-2">
                              {isPendingSettle ? (
                                <span className="flex-1 h-9 rounded-xl bg-muted text-muted-foreground inline-flex items-center justify-center gap-1.5 text-xs font-semibold">
                                  <Clock className="w-3.5 h-3.5" /> Awaiting Acknowledgement
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  className="flex-1 rounded-xl h-9 text-xs font-bold bg-receive hover:bg-receive/90 text-white"
                                  onClick={(e) => { e.stopPropagation(); setSettleBalance(settleBalanceRecord); }}
                                >
                                  <Check className="w-3.5 h-3.5 mr-1.5" /> Settle Net Amount
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl h-9 text-xs font-bold text-owed border-owed/30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDisputeBalance(settleBalanceRecord);
                                  setDisputeForm({ reason: "", proposedAmount: String(settleBalanceRecord.amount) });
                                }}
                              >
                                <Flag className="w-3.5 h-3.5 mr-1.5" /> Dispute
                              </Button>
                            </div>
                          ) : theyOweMeBalanceRecord ? (
                            <div className="flex gap-2">
                              {isPendingTheyOwe ? (
                                <span className="flex-1 h-9 rounded-xl bg-muted text-muted-foreground inline-flex items-center justify-center gap-1.5 text-xs font-semibold">
                                  <Clock className="w-3.5 h-3.5" /> Awaiting Payment
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  className="flex-1 rounded-xl h-9 text-xs font-bold bg-receive/90 hover:bg-receive text-white"
                                  onClick={(e) => { e.stopPropagation(); setSettleBalance(theyOweMeBalanceRecord); }}
                                >
                                  <Clock className="w-3.5 h-3.5 mr-1.5" /> Request Net Settlement
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl h-9 text-xs font-bold text-owed border-owed/30"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDisputeBalance(theyOweMeBalanceRecord);
                                  setDisputeForm({ reason: "", proposedAmount: String(theyOweMeBalanceRecord.amount) });
                                }}
                              >
                                <Flag className="w-3.5 h-3.5 mr-1.5" /> Dispute
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* All unsettled expenses */}
                      <div className="divide-y divide-border/20">
                        {relevantExpenses.length > 0 ? (
                          relevantExpenses.map(({ exp, weOweForExpense, splitAmount, yourShare, theirShare, status }) => {
                            const expPending = (weOweForExpense && isPendingSettle) || (!weOweForExpense && isPendingTheyOwe);
                            const dateStr = exp.expenseTime ? new Date(exp.expenseTime).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
                            return (
                              <div key={exp._id} className="px-4 py-3 hover:bg-muted/10 transition-colors">
                                <div className="flex justify-between items-start gap-2 mb-2">
                                  <h4 className="text-sm font-semibold text-foreground truncate flex-1">
                                    {exp.expenseNote || "Expense"}
                                  </h4>
                                  <span className="text-xs text-muted-foreground flex-shrink-0">{dateStr}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">{groupName}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mb-3">
                                  <span>Total: <strong>{formatAmount(exp.amount, defaultCurrency)}</strong></span>
                                  <span>My share: <strong>{formatAmount(yourShare, defaultCurrency)}</strong></span>
                                  <span className={cn(
                                    "font-medium uppercase",
                                    status === "disputed" ? "text-orange-600" : status === "settled" ? "text-muted-foreground" : "text-primary"
                                  )}>
                                    {status}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  {weOweForExpense && settleBalanceRecord ? (
                                    <>
                                      {expPending ? (
                                        <span className="h-8 px-3 rounded-xl bg-muted text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                                          <Clock className="w-3 h-3" /> Pending
                                        </span>
                                      ) : (
                                        <>
                                          <Button
                                            size="sm"
                                            className="h-8 rounded-xl text-xs font-semibold bg-receive hover:bg-receive/90 text-white"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSettleBalance({ _id: settleBalanceRecord._id, payeeId: settleBalanceRecord.payeeId, amount: splitAmount });
                                            }}
                                          >
                                            <Check className="w-3 h-3 mr-1" /> Settle
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 rounded-xl text-xs font-semibold text-owed border-owed/30"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDisputeBalance(settleBalanceRecord);
                                              setDisputeForm({ reason: "", proposedAmount: String(splitAmount) });
                                            }}
                                          >
                                            <Flag className="w-3 h-3 mr-1" /> Dispute
                                          </Button>
                                        </>
                                      )}
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <span className="h-8 px-3 rounded-xl bg-muted/60 text-muted-foreground inline-flex items-center gap-1 text-xs font-medium">
                                        <Clock className="w-3 h-3" /> Awaiting Payment
                                      </span>
                                      {theyOweMeBalanceRecord && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-8 rounded-xl text-xs font-semibold text-owed border-owed/30"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDisputeBalance(theyOweMeBalanceRecord);
                                            setDisputeForm({ reason: "", proposedAmount: String(theyOweMeBalanceRecord.amount) });
                                          }}
                                        >
                                          <Flag className="w-3 h-3 mr-1" /> Dispute
                                        </Button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="px-4 py-6 text-center">
                            <p className="text-sm text-muted-foreground">All settled</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          {(() => {
            // Build grouped map: otherPersonId -> { owedItems[], receivableItems[], netBalance }
            const involved = balances.filter((b) => b.payerId === user?.id || b.payeeId === user?.id);

            const groupMap: Record<string, { personId: string; owedItems: any[]; receivableItems: any[]; totalYouOwe: number; totalTheyOwe: number }> = {};
            involved.forEach((b) => {
              const isYouPayer = b.payerId === user?.id;
              const otherId = isYouPayer ? b.payeeId : b.payerId;
              if (!groupMap[otherId]) groupMap[otherId] = { personId: otherId, owedItems: [], receivableItems: [], totalYouOwe: 0, totalTheyOwe: 0 };
              if (isYouPayer) {
                groupMap[otherId].owedItems.push(b);
                groupMap[otherId].totalYouOwe += b.amount;
              } else {
                groupMap[otherId].receivableItems.push(b);
                groupMap[otherId].totalTheyOwe += b.amount;
              }
            });

            const groups = Object.values(groupMap).map((g) => ({
              ...g,
              netBalance: g.totalTheyOwe - g.totalYouOwe,
            })).filter((g) => Math.abs(g.netBalance) > 0.01 || g.owedItems.length > 0 || g.receivableItems.length > 0);

            if (groups.length === 0) {
              return (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">🎉</p>
                  <p className="text-sm text-muted-foreground">All settled! No pending balances involving you.</p>
                </div>
              );
            }

            const hasAnyOwed = groups.some((g) => g.owedItems.some((b) => !pendingSettleIds.has(String(b._id))));
            const totalOwed = groups.reduce((s, g) => s + g.totalYouOwe, 0);
            const totalReceivable = groups.reduce((s, g) => s + g.totalTheyOwe, 0);

            return (
              <>
                {/* Summary tiles */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3 rounded-xl border-0 shadow-sm text-center">
                    <p className="text-xs text-muted-foreground mb-1">You Owe</p>
                    <p className="text-lg font-bold text-owed">{formatAmount(totalOwed, defaultCurrency)}</p>
                  </Card>
                  <Card className="p-3 rounded-xl border-0 shadow-sm text-center">
                    <p className="text-xs text-muted-foreground mb-1">You're Owed</p>
                    <p className="text-lg font-bold text-receive">{formatAmount(totalReceivable, defaultCurrency)}</p>
                  </Card>
                </div>

                {/* Settle All button */}
                {hasAnyOwed && (
                  <Button
                    className="w-full rounded-xl bg-receive hover:bg-receive/90 text-white"
                    onClick={() => setSettleBalance({ __settleAll: true, amount: totalOwed })}
                  >
                    <Check className="w-4 h-4 mr-2" /> Settle All — {formatAmount(totalOwed, defaultCurrency)}
                  </Button>
                )}

                {/* Person groups */}
                {groups.map((g) => {
                  const isExpanded = expandedBalancePeople[g.personId] !== false;
                  const isYouOweNet = g.netBalance < 0 || g.totalYouOwe > 0;
                  const absoluteNet = Math.abs(g.totalYouOwe - g.totalTheyOwe);
                  const hasPendingOwed = g.owedItems.some((b: any) => pendingSettleIds.has(String(b._id)));
                  const allOwedPending = g.owedItems.length > 0 && g.owedItems.every((b: any) => pendingSettleIds.has(String(b._id)));

                  return (
                    <Card key={g.personId} className="rounded-2xl border-0 shadow-sm overflow-hidden">
                      {/* Person header row */}
                      <button
                        onClick={() => setExpandedBalancePeople((prev) => ({ ...prev, [g.personId]: !prev[g.personId] }))}
                        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                            {getName(g.personId).substring(0, 2).toUpperCase()}
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-semibold text-foreground">{getName(g.personId)}</p>
                            <p className="text-xs text-muted-foreground">
                              {[...g.owedItems, ...g.receivableItems].length} balance{[...g.owedItems, ...g.receivableItems].length !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            {g.totalYouOwe > 0 && (
                              <p className="text-xs font-semibold text-owed">-{formatAmount(g.totalYouOwe, defaultCurrency)}</p>
                            )}
                            {g.totalTheyOwe > 0 && (
                              <p className="text-xs font-semibold text-receive">+{formatAmount(g.totalTheyOwe, defaultCurrency)}</p>
                            )}
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div>
                          {/* Person-level action row */}
                          <div className="px-4 pb-2 border-b border-border/30 mb-1">
                            {g.owedItems.length > 0 ? (
                              /* User owes this person — show settle + dispute */
                              <div className="flex gap-2">
                                {allOwedPending ? (
                                  <span className="flex-1 h-8 rounded-xl bg-muted text-muted-foreground inline-flex items-center justify-center gap-1 text-xs font-medium">
                                    <Clock className="w-3 h-3" /> Settlement Pending
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="flex-1 rounded-xl h-8 text-xs bg-receive hover:bg-receive/90 text-white"
                                    onClick={(e) => { e.stopPropagation(); setSettleBalance({ __personSettle: true, personId: g.personId, owedItems: g.owedItems, amount: g.totalYouOwe }); }}
                                  >
                                    <Check className="w-3 h-3 mr-1" /> Settle {formatAmount(g.totalYouOwe, defaultCurrency)}
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 rounded-xl h-8 text-xs text-owed border-owed/30"
                                  onClick={(e) => { e.stopPropagation(); setDisputeBalance(g.owedItems[0]); setDisputeForm({ reason: "", proposedAmount: String(g.totalYouOwe) }); }}
                                >
                                  <Flag className="w-3 h-3 mr-1" /> Dispute
                                </Button>
                              </div>
                            ) : (
                              /* User receives from this person — no settle button */
                              <span className="h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center gap-1 text-xs font-medium w-full">
                                <Clock className="w-3 h-3" /> Awaiting Payment from {getName(g.personId)}
                              </span>
                            )}
                          </div>

                          {/* Individual balance rows */}
                          <div className="divide-y divide-border/30 bg-muted/10">
                            {[...g.owedItems, ...g.receivableItems].map((b: any) => {
                              const youOweThis = b.payerId === user?.id;
                              return (
                                <div key={b._id} className="px-5 py-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0 mr-2">
                                      <p className="text-xs font-medium text-foreground truncate">
                                        {b.expenseNote || "Group Expense"}
                                      </p>
                                      <p className={cn("text-xs mt-0.5", youOweThis ? "text-owed" : "text-receive")}>
                                        {youOweThis ? "You owe" : "Owes you"} {formatAmount(b.amount, defaultCurrency)}
                                      </p>
                                    </div>
                                    <div className="flex gap-1.5 flex-shrink-0">
                                      {youOweThis ? (
                                        <>
                                          {pendingSettleIds.has(String(b._id)) ? (
                                            <span className="h-7 px-2.5 text-xs rounded-xl bg-muted text-muted-foreground inline-flex items-center gap-1 font-medium">
                                              <Clock className="w-3 h-3" /> Pending
                                            </span>
                                          ) : (
                                            <Button
                                              size="sm"
                                              className="h-7 px-2.5 text-xs rounded-xl bg-receive hover:bg-receive/90 text-white"
                                              onClick={(e) => { e.stopPropagation(); setSettleBalance(b); }}
                                            >
                                              <Check className="w-3 h-3 mr-1" /> Settle
                                            </Button>
                                          )}
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 px-2.5 text-xs rounded-xl text-owed border-owed/30"
                                            onClick={(e) => { e.stopPropagation(); setDisputeBalance(b); setDisputeForm({ reason: "", proposedAmount: String(b.amount) }); }}
                                          >
                                            <Flag className="w-3 h-3 mr-1" /> Dispute
                                          </Button>
                                        </>
                                      ) : (
                                        /* User receives this — no settle button */
                                        <span className="h-7 px-2.5 text-xs uppercase rounded-[0.5rem] border border-border/40 text-muted-foreground inline-flex items-center gap-1 font-medium">
                                          <Clock className="w-3 h-3" /> Awaiting
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </>
            );
          })()}
        </TabsContent>



        {/* Health Tab */}
        <TabsContent value="health" className="mt-4">
          <GroupHealthTab
            expenses={expenses}
            userNames={userNames}
            budget={budget}
            spent={spent}
            members={group.members || []}
          />
        </TabsContent>
      </Tabs>

      {/* End Trip Dialog */}
      <Dialog open={endGroupOpen} onOpenChange={setEndGroupOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-owed" /> End Trip
            </DialogTitle>
            <DialogDescription>
              {hasUnsettledBalances
                ? `There are unsettled balances in "${group.groupName}". Please settle all dues before ending this trip.`
                : `Are you sure you want to end "${group.groupName}"? The group will be archived and moved to your archived groups.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEndGroupOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            {!hasUnsettledBalances && (
              <Button
                variant="destructive"
                onClick={handleEndTrip}
                className="rounded-xl"
              >
                End Trip
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={editNameOpen} onOpenChange={setEditNameOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Group</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="rounded-xl"
          />
          <DialogFooter>
            <Button onClick={handleRename} className="w-full rounded-xl">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Description Dialog */}
      <Dialog open={editDescOpen} onOpenChange={setEditDescOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Description</DialogTitle>
          </DialogHeader>
          <Textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="rounded-xl resize-none"
            rows={3}
          />
          <DialogFooter>
            <Button
              onClick={handleUpdateDescription}
              className="w-full rounded-xl"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Budget Dialog */}
      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Budget</DialogTitle>
          </DialogHeader>
          <Input
            type="number"
            value={newBudget}
            onChange={(e) => setNewBudget(e.target.value)}
            placeholder="₹ Enter budget"
            className="rounded-xl"
          />
          <DialogFooter>
            <Button onClick={handleSetBudget} className="w-full rounded-xl">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" /> Add Member
            </DialogTitle>
            <DialogDescription>
              Select a friend to add to this group.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Search friends..."
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="rounded-xl mb-2"
          />
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {friends
              .filter(
                (f) =>
                  !group.members?.some((m: any) => m.userId === f.friendId),
              )
              .filter((f) => {
                if (!memberSearch) return true;
                const name = (f.displayName || f.username || "").toLowerCase();
                return (
                  name.includes(memberSearch.toLowerCase()) ||
                  (f.email || "")
                    .toLowerCase()
                    .includes(memberSearch.toLowerCase())
                );
              }).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {friends.filter(
                    (f) =>
                      !group.members?.some((m: any) => m.userId === f.friendId),
                  ).length === 0
                    ? "All your friends are already in this group!"
                    : "No friends match your search"}
                </p>
              )}
            {friends
              .filter(
                (f) =>
                  !group.members?.some((m: any) => m.userId === f.friendId),
              )
              .filter((f) => {
                if (!memberSearch) return true;
                const name = (f.displayName || f.username || "").toLowerCase();
                return (
                  name.includes(memberSearch.toLowerCase()) ||
                  (f.email || "")
                    .toLowerCase()
                    .includes(memberSearch.toLowerCase())
                );
              })
              .map((friend) => {
                const name =
                  friend.displayName ||
                  friend.username ||
                  friend.friendId.substring(0, 8);
                return (
                  <button
                    key={friend.friendId}
                    onClick={() => handleAddMember(friend.friendId)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {friend.email}
                      </p>
                    </div>
                    <Plus className="w-4 h-4 text-primary" />
                  </button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Expense Confirm Dialog */}
      <Dialog
        open={!!deleteExpenseId}
        onOpenChange={() => setDeleteExpenseId(null)}
      >
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-owed" /> Delete Expense
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteExpenseId(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteExpense}
              className="rounded-xl"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={!!editExpense} onOpenChange={() => setEditExpense(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" /> Edit Expense
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Description
              </Label>
              <Input
                value={editExpenseForm.expenseNote}
                onChange={(e) =>
                  setEditExpenseForm((f) => ({
                    ...f,
                    expenseNote: e.target.value,
                  }))
                }
                className="rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Amount (₹)
              </Label>
              <Input
                type="number"
                value={editExpenseForm.amount}
                onChange={(e) =>
                  setEditExpenseForm((f) => ({ ...f, amount: e.target.value }))
                }
                className="rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Category
              </Label>
              <Input
                value={editExpenseForm.category}
                onChange={(e) =>
                  setEditExpenseForm((f) => ({
                    ...f,
                    category: e.target.value,
                  }))
                }
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditExpense(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateExpense} className="rounded-xl">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog
        open={!!removeMemberData}
        onOpenChange={() => setRemoveMemberData(null)}
      >
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-owed" /> Remove Member
            </DialogTitle>
            <DialogDescription>
              Remove <strong>{removeMemberData?.name}</strong> from this group?
              Their existing expense splits will remain. They won't see future
              expenses.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => setRemoveMemberData(null)}
              className="rounded-xl w-full"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleRemoveMember(false)}
              className="rounded-xl w-full"
            >
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle Confirmation Dialog */}
      <Dialog
        open={!!settleBalance}
        onOpenChange={() => { setSettleBalance(null); setPaymentMethod(null); }}
      >
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="w-5 h-5 text-receive" />
              {settleBalance?.payeeId === user?.id ? "Request Net Settlement" : "Confirm Settlement"}
            </DialogTitle>
            <DialogDescription>
              {settleBalance?.payeeId === user?.id ? (
                <>Request <strong>{getName(settleBalance?.payerId)}</strong> to settle <strong>{formatAmount(settleBalance?.amount, defaultCurrency)}</strong>? They will receive a notification.</>
              ) : (
                <>Send a settlement request for <strong>{formatAmount(settleBalance?.amount, defaultCurrency)}</strong>? The other party will receive a notification to confirm in Activity page.</>
              )}
            </DialogDescription>
          </DialogHeader>
          {settleBalance?.payeeId !== user?.id && (
            <div className="space-y-3 mt-2">
              <Label className="text-xs text-muted-foreground">Select Payment Method</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    const receiverId = settleBalance?.payeeId;
                    const hasUpi = receiverId && userUpiIds[receiverId];
                    if (!hasUpi) {
                      toast({ variant: "destructive", title: "UPI ID Missing", description: "Receiver has not set their UPI ID in profile." });
                      return;
                    }
                    setPaymentMethod("upi");
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${paymentMethod === "upi" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 text-muted-foreground"} ${!(settleBalance && userUpiIds[settleBalance?.payeeId]) && "opacity-50 cursor-not-allowed"}`}
                >
                  <Smartphone className="w-6 h-6" />
                  <span className="text-sm font-medium">UPI</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${paymentMethod === "cash" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 text-muted-foreground"}`}
                >
                  <Banknote className="w-6 h-6" />
                  <span className="text-sm font-medium">Cash</span>
                </button>
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => { setSettleBalance(null); setPaymentMethod(null); }}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGroupSettle}
              disabled={settleBalance?.payeeId !== user?.id && !paymentMethod}
              className="rounded-xl bg-receive hover:bg-receive/90 text-white"
            >
              {settleBalance?.payeeId === user?.id ? "Request Net Settlement" : "Confirm Settlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog
        open={!!disputeBalance}
        onOpenChange={() => setDisputeBalance(null)}
      >
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-owed" /> File Dispute
            </DialogTitle>
            <DialogDescription>
              Current: {formatAmount(disputeBalance?.amount, defaultCurrency)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Reason *
              </Label>
              <Textarea
                value={disputeForm.reason}
                onChange={(e) =>
                  setDisputeForm((f) => ({ ...f, reason: e.target.value }))
                }
                className="rounded-xl resize-none"
                rows={3}
                placeholder="Why are you disputing this amount?"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Proposed Amount
              </Label>
              <Input
                type="number"
                value={disputeForm.proposedAmount}
                onChange={(e) =>
                  setDisputeForm((f) => ({
                    ...f,
                    proposedAmount: e.target.value,
                  }))
                }
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisputeBalance(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleGroupDispute}
              className="rounded-xl"
            >
              File Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" /> Group Members
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => { setMembersDialogOpen(false); setAddMemberOpen(true); }}
            >
              <UserPlus className="w-4 h-4 mr-1" /> Add Member
            </Button>
            {group.members?.map((m: any) => {
              const isCreator = m.userId === group.createdBy;
              const isCurrentUser = m.userId === user?.id;
              const memberName = getName(m.userId);
              return (
                <Card
                  key={m._id || m.userId}
                  className="p-3 rounded-xl border-0 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {memberName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {memberName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(m.addedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCreator && (
                      <Badge className="bg-primary/10 text-primary border-0 text-[10px]">
                        <Shield className="w-3 h-3 mr-0.5" /> Admin
                      </Badge>
                    )}
                    {isCurrentUser && (
                      <Badge variant="secondary" className="text-[10px]">
                        You
                      </Badge>
                    )}
                    {!isCreator &&
                      !isCurrentUser &&
                      user?.id === group.createdBy && (
                        <button
                          onClick={() => {
                            setMembersDialogOpen(false);
                            setRemoveMemberData({
                              userId: m.userId,
                              name: memberName,
                            });
                          }}
                          className="p-1 rounded-full hover:bg-muted"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
                  </div>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <ExpenseDetailsDialog
        expense={selectedExpense}
        open={!!selectedExpense}
        onOpenChange={(open) => !open && setSelectedExpense(null)}
        getName={getName}
      />
      {/* UPI Desktop Fallback Dialog */}
      <Dialog open={!!upiDesktopFallback} onOpenChange={() => setUpiDesktopFallback(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" /> UPI Payment
            </DialogTitle>
            <DialogDescription>
              UPI payments can be completed only on mobile device.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Label className="text-xs text-muted-foreground">UPI Payment Link</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={upiDesktopFallback?.link || ""}
                className="rounded-xl text-xs flex-1"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl h-9 px-3"
                onClick={() => {
                  if (upiDesktopFallback?.link) {
                    navigator.clipboard.writeText(upiDesktopFallback.link);
                    toast({ title: "Copied!", description: "UPI link copied to clipboard." });
                  }
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button onClick={() => setUpiDesktopFallback(null)} className="rounded-xl">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupDetailPage;
