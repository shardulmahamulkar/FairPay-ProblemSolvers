import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCurrencySymbol } from "@/lib/currency";
import { SmsService, QueuedPayment } from "@/services/SmsService";

const UpiDetectedDialog = () => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [payment, setPayment] = useState<QueuedPayment | null>(null);
    const [queueSize, setQueueSize] = useState(0);

    const checkQueue = () => {
        const queue = SmsService.getQueue();
        setQueueSize(queue.length);
        if (queue.length > 0) {
            setPayment(queue[0]);
            setOpen(true);
        } else {
            setOpen(false);
            setPayment(null);
        }
    };

    useEffect(() => {
        // Check queue on mount
        checkQueue();

        const handler = () => {
            checkQueue();
        };

        window.addEventListener('upi_queue_updated', handler);
        return () => window.removeEventListener('upi_queue_updated', handler);
    }, []);

    const handleDismiss = () => {
        SmsService.popQueue();
    };

    const handleAddExpense = () => {
        if (!payment) return;
        const params = new URLSearchParams();
        params.set('amount', String(payment.amount));
        if (payment.payee) params.set('note', `Payment to ${payment.payee}`);

        SmsService.popQueue();
        navigate(`/expenses/new?${params.toString()}`);
    };

    // When the dialog animation finishes closing, if there are more in the queue, it'll instantly pop back open.
    // However, if the user clicked outside or pressed escape to close:
    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            handleDismiss();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="rounded-2xl max-w-sm mx-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        💸 Payment Detected {queueSize > 1 ? `(1 of ${queueSize})` : ''}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                    <div className="text-center">
                        <div className="text-3xl font-bold text-primary">
                            {getCurrencySymbol("INR")}{payment?.amount?.toFixed(2)}
                        </div>
                        {payment?.payee && (
                            <p className="text-sm text-muted-foreground mt-1">
                                To <span className="font-medium text-foreground">{payment.payee}</span>
                            </p>
                        )}
                    </div>
                    <p className="text-sm text-center text-muted-foreground">
                        Was this payment for a trip? Add it as a shared expense.
                    </p>
                </div>
                <DialogFooter className="flex gap-2 sm:flex-row">
                    <Button variant="outline" onClick={handleDismiss} className="flex-1 rounded-xl">
                        Dismiss
                    </Button>
                    <Button onClick={handleAddExpense} className="flex-1 rounded-xl">
                        Add Expense
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default UpiDetectedDialog;
