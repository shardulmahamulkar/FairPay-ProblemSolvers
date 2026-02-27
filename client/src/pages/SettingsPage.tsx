import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";

const currencies = ["INR", "USD", "EUR", "GBP"];

const SettingsPage = () => {
  const navigate = useNavigate();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { defaultCurrency, setDefaultCurrency } = useCurrency();

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-foreground">Settings</h2>
      </div>

      <Card className="p-5 rounded-2xl border-0 shadow-md space-y-4">
        <div className="space-y-2">
          <Label>Default Currency</Label>
          <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <Label>Push Notifications</Label>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <Label>Email Notifications</Label>
          <Switch />
        </div>
        <div className="flex items-center justify-between">
          <Label>Settlement Reminders</Label>
          <Switch defaultChecked />
        </div>
      </Card>

      <Button variant="destructive" className="w-full rounded-xl" onClick={() => setDeleteOpen(true)}>
        Delete Account & Data
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-owed"><AlertTriangle className="w-5 h-5" /> Delete Everything</DialogTitle>
            <DialogDescription>This will permanently delete your account and all associated data. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={() => { setDeleteOpen(false); navigate("/onboarding"); }} className="rounded-xl">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
