import { useState, useEffect, useCallback } from "react";
import { Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UndoAction {
  id: string;
  message: string;
  onUndo: () => void;
}

let addUndoAction: ((action: UndoAction) => void) | null = null;

export function triggerUndo(message: string, onUndo: () => void) {
  const id = `undo-${Date.now()}`;
  addUndoAction?.({ id, message, onUndo });
}

const UndoSnackbar = () => {
  const [actions, setActions] = useState<UndoAction[]>([]);

  useEffect(() => {
    addUndoAction = (action) => {
      setActions(prev => [...prev, action]);
      setTimeout(() => {
        setActions(prev => prev.filter(a => a.id !== action.id));
      }, 6000);
    };
    return () => { addUndoAction = null; };
  }, []);

  const handleUndo = useCallback((action: UndoAction) => {
    action.onUndo();
    setActions(prev => prev.filter(a => a.id !== action.id));
  }, []);

  const dismiss = useCallback((id: string) => {
    setActions(prev => prev.filter(a => a.id !== id));
  }, []);

  if (actions.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] w-[90%] max-w-md space-y-2">
      {actions.map(action => (
        <div
          key={action.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg bg-foreground text-background animate-fade-in"
        >
          <p className="text-sm font-medium flex-1">{action.message}</p>
          <button
            onClick={() => handleUndo(action)}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-background/20 hover:bg-background/30 text-sm font-semibold transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" /> Undo
          </button>
          <button onClick={() => dismiss(action.id)} className="p-1 rounded-full hover:bg-background/20">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default UndoSnackbar;
