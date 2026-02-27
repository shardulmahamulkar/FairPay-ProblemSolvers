export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  avatar: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  type: "Travel" | "Home" | "Business" | "Other";
  image: string;
  budget: number;
  spent: number;
  members: string[];
  startDate: string;
  endDate?: string;
  archived: boolean;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  paidBy: string;
  splitType: "equal" | "custom";
  splits: { userId: string; amount: number }[];
  category: string;
  date: string;
  status: "pending" | "cleared" | "disputed";
  paymentType: "cash" | "upi" | "debit" | "credit";
}

export interface Friend {
  id: string;
  userId: string;
  nickname?: string;
  owedAmount: number;
}

export interface Transaction {
  id: string;
  expenseId: string;
  groupId: string;
  fromUser: string;
  toUser: string;
  amount: number;
  date: string;
  settled: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  avatar: string;
  upiId?: string;
  isAuthenticated: boolean;
}
