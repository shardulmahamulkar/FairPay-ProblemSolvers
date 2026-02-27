import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Wallet, BarChart3, Users, Sparkles } from "lucide-react";

const slides = [
  {
    icon: Wallet,
    title: "Welcome to FairPay",
    description: "Split expenses effortlessly with friends and groups. No more awkward money conversations.",
    gradient: "from-[#4398BA] to-[#C3F0F7]",
  },
  {
    icon: Users,
    title: "Smart Group Splitting",
    description: "Create groups, track shared expenses, and let FairPay calculate who owes what.",
    gradient: "from-[#4398BA] via-[#5BB5D1] to-[#C3F0F7]",
  },
  {
    icon: BarChart3,
    title: "Financial Health",
    description: "Monitor your group's financial health with insights, streaks, and fairness scores.",
    gradient: "from-[#3A8BAD] via-[#4398BA] to-[#C3F0F7]",
  },
  {
    icon: Sparkles,
    title: "Ready to Go!",
    description: "Join thousands splitting expenses fairly. Your wallet will thank you.",
    gradient: "from-[#2A7A9A] via-[#4398BA] to-[#C3F0F7]",
  },
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);

  const next = () => {
    if (current < slides.length - 1) setCurrent(current + 1);
    else navigate("/login");
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-8 max-w-md mx-auto bg-gradient-to-b ${slides[current].gradient} transition-all duration-700`}>
      <button
        onClick={() => navigate("/login")}
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
