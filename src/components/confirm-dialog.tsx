"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

export type ConfirmField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "select";
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  tone?: "default" | "danger";
  confirmLabel?: string;
  cancelLabel?: string;
  fields?: ConfirmField[];
};

type ConfirmResult = Record<string, string> | null;

type PendingConfirm = ConfirmOptions & {
  resolve: (value: ConfirmResult) => void;
};

const ConfirmContext = createContext<
  ((options: ConfirmOptions) => Promise<ConfirmResult>) | null
>(null);

export function useConfirmDialog() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirmDialog must be used within ConfirmDialogProvider");
  }
  return ctx;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<ConfirmResult>((resolve) => {
      const initial: Record<string, string> = {};
      for (const f of options.fields ?? []) {
        initial[f.name] = f.defaultValue ?? "";
      }
      setValues(initial);
      setPending({ ...options, resolve });
    });
  }, []);

  const close = (result: ConfirmResult) => {
    pending?.resolve(result);
    setPending(null);
  };

  const missingRequired = (pending?.fields ?? []).some(
    (f) => f.required && !values[f.name]?.trim()
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/50 p-4"
          onClick={() => close(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-800 dark:bg-stone-900"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="font-display text-lg font-semibold text-stone-900 dark:text-stone-50">
              {pending.title}
            </h3>
            {pending.message && (
              <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
                {pending.message}
              </p>
            )}
            {(pending.fields ?? []).map((f) => (
              <div key={f.name} className="mt-3">
                <Label htmlFor={f.name}>{f.label}</Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={f.name}
                    rows={3}
                    value={values[f.name] ?? ""}
                    placeholder={f.placeholder}
                    autoFocus
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                  />
                ) : f.type === "select" ? (
                  <Select
                    id={f.name}
                    value={values[f.name] ?? ""}
                    autoFocus
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                  >
                    {(f.options ?? []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id={f.name}
                    value={values[f.name] ?? ""}
                    placeholder={f.placeholder}
                    autoFocus
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !missingRequired) close(values);
                    }}
                  />
                )}
              </div>
            ))}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => close(null)}>
                {pending.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={pending.tone === "danger" ? "danger" : "primary"}
                disabled={missingRequired}
                onClick={() => close(values)}
              >
                {pending.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
