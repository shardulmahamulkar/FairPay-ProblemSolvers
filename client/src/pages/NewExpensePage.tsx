import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Camera, Users, Plus, Upload, X, Loader2, ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ApiService } from "@/services/ApiService";
import { scanBill } from "@/services/OcrService";

const categories = ["Food", "Transport", "Accommodation", "Utilities", "Entertainment", "Shopping", "Beverages", "Other"];
const currencies = ["INR", "USD", "EUR", "GBP"];
import { getCurrencySymbol } from "@/lib/currency";

const NewExpensePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [groups, setGroups] = useState<any[]>([]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    groupId: (location.state as any)?.groupId || "",
    date: new Date().toISOString().split("T")[0],
    amount: "",
    currency: "INR",
    splitType: "equal",
    category: "",
    note: "",
    paymentType: "upi",
  });
  const [customMode, setCustomMode] = useState<"amount" | "percentage">("amount");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberAmounts, setMemberAmounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [userMap, setUserMap] = useState<Record<string, { username: string; avatar: string }>>({});

  // Fetch user details for all members of a group
  const fetchMemberDetails = async (members: any[]) => {
    const map: Record<string, { username: string; avatar: string }> = {};
    await Promise.all(
      members.map(async (m: any) => {
        const uid = m.userId;
        if (uid === user?.id) {
          map[uid] = { username: "You", avatar: user?.avatar || "" };
          return;
        }
        try {
          const u: any = await ApiService.get(`/api/users/${uid}`);
          map[uid] = {
            username: u.displayName || u.username || u.email?.split("@")[0] || uid.substring(0, 8),
            avatar: u.avatar || "",
          };
        } catch {
          map[uid] = { username: uid.substring(0, 8), avatar: "" };
        }
      })
    );
    setUserMap(map);
  };

  useEffect(() => {
    if (user?.id) {
      ApiService.get(`/api/groups/user/${user.id}`)
        .then((res: any) => {
          const gs = res || [];
          setGroups(gs);
          // If groupId was preselected, also preload members
          const preId = (location.state as any)?.groupId;
          if (preId) {
            const pg = gs.find((g: any) => g._id === preId);
            if (pg) {
              setSelectedMembers(pg.members.map((m: any) => m.userId));
              fetchMemberDetails(pg.members);
            }
          }
        })
        .catch(console.error);
    }
  }, [user]);

  // Scan bill state
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResultOpen, setScanResultOpen] = useState(false);
  const [scanResult, setScanResult] = useState({ amount: "", note: "", category: "" });
  const [scanProgress, setScanProgress] = useState(0);

  // Live camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const selectedGroup = groups.find(g => g._id === form.groupId);

  const toggleMember = (id: string) => {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const totalCustom = Object.values(memberAmounts).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const totalAmount = parseFloat(form.amount) || 0;
  const remaining = customMode === "amount"
    ? totalAmount - totalCustom
    : 100 - totalCustom;

  const handleSubmit = async () => {
    if (!user?.id || !form.groupId || !form.amount) return;
    setSubmitting(true);

    try {
      const amount = parseFloat(form.amount);
      let participatorsInvolved: { userId: string; amount: number; splitPercentage?: number }[] = [];

      if (form.splitType === "equal") {
        // Split equally among all members of the group
        const members = selectedGroup?.members || [];
        const perPerson = amount / members.length;
        participatorsInvolved = members.map((m: any) => ({
          userId: m.userId,
          amount: Math.round(perPerson * 100) / 100,
          splitPercentage: 100 / members.length,
        }));
      } else {
        // Custom split
        participatorsInvolved = selectedMembers.map(userId => {
          const val = parseFloat(memberAmounts[userId] || "0");
          return {
            userId,
            amount: customMode === "amount" ? val : Math.round((val / 100) * amount * 100) / 100,
            splitPercentage: customMode === "percentage" ? val : (val / amount) * 100,
          };
        });
      }

      const paymentMethodMap: Record<string, string> = {
        cash: "cash", upi: "upi", debit: "card", credit: "card",
      };

      await ApiService.post("/api/expenses", {
        groupId: form.groupId,
        userId: user.id,
        expenseNote: form.note || form.category || "Expense",
        amount,
        currency: form.currency,
        category: form.category || "Other",
        paymentMethod: paymentMethodMap[form.paymentType] || "upi",
        participatorsInvolved,
      });

      toast({ title: "Expense Added!", description: `₹${form.amount} split ${form.splitType === "equal" ? "equally" : "custom"} in ${selectedGroup?.groupName}` });
      navigate(form.groupId ? `/groups/${form.groupId}` : "/");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setScanPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleScanBill = async () => {
    if (!scanFile) return;
    setScanning(true);
    setScanProgress(0);
    try {
      const parsed = await scanBill(scanFile, (progress) => setScanProgress(progress));
      setScanResult({
        amount: parsed.amount,
        note: parsed.note,
        category: parsed.category,
      });
      setScanResultOpen(true);
    } catch {
      toast({ title: "Scan Failed", description: "Could not read the bill. Try a clearer image.", variant: "destructive" });
    } finally {
      setScanning(false);
      setScanProgress(0);
    }
  };

  const applyScanResult = () => {
    setForm(prev => ({
      ...prev,
      amount: scanResult.amount || prev.amount,
      note: scanResult.note || prev.note,
      category: scanResult.category || prev.category,
    }));
    setScanResultOpen(false);
    setScanPreview(null);
    setScanFile(null);
    toast({ title: "Bill Scanned", description: "Fields auto-filled from your bill" });
  };

  const clearScan = () => {
    setScanPreview(null);
    setScanFile(null);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const handleCameraOpen = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // Wait for the video element to mount, then attach the stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch {
      // Fallback: if getUserMedia fails, use the file input with capture
      cameraInputRef.current?.click();
    }
  };

  const handleCameraCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setScanPreview(dataUrl);
    // Convert to File for scanning
    canvas.toBlob((blob) => {
      if (blob) setScanFile(new File([blob], "camera-capture.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
    handleCameraClose();
  };

  const handleCameraClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)} className="p-1 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-foreground">New Expense</h2>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 h-1 rounded-full transition-all duration-500 ${step >= s ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 1 && (
        <Card className="p-5 rounded-2xl border-0 shadow-md space-y-4">
          <div className="space-y-2">
            <Label>Group</Label>
            <Select value={form.groupId} onValueChange={(v) => {
              if (v === "__new_group__") {
                navigate("/groups/new");
                return;
              }
              setForm({ ...form, groupId: v });
              const g = groups.find(gr => gr._id === v);
              if (g) {
                setSelectedMembers(g.members.map((m: any) => m.userId));
                fetchMemberDetails(g.members);
              }
            }}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select group" /></SelectTrigger>
              <SelectContent>
                {groups.filter(g => !g.isArchived).map(g => (
                  <SelectItem key={g._id} value={g._id} className="py-1.5 text-sm">{g.groupName}</SelectItem>
                ))}
                <SelectItem value="__new_group__" className="py-1.5 text-sm">
                  <span className="flex items-center gap-1.5 text-primary font-medium">
                    <Plus className="w-3.5 h-3.5" /> New Group
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="rounded-xl text-lg font-semibold" />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Split between people</Label>
            <div className="flex gap-2">
              {["equal", "custom"].map(type => (
                <button
                  key={type}
                  onClick={() => setForm({ ...form, splitType: type })}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    form.splitType === type ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
                  )}
                >
                  {type === "equal" ? "Equally" : "Custom"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Note</Label>
            <Textarea placeholder="What's this expense for?" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="rounded-xl resize-none" rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Payment Type</Label>
            <div className="grid grid-cols-4 gap-2">
              {["cash", "upi", "debit", "credit"].map(type => (
                <button
                  key={type}
                  onClick={() => setForm({ ...form, paymentType: type })}
                  className={cn(
                    "py-2 rounded-xl text-xs font-medium transition-all duration-200 capitalize",
                    form.paymentType === type ? "bg-primary text-primary-foreground shadow-md" : "bg-muted text-muted-foreground"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          {/* Bill scan */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          {!scanPreview ? (
            <div className="flex gap-2">
              <button
                onClick={handleCameraOpen}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-muted text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Camera className="w-4 h-4" />
                <span className="text-sm font-medium">Camera</span>
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-muted text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="text-sm font-medium">Gallery</span>
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="relative">
                <img src={scanPreview} alt="Bill preview" className="w-full max-h-48 object-cover" />
                <button
                  onClick={clearScan}
                  className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 rounded-xl text-xs"
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5 mr-1" /> Re-upload
                </Button>
                <Button
                  size="sm"
                  className="flex-1 rounded-xl text-xs"
                  onClick={handleScanBill}
                  disabled={scanning}
                >
                  {scanning ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Scanning {scanProgress}%</>
                  ) : (
                    <><Camera className="w-3.5 h-3.5 mr-1" /> Extract Details</>
                  )}
                </Button>
              </div>
            </div>
          )}

          <Button
            onClick={() => {
              if (form.splitType === "custom") setStep(2);
              else setStep(3);
            }}
            disabled={!form.groupId || !form.amount}
            className="w-full rounded-xl"
          >
            Next
          </Button>
        </Card>
      )}

      {step === 2 && selectedGroup && (
        <Card className="p-5 rounded-2xl border-0 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Customize Split</h3>
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                onClick={() => { setCustomMode("amount"); setMemberAmounts({}); }}
                className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors", customMode === "amount" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                {getCurrencySymbol(form.currency)} Amount
              </button>
              <button
                onClick={() => { setCustomMode("percentage"); setMemberAmounts({}); }}
                className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors", customMode === "percentage" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
              >
                % Percent
              </button>
            </div>
          </div>

          {/* Split Equally shortcut */}
          <button
            onClick={() => {
              if (!selectedMembers.length) return;
              const total = parseFloat(form.amount) || 0;
              const n = selectedMembers.length;
              const perPerson = customMode === "amount"
                ? Math.round((total / n) * 100) / 100
                : Math.round((100 / n) * 100) / 100;
              const newAmounts: Record<string, string> = {};
              selectedMembers.forEach(id => { newAmounts[id] = String(perPerson); });
              setMemberAmounts(newAmounts);
            }}
            className="w-full text-xs text-primary font-medium py-1.5 border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors"
          >
            ⚡ Split Equally Among Selected
          </button>

          <div className="space-y-3">
            {selectedGroup.members?.map((m: any) => {
              const mId = m.userId;
              const isSelected = selectedMembers.includes(mId);
              return (
                <div key={mId} className={cn("flex items-center justify-between p-3 rounded-xl transition-colors", isSelected ? "bg-primary/5" : "bg-muted/30")}>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleMember(mId)}
                    />
                    {userMap[mId]?.avatar ? (
                      <img src={userMap[mId].avatar} alt={userMap[mId]?.username || ""} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {(userMap[mId]?.username || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-foreground">{mId === user?.id ? "You" : (userMap[mId]?.username || mId.substring(0, 8))}</span>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-1">
                      {customMode === "percentage" && <span className="text-xs text-muted-foreground">%</span>}
                      <Input
                        type="number"
                        placeholder="0"
                        value={memberAmounts[mId] || ""}
                        onChange={(e) => setMemberAmounts(prev => ({ ...prev, [mId]: e.target.value }))}
                        className="w-20 rounded-lg text-right h-8 text-sm"
                      />
                      {customMode === "amount" && <span className="text-xs text-muted-foreground">{getCurrencySymbol(form.currency)}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className={cn(
            "p-3 rounded-xl text-sm font-medium text-center",
            Math.abs(remaining) < 0.01 ? "bg-receive/10 text-receive" : "bg-owed/10 text-owed"
          )}>
            {customMode === "amount"
              ? `Remaining: ${getCurrencySymbol(form.currency)}${remaining.toFixed(2)} of ${getCurrencySymbol(form.currency)}${totalAmount.toFixed(2)}`
              : `Remaining: ${remaining.toFixed(1)}% of 100%`}
          </div>

          <Button onClick={() => setStep(3)} className="w-full rounded-xl">
            Next
          </Button>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-5 rounded-2xl border-0 shadow-md space-y-4">
          <h3 className="font-semibold text-foreground">Review & Submit</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Group</span><span className="font-medium text-foreground">{selectedGroup?.groupName}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium text-foreground">{getCurrencySymbol(form.currency)}{form.amount}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Split</span><span className="font-medium text-foreground capitalize">{form.splitType}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span className="font-medium text-foreground">{form.category || "—"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className="font-medium text-foreground capitalize">{form.paymentType}</span></div>
            {form.note && <div className="flex justify-between"><span className="text-muted-foreground">Note</span><span className="font-medium text-foreground">{form.note}</span></div>}
          </div>
          <Button onClick={handleSubmit} className="w-full rounded-xl" disabled={submitting}>
            {submitting ? "Adding..." : "Add Expense"}
          </Button>
        </Card>
      )}

      {/* Scan Result Dialog */}
      <Dialog open={scanResultOpen} onOpenChange={setScanResultOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" /> Scanned Results
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Review the extracted details and apply them to your expense.</p>
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                value={scanResult.amount}
                onChange={(e) => setScanResult({ ...scanResult, amount: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={scanResult.note}
                onChange={(e) => setScanResult({ ...scanResult, note: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={scanResult.category} onValueChange={(v) => setScanResult({ ...scanResult, category: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setScanResultOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
            <Button onClick={applyScanResult} className="flex-1 rounded-xl">Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Live Camera Overlay */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="flex-1 object-cover w-full"
          />
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-8 pb-10 pt-4 bg-gradient-to-t from-black/80 to-transparent">
            <button
              onClick={handleCameraClose}
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white"
            >
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={handleCameraCapture}
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg"
              style={{ border: "4px solid rgba(255,255,255,0.5)" }}
            >
              <div className="w-12 h-12 rounded-full bg-white" />
            </button>
            <div className="w-12 h-12" /> {/* spacer for centering */}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewExpensePage;
