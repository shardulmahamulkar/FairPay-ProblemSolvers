import { Group } from "../models/Group";

export class GroupService {
  static async createGroup(data: {
    groupName: string;
    groupType?: string;
    description?: string;
    backgroundImage?: string;
    createdBy: string;
    memberIds: string[];
  }) {
    const uniqueMembers = Array.from(new Set(data.memberIds));

    const members = uniqueMembers.map((id) => ({
      userId: id,
      addedAt: new Date(),
    }));

    // Creator should also be a member
    if (!uniqueMembers.includes(data.createdBy)) {
      members.push({
        userId: data.createdBy,
        addedAt: new Date(),
      });
    }

    const group = await Group.create({
      groupName: data.groupName,
      groupType: data.groupType,
      description: data.description,
      backgroundImage: data.backgroundImage,
      createdBy: data.createdBy,
      members,
    });

    // Initialize the stats for the newly created group
    const { Stats } = await import("../models/Stats");
    await Stats.create({
      groupId: group._id,
      budget: 0,
      spent: 0,
      moneyLeft: 0,
    });

    return group;
  }

  // Get groups of a particular user
  static async getUserGroups(userId: string) {
    return Group.find({
      $or: [{ createdBy: userId }, { "members.userId": userId }],
    });
  }

  // Get a single group by ID
  static async getGroupById(groupId: string) {
    const group = await Group.findById(groupId);
    if (!group) throw new Error("Group not found");
    return group;
  }

  // Update group details
  static async updateGroup(groupId: string, updates: {
    groupName?: string;
    description?: string;
    groupType?: string;
    backgroundImage?: string;
    isArchived?: boolean;
  }) {
    const group = await Group.findByIdAndUpdate(
      groupId,
      { $set: updates },
      { new: true }
    );
    if (!group) throw new Error("Group not found");
    return group;
  }

  // Delete group and its stats
  static async deleteGroup(groupId: string) {
    const { Stats } = await import("../models/Stats");
    const { OwedBorrow } = await import("../models/OwedBorrow");
    const { Expense } = await import("../models/Expense");

    await Stats.deleteMany({ groupId });
    await OwedBorrow.deleteMany({ groupId });
    await Expense.deleteMany({ groupId });
    await Group.findByIdAndDelete(groupId);
  }

  // Add a member to the group
  static async addMember(groupId: string, userId: string) {
    const group = await Group.findById(groupId);
    if (!group) throw new Error("Group not found");

    const exists = group.members.some(
      (member) => member.userId === userId,
    );

    if (exists) throw new Error("User already exists in the group");

    group.members.push({
      userId: userId,
      addedAt: new Date(),
    });

    await group.save();
    return group;
  }

  // Remove a member from the group
  static async removeMember(groupId: string, userId: string) {
    const group = await Group.findById(groupId);
    if (!group) throw new Error("Group not found");

    const idx = group.members.findIndex((m) => m.userId === userId);
    if (idx !== -1) group.members.splice(idx, 1);

    await group.save();
    return group;
  }

  // Archive group
  static async archiveGroup(groupId: string) {
    return Group.findByIdAndUpdate(
      groupId,
      { isArchived: true },
      { new: true },
    );
  }
}
