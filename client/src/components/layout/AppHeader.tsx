import { Bell, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useEffect } from "react";

const AppHeader = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { darkMode } = useTheme();

  const displayName = user?.name?.split(" ")[0] || "User";
  const avatarUrl = (user?.avatar?.startsWith("http") || user?.avatar?.startsWith("data:")) ? user.avatar : null;

  // Sync native Android/iOS status bar style with the app theme.
  // Style.Dark = dark icons (grey clock/battery) on a light header.
  // Style.Light = light icons (white clock/battery) on a dark header.
  useEffect(() => {
    const syncStatusBar = async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        if (darkMode) {
          await StatusBar.setStyle({ style: Style.Dark });          // white icons
          await StatusBar.setBackgroundColor({ color: "#003F66" }); // dark navy bg
        } else {
          await StatusBar.setStyle({ style: Style.Light });         // dark/grey icons
          await StatusBar.setBackgroundColor({ color: "#ffffff" }); // white bg
        }
      } catch {
        // Not running inside Capacitor (web browser) — silently ignore
      }
    };
    syncStatusBar();
  }, [darkMode]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,24px)+12px)] pb-3 backdrop-blur-lg max-w-full overflow-hidden transition-colors duration-300"
      style={{
        backgroundColor: darkMode ? "#003F66" : "#ffffff",
        borderBottom: darkMode ? "1px solid rgba(255,255,255,0.10)" : "1px solid rgba(0,0,0,0.08)",
      }}
    >
      <h1
        className="text-xl font-bold cursor-pointer tracking-tight shrink-0"
        style={{ color: darkMode ? "#ffffff" : "#1a1a2e" }}
        onClick={() => navigate("/")}
      >
        Fair<span style={{ color: "#C6A75E" }}>Pay</span>
      </h1>
      <p
        className="text-sm truncate mx-3 min-w-0 hidden sm:block"
        style={{ color: darkMode ? "rgba(255,255,255,0.70)" : "rgba(0,0,0,0.50)" }}
      >
        Welcome back,{" "}
        <span
          className="font-semibold"
          style={{ color: darkMode ? "#ffffff" : "#1a1a2e" }}
        >
          {displayName}
        </span>
      </p>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate("/activity")}
          className="relative p-2 rounded-full transition-colors"
          style={{ background: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }}
        >
          <Bell
            className="w-5 h-5"
            style={{ color: darkMode ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.55)" }}
          />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: "#C6A75E" }}
          />
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden"
          style={{ background: darkMode ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.08)" }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <User
              className="w-4 h-4"
              style={{ color: darkMode ? "#ffffff" : "rgba(0,0,0,0.55)" }}
            />
          )}
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
