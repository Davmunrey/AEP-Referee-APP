"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getGoogleMapsApiKey, loadGoogleMapsPlaces } from "@/lib/google-maps-loader";
import { cn } from "@/lib/utils";

export interface AddressSelection {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
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

export function AddressAutocompleteField({
  id,
  label,
  value,
  onValueChange,
  onPlaceSelect,
  placeholder = "Buscar dirección en Google Maps…",
  disabled,
  className,
  coordsOk,
  coordsHint,
  hint,
}: AddressAutocompleteFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const apiKey = getGoogleMapsApiKey();

  useEffect(() => {
    if (!apiKey || !inputRef.current || disabled) return;

    let cancelled = false;

    loadGoogleMapsPlaces()
      .then(() => {
        if (cancelled || !inputRef.current) return;

        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "es" },
          fields: ["formatted_address", "geometry", "place_id", "name"],
          types: ["address", "establishment", "geocode"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const location = place.geometry?.location;
          if (!location) return;

          const address = place.formatted_address ?? place.name ?? inputRef.current?.value ?? "";
          onValueChange(address);
          onPlaceSelect?.({
            address,
            lat: location.lat(),
            lng: location.lng(),
            placeId: place.place_id,
          });
        });

        autocompleteRef.current = autocomplete;
        setMapsReady(true);
        setMapsError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setMapsError(err instanceof Error ? err.message : "Google Maps no disponible");
        }
      });

    return () => {
      cancelled = true;
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, [apiKey, disabled, onPlaceSelect, onValueChange]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={inputId} className="flex items-center gap-1.5 text-xs font-medium text-foreground-secondary">
        <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        {label}
      </label>
      <Input
        id={inputId}
        ref={inputRef}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={mapsReady ? placeholder : "Calle, número, ciudad"}
        disabled={disabled}
        autoComplete="off"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {apiKey && mapsReady && (
        <p className="text-[11px] text-success">Autocomplete Google Maps activo — elige una sugerencia de la lista.</p>
      )}
      {!apiKey && (
        <p className="text-[11px] text-warning">
          Configura NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para autocomplete. Se guardará la dirección y se geocodificará al guardar.
        </p>
      )}
      {mapsError && <p className="text-[11px] text-warning">{mapsError}</p>}
      {coordsHint && (
        <p className={cn("text-[11px]", coordsOk ? "text-success" : "text-warning")}>{coordsHint}</p>
      )}
    </div>
  );
}
