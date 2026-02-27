import { Outlet } from "react-router-dom";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";

const AppLayout = () => {
  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative">
      <AppHeader />
      <main className="pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)] px-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
