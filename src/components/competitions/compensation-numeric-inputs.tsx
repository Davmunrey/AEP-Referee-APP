"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const numericFieldClass = "h-8 font-mono text-xs tabular-nums";

/** Campo numérico entero: editable libremente; guarda al salir o con Enter. */
export function CompensationKmInput({
  valueKm,
  label,
  className,
  onCommit,
}: {
  valueKm: number | null | undefined;
  label: string;
  className?: string;
  onCommit: (km: number | null) => void;
}) {
  const [text, setText] = useState(() => formatKm(valueKm));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setText(formatKm(valueKm));
    }
  }, [valueKm]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === "") {
      setText("");
      if (valueKm != null) onCommit(null);
      return;
    }
    const parsed = Math.max(0, Math.round(Number(trimmed)));
    if (!Number.isFinite(parsed)) {
      setText(formatKm(valueKm));
      return;
    }
    setText(String(parsed));
    if (parsed !== valueKm) onCommit(parsed);
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      placeholder="km"
      className={cn(numericFieldClass, "w-24", className)}
      value={text}
      aria-label={label}
      onFocus={(e) => {
        focusedRef.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onChange={(e) => {
        const next = e.target.value.replace(/\s/g, "");
        if (next === "" || /^\d+$/.test(next)) {
          setText(next);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

/** Importe en euros (montaje, etc.): solo números y coma/punto; guarda al salir. */
export function CompensationEuroInput({
  valueEur,
  label,
  className,
  onCommit,
}: {
  valueEur: number | null | undefined;
  label: string;
  className?: string;
  onCommit: (amount: number | null) => void;
}) {
  const [text, setText] = useState(() => formatEuro(valueEur));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setText(formatEuro(valueEur));
    }
  }, [valueEur]);

  const commit = () => {
    const trimmed = text.trim().replace(",", ".");
    if (trimmed === "") {
      setText("");
      if (valueEur != null && valueEur > 0) onCommit(null);
      return;
    }
    const parsed = Math.max(0, Math.round(Number(trimmed) * 100) / 100);
    if (!Number.isFinite(parsed)) {
      setText(formatEuro(valueEur));
      return;
    }
    const display = parsed > 0 ? String(parsed) : "";
    setText(display);
    if (parsed !== (valueEur ?? 0)) onCommit(parsed > 0 ? parsed : null);
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      placeholder="€"
      className={cn(numericFieldClass, "w-16", className)}
      value={text}
      aria-label={label}
      onFocus={(e) => {
        focusedRef.current = true;
        e.target.select();
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onChange={(e) => {
        const next = e.target.value;
        if (next === "" || /^\d*[,.]?\d*$/.test(next)) {
          setText(next);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function formatKm(km: number | null | undefined): string {
  return km != null ? String(km) : "";
}

function formatEuro(amount: number | null | undefined): string {
  return amount != null && amount > 0 ? String(amount) : "";
}
