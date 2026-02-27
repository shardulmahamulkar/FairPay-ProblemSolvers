import { useState, useEffect } from "react";
import { Plus, Search, MoreVertical, UserPlus, Send, Edit, X, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ApiService } from "@/services/ApiService";
import { getCurrencySymbol } from "@/lib/currency";
import { convertAllToBase } from "@/services/exchangeRate";

const FriendsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState<any[]>([]);
  const [friendRequests, setFriendRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [friendBalances, setFriendBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [editNickname, setEditNickname] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");

  // Add friend form
  const [addQuery, setAddQuery] = useState("");
  const [addMethod, setAddMethod] = useState<"email" | "username" | "phone">("email");
  const [adding, setAdding] = useState(false);

  const fetchFriends = async () => {
    if (!user?.id) return;
    try {
      const res = await ApiService.get(`/api/friends/user/${user.id}`);
      setFriends(res as any[] || []);
    } catch (err) {
      console.error("Friends fetch error:", err);
    }
    try {
      const reqRes = await ApiService.get(`/api/friends/requests/${user.id}`);
      setFriendRequests(reqRes as any[] || []);
    } catch (err) {
      console.warn("Requests fetch error (may not be deployed yet):", err);
    }
    // Fetch outgoing sent requests
    try {
      const sentRes = await ApiService.get(`/api/friends/sent/${user.id}`);
      setSentRequests(sentRes as any[] || []);
    } catch (err) {
      console.warn("Sent requests fetch error:", err);
    }
    // Fetch summary to compute converted per-friend balances
    try {
      const summaryRes: any = await ApiService.get(`/api/expenses/summary/${user.id}`);
      const owedDocs = summaryRes.owedDocs || [];
      const receivableDocs = summaryRes.receivableDocs || [];
      const convertedOwed = await convertAllToBase(
        owedDocs.map((d: any) => ({ amount: d.amount, currency: d.currency || "INR" }))
      );
      const convertedReceivable = await convertAllToBase(
        receivableDocs.map((d: any) => ({ amount: d.amount, currency: d.currency || "INR" }))
      );
      const balMap: Record<string, number> = {};
      receivableDocs.forEach((d: any, i: number) => {
        balMap[d.payerId] = (balMap[d.payerId] || 0) + convertedReceivable[i].convertedAmount;
      });
      owedDocs.forEach((d: any, i: number) => {
        balMap[d.payeeId] = (balMap[d.payeeId] || 0) - convertedOwed[i].convertedAmount;
      });
      setFriendBalances(balMap);
    } catch (err) {
      console.error("Summary fetch error:", err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchFriends(); }, [user]);

  const filteredFriends = friends.filter((f) => {
    const name = f.displayName || f.username || "";
    const nick = f.nickname || "";
    return name.toLowerCase().includes(search.toLowerCase()) || nick.toLowerCase().includes(search.toLowerCase());
  });

  const handleAddFriend = async () => {
    if (!user?.id || !addQuery.trim()) return;
    setAdding(true);
    try {
      const payload: any = { userId: user.id };
      if (addMethod === "email") payload.email = addQuery.trim();
      else if (addMethod === "username") payload.username = addQuery.trim().replace("@", "");
      else payload.phone = addQuery.trim();

      const result: any = await ApiService.post("/api/friends/add", payload);
      if (result.autoAccepted) {
        toast({ title: "Friends!", description: `You both sent requests — now friends!` });
      } else {
        toast({ title: "Request Sent!", description: `Friend request sent successfully.` });
      }
      setAddOpen(false);
      setAddQuery("");
      fetchFriends();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setAdding(false);
    }
  };

  const handleAcceptRequest = async (senderId: string) => {
    try {
      await ApiService.post("/api/friends/accept", { userId: user?.id, senderId });
      toast({ title: "Friend Added!", description: "Friend request accepted." });
      fetchFriends();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleRejectRequest = async (senderId: string) => {
    try {
      await ApiService.post("/api/friends/reject", { userId: user?.id, senderId });
      toast({ title: "Declined", description: "Friend request declined." });
      fetchFriends();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleCancelRequest = async (recipientId: string) => {
    try {
      await ApiService.post("/api/friends/cancel", { userId: user?.id, recipientId });
      toast({ title: "Cancelled", description: "Friend request cancelled." });
      fetchFriends();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleModify = async () => {
    if (!user?.id || !selectedFriend) return;
    try {
      await ApiService.put("/api/friends/update", {
        userId: user.id,
        friendId: selectedFriend.friendId,
        nickname: editNickname,
        displayName: editDisplayName,
      });
      toast({ title: "Friend Updated" });
      setModifyOpen(false);
      fetchFriends();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleDelete = async (friendId: string, name: string) => {
    if (!user?.id) return;
    try {
      await ApiService.delete(`/api/friends/remove?userId=${user.id}&friendId=${friendId}`);
      toast({ title: "Removed", description: `${name} removed from friends` });
      fetchFriends();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const openModify = (friend: any) => {
    setSelectedFriend(friend);
    setEditNickname(friend.nickname || "");
    setEditDisplayName(friend.displayName || "");
    setModifyOpen(true);
  };

  if (loading) return <p className="p-4 text-muted-foreground">Loading friends...</p>;

  return (
    <div className="space-y-5 animate-fade-in pt-4">
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-xl font-bold text-foreground">Friends</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setInviteOpen(true)}>
            <Send className="w-4 h-4 mr-1" /> Invite
          </Button>
          <Button size="sm" className="rounded-xl" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search friends..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl border-0 bg-card shadow-sm"
        />
      </div>

      {/* Friend Requests section */}
      {friendRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            Friend Requests
            <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5">{friendRequests.length}</span>
          </h3>
          {friendRequests.map((req) => (
            <Card key={req._id} className="flex items-center justify-between p-3 rounded-xl border-0 shadow-sm">
              <div className="flex items-center gap-3">
                {req.avatar?.startsWith("http") ? (
                  <img src={req.avatar} alt={req.username} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {(req.username || "??").substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{req.username || req.senderId.substring(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{req.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleAcceptRequest(req.senderId)} className="rounded-xl h-8 px-3 text-xs bg-receive hover:bg-receive/90 text-white">Accept</Button>
                <Button size="sm" variant="outline" onClick={() => handleRejectRequest(req.senderId)} className="rounded-xl h-8 px-3 text-xs text-owed border-owed/30">Decline</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {filteredFriends.map((friend) => {
          const name = friend.displayName || friend.username || friend.friendId.substring(0, 8);
          const isImgAvatar = friend.avatar?.startsWith("http");
          return (
            <Card key={friend._id} className="flex items-center justify-between p-3 rounded-xl border-0 shadow-sm">
              <div className="flex items-center gap-3">
                {isImgAvatar ? (
                  <img src={friend.avatar} alt={name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {friend.email || friend.username}{friend.nickname ? ` · "${friend.nickname}"` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const bal = friendBalances[friend.friendId] ?? friend.owedAmount;
                  return (
                    <p className={cn("text-sm font-semibold", bal > 0 ? "text-receive" : bal < 0 ? "text-owed" : "text-muted-foreground")}>
                      {bal > 0 ? "+" : ""}
                      {bal !== 0 ? `${getCurrencySymbol()}${Math.abs(Math.round(bal * 100) / 100).toLocaleString()}` : "settled"}
                    </p>
                  );
                })()}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded-full hover:bg-muted">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem onClick={() => openModify(friend)}>
                      <Edit className="w-4 h-4 mr-2" /> Modify
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-owed" onClick={() => handleDelete(friend.friendId, name)}>
                      <X className="w-4 h-4 mr-2" /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          );
        })}
        {filteredFriends.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            {friends.length === 0 ? "No friends yet. Add one!" : "No friends match your search"}
          </p>
        )}
      </div>

      {/* Sent Pending Requests */}
      {sentRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Pending Sent Requests
            <span className="bg-muted text-muted-foreground text-[10px] font-bold rounded-full px-1.5 py-0.5">{sentRequests.length}</span>
          </h3>
          {sentRequests.map((req) => (
            <Card key={req._id} className="flex items-center justify-between p-3 rounded-xl border-0 shadow-sm">
              <div className="flex items-center gap-3">
                {req.avatar?.startsWith("http") ? (
                  <img src={req.avatar} alt={req.username} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {(req.username || "??").substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{req.username || req.recipientId.substring(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{req.email}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleCancelRequest(req.recipientId)} className="rounded-xl h-8 px-3 text-xs text-owed border-owed/30">
                Cancel
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Modify Friend Dialog */}
      <Dialog open={modifyOpen} onOpenChange={setModifyOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary" /> Modify Friend
            </DialogTitle>
          </DialogHeader>
          {selectedFriend && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                {selectedFriend.avatar?.startsWith("http") ? (
                  <img src={selectedFriend.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                    {(selectedFriend.displayName || "U").substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedFriend.displayName}</p>
                  <p className="text-xs text-muted-foreground">{selectedFriend.email}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Custom display name"
                  className="rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">Override how this friend's name appears to you</p>
              </div>
              <div className="space-y-2">
                <Label>Nickname</Label>
                <Input
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  placeholder='e.g. Bestie, Roomie'
                  className="rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">A personal tag shown next to their name</p>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setModifyOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
            <Button onClick={handleModify} className="flex-1 rounded-xl">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Friend Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Add Friend</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="email" onValueChange={(v) => { setAddMethod(v as any); setAddQuery(""); }}>
            <TabsList className="w-full rounded-xl">
              <TabsTrigger value="email" className="flex-1 rounded-lg text-xs">Email</TabsTrigger>
              <TabsTrigger value="username" className="flex-1 rounded-lg text-xs">Username</TabsTrigger>
              <TabsTrigger value="phone" className="flex-1 rounded-lg text-xs">Phone</TabsTrigger>
            </TabsList>
            <TabsContent value="email" className="space-y-3 mt-3">
              <Input placeholder="friend@example.com" value={addQuery} onChange={(e) => setAddQuery(e.target.value)} className="rounded-xl" />
            </TabsContent>
            <TabsContent value="username" className="space-y-3 mt-3">
              <Input placeholder="@username" value={addQuery} onChange={(e) => setAddQuery(e.target.value)} className="rounded-xl" />
            </TabsContent>
            <TabsContent value="phone" className="space-y-3 mt-3">
              <Input placeholder="+91 98765 43210" value={addQuery} onChange={(e) => setAddQuery(e.target.value)} className="rounded-xl" />
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button onClick={handleAddFriend} className="w-full rounded-xl" disabled={adding || !addQuery.trim()}>
              {adding ? "Adding..." : "Add Friend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Friend Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite to FairPay</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Phone or Email" className="rounded-xl" />
            <p className="text-xs text-muted-foreground">An invite link will be sent with a download link to FairPay.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => { setInviteOpen(false); toast({ title: "Invite Sent", description: "SMS/Email invite sent" }); }} className="w-full rounded-xl">
              <Send className="w-4 h-4 mr-1" /> Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FriendsPage;
