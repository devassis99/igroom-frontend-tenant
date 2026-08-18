import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Geographic center of the contiguous US — the default view before an
 * owner has ever set a pin, so the map isn't just floating over the
 * Atlantic (Leaflet's own default is 0,0).
 */
const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;
const PIN_ZOOM = 15;

/**
 * A plain inline SVG pin instead of Leaflet's default marker image.
 * Leaflet's default icon references marker-icon.png/marker-shadow.png by
 * relative URL, which Vite doesn't rewrite — the classic "broken image
 * icon on the map" bug. A divIcon sidesteps that entirely since it's just
 * HTML, no asset path to get wrong.
 */
const pinIcon = L.divIcon({
  className: "",
  html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" style="filter drop-shadow(0 2px 3px rgba(0,0,0,0.35))">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 27 15 27s15-16.5 15-27c0-8.3-6.7-15-15-15z" fill="#C89B3C"/>
    <circle cx="15" cy="15" r="6" fill="#ffffff"/>
  </svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
});

interface LocationMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (latitude: number, longitude: number) => void;
  height?: number;
}

/** Imperatively re-centers the map when the pin moves via something other than direct map interaction — e.g. the "Locate from address" button setting lat/long from a geocode result. */
function RecenterOnChange({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (latitude == null || longitude == null) return;
    map.setView([latitude, longitude], Math.max(map.getZoom(), PIN_ZOOM));
    // Only react to the coordinates changing, not to zoom/pan the owner does by hand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  return null;
}

function ClickToPlace({ onChange }: { onChange: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Locations settings page's map picker — click anywhere (or drag the
 * dropped pin) to set a location's lat/long, which powers pinning this
 * shop on a map (the mobile app that will render that map doesn't exist
 * yet; this just makes the data available via the API, see
 * locations.ts's schema comment). Pairs with the "Locate from address"
 * button in AddEditLocationModal, which geocodes the ADDRESS field as a
 * starting point the owner can then fine-tune by hand.
 */
export function LocationMapPicker({
  latitude,
  longitude,
  onChange,
  height = 220,
}: LocationMapPickerProps) {
  const hasPin = latitude != null && longitude != null;
  const center = useMemo<[number, number]>(
    () => (hasPin ? [latitude!, longitude!] : DEFAULT_CENTER),
    // Only used for the map's initial center — MapContainer doesn't react
    // to `center` changing after mount, RecenterOnChange handles that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="overflow-hidden rounded-xl border border-tn-border-soft" style={{ height }}>
      <MapContainer
        center={center}
        zoom={hasPin ? PIN_ZOOM : DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToPlace onChange={onChange} />
        <RecenterOnChange latitude={latitude} longitude={longitude} />
        {hasPin && (
          <Marker
            position={[latitude!, longitude!]}
            icon={pinIcon}
            draggable
            eventHandlers={{
              dragend: (e: L.DragEndEvent) => {
                const marker = e.target as L.Marker;
                const pos = marker.getLatLng();
                onChange(pos.lat, pos.lng);
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}

export default LocationMapPicker;
