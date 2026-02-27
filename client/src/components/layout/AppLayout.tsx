import { Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import AppHeader from "./AppHeader";
import BottomNav from "./BottomNav";
import { SmsService } from "@/services/SmsService";

const AppLayout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize SMS watcher when inside the app
    SmsService.initialize();

    const handleUpiExpense = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { amount, note } = customEvent.detail;

      // Navigate to Add Expense screen with prefilled amount and description
      const searchParams = new URLSearchParams();
      if (amount) searchParams.set('amount', amount);
      if (note) searchParams.set('note', note);

      navigate(`/expenses/new?${searchParams.toString()}`);
    };

    window.addEventListener('new_upi_expense', handleUpiExpense);
    return () => window.removeEventListener('new_upi_expense', handleUpiExpense);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative">
      <AppHeader />
      <main className="pt-[calc(env(safe-area-inset-top,24px)+4rem)] pb-[calc(env(safe-area-inset-bottom,20px)+6rem)] px-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
