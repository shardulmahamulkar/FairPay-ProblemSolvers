import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  AlertTriangle,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Zap,
  ShieldCheck,
  Users,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { getCurrencySymbol } from "@/lib/currency";

/* ═══════════════════════════════════════════════════════════════
 * GroupHealthTab — the "intelligence layer" of the group expense app.
 *
 * All values are derived from real props:
 *   - expenses    : array of expense objects from MongoDB
 *   - userNames   : { userId → displayName }
 *   - budget      : group budget (₹)
 *   - spent       : total amount spent (₹)
 *   - members     : group member objects { userId, addedAt }
 * ═══════════════════════════════════════════════════════════════ */

interface GroupHealthTabProps {
  expenses: any[];
  userNames: Record<string, string>;
  budget: number;
  spent: number;
  members: any[];
}

/* ── Utility: intersection observer hook ── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ── Status colour helpers ── */
const statusColor = (score: number) =>
  score >= 75 ? "hsl(142, 60%, 40%)" : score >= 50 ? "hsl(45, 93%, 47%)" : "hsl(0, 72%, 51%)";

const statusLabel = (score: number) =>
  score >= 75 ? "Stable" : score >= 50 ? "Monitor" : "Risk";

const statusBg = (score: number) =>
  score >= 75
    ? "bg-green-500/10 text-green-600 dark:text-green-400"
    : score >= 50
      ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
      : "bg-red-500/10 text-red-600 dark:text-red-400";

/* ── Standard deviation utility ── */
function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.map((v) => Math.pow(v - mean, 2)).reduce((s, v) => s + v, 0) / values.length);
}

/* ── Smart rounding utility ──
 * Rounds split amounts to "cleaner" numbers:
 *   4+ digits → round to nearest 100  (e.g. 1234 → 1200)
 *   3  digits → round to nearest 10   (e.g. 456  → 460)
 *   <3 digits → keep as-is
 */
function smartRound(value: number): number {
  const abs = Math.abs(value);
  if (abs >= 1000) return Math.round(value / 100) * 100;
  if (abs >= 100) return Math.round(value / 10) * 10;
  return Math.round(value);
}

/* ══════════════════════════════════════════════════════
 * CIRCULAR PROGRESS RING (SVG)
 * ══════════════════════════════════════════════════════ */
