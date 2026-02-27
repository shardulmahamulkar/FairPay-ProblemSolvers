import { useNavigate } from "react-router-dom";
import { Mail, Star, HelpCircle, Bug, Moon, LogOut, Trash2, ChevronRight, Shield, Edit, Settings, Camera } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { Friend } from "@/types";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AuthService } from "@/services/AuthService";
import { useTheme } from "@/contexts/ThemeContext";

const friends: Friend[] = [];

const ProfilePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout, updateProfile } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const [editOpen, setEditOpen] = useState(false);
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Edit form state — email is read-only (managed by Firebase Auth, not editable here)
  const [editName, setEditName] = useState(user?.name || "");
  const [editUsername, setEditUsername] = useState(user?.username || "");
  const [editAvatar, setEditAvatar] = useState(user?.avatar || "");

  const hasUnsettled = friends.some(f => f.owedAmount !== 0);

  const openEdit = () => {
    setEditName(user?.name || "");
    setEditUsername(user?.username || "");
    setEditAvatar(user?.avatar || "");
    setEditOpen(true);
  };

  const handleSaveProfile = () => {
    setEditOpen(false);
    setTwoFAOpen(true);
  };

  const handleVerify = async () => {
    try {
      await updateProfile({
        name: editName,
        username: editUsername,
        avatar: editAvatar.trim() || editName.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase(),
      });
      setTwoFAOpen(false);
      toast({ title: "Profile Updated", description: "Your profile has been updated" });
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message || "Could not update profile.", variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const menuItems = [
    { icon: Edit, label: "Edit Profile", action: openEdit },
    { icon: Settings, label: "Settings", action: () => navigate("/settings") },
    { icon: Star, label: "Rate Us", action: () => toast({ title: "Thanks!", description: "Redirecting to app store" }) },
    { icon: HelpCircle, label: "Help / FAQ", action: () => toast({ title: "Help", description: "Opening help center" }) },
    { icon: Bug, label: "Bug Report", action: () => toast({ title: "Report", description: "Bug report submitted" }) },
  ];

  return (
    <div className="space-y-5 animate-fade-in pt-4">
      <Card className="p-6 rounded-2xl border-0 shadow-md text-center" style={{ background: "linear-gradient(135deg, #1E2A44, #3A4F6E)" }}>
        {(user?.avatar?.startsWith("http") || user?.avatar?.startsWith("data:")) ? (
          <img src={user.avatar} alt="Profile" className="w-20 h-20 rounded-full object-cover mx-auto mb-3 shadow-lg" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-white mx-auto flex items-center justify-center mb-3 shadow-lg">
            <span className="text-2xl font-bold text-primary">
              {user?.name?.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() || "?"}
            </span>
          </div>
        )}
        <h2 className="text-lg font-bold text-white">{user?.name || "User"}</h2>
        <p className="text-sm text-white/70">@{user?.username || "user"}</p>
        <div className="mt-4 space-y-2 text-left">
          <div className="flex items-center gap-3 text-sm text-white/80">
            <Mail className="w-4 h-4" /> {user?.email || "—"}
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md overflow-hidden divide-y divide-border">
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-4 h-4 text-[#C6A75E]" />
              <span className="text-sm font-medium text-foreground">{item.label}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Moon className="w-4 h-4 text-[#C6A75E]" />
            <span className="text-sm font-medium text-foreground">Dark Mode</span>
          </div>
          <Switch checked={darkMode} onCheckedChange={toggleDarkMode} />
        </div>
      </Card>

      <Card className="rounded-2xl border-0 shadow-md overflow-hidden divide-y divide-border">
        <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors">
          <LogOut className="w-4 h-4 text-[#C6A75E]" />
          <span className="text-sm font-medium text-foreground">Logout</span>
        </button>
        <button onClick={() => setDeleteOpen(true)} className="w-full flex items-center gap-3 p-4 hover:bg-destructive/5 transition-colors">
          <Trash2 className="w-4 h-4 text-owed" />
          <span className="text-sm font-medium text-owed">Delete Account</span>
        </button>
      </Card>

      {/* Edit Profile Dialog — name and username only; email is not editable */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={editName} onChange={e => setEditName(e.target.value)} className="rounded-xl" /></div>
            <div className="space-y-1"><Label>Username</Label><Input value={editUsername} onChange={e => setEditUsername(e.target.value)} className="rounded-xl" /></div>
            <div className="space-y-1">
              <Label>Profile Picture</Label>
              <div className="flex flex-col items-center gap-3">
                {(editAvatar?.startsWith("http") || editAvatar?.startsWith("data:")) ? (
                  <img src={editAvatar} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-border shadow-sm" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                    <Camera className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors">
                  <Camera className="w-4 h-4" />
                  Choose Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        toast({ variant: "destructive", title: "Too large", description: "Please pick an image under 2MB." });
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setEditAvatar(reader.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
                {editAvatar && (
                  <button onClick={() => setEditAvatar("")} className="text-xs text-muted-foreground hover:text-owed transition-colors">Remove photo</button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1">
                Email
                <span className="text-xs text-muted-foreground font-normal">(cannot be changed here)</span>
              </Label>
              <Input value={user?.email || ""} disabled className="rounded-xl opacity-60 cursor-not-allowed" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveProfile} className="w-full rounded-xl">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={twoFAOpen} onOpenChange={setTwoFAOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Confirm Changes</DialogTitle>
            <DialogDescription>Please confirm you want to save these profile changes.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTwoFAOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleVerify} className="rounded-xl">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-owed"><Trash2 className="w-5 h-5" /> Delete Account</DialogTitle>
            <DialogDescription>
              {hasUnsettled
                ? "You have unsettled balances with friends. Please settle all dues before deleting your account."
                : "Are you sure? This will permanently delete your account and all data. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="rounded-xl">Cancel</Button>
            {!hasUnsettled && (
              <Button
                variant="destructive"
                onClick={async () => {
                  setDeleteOpen(false);
                  try {
                    const fbUser = AuthService.getCurrentUser();
                    if (fbUser) await AuthService.deleteAccount(fbUser);
                    await logout();
                    navigate("/onboarding");
                  } catch (e: any) {
                    toast({ title: "Delete failed", description: e.message || "Please re-login and try again.", variant: "destructive" });
                  }
                }}
                className="rounded-xl"
              >
                Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProfilePage;
