import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ImageIcon, Shield, User as UserIcon, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ApiService } from "@/services/ApiService";

const groupTypes = ["Travel", "Home", "Business", "Other"];

const backgroundOptions = [
  "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=200&fit=crop",
];

const NewGroupPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  const currentUser = {
    id: authUser?.id || "",
    name: authUser?.name || "You",
    avatar: authUser?.avatar || "?",
  };

  const [step, setStep] = useState(1);
  const [friends, setFriends] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    members: [currentUser.id] as string[],
    roles: { [currentUser.id]: "admin" } as Record<string, "admin" | "member">,
    backgroundImage: backgroundOptions[0],
  });

  // Fetch friends list
  useEffect(() => {
    if (authUser?.id) {
      ApiService.get(`/api/friends/user/${authUser.id}`)
        .then((res: any) => setFriends(res || []))
        .catch(console.error);
    }
  }, [authUser]);

  const toggleMember = (friendId: string) => {
    setForm(prev => {
      const members = prev.members.includes(friendId)
        ? prev.members.filter(id => id !== friendId)
        : [...prev.members, friendId];
      const roles = { ...prev.roles };
      if (!prev.members.includes(friendId)) roles[friendId] = "member";
      else delete roles[friendId];
      return { ...prev, members, roles };
    });
  };

  const toggleRole = (userId: string) => {
    if (userId === currentUser.id) return;
    setForm(prev => ({
      ...prev,
      roles: { ...prev.roles, [userId]: prev.roles[userId] === "admin" ? "member" : "admin" },
    }));
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)} className="p-1 rounded-full hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold text-foreground">New Group</h2>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 h-1 rounded-full transition-all duration-500 ${step >= s ? "bg-primary" : "bg-muted"}`} />
        ))}
      </div>

      {step === 1 && (
        <Card className="p-5 rounded-2xl border-0 shadow-md space-y-4">
          <div className="space-y-2">
            <Label>Group Name</Label>
            <Input placeholder="e.g. Goa Trip" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder="What's this group for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-xl resize-none" rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>{groupTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="rounded-xl" />
            </div>
          </div>
          <Button onClick={() => setStep(2)} disabled={!form.name} className="w-full rounded-xl">Next</Button>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-5 rounded-2xl border-0 shadow-md space-y-4">
          <h3 className="font-semibold text-foreground">Choose Background</h3>
          <div className="grid grid-cols-3 gap-2">
            {backgroundOptions.map(url => (
              <button
                key={url}
                onClick={() => setForm({ ...form, backgroundImage: url })}
                className={cn(
                  "h-16 rounded-xl bg-cover bg-center border-2 transition-all",
                  form.backgroundImage === url ? "border-primary ring-2 ring-primary/30" : "border-transparent"
                )}
                style={{ backgroundImage: `url(${url})` }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 rounded-lg bg-muted/50">
            <ImageIcon className="w-4 h-4" />
            <span>Custom upload coming soon</span>
          </div>
          <Button onClick={() => setStep(3)} className="w-full rounded-xl">Next</Button>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-5 rounded-2xl border-0 shadow-md space-y-4">
          <h3 className="font-semibold text-foreground">Add Members & Assign Roles</h3>
          <p className="text-xs text-muted-foreground">Select friends to add to this group. Tap their role badge to toggle admin/member.</p>
          <div className="space-y-2">
            {/* Current user always included */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border border-primary">
              {currentUser.avatar?.startsWith("http") ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{currentUser.avatar}</div>
              )}
              <span className="text-sm font-medium text-foreground flex-1">{currentUser.name} (You)</span>
              <Badge className="bg-primary/20 text-primary border-0 text-[10px]">
                <Shield className="w-3 h-3 mr-0.5" /> Admin
              </Badge>
            </div>

            {/* Friends list */}
            {friends.length === 0 && (
              <div className="text-center py-4 space-y-2">
                <p className="text-sm text-muted-foreground">No friends yet.</p>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => navigate("/friends")}>
                  <Plus className="w-4 h-4 mr-1" /> Add Friends First
                </Button>
              </div>
            )}
            {friends.map(friend => {
              const selected = form.members.includes(friend.friendId);
              const role = form.roles[friend.friendId] || "member";
              const name = friend.displayName || friend.username || friend.friendId.substring(0, 8);
              const isImgAvatar = friend.avatar?.startsWith("http");
              return (
                <div
                  key={friend.friendId}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-colors cursor-pointer",
                    selected ? "bg-primary/5 border border-primary/30" : "bg-muted/50 hover:bg-muted"
                  )}
                  onClick={() => toggleMember(friend.friendId)}
                >
                  {isImgAvatar ? (
                    <img src={friend.avatar} alt={name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium text-foreground flex-1">{name}</span>
                  {selected && (
                    <button onClick={(e) => { e.stopPropagation(); toggleRole(friend.friendId); }}>
                      <Badge className={cn(
                        "border-0 text-[10px] cursor-pointer",
                        role === "admin" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {role === "admin" ? <><Shield className="w-3 h-3 mr-0.5" /> Admin</> : <><UserIcon className="w-3 h-3 mr-0.5" /> Member</>}
                      </Badge>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <Button onClick={async () => {
            try {
              if (!authUser?.id) throw new Error("Not logged in");

              const payload = {
                groupName: form.name,
                description: form.description,
                groupType: form.type.toLowerCase() || "other",
                backgroundImage: form.backgroundImage,
                createdBy: authUser.id,
                memberIds: form.members
              };

              await ApiService.post('/api/groups', payload);
              toast({ title: "Group Created!", description: `${form.name} with ${form.members.length} members` });
              navigate("/groups");
            } catch (err: any) {
              toast({ variant: "destructive", title: "Error", description: err.message });
            }
          }} className="w-full rounded-xl">
            Create Group
          </Button>
        </Card>
      )}
    </div>
  );
};

export default NewGroupPage;
