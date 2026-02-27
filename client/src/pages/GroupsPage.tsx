import { useNavigate } from "react-router-dom";
import { Plus, Search, MoreVertical, Archive, Edit, Trash2, Users, ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ApiService } from "@/services/ApiService";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_BG = "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&h=200&fit=crop";

const GroupsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<any[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [userAvatars, setUserAvatars] = useState<Record<string, string>>({});
  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());
  const [massDeleteOpen, setMassDeleteOpen] = useState(false);

  const fetchGroups = () => {
    if (user?.id) {
      ApiService.get(`/api/groups/user/${user.id}`)
        .then(async (res: any) => {
          setGroups(res || []);
          // Resolve member names
          const ids = new Set<string>();
          (res || []).forEach((g: any) => g.members?.forEach((m: any) => ids.add(m.userId)));
          const nameMap: Record<string, string> = {};
          const avatarMap: Record<string, string> = {};
          await Promise.all(
            [...ids].map(async (uid) => {
              if (uid === user?.id) { nameMap[uid] = user.name || "You"; avatarMap[uid] = user.avatar || ""; return; }
              try {
                const u: any = await ApiService.get(`/api/users/${uid}`);
                nameMap[uid] = u.username || uid.substring(0, 8);
                avatarMap[uid] = u.avatar || "";
              } catch { nameMap[uid] = uid.substring(0, 8); }
            })
          );
          setUserNames(nameMap);
          setUserAvatars(avatarMap);
        })
        .catch(console.error);
    }
  };

  useEffect(() => { fetchGroups(); }, [user]);

  const getName = (uid: string) => {
    if (uid === user?.id) return user?.name?.substring(0, 2).toUpperCase() || "YO";
    return (userNames[uid] || uid.substring(0, 2)).substring(0, 2).toUpperCase();
  };

  const handleArchive = async (groupId: string, groupName: string) => {
    try {
      await ApiService.put(`/api/groups/${groupId}`, { isArchived: true });
      toast({ title: "Archived", description: `${groupName} has been archived.` });
      fetchGroups();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupId) return;
    try {
      await ApiService.delete(`/api/groups/${deleteGroupId}`);
      toast({ title: "Deleted", description: "Group deleted successfully." });
      setDeleteGroupId(null);
      setSelectedForDelete(prev => { const s = new Set(prev); s.delete(deleteGroupId); return s; });
      fetchGroups();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const handleMassDelete = async () => {
    try {
      await Promise.all(Array.from(selectedForDelete).map(id => ApiService.delete(`/api/groups/${id}`)));
      toast({ title: "Deleted", description: `${selectedForDelete.size} groups deleted successfully.` });
      setSelectedForDelete(new Set());
      setMassDeleteOpen(false);
      fetchGroups();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  const activeGroups = groups.filter((g: any) => !g.isArchived && g.groupName?.toLowerCase().includes(search.toLowerCase()));
  const archivedGroups = groups.filter((g: any) => g.isArchived && g.groupName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5 animate-fade-in pt-4">
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-xl font-bold text-foreground">Groups</h2>
        <Button onClick={() => navigate("/groups/new")} size="sm" className="rounded-xl">
          <Plus className="w-4 h-4 mr-1" /> New
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl border-0 bg-card shadow-sm"
        />
      </div>

      <div className="space-y-3">
        {activeGroups.map((group) => (
          <Card
            key={group._id}
            onClick={() => navigate(`/groups/${group._id}`)}
            className="rounded-2xl overflow-hidden border-0 shadow-md cursor-pointer hover-scale"
          >
            <div className="h-24 bg-cover bg-center relative" style={{ backgroundImage: `url(${group.backgroundImage || DEFAULT_BG})` }}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end">
                <div>
                  <p className="text-white font-semibold">{group.groupName}</p>
                  <p className="text-white/70 text-xs">{group.description}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30">
                      <MoreVertical className="w-4 h-4 text-white" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/groups/${group._id}`); }}>
                      <Edit className="w-4 h-4 mr-2" /> Open & Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-owed" onClick={(e) => { e.stopPropagation(); handleArchive(group._id, group.groupName); }}>
                      <Archive className="w-4 h-4 mr-2" /> End Trip
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="p-3 flex items-center justify-between">
              <div className="flex -space-x-2">
                {group.members?.slice(0, 4).map((m: any) => {
                  const avatar = userAvatars[m.userId] || (m.userId === user?.id ? user?.avatar : null);
                  return avatar && avatar.startsWith("http") ? (
                    <img key={m.userId} src={avatar} alt="" className="w-7 h-7 rounded-full object-cover border-2 border-card" />
                  ) : (
                    <div key={m.userId} className="w-7 h-7 rounded-full bg-secondary border-2 border-card flex items-center justify-center text-[9px] font-bold text-secondary-foreground">
                      {getName(m.userId)}
                    </div>
                  );
                })}
                {(group.members?.length || 0) > 4 && (
                  <div className="w-7 h-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                    +{group.members.length - 4}
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                  <Users className="w-3 h-3" /> {group.members?.length || 0} members
                </p>
              </div>
            </div>
          </Card>
        ))}
        {activeGroups.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No active groups. Create one!</p>
        )}
      </div>

      {archivedGroups.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setIsArchivedExpanded(!isArchivedExpanded)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Archive className="w-4 h-4 text-muted-foreground" />
              <h3 className="font-semibold text-muted-foreground text-sm">Archived ({archivedGroups.length})</h3>
              {isArchivedExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {selectedForDelete.size > 0 && (
              <Button size="sm" variant="destructive" onClick={() => setMassDeleteOpen(true)} className="h-7 text-xs rounded-xl">
                Delete ({selectedForDelete.size})
              </Button>
            )}
          </div>
          {isArchivedExpanded && (
            <div className="space-y-2">
              {archivedGroups.map((group) => (
                <Card
                  key={group._id}
                  className="p-3 rounded-xl border-0 shadow-sm opacity-60 hover:opacity-100 transition-opacity flex items-center gap-3"
                >
                  <Checkbox
                    checked={selectedForDelete.has(group._id)}
                    onCheckedChange={(checked) => {
                      const newSet = new Set(selectedForDelete);
                      if (checked) newSet.add(group._id);
                      else newSet.delete(group._id);
                      setSelectedForDelete(newSet);
                    }}
                  />
                  <div className="flex-1 cursor-pointer flex items-center justify-between" onClick={() => navigate(`/groups/${group._id}`)}>
                    <div>
                      <p className="font-medium text-sm">{group.groupName}</p>
                      <p className="text-xs text-muted-foreground">{group.groupType} • {group.members?.length} members</p>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteGroupId(group._id); }} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Dialog for single delete */}
      <Dialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-owed" /> Delete Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this group? All expenses and balances will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2">
            <Button variant="outline" onClick={() => setDeleteGroupId(null)} className="rounded-xl w-full">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteGroup} className="rounded-xl w-full">Delete Group</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for mass delete */}
      <Dialog open={massDeleteOpen} onOpenChange={setMassDeleteOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-owed" /> Delete {selectedForDelete.size} Groups</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete {selectedForDelete.size} groups? All expenses and balances will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2">
            <Button variant="outline" onClick={() => setMassDeleteOpen(false)} className="rounded-xl w-full">Cancel</Button>
            <Button variant="destructive" onClick={handleMassDelete} className="rounded-xl w-full">Delete {selectedForDelete.size} Groups</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupsPage;
