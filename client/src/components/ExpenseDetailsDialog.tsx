import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getCategoryIcon, getCategoryName, getCategoryColor } from "@/lib/categoryIcons";
import { getCurrencySymbol } from "@/lib/currency";
import { Receipt, Calendar, CreditCard, Users, FileText } from "lucide-react";

interface ExpenseDetailsDialogProps {
    expense: any | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    getName: (userId: string) => string;
}

export function ExpenseDetailsDialog({ expense, open, onOpenChange, getName }: ExpenseDetailsDialogProps) {
    if (!expense) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-2xl max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Expense Details
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Details of the selected expense
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center gap-3 py-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden p-2 ${getCategoryColor(expense.category, expense.expenseNote).bg}`}>
                        <img
                            src={getCategoryIcon(expense.category, expense.expenseNote)}
                            alt={expense.category || "expense"}
                            className="w-full h-full object-contain filter invert"
                        />
                    </div>
                    <div className="text-center">
                        <h3 className="text-xl font-bold text-foreground">{expense.expenseNote || "Expense"}</h3>
                        <p className="text-2xl font-black mt-1">{getCurrencySymbol(expense.currency)}{expense.amount?.toLocaleString()}</p>
                    </div>
                </div>

                <div className="space-y-4 bg-muted/30 p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Receipt className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Category</p>
                            <p className="text-sm font-medium">{getCategoryName(expense.category, expense.expenseNote)}</p>
                        </div>
                    </div>

                    {expense.expenseNote && (
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary mt-0.5 mt-0">
                                <FileText className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-muted-foreground">Note</p>
                                <p className="text-sm font-medium break-words leading-tight">{expense.expenseNote}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Users className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Paid by</p>
                            <p className="text-sm font-medium">{getName(expense.userId)}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Date</p>
                            <p className="text-sm font-medium">{new Date(expense.expenseTime).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <CreditCard className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-muted-foreground">Payment Method</p>
                            <p className="text-sm font-medium capitalize">{expense.paymentMethod || "UPI"}</p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
