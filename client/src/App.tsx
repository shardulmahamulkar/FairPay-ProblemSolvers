import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import SnackbarNotifications from "@/components/SnackbarNotifications";
import UndoSnackbar from "@/components/UndoSnackbar";
import HomePage from "@/pages/HomePage";
import GroupsPage from "@/pages/GroupsPage";
import GroupDetailPage from "@/pages/GroupDetailPage";
import NewGroupPage from "@/pages/NewGroupPage";
import NewExpensePage from "@/pages/NewExpensePage";
import FriendsPage from "@/pages/FriendsPage";
import ActivityPage from "@/pages/ActivityPage";
import ProfilePage from "@/pages/ProfilePage";
import SettingsPage from "@/pages/SettingsPage";
import SettleHubPage from "@/pages/SettleHubPage";
import OnboardingPage from "@/pages/OnboardingPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { CapacitorUpdater } from "@capgo/capacitor-updater";
import { Capacitor } from "@capacitor/core";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // OTA Update logic removed for local SMS testing
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <BrowserRouter>
              <UndoSnackbar />
              <Routes>
                {/* Public routes */}
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/login" element={<LoginPage />} />

                {/* Protected routes */}
                <Route element={
                  <ProtectedRoute>
                    <SnackbarNotifications />
                    <AppLayout />
                  </ProtectedRoute>
                }>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/groups" element={<GroupsPage />} />
                  <Route path="/groups/new" element={<NewGroupPage />} />
                  <Route path="/groups/:id" element={<GroupDetailPage />} />
                  <Route path="/expenses/new" element={<NewExpensePage />} />
                  <Route path="/friends" element={<FriendsPage />} />
                  <Route path="/activity" element={<ActivityPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/settle" element={<SettleHubPage />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
