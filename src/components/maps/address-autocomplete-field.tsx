"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AddressSelection {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

interface AddressSuggestion {
  address: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteFieldProps {
  id?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onPlaceSelect?: (place: AddressSelection) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  coordsOk?: boolean;
  coordsHint?: string;
  hint?: string;
  /** Muestra botón para borrar dirección y coordenadas guardadas. */
  clearable?: boolean;
  onClear?: () => void;
  clearing?: boolean;
}

export function AddressAutocompleteField({
  id,
  label,
  value,
  onValueChange,
  onPlaceSelect,
  placeholder = "Buscar dirección…",
  disabled,
  className,
  coordsOk,
  coordsHint,
  hint,
  clearable,
  onClear,
  clearing,
}: AddressAutocompleteFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-suggestions`;
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string) => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setSearchError(null);
      return;
    }
    setLoading(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams({ q });
      const res = await fetch(`/api/v1/geocode/search?${params.toString()}`);
      if (!res.ok) {
        setSuggestions([]);
        setSearchError("No se pudo buscar. Inténtalo de nuevo.");
        return;
      }
      const json = (await res.json()) as { data?: { suggestions?: AddressSuggestion[] } };
      const next = json.data?.suggestions ?? [];
      setSuggestions(next);
      setOpen(next.length > 0);
      if (next.length === 0) {
        setSearchError("Sin resultados. Prueba con calle y población o guarda para geocodificar al guardar.");
      }
    } catch {
      setSuggestions([]);
      setSearchError("No se pudo buscar. Comprueba tu conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const onInputChange = (next: string) => {
    onValueChange(next);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void search(next);
    }, 280);
  };

  const pickSuggestion = (suggestion: AddressSuggestion) => {
    onValueChange(suggestion.address);
    onPlaceSelect?.({
      address: suggestion.address,
      lat: suggestion.lat,
      lng: suggestion.lng,
    });
    setSuggestions([]);
    setOpen(false);
    setSearchError(null);
  };

  const showClear = clearable && onClear && (value.trim().length > 0 || coordsOk);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="flex items-center gap-1.5 text-xs font-medium text-foreground-secondary">
          <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          {label}
        </label>
        {showClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled || clearing}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive-muted disabled:opacity-50"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            {clearing ? "Eliminando…" : "Eliminar ubicación"}
          </button>
        )}
      </div>
      <div className="relative">
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          value={value}
          onChange={(e) => onInputChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-auto rounded-xl border border-border-muted bg-card py-1 shadow-lg"
          >
            {suggestions.map((suggestion) => (
              <li key={`${suggestion.address}-${suggestion.lat}`} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(suggestion)}
                >
                  {suggestion.address}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <p className="text-[11px] text-success">
        Autocomplete OpenStreetMap (gratuito) — elige una sugerencia de la lista.
      </p>
      {loading && <p className="text-[11px] text-muted-foreground">Buscando…</p>}
      {!loading && searchError && (
        <p className="text-[11px] text-warning">{searchError}</p>
      )}
      {coordsHint && (
        <p className={cn("text-[11px]", coordsOk ? "text-success" : "text-warning")}>{coordsHint}</p>
      )}
    </div>
  );
}
