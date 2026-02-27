import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wallet, BarChart3, Users, Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const slides = [
  {
    icon: Wallet,
    title: "Welcome to FairPay",
    description: "Split expenses effortlessly with friends and groups. No more awkward money conversations.",
    gradient: "from-[#1E2A44] to-[#3A4F6E]",
  },
  {
    icon: Users,
    title: "Smart Group Splitting",
    description: "Create groups, track shared expenses, and let FairPay calculate who owes what.",
    gradient: "from-[#1E2A44] via-[#2A3D62] to-[#3A4F6E]",
  },
  {
    icon: BarChart3,
    title: "Financial Health",
    description: "Monitor your group's financial health with insights, streaks, and fairness scores.",
    gradient: "from-[#162036] via-[#1E2A44] to-[#3A4F6E]",
  },
  {
    icon: Sparkles,
    title: "Ready to Go!",
    description: "Join thousands splitting expenses fairly. Your wallet will thank you.",
    gradient: "from-[#0F1A2E] via-[#1E2A44] to-[#3A4F6E]",
  },
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();

  const [current, setCurrent] = useState(0);
  const [showUpiForm, setShowUpiForm] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [confirmUpiId, setConfirmUpiId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const next = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      if (user && !user.upiId) {
        setShowUpiForm(true);
      } else {
        navigate("/login");
      }
    }
  };

  const skipOrDone = () => navigate("/login");

  const saveUpi = async () => {
    if (!upiId || !confirmUpiId) {
      toast({ title: "Missing UPI ID", description: "Please enter your UPI ID or click Skip.", variant: "destructive" });
      return;
    }
    if (upiId !== confirmUpiId) {
      toast({ title: "UPI IDs do not match", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const { ApiService } = await import("@/services/ApiService");
      await ApiService.put(`/api/users/${user?.id}`, { upiId: upiId.trim() });
      if (updateProfile) {
        await updateProfile({ upiId: upiId.trim() } as any);
      }
      toast({ title: "UPI ID Saved!" });
      navigate("/login");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (showUpiForm) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 max-w-md mx-auto bg-gradient-to-b from-[#0F1A2E] via-[#1E2A44] to-[#3A4F6E] transition-all duration-700">
        <button
          onClick={skipOrDone}
          className="absolute top-6 right-6 text-sm text-white/70 hover:text-white backdrop-blur-sm px-3 py-1 rounded-full bg-white/10"
        >
          Skip
        </button>

        <div className="flex-1 flex flex-col items-center justify-center text-center w-full animate-fade-in">
          <div className="relative mb-10 animate-scale-in">
            <div className="w-28 h-28 rounded-[32px] bg-white/15 backdrop-blur-md flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-4xl">UPI</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Set your UPI ID</h2>
          <p className="text-white/80 leading-relaxed text-sm max-w-xs mb-8">
            Tell friends where to send the money you split.
          </p>

          <div className="w-full space-y-4 text-left">
            <div className="space-y-1.5">
              <Label className="text-white/90 ml-1">UPI ID</Label>
              <Input
                value={upiId}
                onChange={e => setUpiId(e.target.value)}
                placeholder="e.g. name@bank"
                className="rounded-xl h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className={`ml-1 ${upiId && upiId !== confirmUpiId ? "text-red-400" : "text-white/90"}`}>
                Confirm UPI ID
              </Label>
              <Input
                value={confirmUpiId}
                onChange={e => setConfirmUpiId(e.target.value)}
                placeholder="Re-enter UPI ID"
                className="rounded-xl h-12 bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>
            <Button
              onClick={saveUpi}
              className="w-full rounded-2xl bg-white text-primary hover:bg-white/90 shadow-lg h-12 text-base font-semibold mt-4"
              size="lg"
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save & Continue"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-8 max-w-md mx-auto bg-gradient-to-b ${slides[current].gradient} transition-all duration-700`}>
      <button
        onClick={skipOrDone}
        className="absolute top-6 right-6 text-sm text-white/70 hover:text-white backdrop-blur-sm px-3 py-1 rounded-full bg-white/10"
      >
        Skip
      </button>

      <div className="flex-1 flex flex-col items-center justify-center text-center" key={current}>
        {/* Animated icon container */}
        <div className="relative mb-10 animate-scale-in">
          <div className="w-28 h-28 rounded-[32px] bg-white/15 backdrop-blur-md flex items-center justify-center shadow-lg">
            {(() => { const Icon = slides[current].icon; return <Icon className="w-14 h-14 text-white" />; })()}
          </div>
          <div className="absolute -inset-3 rounded-[40px] bg-white/5 -z-10 animate-pulse-glow" />
        </div>

        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">{slides[current].title}</h2>
          <p className="text-white/80 leading-relaxed text-base max-w-xs">{slides[current].description}</p>
        </div>
      </div>

      <div className="w-full space-y-5">
        <div className="flex justify-center gap-2.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-500 ${i === current ? "bg-white w-8" : "bg-white/30 w-2"}`}
            />
          ))}
        </div>
        <Button onClick={next} className="w-full rounded-2xl bg-white text-primary hover:bg-white/90 shadow-lg h-12 text-base font-semibold" size="lg">
          {current < slides.length - 1 ? (
            <>Next <ArrowRight className="w-5 h-5 ml-1" /></>
          ) : (
            "Get Started"
          )}
        </Button>
      </div>
    </div>
  );
};

export default OnboardingPage;
