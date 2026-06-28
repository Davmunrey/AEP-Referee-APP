"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AddressSelection {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

interface PhotonFeature {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  geometry: {
    coordinates: [number, number];
  };
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
}

function formatPhotonAddress(feature: PhotonFeature): string {
  const p = feature.properties;
  const street = [p.street, p.housenumber].filter(Boolean).join(" ");
  const city = p.city ?? p.town ?? p.village ?? "";
  const parts = [p.name, street, city, p.state, p.postcode, p.country].filter(Boolean);
  return [...new Set(parts)].join(", ");
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
}: AddressAutocompleteFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-suggestions`;
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (query: string) => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ q, lang: "es", limit: "6", bbox: "-9.5,36.0,3.3,43.8" });
      const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
      if (!res.ok) throw new Error("Photon error");
      const data = (await res.json()) as { features: PhotonFeature[] };
      setSuggestions(data.features ?? []);
      setOpen(true);
    } catch {
      setSuggestions([]);
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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void search(next);
    }, 280);
  };

  const pickSuggestion = (feature: PhotonFeature) => {
    const address = formatPhotonAddress(feature);
    const [lng, lat] = feature.geometry.coordinates;
    onValueChange(address);
    onPlaceSelect?.({ address, lat, lng });
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className={cn("relative space-y-1.5", className)}>
      <label htmlFor={inputId} className="flex items-center gap-1.5 text-xs font-medium text-foreground-secondary">
        <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        {label}
      </label>
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
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <p className="text-[11px] text-success">
        Autocomplete OpenStreetMap (gratuito) — elige una sugerencia de la lista.
      </p>
      {loading && <p className="text-[11px] text-muted-foreground">Buscando…</p>}
      {coordsHint && (
        <p className={cn("text-[11px]", coordsOk ? "text-success" : "text-warning")}>{coordsHint}</p>
      )}
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-border-muted bg-card py-1 shadow-lg"
        >
          {suggestions.map((feature, index) => {
            const labelText = formatPhotonAddress(feature);
            return (
              <li key={`${labelText}-${index}`} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(feature)}
                >
                  {labelText}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
