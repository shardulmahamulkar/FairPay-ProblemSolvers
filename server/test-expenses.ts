import { connectDB } from "./src/db/connect";
import { User } from "./src/models/User";
import { GroupService } from "./src/services/group-services";
import { ExpenseService } from "./src/services/expense-services";
import { Types } from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Register models
import "./src/models/User";
import "./src/models/Group";
import "./src/models/Expense";
import "./src/models/OwedBorrow";
import "./src/models/Stats";

async function testExpenses() {
    console.log("Connecting database...");
    await connectDB();

    try {
        console.log("\n1. Creating dummy users...");
        const user1 = await User.create({ authId: "u1-" + Date.now(), username: "Alice", email: "alice@test.com" });
        const user2 = await User.create({ authId: "u2-" + Date.now(), username: "Bob", email: "bob@test.com" });
        const user3 = await User.create({ authId: "u3-" + Date.now(), username: "Charlie", email: "charlie@test.com" });

        console.log("\n2. Creating a group (Trip: Goa)...");
        const group = await GroupService.createGroup({
            groupName: "Goa Trip",
            groupType: "trip",
            createdBy: user1._id.toString(),
            memberIds: [user1._id.toString(), user2._id.toString(), user3._id.toString()]
        });
        console.log(`✅ Group Created: ${group.groupName} (ID: ${group._id})`);

        let stats = await ExpenseService.getGroupStats(group._id.toString());
        console.log(`✅ Stats Initialized: Spent = ${stats?.spent}, Money Left = ${stats?.moneyLeft}`);

        console.log("\n3. Alice pays ₹3000 for dinner. (Alice: ₹1000, Bob: ₹1000, Charlie: ₹1000)...");
        await ExpenseService.createExpense({
            groupId: group._id.toString(),
            userId: user1._id.toString(), // Alice pays
            expenseNote: "Dinner at Taj",
            amount: 3000,
            participatorsInvolved: [
                { userId: user1._id.toString(), amount: 1000 },
                { userId: user2._id.toString(), amount: 1000 },
                { userId: user3._id.toString(), amount: 1000 }
            ]
        });

        stats = await ExpenseService.getGroupStats(group._id.toString());
        console.log(`✅ Stats Updated: Spent = ${stats?.spent}, Money Left = ${stats?.moneyLeft}`);

        let balances = await ExpenseService.getGroupBalances(group._id.toString());
        console.log("✅ Current Balances:");
        balances.forEach(b => {
            const payer = b.payerId as any;
            const payee = b.payeeId as any;
            console.log(`  - ${payer.username} owes ${payee.username}: ₹${b.amount}`);
        });

        console.log("\n4. Bob pays ₹600 for snacks. (Bob: ₹300, Alice: ₹300)...");
        await ExpenseService.createExpense({
            groupId: group._id.toString(),
            userId: user2._id.toString(), // Bob pays
            expenseNote: "Snacks",
            amount: 600,
            participatorsInvolved: [
                { userId: user1._id.toString(), amount: 300 }, // Alice owes Bob 300
                { userId: user2._id.toString(), amount: 300 }  // Bob ate 300 worth
            ]
        });

        stats = await ExpenseService.getGroupStats(group._id.toString());
        console.log(`✅ Stats Updated: Spent = ${stats?.spent}, Money Left = ${stats?.moneyLeft}`);

        balances = await ExpenseService.getGroupBalances(group._id.toString());
        console.log("✅ Final Balances after Bob's payment:");
        balances.forEach(b => {
            const payer = b.payerId as any;
            const payee = b.payeeId as any;
            if (b.amount > 0) {
                console.log(`  - ${payer.username} owes ${payee.username}: ₹${b.amount}`);
            }
        });

    } catch (error) {
        console.error("Test failed:", error);
    }

    process.exit(0);
}

testExpenses();
