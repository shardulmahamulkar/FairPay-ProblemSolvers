
const BASE_URL = "http://localhost:3000/api/groups";

async function testRoutes() {
  console.log("Testing Group Routes...");

  // 1. Create a group (Mocking some IDs)
  const mockUserId = "65dae3d82d5d6d3cbd3c3c4d"; // Random valid ObjectId
  let createRes;
  try {
    createRes = await fetch(`${BASE_URL}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupName: "Test Group",
        groupType: "trip",
        description: "A test group",
        createdBy: mockUserId,
        memberIds: [mockUserId]
      })
    });
  } catch (err) {
    console.error("Fetch failed:", err);
    return;
  }
  
  console.log("Create Group Status:", createRes.status);
  const responseText = await createRes.text();
  console.log("Create Group Raw Response:", responseText);

  let createdGroup: any;
  try {
    createdGroup = JSON.parse(responseText);
  } catch (e) {
    console.error("Failed to parse JSON:", e);
    return;
  }

  if (createdGroup._id) {
    // 2. List groups for user
    const listRes = await fetch(`${BASE_URL}/user/${mockUserId}`);
    const groups = await listRes.json();
    console.log("List Groups Response:", JSON.stringify(groups, null, 2));

    // 3. Add member
    const anotherUser = "65dae3d82d5d6d3cbd3c3c4e";
    const addRes = await fetch(`${BASE_URL}/add-member`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: createdGroup._id,
        userId: anotherUser
      })
    });
    console.log("Add Member Response:", await addRes.json());
  }
}

testRoutes().catch(console.error);
