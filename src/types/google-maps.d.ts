/** Tipos mínimos para Places Autocomplete en cliente. */
declare global {
  interface Window {
    google?: {
      maps: {
        places: typeof google.maps.places;
        event: typeof google.maps.event;
      };
    };
  }
}

declare namespace google.maps.places {
  interface PlaceResult {
    formatted_address?: string;
    name?: string;
    place_id?: string;
    geometry?: {
      location?: {
        lat(): number;
        lng(): number;
      };
    };
  }

  class Autocomplete {
    constructor(input: HTMLInputElement, opts?: AutocompleteOptions);
    addListener(event: string, handler: () => void): void;
    getPlace(): PlaceResult;
  }

  interface AutocompleteOptions {
    componentRestrictions?: { country: string | string[] };
    fields?: string[];
    types?: string[];
  }
}

declare namespace google.maps {
  class LatLng {
    lat(): number;
    lng(): number;
  }

  namespace event {
    function clearInstanceListeners(instance: object): void;
  }
}

declare const google: {
  maps: {
    places: typeof google.maps.places;
    event: typeof google.maps.event;
  };
};
