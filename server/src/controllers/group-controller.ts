import { GroupService } from "../services/group-services";

export const GroupController = {
  create: async ({ body }: { body: any }) => {
    return GroupService.createGroup(body);
  },

  list: async ({ params }: { params: { userId: string } }) => {
    return GroupService.getUserGroups(params.userId);
  },

  addMember: async ({ body }: { body: any }) => {
    const { groupId, userId } = body;
    return GroupService.addMember(groupId, userId);
  },

  archive: async ({ body }: { body: any }) => {
    const { groupId } = body;
    return GroupService.archiveGroup(groupId);
  },
};

//What Controllers Do (In General)
// In modern web development (often following the MVC or Layered Architecture pattern), a controller has a very specific, limited job:

// Receive the Request: It listens for incoming HTTP requests (like GET, POST, PUT, DELETE) from the user's browser or mobile app.

// Extract Data: It pulls out the necessary information from the request, such as URL parameters (req.params) or the data payload (req.body).

// Delegate: It passes that extracted data to the Service layer (in your case, GroupService), which handles the heavy lifting, database queries, and complex rules.

// Return a Response: Once the Service layer finishes its job, the controller sends the result back to the user.

// By separating the Controller from the Service, your code becomes much easier to test, read, and maintain.