function CircularScore({ score, size = 160, strokeWidth = 10, animate = true }: {
  score: number; size?: number; strokeWidth?: number; animate?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = statusColor(score);

  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!animate) { setDisplay(score); return; }
    let raf: number;
    const start = performance.now();
    const duration = 1400;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * score));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score, animate]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth} fill="none" strokeLinecap="round" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={color}
          strokeWidth={strokeWidth} fill="none" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={animate ? offset : circumference}
          style={{ transition: animate ? "stroke-dashoffset 1.4s cubic-bezier(0.65,0,0.35,1)" : "none" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-extrabold tabular-nums" style={{ color }}>
          {display}%
        </span>
        <span className={cn("text-[10px] font-semibold px-2.5 py-0.5 rounded-full mt-1", statusBg(score))}>
          {statusLabel(score)}
        </span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
 * COLLAPSIBLE CARD
 * ══════════════════════════════════════════════════════ */
function CollapsibleCard({ title, score, statusText, icon: Icon, children, defaultOpen = false, delay = 0 }: {
  title: string; score: number; statusText: string; icon: any;
  children: React.ReactNode; defaultOpen?: boolean; delay?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const v = useInView(0.1);

  return (
    <div
      ref={v.ref}
      className={cn(
        "bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden transition-all duration-700",
        v.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${statusColor(score)}15` }}>
            <Icon className="w-4 h-4" style={{ color: statusColor(score) }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-bold tabular-nums" style={{ color: statusColor(score) }}>
                {score}%
              </span>
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", statusBg(score))}>
                {statusText}
              </span>
            </div>
          </div>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>
      <div className={cn("grid transition-all duration-400 ease-in-out", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 space-y-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground tabular-nums">
        {value}
        {suffix && <span className="text-muted-foreground font-normal ml-0.5">{suffix}</span>}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
 * MAIN COMPONENT
 * ══════════════════════════════════════════════════════ */
export default function GroupHealthTab({ expenses, userNames, budget, spent, members }: GroupHealthTabProps) {

  const [expenseInput, setExpenseInput] = useState("");

  /* ─────────────────────────────────────────────────────
   * DERIVE MEMBER CONTRIBUTIONS FROM REAL EXPENSES
   *
   * For each member we compute:
   *   amountPaid     = sum of expense.amount where expense.userId === member.userId
   *   expensesLogged = count of expenses where expense.userId === member.userId
   *   lastPaidDate   = most recent expense.expenseTime for that member
   * ───────────────────────────────────────────────────── */
  const memberContributions = members.map((m: any) => {
    const memberExpenses = expenses.filter((e: any) => e.userId === m.userId);
    const amountPaid = memberExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
    const expensesLogged = memberExpenses.length;
    const lastPaidDate = memberExpenses.length > 0
      ? memberExpenses.sort((a: any, b: any) =>
        new Date(b.expenseTime).getTime() - new Date(a.expenseTime).getTime()
      )[0].expenseTime
      : null;
    const name = userNames[m.userId] || m.userId?.substring(0, 8) || "Member";
    return { id: m.userId, name, amountPaid, expensesLogged, lastPaidDate };
  });

  const totalMembers = memberContributions.length;
  const totalSpent = spent > 0 ? spent : expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);

  /* ─────────────────────────────────────────────────────
   * TRIP DURATION — derived from first and last expense dates
   *
   * DaysElapsed   = days from first expense to today
   * TotalTripDays = max(DaysElapsed, 1)   [can be extended when budget end date is available]
   * ───────────────────────────────────────────────────── */
  const now = new Date();
  const sortedByTime = [...expenses].sort(
    (a: any, b: any) => new Date(a.expenseTime).getTime() - new Date(b.expenseTime).getTime()
  );
  const firstExpenseDate = sortedByTime.length > 0 ? new Date(sortedByTime[0].expenseTime) : now;
  const daysElapsed = Math.max(1, Math.ceil((now.getTime() - firstExpenseDate.getTime()) / 86400000));
  // TotalTripDays: if no budget context, use daysElapsed + 7 as a reasonable forward-looking window
  const totalTripDays = Math.max(daysElapsed, daysElapsed + 7);

  /* ─────────────────────────────────────────────────────
   * BUDGET HEALTH SCORE
   *
   * BudgetUsagePercent     = (TotalSpent / TotalBudget) * 100
   * BurnRate               = TotalSpent / DaysElapsed
   * ProjectedFinalSpend    = BurnRate * TotalTripDays
   *
   * BudgetUsageRiskFactor  = (BudgetUsagePercent / 100) * 40
   *   → At 100% usage, contributes 40 penalty points
   *
   * OverspendingTrendFactor = max(0, (ProjectedFinalSpend / Budget - 1)) * 60
   *   → Penalises when projected spend exceeds budget
   *
   * BudgetHealthScore = max(0, 100 - BudgetUsageRiskFactor - OverspendingTrendFactor)
   *
   * Note: if no budget is set, score defaults to 100 (no constraint = no risk)
   * ───────────────────────────────────────────────────── */
  let budgetHealthScore: number;
  let budgetUsagePercent = 0;
  let burnRate = 0;
  let projectedFinalSpend = 0;

  if (budget > 0) {
    budgetUsagePercent = (totalSpent / budget) * 100;
    burnRate = totalSpent / daysElapsed;
    projectedFinalSpend = burnRate * totalTripDays;
    const budgetUsageRisk = (budgetUsagePercent / 100) * 40;
    const overspendTrend = Math.max(0, (projectedFinalSpend / budget) - 1) * 60;
    budgetHealthScore = Math.max(0, Math.round(100 - budgetUsageRisk - overspendTrend));
  } else {
    // No budget set — cannot assess risk, default to a neutral score
    burnRate = totalSpent / daysElapsed;
    projectedFinalSpend = burnRate * totalTripDays;
    budgetHealthScore = 100;
  }

  /* ─────────────────────────────────────────────────────
   * SETTLEMENT HEALTH SCORE
   *
   * ContributionVariance = StandardDeviation(MemberAmountsPaid)
   * MaxBalanceGap        = Max(Paid) - Min(Paid)
   * IdealShare           = TotalSpent / NumberOfMembers
   *
   * ContributionVarianceWeight = min(30, (ContributionVariance / max(IdealShare, 1)) * 30)
   * MaxBalanceGapWeight        = min(30, (MaxBalanceGap / max(TotalSpent, 1)) * 30)
   *
   * SettlementHealthScore = max(0, 100 - ContributionVarianceWeight - MaxBalanceGapWeight)
   * ───────────────────────────────────────────────────── */
  const contributions = memberContributions.map((m) => m.amountPaid);
  const idealShare = totalMembers > 0 ? totalSpent / totalMembers : 0;
  const maxPaid = contributions.length > 0 ? Math.max(...contributions) : 0;
  const minPaid = contributions.length > 0 ? Math.min(...contributions) : 0;
  const maxBalanceGap = maxPaid - minPaid;
  const contribVariance = standardDeviation(contributions);
  const contribVarianceWeight = Math.min(30, (contribVariance / Math.max(idealShare, 1)) * 30);
  const maxGapWeight = Math.min(30, (maxBalanceGap / Math.max(totalSpent, 1)) * 30);
  const settlementHealthScore = totalSpent > 0
    ? Math.max(0, Math.round(100 - contribVarianceWeight - maxGapWeight))
    : 100;

  /* ─────────────────────────────────────────────────────
   * PARTICIPATION HEALTH SCORE
   *
   * MembersWhoPaid        = count of members with amountPaid > 0
   * ParticipationRatio    = MembersWhoPaid / TotalMembers
   *
   * ExpenseDistVariance   = StandardDeviation(expensesLogged per member)
   * DistVariancePenalty   = min(30, ExpenseDistVariance * 10)
   *
   * ParticipationHealthScore =
   *   max(0, (ParticipationRatio * 70) - DistVariancePenalty + 30)
   * ───────────────────────────────────────────────────── */
  const membersWhoPaid = memberContributions.filter((m) => m.amountPaid > 0).length;
  const participationRatio = totalMembers > 0 ? membersWhoPaid / totalMembers : 1;
  const expenseCountsPerM = memberContributions.map((m) => m.expensesLogged);
  const expenseDistVariance = standardDeviation(expenseCountsPerM);
  const distVariancePenalty = Math.min(30, expenseDistVariance * 10);
  const participationHealthScore = totalMembers > 0
    ? Math.max(0, Math.round(participationRatio * 70 - distVariancePenalty + 30))
    : 100;

  /* ─────────────────────────────────────────────────────
   * FINAL OVERALL HEALTH SCORE
   *
   * FinalHealthScore =
   *   (BudgetHealthScore        * 0.40) +
   *   (SettlementHealthScore    * 0.35) +
   *   (ParticipationHealthScore * 0.25)
   * ───────────────────────────────────────────────────── */
  const finalHealthScore = Math.round(
    budgetHealthScore * 0.40 +
    settlementHealthScore * 0.35 +
    participationHealthScore * 0.25
  );

  /* ─────────────────────────────────────────────────────
   * NEXT SUGGESTED PAYER
   *
   * IdealShare = TotalSpent / NumberOfMembers
   * ContributionGap = IdealShare - MemberAmountPaid
   *   → Positive = underpaid, Negative = overpaid
   *
   * daysSincePaid = days from member's lastPaidDate to today
   *   (members who never paid get max days)
   *
   * maxExpensesLogged = max across all members
   * PaymentFrequencyWeight = (maxExpensesLogged - member.expensesLogged) / max(maxExpensesLogged, 1)
   *   → Members logging fewer expenses score higher
   *
   * RecencyWeight = daysSincePaid / max(daysSincePaid across all members, 1)
   *   → Members who paid longest ago score higher
   *
   * NextPayerScore =
   *   (ContributionGap * 0.6) +
   *   (PaymentFrequencyWeight * IdealShare * 0.2) +
   *   (RecencyWeight * IdealShare * 0.2)
   *
   * Highest NextPayerScore → SuggestedNextPayer
   *
   * If all gaps ≈ 0 (balanced contributions), rotate by recency.
   *
   * Status label:
   *   NextPayerScore > IdealShare * 0.6 → "Strong Recommendation"
   *   NextPayerScore > IdealShare * 0.3 → "Suggested"
   *   else                              → "Balanced Rotation"
   * ───────────────────────────────────────────────────── */
  const maxExpensesLogged = Math.max(...expenseCountsPerM, 1);

  const scoredMembers = memberContributions.map((m) => {
    const gap = idealShare - m.amountPaid;
    const daysSincePaid = m.lastPaidDate
      ? Math.max(1, Math.ceil((now.getTime() - new Date(m.lastPaidDate).getTime()) / 86400000))
      : 9999; // never paid = very stale
    return { ...m, gap, daysSincePaid };
  });

  const maxDaysSincePaid = Math.max(...scoredMembers.map((m) => m.daysSincePaid), 1);

  const scoredWithNextPayer = scoredMembers.map((m) => {
    const freqWeight = (maxExpensesLogged - m.expensesLogged) / maxExpensesLogged;
    const recencyWeight = m.daysSincePaid / maxDaysSincePaid;
    const nextPayerScore =
      m.gap * 0.6 +
      freqWeight * idealShare * 0.2 +
      recencyWeight * idealShare * 0.2;
    return { ...m, nextPayerScore };
  }).sort((a, b) => b.nextPayerScore - a.nextPayerScore);

  const suggestedPayer = scoredWithNextPayer[0];

  const recommendationLabel =
    !suggestedPayer || totalSpent === 0 ? "Balanced Rotation" :
      suggestedPayer.nextPayerScore > idealShare * 0.6 ? "Strong Recommendation" :
        suggestedPayer.nextPayerScore > idealShare * 0.3 ? "Suggested"
          : "Balanced Rotation";

  const recommendationBg =
    recommendationLabel === "Strong Recommendation"
      ? "bg-red-500/10 text-red-600 dark:text-red-400"
      : recommendationLabel === "Suggested"
        ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
        : "bg-green-500/10 text-green-600 dark:text-green-400";

  /* ═══════════════════════════════════════════════════════════════
   * FLEXIBLE FAIR MODE — Dynamic Expense Input Handling
   *
   * CapPerPerson = TotalBudget / NumberOfMembers
   * RemainingBudgetCapacity_i = CapPerPerson - Paid_i
   *
   * DefaultSuggestedPayer = Member with highest RemainingBudgetCapacity_i
   *   where RemainingBudgetCapacity_i > 0
   * ═══════════════════════════════════════════════════════════════ */

  // CapPerPerson = TotalBudget / NumberOfMembers
  // Falls back to idealShare (totalSpent / n) when no budget is set
  const capPerPerson = budget > 0 && totalMembers > 0
    ? budget / totalMembers
    : idealShare;

  // RemainingBudgetCapacity_i = CapPerPerson - Paid_i
  const membersWithCapacity = memberContributions.map((m) => ({
    ...m,
    remainingCapacity: capPerPerson - m.amountPaid,
  }));

  // DefaultSuggestedPayer = Member with highest RemainingBudgetCapacity_i (> 0)
  const defaultSuggestedPayer = [...membersWithCapacity]
    .filter((m) => m.remainingCapacity > 0)
    .sort((a, b) => b.remainingCapacity - a.remainingCapacity)[0]
    || membersWithCapacity[0]; // fallback if all at/over cap

  /* ─────────────────────────────────────────────────────
   * DYNAMIC INPUT MODE — evaluate when user enters amount X
   *
   * suggestionMode:
   *   "default"    → no input, show baseline payer
   *   "single"     → X <= RemainingBudgetCapacity of default payer
   *   "split"      → X > single payer capacity but X <= TotalRemainingCapacity (Case A)
   *   "overflow"   → X > TotalRemainingCapacity (Case B — Flexible Fair Mode)
   * ───────────────────────────────────────────────────── */
  type SuggestionMode = "default" | "single" | "split" | "overflow";

  let suggestionMode: SuggestionMode = "default";
  let splitContributions: { name: string; id: string; contribution: number; remainingCapacity: number }[] = [];
  let parsedExpenseAmount = 0;

  // Only evaluate dynamic mode if we have a parsed numeric input
  const trimmedInput = (typeof expenseInput === "string" ? expenseInput : "").trim();
  if (trimmedInput !== "" && !isNaN(Number(trimmedInput)) && Number(trimmedInput) > 0) {
    parsedExpenseAmount = Number(trimmedInput);
    const X = parsedExpenseAmount;

    /* STEP 1: Check single payer feasibility
     * Single payer valid only if:
     *   Paid_i + X <= CapPerPerson
     *   i.e. X <= RemainingBudgetCapacity_DefaultSuggestedPayer */
    if (defaultSuggestedPayer && X <= defaultSuggestedPayer.remainingCapacity) {
      suggestionMode = "single";
    } else {
      /* STEP 2: Single payer not feasible — compute eligible members */

      // EligibleMembers = Members where RemainingBudgetCapacity_i > 0
      const eligibleMembers = membersWithCapacity.filter((m) => m.remainingCapacity > 0);

      // TotalRemainingCapacity = Σ (CapPerPerson - Paid_i)
      const totalRemainingCapacity = eligibleMembers.reduce(
        (sum, m) => sum + m.remainingCapacity, 0
      );

      if (X <= totalRemainingCapacity && totalRemainingCapacity > 0) {
        /* CASE A: X <= TotalRemainingCapacity
         * Distribute proportionally:
         *   Contribution_i = X * (RemainingBudgetCapacity_i / TotalRemainingCapacity)
         *
         * Contribution_i ensures:
         *   Paid_i + Contribution_i <= CapPerPerson */
        suggestionMode = "split";
        const rawContribs = eligibleMembers.map((m) => ({
          name: m.name,
          id: m.id,
          contribution: smartRound(X * (m.remainingCapacity / totalRemainingCapacity)),
          remainingCapacity: m.remainingCapacity,
        }));
        // Adjust the last member so total matches X exactly after rounding
        const roundedTotal = rawContribs.reduce((s, c) => s + c.contribution, 0);
        if (rawContribs.length > 0) rawContribs[rawContribs.length - 1].contribution += (X - roundedTotal);
        splitContributions = rawContribs;
      } else {
        /* CASE B: X > TotalRemainingCapacity
         * Flexible Fair Mode activates.
         * Distribute equally:
         *   Contribution_i = X / n
         *
         * Flexible mode allows:
         *   Paid_i + Contribution_i > CapPerPerson
         *   only when unavoidable. */
        suggestionMode = "overflow";
        const perPerson = smartRound(X / totalMembers);
        const rawContribs = membersWithCapacity.map((m) => ({
          name: m.name,
          id: m.id,
          contribution: perPerson,
          remainingCapacity: m.remainingCapacity,
        }));
        // Adjust the last member so total matches X exactly after rounding
        const roundedTotal = rawContribs.reduce((s, c) => s + c.contribution, 0);
        if (rawContribs.length > 0) rawContribs[rawContribs.length - 1].contribution += (X - roundedTotal);
        splitContributions = rawContribs;
      }
    }
  }

  /* ── AI-style summary (template-driven, no external AI) ── */
  const aiSummary =
    totalSpent === 0
      ? "No expenses recorded yet. Add your first expense to start tracking group health."
      : finalHealthScore >= 85
        ? "Spending is within budget. Minor imbalance in settlements."
        : finalHealthScore >= 65
          ? "Some areas need attention. Settlement gaps are widening."
          : "Financial health is at risk. Immediate settlement and budget review recommended.";

  /* ── Risk Alerts (dynamic from real data) ── */
  const riskAlerts: { text: string; level: "red" | "yellow" }[] = [];

  if (maxBalanceGap > idealShare * 0.5 && totalSpent > 0)
    riskAlerts.push({ text: "High imbalance detected between member contributions.", level: "red" });

  if (budget > 0 && projectedFinalSpend > budget)
    riskAlerts.push({
      text: `Budget exhaustion risk in ${Math.max(1, Math.ceil((budget - totalSpent) / Math.max(burnRate, 1)))} days.`,
      level: "red",
    });

  if (membersWhoPaid < totalMembers && totalSpent > 0) {
    const nonContributors = memberContributions
      .filter((m) => m.amountPaid === 0)
      .map((m) => m.name)
      .join(", ");
    riskAlerts.push({ text: `${nonContributors} has not contributed yet.`, level: "yellow" });
  }

  if (budget > 0 && burnRate > (budget / Math.max(totalTripDays, 1)) * 1.3)
    riskAlerts.push({ text: "Daily burn rate exceeds sustainable threshold.", level: "yellow" });

  /* ── Suggested Actions (dynamic) ── */
  const suggestedActions: string[] = [];

  if (maxBalanceGap > 100 && totalSpent > 0) {
    const overpaidMember = memberContributions.reduce((p, c) => c.amountPaid > p.amountPaid ? c : p);
    const underpaidMember = memberContributions.reduce((p, c) => c.amountPaid < p.amountPaid ? c : p);
    if (overpaidMember.name !== underpaidMember.name)
      suggestedActions.push(
        `Consider settling ${getCurrencySymbol()}${Math.round(maxBalanceGap / 2).toLocaleString("en-IN")} between ${underpaidMember.name} and ${overpaidMember.name}.`
      );
  }

  if (suggestedPayer && totalSpent > 0)
    suggestedActions.push(`Rotate payer for next expense — ${suggestedPayer.name} should pay next.`);

  if (budget > 0 && projectedFinalSpend > budget * 0.85)
    suggestedActions.push("Reduce discretionary spending to stay within budget.");

  if (expenseDistVariance > 1 && totalMembers > 1)
    suggestedActions.push("Encourage all members to log expenses for better tracking accuracy.");

  if (suggestedActions.length === 0)
    suggestedActions.push("Keep it up! Group finances are well balanced.");

  /* ── Section entrance refs ── */
  const topCardV = useInView(0.1);
  const payerCardV = useInView(0.1);
  const risksV = useInView(0.1);
  const actionsV = useInView(0.1);
  const [budgetWhyOpen, setBudgetWhyOpen] = useState(false);

  /* ── Empty state ── */
  if (expenses.length === 0 && totalSpent === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <ShieldCheck className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No data to analyse yet</p>
        <p className="text-xs text-muted-foreground max-w-[240px]">
          Add some expenses to unlock the group health intelligence panel.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">

      {/* ═══════════════════════════════════════════════════
       * 1) OVERALL GROUP HEALTH SCORE
       * ═══════════════════════════════════════════════════ */}
      <div
        ref={topCardV.ref}
        className={cn(
          "bg-card rounded-2xl border border-border/60 shadow-sm p-6 flex flex-col items-center transition-all duration-700",
          topCardV.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        )}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          Group Health Score
        </p>
        <CircularScore score={finalHealthScore} animate={topCardV.inView} />
        <p className="text-xs text-muted-foreground text-center mt-4 max-w-[280px] leading-relaxed">
          {aiSummary}
        </p>
      </div>

      {/* ═══════════════════════════════════════════════════
       * 2) NEXT SUGGESTED PAYER — Flexible Fair Mode
       * ═══════════════════════════════════════════════════ */}
      {defaultSuggestedPayer && (
        <div
          ref={payerCardV.ref}
          className={cn(
            "relative overflow-hidden bg-card rounded-2xl border border-border/60 shadow-sm p-4 transition-all duration-700",
            payerCardV.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
          style={{ transitionDelay: "100ms" }}
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-primary/8 blur-2xl pointer-events-none" />

          {/* ── Header ── */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-primary" />
              Next Suggested Payer
            </p>
            {suggestionMode === "default" && (
              <span className={cn("text-[10px] font-semibold px-2.5 py-0.5 rounded-full", recommendationBg)}>
                {recommendationLabel}
              </span>
            )}
            {suggestionMode === "single" && (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                Single Payer
              </span>
            )}
            {suggestionMode === "split" && (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                Multi-Payer Split
              </span>
            )}
            {suggestionMode === "overflow" && (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                Flexible Overflow
              </span>
            )}
          </div>

          {/* ── DEFAULT MODE: No input → show baseline suggested payer ── */}
          {suggestionMode === "default" && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                  {defaultSuggestedPayer.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{defaultSuggestedPayer.name}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    Suggested Payer — highest remaining budget capacity
                    ({defaultSuggestedPayer.remainingCapacity > 0
                      ? `${getCurrencySymbol()}${Math.round(defaultSuggestedPayer.remainingCapacity).toLocaleString("en-IN")} remaining`
                      : "at capacity"})
                  </p>
                </div>
              </div>

              {/* ── Expense Input Field ── */}
              <div className="mb-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">{getCurrencySymbol()}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Enter upcoming expense amount"
                    value={expenseInput}
                    onChange={(e) => setExpenseInput(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 ml-1">Optional — dynamically adjusts payer suggestion</p>
              </div>
              {/* comparison bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Current Paid</span>
                  <span className="font-semibold text-foreground">{getCurrencySymbol()}{defaultSuggestedPayer.amountPaid.toLocaleString("en-IN")}</span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-400/70 transition-all duration-1000 ease-out"
                    style={{
                      width: payerCardV.inView
                        ? `${Math.min((defaultSuggestedPayer.amountPaid / Math.max(capPerPerson, 1)) * 100, 100)}%`
                        : "0%",
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Cap Per Person</span>
                  <span className="font-semibold text-foreground">{getCurrencySymbol()}{Math.round(capPerPerson).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </>
          )}

          {/* ── SINGLE PAYER MODE: X fits within default payer's capacity ── */}
          {suggestionMode === "single" && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-green-500/10 flex items-center justify-center text-sm font-bold text-green-600 dark:text-green-400 flex-shrink-0">
                  {defaultSuggestedPayer.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">{defaultSuggestedPayer.name}</p>
                  <p className="text-[11px] text-green-600 dark:text-green-400 leading-snug mt-0.5 font-medium">
                    ✓ Can pay this {getCurrencySymbol()}{parsedExpenseAmount.toLocaleString("en-IN")} expense
                  </p>
                </div>
              </div>

              {/* ── Expense Input Field ── */}
              <div className="mb-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">{getCurrencySymbol()}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Enter upcoming expense amount"
                    value={expenseInput}
                    onChange={(e) => setExpenseInput(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Remaining Capacity After</span>
                  <span className="font-semibold text-foreground">
                    {getCurrencySymbol()}{Math.round(defaultSuggestedPayer.remainingCapacity - parsedExpenseAmount).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-400/70 transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(((defaultSuggestedPayer.amountPaid + parsedExpenseAmount) / Math.max(capPerPerson, 1)) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Cap Per Person</span>
                  <span className="font-semibold text-foreground">{getCurrencySymbol()}{Math.round(capPerPerson).toLocaleString("en-IN")}</span>
                </div>
              </div>
            </>
          )}

          {/* ── MULTI-PAYER SPLIT MODE (Case A): Proportional distribution ── */}
          {suggestionMode === "split" && (
            <>
              {/* ── Expense Input Field ── */}
              <div className="mb-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">{getCurrencySymbol()}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Enter upcoming expense amount"
                    value={expenseInput}
                    onChange={(e) => setExpenseInput(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Suggested contributors for <span className="font-semibold text-foreground">{getCurrencySymbol()}{parsedExpenseAmount.toLocaleString("en-IN")}</span> expense — proportional split based on remaining capacity.
              </p>
              <div className="space-y-2">
                {splitContributions.map((m) => (
                  <div key={m.id}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-blue-500/10 flex items-center justify-center text-[9px] font-bold text-blue-600 dark:text-blue-400">
                          {m.name.substring(0, 1).toUpperCase()}
                        </span>
                        {m.name}
                      </span>
                      <span className="font-semibold text-foreground tabular-nums">{getCurrencySymbol()}{m.contribution.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-400/60 transition-all duration-700 ease-out"
                        style={{
                          width: parsedExpenseAmount > 0 ? `${(m.contribution / parsedExpenseAmount) * 100}%` : "0%",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── FLEXIBLE OVERFLOW MODE (Case B): Equal distribution + warning ── */}
          {suggestionMode === "overflow" && (
            <>
              {/* ── Expense Input Field ── */}
              <div className="mb-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">{getCurrencySymbol()}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Enter upcoming expense amount"
                    value={expenseInput}
                    onChange={(e) => setExpenseInput(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-muted/50 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
                  />
                </div>
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/20 mb-3">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-yellow-700 dark:text-yellow-300 leading-relaxed">
                  Expense exceeds fair budget capacity. Temporary imbalance may occur.
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                Equal split for <span className="font-semibold text-foreground">{getCurrencySymbol()}{parsedExpenseAmount.toLocaleString("en-IN")}</span> — <span className="font-semibold text-foreground">{getCurrencySymbol()}{Math.round(parsedExpenseAmount / Math.max(totalMembers, 1)).toLocaleString("en-IN")}</span> per person.
              </p>
              <div className="space-y-2">
                {splitContributions.map((m) => (
                  <div key={m.id}>
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center text-[9px] font-bold text-yellow-600 dark:text-yellow-400">
                          {m.name.substring(0, 1).toUpperCase()}
                        </span>
                        {m.name}
                      </span>
                      <span className="font-semibold text-foreground tabular-nums">{getCurrencySymbol()}{m.contribution.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-yellow-400/60 transition-all duration-700 ease-out"
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
       * 3) BUDGET HEALTH MODULE
       * ═══════════════════════════════════════════════════ */}
      <CollapsibleCard
        title="Budget Health"
        score={budgetHealthScore}
        statusText={budgetHealthScore >= 80 ? "On Track" : budgetHealthScore >= 50 ? "Warning" : "Over Budget"}
        icon={TrendingUp}
        defaultOpen
        delay={150}
      >
        {budget > 0 ? (
          <>
            <DetailRow label="Total Budget" value={`${getCurrencySymbol()}${budget.toLocaleString("en-IN")}`} />
            <DetailRow label="Total Spent" value={`${getCurrencySymbol()}${totalSpent.toLocaleString("en-IN")}`} />
            <DetailRow label="Remaining" value={`${getCurrencySymbol()}${(budget - totalSpent).toLocaleString("en-IN")}`} />
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">No budget set. Go to ⋮ → Set Budget to enable budget tracking.</p>
        )}
        <DetailRow label="Burn Rate" value={`${getCurrencySymbol()}${Math.round(burnRate).toLocaleString("en-IN")}`} suffix="/day" />
        <DetailRow label="Projected Spend" value={`${getCurrencySymbol()}${Math.round(projectedFinalSpend).toLocaleString("en-IN")}`} />

        {budget > 0 && (
          <>
            <div className="mt-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${Math.min(budgetUsagePercent, 100)}%`,
                    background: statusColor(budgetHealthScore),
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right mt-1">
                {budgetUsagePercent.toFixed(1)}% used
              </p>
            </div>

            <button
              onClick={() => setBudgetWhyOpen(!budgetWhyOpen)}
              className="flex items-center gap-1 text-[11px] text-primary font-medium mt-1 hover:underline"
            >
              Why this score?
              <ChevronDown className={cn("w-3 h-3 transition-transform duration-300", budgetWhyOpen && "rotate-180")} />
            </button>
            {budgetWhyOpen && (
              <div className="text-[11px] text-muted-foreground leading-relaxed bg-muted/40 rounded-xl p-3 mt-1 animate-fade-in-up">
                The budget health score of <strong className="text-foreground">{budgetHealthScore}%</strong> is
                based on your current spending rate.
                At <strong className="text-foreground">{getCurrencySymbol()}{Math.round(burnRate).toLocaleString("en-IN")}/day</strong>, you're
                projected to spend <strong className="text-foreground">{getCurrencySymbol()}{Math.round(projectedFinalSpend).toLocaleString("en-IN")}</strong> total,
                which is{" "}
                {projectedFinalSpend <= budget
                  ? "comfortably within budget."
                  : `${getCurrencySymbol()}${Math.round(projectedFinalSpend - budget).toLocaleString("en-IN")} over budget.`}
              </div>
            )}
          </>
        )}
      </CollapsibleCard>

      {/* ═══════════════════════════════════════════════════
       * 4) SETTLEMENT HEALTH MODULE
       * ═══════════════════════════════════════════════════ */}
      <CollapsibleCard
        title="Settlement Health"
        score={settlementHealthScore}
        statusText={settlementHealthScore >= 80 ? "Balanced" : settlementHealthScore >= 50 ? "Slight Imbalance" : "High Imbalance"}
        icon={TrendingDown}
        delay={200}
      >
        {memberContributions.length > 0 ? (
          <>
            <DetailRow
              label="Highest Contributor"
              value={`${totalSpent > 0 ? Math.round((maxPaid / totalSpent) * 100) : 0}%`}
              suffix={` (${memberContributions.find((m) => m.amountPaid === maxPaid)?.name ?? "–"})`}
            />
            <DetailRow label="Max Balance Difference" value={`${getCurrencySymbol()}${Math.round(maxBalanceGap).toLocaleString("en-IN")}`} />
            <DetailRow label="Ideal Share Per Member" value={`${getCurrencySymbol()}${Math.round(idealShare).toLocaleString("en-IN")}`} />

            <div className="space-y-2 mt-2">
              {memberContributions.map((m) => (
                <div key={m.id}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-muted-foreground">{m.name}</span>
                    <span className="font-semibold text-foreground tabular-nums">{getCurrencySymbol()}{m.amountPaid.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: maxPaid > 0 ? `${(m.amountPaid / maxPaid) * 100}%` : "0%",
                        background: statusColor(settlementHealthScore),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">No members to compare.</p>
        )}
      </CollapsibleCard>

      {/* ═══════════════════════════════════════════════════
       * 5) PARTICIPATION HEALTH MODULE
       * ═══════════════════════════════════════════════════ */}
      <CollapsibleCard
        title="Participation Health"
        score={participationHealthScore}
        statusText={participationHealthScore >= 80 ? "Good Participation" : participationHealthScore >= 50 ? "Fair" : "Low Participation"}
        icon={Users}
        delay={250}
      >
        <DetailRow label="Members Paid" value={`${membersWhoPaid} / ${totalMembers}`} />
        <DetailRow label="Participation Ratio" value={`${Math.round(participationRatio * 100)}%`} />
        <DetailRow label="Expense Logging Spread (σ)" value={expenseDistVariance.toFixed(1)} />

        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mt-2 mb-1">
          Expense Logging per Member
        </p>
        <div className="space-y-1.5">
          {memberContributions.map((m) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-14 truncate">{m.name}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: maxExpensesLogged > 0 ? `${(m.expensesLogged / maxExpensesLogged) * 100}%` : "0%",
                    background: statusColor(participationHealthScore),
                  }}
                />
              </div>
              <span className="text-[10px] font-semibold text-foreground tabular-nums w-4 text-right">
                {m.expensesLogged}
              </span>
            </div>
          ))}
        </div>
      </CollapsibleCard>

      {/* ═══════════════════════════════════════════════════
       * 6) RISK ALERTS
       * ═══════════════════════════════════════════════════ */}
      <div
        ref={risksV.ref}
        className={cn(
          "space-y-2 transition-all duration-700",
          risksV.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        )}
        style={{ transitionDelay: "300ms" }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3" />
          Risk Alerts
        </p>

        {riskAlerts.length === 0 ? (
          <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-xs text-green-700 dark:text-green-300 font-medium">
              No financial risks detected. Everything looks good!
            </p>
          </div>
        ) : (
          riskAlerts.map((alert, i) => (
            <div
              key={i}
              className={cn(
                "rounded-2xl p-3.5 flex items-start gap-3 border",
                alert.level === "red" ? "bg-red-500/5 border-red-500/20" : "bg-yellow-500/5 border-yellow-500/20"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                alert.level === "red" ? "bg-red-500/10" : "bg-yellow-500/10"
              )}>
                <AlertTriangle className={cn("w-3.5 h-3.5",
                  alert.level === "red" ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"
                )} />
              </div>
              <p className="text-xs text-foreground leading-relaxed pt-1">{alert.text}</p>
            </div>
          ))
        )}
      </div>

      {/* ═══════════════════════════════════════════════════
       * 7) SUGGESTED ACTIONS
       * ═══════════════════════════════════════════════════ */}
      <div
        ref={actionsV.ref}
        className={cn(
          "space-y-2 transition-all duration-700",
          actionsV.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        )}
        style={{ transitionDelay: "350ms" }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Lightbulb className="w-3 h-3" />
          Suggested Actions
        </p>

        {suggestedActions.map((action, i) => (
          <div
            key={i}
            className="bg-card rounded-2xl border border-border/60 shadow-sm p-3.5 flex items-start gap-3
                       hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-default"
          >
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <ArrowRight className="w-3.5 h-3.5 text-primary" />
            </div>
            <p className="text-xs text-foreground leading-relaxed pt-1">{action}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
