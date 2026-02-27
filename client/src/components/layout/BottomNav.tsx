import { Home, Users, Layers, Activity, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Users, label: "Friends", path: "/friends" },
  { icon: Layers, label: "Groups", path: "/groups" },
  { icon: Activity, label: "Activity", path: "/activity" },
  { icon: User, label: "Profile", path: "/profile" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      className="fixed bottom-[calc(env(safe-area-inset-bottom,20px)+1rem)] left-1/2 -translate-x-1/2 z-50 flex items-center justify-around w-[calc(100%-2rem)] max-w-[calc(28rem-2rem)] rounded-2xl py-2 px-1 bg-card border"
      style={{ borderColor: "rgba(15,26,46,0.08)", boxShadow: "0px 12px 30px rgba(15, 26, 46, 0.08)" }}
    >
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path || (tab.path !== "/" && location.pathname.startsWith(tab.path));
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className="flex flex-col items-center gap-0.5 transition-all duration-200 relative"
          >
            <div className="flex flex-col items-center justify-center px-4 py-1.5 rounded-[20px] transition-all duration-300 relative">
              <tab.icon className={cn(
                "w-5 h-5 transition-colors duration-200",
                isActive ? "text-[#1E2A44] dark:text-[#F5F2EB]" : "text-[rgba(15,26,46,0.4)] dark:text-[rgba(245,242,235,0.4)]"
              )} />
              <span className={cn(
                "text-[9px] font-semibold mt-0.5 transition-colors duration-200",
                isActive ? "text-[#1E2A44] dark:text-[#F5F2EB]" : "text-[rgba(15,26,46,0.4)] dark:text-[rgba(245,242,235,0.4)]"
              )}>
                {tab.label}
              </span>
              {/* Gold underline for active state */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full"
                  style={{ width: "16px", height: "2px", backgroundColor: "#C6A75E" }}
                />
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
