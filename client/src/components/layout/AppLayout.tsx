import { Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";
import { SmsService } from "@/services/SmsService";
import UpiDetectedDialog from "@/components/UpiDetectedDialog";

const AppLayout = () => {
  useEffect(() => {
    SmsService.initialize();

    return () => {
      SmsService.cleanup();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative">
      <AppHeader />
      <main className="pt-[calc(env(safe-area-inset-top,24px)+4rem)] pb-[calc(env(safe-area-inset-bottom,20px)+6rem)] px-4">
        <Outlet />
      </main>
      <BottomNav />
      <UpiDetectedDialog />
    </div>
  );
};

export default AppLayout;
