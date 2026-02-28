import { Bell, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const AppHeader = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const displayName = user?.name?.split(" ")[0] || "User";
  const avatarUrl = (user?.avatar?.startsWith("http") || user?.avatar?.startsWith("data:")) ? user.avatar : null;

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,24px)+12px)] pb-3 backdrop-blur-lg border-b border-white/10 max-w-full overflow-hidden"
      style={{ backgroundColor: "#003F66" }}
    >
      <h1
        className="text-xl font-bold cursor-pointer tracking-tight shrink-0 text-white"
        onClick={() => navigate("/")}
      >
        Fair<span style={{ color: "#C6A75E" }}>Pay</span>
      </h1>
      <p className="text-sm text-white/70 truncate mx-3 min-w-0 hidden sm:block">
        Welcome back, <span className="font-semibold text-white">{displayName}</span>
      </p>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate("/activity")}
          className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
        >
          <Bell className="w-5 h-5 text-white/80" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: "#C6A75E" }} />
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <User className="w-4 h-4 text-white" />
          )}
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
