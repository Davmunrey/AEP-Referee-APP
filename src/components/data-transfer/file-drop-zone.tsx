"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { formatFileMeta, getAcceptedMime, type TransferKind } from "@/lib/import-export-ui";
import { cn } from "@/lib/utils";

export interface FileDropZoneProps {
  kind: TransferKind;
  accept?: string;
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  hint?: string;
  className?: string;
}

export function FileDropZone({
  kind,
  accept,
  file,
  onFile,
  disabled,
  hint,
  className,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const acceptAttr = accept ?? getAcceptedMime(kind);

  const pick = useCallback(
    (f: File | null) => {
      if (!f) {
        onFile(null);
        return;
      }
      onFile(f);
    },
    [onFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const f = e.dataTransfer.files?.[0];
      if (f) pick(f);
    },
    [disabled, pick],
  );

  return (
    <div className={cn("mb-4", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr || undefined}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          // Misma ley que los huecos de la tarima: la zona crece un poco cuando
          // el archivo está encima, para que se note que va a aceptarlo.
          "flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-[color,background-color,border-color,box-shadow,scale] duration-150 ease-(--ease-out) focus-ring",
          dragOver
            ? "scale-[1.01] border-primary bg-primary-muted shadow-card"
            : "border-border-muted bg-surface/50 hover:border-border-strong hover:bg-surface-hover active:scale-[0.995]",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <Upload
          className={cn(
            "h-8 w-8 transition-colors duration-150",
            dragOver ? "text-primary" : "text-subtle-muted",
          )}
          aria-hidden="true"
        />
        <span className="text-sm font-medium text-foreground">
          {file ? file.name : "Arrastra un archivo o haz clic para elegir"}
        </span>
        {file ? (
          <span className="text-xs text-subtle-muted">{formatFileMeta(file.size)}</span>
        ) : (
          <span className="text-xs text-subtle-muted">{hint ?? acceptAttr}</span>
        )}
      </button>
    </div>
  );
}
