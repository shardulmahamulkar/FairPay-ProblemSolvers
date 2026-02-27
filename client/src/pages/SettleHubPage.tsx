import { useState, useEffect } from "react";
import { ArrowLeft, Check, Flag, ChevronDown, ChevronUp, AlertTriangle, Banknote, Smartphone, Clock } from "lucide-react";
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
  const [expandedPeople, setExpandedPeople] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const { defaultCurrency, formatAmount, convertAmount } = useCurrency();

  // Settle dialog
  const [settleTarget, setSettleTarget] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | null>(null);

  // Dispute dialog
  const [disputeTarget, setDisputeTarget] = useState<any | null>(null);
  const [disputeForm, setDisputeForm] = useState({ reason: "", proposedAmount: "" });

  // Settle All dialog
  const [settleAllTarget, setSettleAllTarget] = useState<{ personId: string; items: any[] } | null>(null);

  // Track which balances already have a pending settlement request (outgoing)
  const [pendingSettleIds, setPendingSettleIds] = useState<Set<string>>(new Set());

  const getName = (uid: string) => {
    if (uid === user?.id) return "You";
    return userNames[uid] || uid.substring(0, 8);
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
      await Promise.all([...ids].map(async (uid) => {
        try {
          const u: any = await ApiService.get(`/api/users/${uid}`);
          nameMap[uid] = u.username || u.email?.split("@")[0] || uid.substring(0, 8);
          avatarMap[uid] = u.avatar || "";
        } catch {
          nameMap[uid] = uid.substring(0, 8);
        }
      }));
      setUserNames(nameMap);
      setUserAvatars(avatarMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user, defaultCurrency]);

  // Group debts by person (the other party)
  const groupByPerson = (docs: any[], isOwed: boolean) => {
    const map: Record<string, { personId: string; items: any[] }> = {};
    docs.forEach((d) => {
      const personId = isOwed ? d.payeeId : d.payerId;
      if (!map[personId]) map[personId] = { personId, items: [] };
      map[personId].items.push(d);
    });
    Object.values(map).forEach(({ items }) => {
      items.sort((a, b) => (a.groupName || "").localeCompare(b.groupName || ""));
    });
    return Object.values(map).sort((a, b) => getName(a.personId).localeCompare(getName(b.personId)));
  };

  const owedByPerson = groupByPerson(summary.owedDocs || [], true);
  const receivableByPerson = groupByPerson(summary.receivableDocs || [], false);

  const togglePerson = (pid: string) => setExpandedPeople(prev => ({ ...prev, [pid]: !prev[pid] }));

  const handleSettle = async () => {
    if (!settleTarget || !user?.id || !paymentMethod) return;
    try {
      await ApiService.post("/api/balance-requests/settle", {
        owedBorrowId: settleTarget._id,
        requestedBy: user.id,
        paymentMethod,
      });
      setSettleTarget(null);
      setPaymentMethod(null);
      if (paymentMethod === "upi") {
        toast({ title: "Settled via UPI", description: "Payment marked as completed." });
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
      await ApiService.post("/api/balance-requests/dispute", {
        owedBorrowId: disputeTarget._id,
        requestedBy: user.id,
        reason: disputeForm.reason,
        proposedAmount: parseFloat(disputeForm.proposedAmount) || disputeTarget.amount,
      });
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

  const handleSettleAll = async () => {
    if (!settleAllTarget || !user?.id || !paymentMethod) return;
    try {
      await Promise.all(
        settleAllTarget.items.map(d =>
          ApiService.post("/api/balance-requests/settle", { owedBorrowId: d._id, requestedBy: user.id, paymentMethod })
        )
      );
      const total = settleAllTarget.items.reduce((s, d) => s + d.amount, 0);
      setSettleAllTarget(null);
      setPaymentMethod(null);
      if (paymentMethod === "upi") {
        toast({ title: "All Settled via UPI", description: `${formatAmount(total, defaultCurrency)} across ${settleAllTarget.items.length} groups marked completed.` });
      } else {
        toast({ title: "All Settlements Requested", description: `${formatAmount(total, defaultCurrency)} across ${settleAllTarget.items.length} groups sent for acknowledgment.` });
      }
      fetchData();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const PersonSection = ({ group, isOwed }: { group: { personId: string; items: any[] }; isOwed: boolean }) => {
    const total = group.items.reduce((s, d) => s + d.amount, 0);
    const isExpanded = expandedPeople[group.personId] !== false;
    const avatar = userAvatars[group.personId];

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
              <p className="text-xs text-muted-foreground">{group.items.length} balance{group.items.length > 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("font-bold text-sm", isOwed ? "text-owed" : "text-receive")}>
              {isOwed ? "-" : "+"}{formatAmount(total, defaultCurrency)}
            </span>
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </button>

        {isExpanded && isOwed && group.items.length > 1 && (
          <div className="px-4 pb-2">
            <Button
              size="sm"
              className="w-full rounded-xl h-8 text-xs bg-receive hover:bg-receive/90 text-white"
              onClick={(e) => { e.stopPropagation(); setSettleAllTarget(group); }}
            >
              <Check className="w-3 h-3 mr-1" /> Settle All ({group.items.length} groups) — {formatAmount(total, defaultCurrency)}
            </Button>
          </div>
        )}

        {isExpanded && (
          <div className="border-t border-border/40 divide-y divide-border/30">
            {group.items.map((d) => (
              <div key={d._id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-foreground">{d.groupName || "Unnamed Group"}</p>
                    <p className={cn("text-xs", isOwed ? "text-owed" : "text-receive")}>
                      {isOwed ? "You owe" : "Owes you"} {formatAmount(d.amount, defaultCurrency)}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {isOwed ? (
                      /* User OWES — show Settle + Dispute */
                      <>
                        {pendingSettleIds.has(String(d._id)) ? (
                          <span className="h-7 px-2.5 text-xs rounded-xl bg-muted text-muted-foreground inline-flex items-center gap-1 font-medium">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs rounded-xl bg-receive hover:bg-receive/90 text-white"
                            onClick={() => setSettleTarget(d)}
                          >
                            <Check className="w-3 h-3 mr-1" /> Settle
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs rounded-xl text-owed border-owed/30"
                          onClick={() => { setDisputeTarget(d); setDisputeForm({ reason: "", proposedAmount: String(d.amount) }); }}
                        >
                          <Flag className="w-3 h-3 mr-1" /> Dispute
                        </Button>
                      </>
                    ) : (
                      /* User IS OWED — show status badge only */
                      <span className="h-7 px-2.5 text-xs rounded-xl bg-muted text-muted-foreground inline-flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" /> Awaiting
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
      {owedByPerson.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground text-owed">You Owe</h3>
          {owedByPerson.map((g) => <PersonSection key={g.personId} group={g} isOwed={true} />)}
        </section>
      )}

      {/* Others owe you */}
      {receivableByPerson.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground text-receive">They Owe You</h3>
          {receivableByPerson.map((g) => <PersonSection key={g.personId} group={g} isOwed={false} />)}
        </section>
      )}

      {owedByPerson.length === 0 && receivableByPerson.length === 0 && pendingRequests.length === 0 && (
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
              Send a settlement request of <strong>{formatAmount(settleTarget?.amount, defaultCurrency)}</strong> for <strong>{settleTarget?.groupName}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Label className="text-xs text-muted-foreground">Select Payment Method</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod("upi")}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${paymentMethod === "upi" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 text-muted-foreground"}`}
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
              Current amount: <strong>{formatAmount(disputeTarget?.amount, defaultCurrency)}</strong> for <strong>{disputeTarget?.groupName}</strong>
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
              <Label className="text-xs text-muted-foreground mb-1 block">Proposed Amount ({getCurrencySymbol()})</Label>
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

      {/* Settle All Confirmation Dialog */}
      <Dialog open={!!settleAllTarget} onOpenChange={() => { setSettleAllTarget(null); setPaymentMethod(null); }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Check className="w-5 h-5 text-receive" /> Confirm Batch Settlement</DialogTitle>
            <DialogDescription>
              Settle all <strong>{settleAllTarget?.items.length}</strong> balances with <strong>{settleAllTarget ? getName(settleAllTarget.personId) : ""}</strong>?
              Total amount: <strong>{formatAmount(settleAllTarget?.items.reduce((s: number, d: any) => s + d.amount, 0), defaultCurrency)}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Label className="text-xs text-muted-foreground">Select Payment Method</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPaymentMethod("upi")}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${paymentMethod === "upi" ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50 text-muted-foreground"}`}
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
            <Button variant="outline" onClick={() => { setSettleAllTarget(null); setPaymentMethod(null); }} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSettleAll} disabled={!paymentMethod} className="rounded-xl bg-receive hover:bg-receive/90 text-white">Confirm All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettleHubPage;
