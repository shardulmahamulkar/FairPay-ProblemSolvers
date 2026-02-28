import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Check, Flag, ChevronDown, ChevronUp, AlertTriangle, Banknote, Smartphone, Clock, Copy, Zap, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ApiService } from "@/services/ApiService";
import { useToast } from "@/hooks/use-toast";
import { convertAllToBase } from "@/services/exchangeRate";
import { useCurrency } from "@/contexts/CurrencyContext";

const SettleHubPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [summary, setSummary] = useState<any>({ owedDocs: [], receivableDocs: [], totalOwed: 0, totalReceivable: 0 });
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [userUpiIds, setUserUpiIds] = useState<Record<string, string>>({});
  const [expandedPeople, setExpandedPeople] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Smart Settle: simplified/optimized settlements across groups
  const [smartSettlements, setSmartSettlements] = useState<any[]>([]);
  const { defaultCurrency, formatAmount, convertAmount } = useCurrency();

  // Action dialog targets (now operating on the aggregated person object)
  const [settleTarget, setSettleTarget] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | null>(null);

  const [disputeTarget, setDisputeTarget] = useState<any | null>(null);
  const [disputeForm, setDisputeForm] = useState({ reason: "", proposedAmount: "" });

  // UPI desktop fallback modal
  const [upiDesktopFallback, setUpiDesktopFallback] = useState<{ link: string } | null>(null);

  // Track which balances already have a pending settlement request (outgoing)
  const [pendingSettleIds, setPendingSettleIds] = useState<Set<string>>(new Set());

  const getName = (uid: string) => {
    if (uid === user?.id) return "You";
    return userNames[uid] || uid.substring(0, 8);
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
    if (!user?.id) return;
    try {
      const [summaryRes, requestsRes, activityRes] = await Promise.all([
        ApiService.get(`/api/expenses/summary/${user.id}`),
        ApiService.get(`/api/balance-requests/pending/${user.id}`).catch(() => []),
        ApiService.get(`/api/balance-requests/activity/${user.id}`).catch(() => []),
      ]);

      // Build set of owedBorrowIds that have outgoing pending settlement requests
      const outgoing = new Set<string>();
      ((activityRes as any[]) || []).forEach((r: any) => {
        if (r.requestedBy === user.id && r.status === "pending" && r.type === "settlement" && r.owedBorrowId) {
          outgoing.add(String(r.owedBorrowId));
        }
      });
      setPendingSettleIds(outgoing);
      const s = summaryRes as any;

      // Convert all debt amounts to INR using live exchange rates
      const owedDocs = s.owedDocs || [];
      const receivableDocs = s.receivableDocs || [];

      const convertedOwed = await convertAllToBase(
        owedDocs.map((d: any) => ({ amount: d.amount, currency: d.currency || "INR" })),
        defaultCurrency
      );
      const convertedReceivable = await convertAllToBase(
        receivableDocs.map((d: any) => ({ amount: d.amount, currency: d.currency || "INR" })),
        defaultCurrency
      );

      // Merge converted amounts back into the docs
      const enrichedOwed = owedDocs.map((d: any, i: number) => ({ ...d, amount: convertedOwed[i].convertedAmount }));
      const enrichedReceivable = receivableDocs.map((d: any, i: number) => ({ ...d, amount: convertedReceivable[i].convertedAmount }));

      const totalOwed = enrichedOwed.reduce((sum: number, d: any) => sum + d.amount, 0);
      const totalReceivable = enrichedReceivable.reduce((sum: number, d: any) => sum + d.amount, 0);

      setSummary({ totalOwed, totalReceivable, owedDocs: enrichedOwed, receivableDocs: enrichedReceivable });
      setPendingRequests(requestsRes as any[] || []);

      // Resolve user names
      const ids = new Set<string>();
      [...(s.owedDocs || []), ...(s.receivableDocs || [])].forEach((d: any) => {
        if (d.payerId !== user?.id) ids.add(d.payerId);
        if (d.payeeId !== user?.id) ids.add(d.payeeId);
      });
      (requestsRes as any[] || []).forEach((r: any) => {
        if (r.requestedBy !== user?.id) ids.add(r.requestedBy);
      });

      const nameMap: Record<string, string> = {};
      const avatarMap: Record<string, string> = {};
      const upiIdMap: Record<string, string> = {};
      await Promise.all([...ids].map(async (uid) => {
        try {
          const u: any = await ApiService.get(`/api/users/${uid}`);
          nameMap[uid] = u.username || u.email?.split("@")[0] || uid.substring(0, 8);
          avatarMap[uid] = u.avatar || "";
          if (u.upiId) upiIdMap[uid] = u.upiId;
        } catch {
          nameMap[uid] = uid.substring(0, 8);
        }
      }));
      setUserNames(nameMap);
      setUserAvatars(avatarMap);
      setUserUpiIds(upiIdMap);

      // Fetch simplified balances for each group the user is in
      try {
        const groupsRes: any = await ApiService.get(`/api/groups/user/${user.id}`);
        const groups = Array.isArray(groupsRes) ? groupsRes : [];
        const allSimplified: any[] = [];
        await Promise.all(
          groups.map(async (g: any) => {
            try {
              const res: any = await ApiService.get(`/api/expenses/simplified-balances/${g._id}`);
              if (res.simplified && res.simplified.length > 0) {
                // Only include settlements where the current user is involved
                const relevant = res.simplified.filter((s: any) => s.from === user.id || s.to === user.id);
                // Check if simplified differs from raw (i.e., there's actual optimization)
                const rawPairs = (res.rawBalances || []).filter((b: any) => b.payerId === user.id || b.payeeId === user.id);
                // Only show smart settle if simplified count < raw pairs count (optimization found)
                if (relevant.length > 0 && relevant.length < rawPairs.length) {
                  allSimplified.push(...relevant.map((s: any) => ({
                    ...s,
                    rawOwedBorrowIds: (res.rawBalances || []).map((b: any) => b._id),
                  })));
                }
              }
            } catch { /* ignore per-group errors */ }
          })
        );
        setSmartSettlements(allSimplified);
      } catch { /* ignore */ }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user, defaultCurrency]);

  const aggregatedByPerson = useMemo(() => {
    const map: Record<string, any> = {};

    (summary.owedDocs || []).forEach((d: any) => {
      const pid = d.payeeId;
      if (!map[pid]) map[pid] = { personId: pid, owedItems: [], receivableItems: [], allItems: [], totalYouOwe: 0, totalTheyOwe: 0 };
      map[pid].owedItems.push(d);
      map[pid].allItems.push(d);
      map[pid].totalYouOwe += d.amount;
    });

    (summary.receivableDocs || []).forEach((d: any) => {
      const pid = d.payerId;
      if (!map[pid]) map[pid] = { personId: pid, owedItems: [], receivableItems: [], allItems: [], totalYouOwe: 0, totalTheyOwe: 0 };
      map[pid].receivableItems.push(d);
      map[pid].allItems.push(d);
      map[pid].totalTheyOwe += d.amount;
    });

    return Object.values(map)
      .map(group => {
        // netBalance = totalTheyOwe - totalYouOwe
        // if netBalance < 0: we owe them (absolute value is what we owe)
        // if netBalance > 0: they owe us
        const netBalance = group.totalTheyOwe - group.totalYouOwe;
        return { ...group, netBalance };
      })
      .filter(g => Math.abs(g.netBalance) > 0.01) // Filter out effectively zero balances
      .sort((a, b) => getName(a.personId).localeCompare(getName(b.personId)));
  }, [summary, userNames]);

  const netOwedByPerson = aggregatedByPerson.filter(g => g.netBalance < 0);
  const netReceivableByPerson = aggregatedByPerson.filter(g => g.netBalance > 0);

  const togglePerson = (pid: string) => setExpandedPeople(prev => ({ ...prev, [pid]: !prev[pid] }));

  const handleSettle = async () => {
    if (!settleTarget || !user?.id || !paymentMethod) return;
    try {
      const isGroup = settleTarget.netBalance !== undefined;
      const settleAmount = isGroup ? Math.abs(settleTarget.netBalance) : settleTarget.amount;

      // Trigger UPI deep link before API calls
      if (paymentMethod === "upi") {
        const receiverId = isGroup ? settleTarget.personId : settleTarget.payeeId;
        const receiverUpiId = userUpiIds[receiverId];
        if (!receiverUpiId) {
          toast({ variant: "destructive", title: "UPI ID Missing", description: "Receiver has not set their UPI ID in profile." });
          return;
        }
        const receiverName = getName(receiverId);
        const upiLink = buildUpiLink(receiverUpiId, receiverName, settleAmount);
        if (isMobileDevice()) {
          window.location.href = upiLink;
        } else {
          setUpiDesktopFallback({ link: upiLink });
        }
      }

      const itemsToSettle = isGroup ? settleTarget.owedItems : [settleTarget];
      await Promise.all(
        itemsToSettle.map((d: any) =>
          ApiService.post("/api/balance-requests/settle", { owedBorrowId: d._id, requestedBy: user.id, paymentMethod })
        )
      );

      setSettleTarget(null);
      setPaymentMethod(null);
      if (paymentMethod === "upi") {
        toast({ title: "Settlement Processing", description: "UPI payment initiated. Waiting for confirmation." });
      } else {
        toast({ title: "Settlement Requested", description: "Waiting for acknowledgment from the other party." });
      }
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleDispute = async () => {
    if (!disputeTarget || !user?.id) return;
    if (!disputeForm.reason.trim()) {
      toast({ variant: "destructive", title: "Reason required", description: "Please provide a reason for the dispute." });
      return;
    }
    
    try {
      const isGroup = disputeTarget.netBalance !== undefined;
      const currentOwed = isGroup ? Math.abs(disputeTarget.netBalance) : disputeTarget.amount;
      const proposedOwed = parseFloat(disputeForm.proposedAmount) || currentOwed;
      // Calculate scaling factor to distribute the proposed amount proportionally across all owed items
      const scale = isGroup ? proposedOwed / currentOwed : 1;

      const itemsToDispute = isGroup ? disputeTarget.owedItems : [disputeTarget];
      await Promise.all(
        itemsToDispute.map((d: any) =>
          ApiService.post("/api/balance-requests/dispute", {
            owedBorrowId: d._id,
            requestedBy: user.id,
            reason: disputeForm.reason,
            proposedAmount: isGroup ? d.amount * scale : proposedOwed,
          })
        )
      );

      setDisputeTarget(null);
      setDisputeForm({ reason: "", proposedAmount: "" });
      toast({ title: "Dispute Filed", description: "The other party will be asked to review and respond." });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await ApiService.post(`/api/balance-requests/${requestId}/accept`, { userId: user?.id });
      toast({ title: "Accepted", description: "Balance updated successfully." });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await ApiService.post(`/api/balance-requests/${requestId}/reject`, { userId: user?.id });
      toast({ title: "Declined", description: "Request declined." });
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const PersonSection = ({ group, isOwed }: { group: any; isOwed: boolean }) => {
    const isExpanded = expandedPeople[group.personId] !== false;
    const avatar = userAvatars[group.personId];
    const absoluteNet = Math.abs(group.netBalance);
    
    // Check if any of the underlying items have a pending outgoing settlement
    const hasPendingOwed = group.owedItems.some((d: any) => pendingSettleIds.has(String(d._id)));

    return (
      <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
        <button
          onClick={() => togglePerson(group.personId)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            {(avatar?.startsWith("http") || avatar?.startsWith("data:")) ? (
              <img src={avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                {getName(group.personId).substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{getName(group.personId)}</p>
              <p className="text-xs text-muted-foreground">{group.allItems.length} relevant balance{group.allItems.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("font-bold text-sm", isOwed ? "text-owed" : "text-receive")}>
              {isOwed ? "-" : "+"}{formatAmount(absoluteNet, defaultCurrency)}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {isExpanded && (
          <div>
            {/* Person-level Aggregated Actions */}
            <div className="px-4 pb-2 border-b border-border/30 mb-2">
              {isOwed ? (
                /* We Owe -> Show Settle & Dispute Actions horizontally */
                <div className="flex gap-2">
                  {hasPendingOwed ? (
                    <span className="flex-1 h-8 rounded-xl bg-muted text-muted-foreground inline-flex items-center justify-center gap-1 text-xs font-medium">
                      <Clock className="w-3 h-3" /> Settlement Pending
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1 rounded-xl h-8 text-xs bg-receive hover:bg-receive/90 text-white"
                      onClick={(e) => { e.stopPropagation(); setSettleTarget(group); }}
                    >
                      <Check className="w-3 h-3 mr-1" /> Settle Net Balance
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl h-8 text-xs text-owed border-owed/30"
                    onClick={(e) => { e.stopPropagation(); setDisputeTarget(group); setDisputeForm({ reason: "", proposedAmount: String(absoluteNet) }); }}
                  >
                    <Flag className="w-3 h-3 mr-1" /> Dispute
                  </Button>
                </div>
              ) : (
                /* They Owe Us -> Simple waiting state */
                <span className="h-8 rounded-xl bg-muted text-muted-foreground flex items-center justify-center gap-1 text-xs font-medium w-full">
                  <Clock className="w-3 h-3" /> Awaiting Payment
                </span>
              )}
            </div>

            {/* Underlying Individual Group Balances */}
            <div className="divide-y divide-border/30 bg-muted/10">
              {group.allItems.map((d: any) => {
                // Determine if this specific item is one where we are the payer
                const weArePayer = d.payerId === user?.id;
                return (
                  <div key={d._id} className="px-5 py-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-foreground">{d.groupName || "Unnamed Group"}</p>
                        <p className={cn("text-xs mt-0.5", weArePayer ? "text-owed" : "text-receive")}>
                          {weArePayer ? "You owe" : "Owes you"} {formatAmount(d.amount, defaultCurrency)}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        {weArePayer ? (
                          <>
                            {pendingSettleIds.has(String(d._id)) ? (
                              <span className="h-7 px-2.5 text-xs rounded-xl bg-muted text-muted-foreground inline-flex items-center gap-1 font-medium">
                                <Clock className="w-3 h-3" /> Pending
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                className="h-7 px-2.5 text-xs rounded-xl bg-receive hover:bg-receive/90 text-white"
                                onClick={(e) => { e.stopPropagation(); setSettleTarget(d); }}
                              >
                                <Check className="w-3 h-3 mr-1" /> Settle
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs rounded-xl text-owed border-owed/30"
                              onClick={(e) => { e.stopPropagation(); setDisputeTarget(d); setDisputeForm({ reason: "", proposedAmount: String(d.amount) }); }}
                            >
                              <Flag className="w-3 h-3 mr-1" /> Dispute
                            </Button>
                          </>
                        ) : (
                          <span className="h-7 px-2.5 text-xs uppercase rounded-[0.5rem] bg-none border border-border/40 text-muted-foreground inline-flex items-center gap-1 font-medium">
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
  };

  if (loading) return <p className="p-4 text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-foreground">Settlement Hub</h2>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 rounded-xl border-0 shadow-sm text-center">
          <p className="text-xs text-muted-foreground mb-1">You Owe</p>
          <p className="text-xl font-bold text-owed">{formatAmount(summary.totalOwed, defaultCurrency)}</p>
        </Card>
        <Card className="p-4 rounded-xl border-0 shadow-sm text-center">
          <p className="text-xs text-muted-foreground mb-1">You're Owed</p>
          <p className="text-xl font-bold text-receive">{formatAmount(summary.totalReceivable, defaultCurrency)}</p>
        </Card>
      </div>

      {/* Smart Settle — Optimized Settlements */}
      {smartSettlements.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            Smart Settle
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-600 dark:text-amber-400">Optimized</Badge>
          </h3>
          <p className="text-xs text-muted-foreground -mt-1">
            These are optimized payments that reduce the number of transactions needed.
          </p>
          {smartSettlements.map((s, idx) => {
            const isYouPaying = s.from === user?.id;
            const otherName = isYouPaying ? s.toName : s.fromName;
            const otherAvatar = isYouPaying ? s.toAvatar : s.fromAvatar;
            const otherUpiId = isYouPaying ? s.toUpiId : "";
            return (
              <Card key={`smart-${idx}`} className="rounded-2xl border-0 shadow-sm overflow-hidden border-l-2 border-l-amber-500">
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* From avatar */}
                      {isYouPaying ? (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">You</div>
                      ) : (
                        (otherAvatar?.startsWith("http") || otherAvatar?.startsWith("data:")) ? (
                          <img src={otherAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {otherName.substring(0, 2).toUpperCase()}
                          </div>
                        )
                      )}
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      {/* To avatar */}
                      {!isYouPaying ? (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">You</div>
                      ) : (
                        (otherAvatar?.startsWith("http") || otherAvatar?.startsWith("data:")) ? (
                          <img src={otherAvatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {otherName.substring(0, 2).toUpperCase()}
                          </div>
                        )
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {isYouPaying ? `Pay ${otherName} directly` : `${otherName} pays you directly`}
                        </p>
                        <p className="text-xs text-muted-foreground">{s.groupName} · Saves a step</p>
                      </div>
                    </div>
                    <span className={cn("font-bold text-sm", isYouPaying ? "text-owed" : "text-receive")}>
                      {isYouPaying ? "-" : "+"}{formatAmount(s.amount, defaultCurrency)}
                    </span>
                  </div>

                  {isYouPaying && (
                    <Button
                      size="sm"
                      className="w-full rounded-xl h-9 text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium"
                      onClick={() => setSettleTarget({
                        netBalance: -s.amount,
                        personId: s.to,
                        owedItems: (summary.owedDocs || []).filter((d: any) =>
                          d.payeeId === s.to || d.payerId === user?.id
                        ),
                        allItems: [],
                        isSmartSettle: true,
                      })}
                    >
                      <Zap className="w-3 h-3 mr-1" /> Pay Directly · {formatAmount(s.amount, defaultCurrency)}
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {/* Incoming acknowledgment requests */}
      {pendingRequests.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Incoming Requests
            <span className="bg-owed text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{pendingRequests.length}</span>
          </h3>
          {pendingRequests.map((req) => (
            <Card key={req._id} className="p-4 rounded-xl border-0 shadow-sm space-y-2 border-l-2 border-l-primary">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {req.type === "settlement" ? "💳 Settlement Request" : "⚠️ Dispute"}
                  </p>
                  <p className="text-xs text-muted-foreground">From: {getName(req.requestedBy)}</p>
                  {req.type === "settlement" && (
                    <p className="text-xs text-foreground mt-0.5">Wants to mark <strong>{formatAmount(req.amount, req.currency)}</strong> as settled</p>
                  )}
                  {req.type === "dispute" && (
                    <>
                      <p className="text-xs text-foreground mt-0.5">Current: {formatAmount(req.amount, req.currency)} → Proposed: {formatAmount(req.proposedAmount, req.currency)}</p>
                      <p className="text-xs text-muted-foreground italic">"{req.reason}"</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 rounded-xl h-8 text-xs bg-receive hover:bg-receive/90 text-white" onClick={() => handleAcceptRequest(req._id)}>
                  <Check className="w-3 h-3 mr-1" /> Accept
                </Button>
                <Button size="sm" variant="outline" className="flex-1 rounded-xl h-8 text-xs text-owed border-owed/30" onClick={() => handleRejectRequest(req._id)}>
                  Decline
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      {/* You Owe section */}
      {netOwedByPerson.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground text-owed">You Owe</h3>
          {netOwedByPerson.map((g) => <PersonSection key={g.personId} group={g} isOwed={true} />)}
        </section>
      )}

      {/* Others owe you */}
      {netReceivableByPerson.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground text-receive">They Owe You</h3>
          {netReceivableByPerson.map((g) => <PersonSection key={g.personId} group={g} isOwed={false} />)}
        </section>
      )}

      {netOwedByPerson.length === 0 && netReceivableByPerson.length === 0 && pendingRequests.length === 0 && (
        <div className="text-center py-12 space-y-2">
          <p className="text-3xl">🎉</p>
          <p className="text-sm text-muted-foreground font-medium">All settled! No pending payments.</p>
        </div>
      )}

      {/* Settle Confirmation Dialog */}
      <Dialog open={!!settleTarget} onOpenChange={() => { setSettleTarget(null); setPaymentMethod(null); }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Check className="w-5 h-5 text-receive" /> Confirm Settlement</DialogTitle>
            <DialogDescription>
              {settleTarget?.netBalance !== undefined ? (
                <>Settle your net balance of <strong>{formatAmount(Math.abs(settleTarget.netBalance), defaultCurrency)}</strong> with <strong>{getName(settleTarget.personId)}</strong>?</>
              ) : (
                <>Send a settlement request of <strong>{formatAmount(settleTarget?.amount, defaultCurrency)}</strong> for <strong>{settleTarget?.groupName}</strong>?</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Label className="text-xs text-muted-foreground">Select Payment Method</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const receiverId = settleTarget?.netBalance !== undefined ? settleTarget.personId : settleTarget?.payeeId;
                  const hasUpi = receiverId && userUpiIds[receiverId];
                  if (!hasUpi) {
                    toast({ variant: "destructive", title: "UPI ID Missing", description: "Receiver has not set their UPI ID in profile." });
                    return;
                  }
                  setPaymentMethod("upi");
                }}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${paymentMethod === "upi" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 text-muted-foreground"} ${!(settleTarget && userUpiIds[settleTarget?.netBalance !== undefined ? settleTarget.personId : settleTarget?.payeeId]) && "opacity-50 cursor-not-allowed"}`}
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
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setSettleTarget(null); setPaymentMethod(null); }} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSettle} disabled={!paymentMethod} className="rounded-xl bg-receive hover:bg-receive/90 text-white">Confirm Settlement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Dialog */}
      <Dialog open={!!disputeTarget} onOpenChange={() => setDisputeTarget(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-owed" /> File Dispute</DialogTitle>
            <DialogDescription>
              {disputeTarget?.netBalance !== undefined ? (
                <>Current net amount: <strong>{formatAmount(Math.abs(disputeTarget.netBalance), defaultCurrency)}</strong> with <strong>{getName(disputeTarget.personId)}</strong></>
              ) : (
                <>Current amount: <strong>{formatAmount(disputeTarget?.amount, defaultCurrency)}</strong> for <strong>{disputeTarget?.groupName}</strong></>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Reason *</Label>
              <Textarea
                placeholder="Explain why you're disputing this amount..."
                value={disputeForm.reason}
                onChange={e => setDisputeForm(f => ({ ...f, reason: e.target.value }))}
                className="rounded-xl resize-none" rows={3}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Proposed Amount ({{ INR: "₹", USD: "$", EUR: "€", GBP: "£" }[defaultCurrency] || defaultCurrency})</Label>
              <Input
                type="number"
                value={disputeForm.proposedAmount}
                onChange={e => setDisputeForm(f => ({ ...f, proposedAmount: e.target.value }))}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeTarget(null)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleDispute} className="rounded-xl">File Dispute</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* UPI Desktop Fallback Dialog */}
      <Dialog open={!!upiDesktopFallback} onOpenChange={() => setUpiDesktopFallback(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /> UPI Payment</DialogTitle>
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

export default SettleHubPage;
