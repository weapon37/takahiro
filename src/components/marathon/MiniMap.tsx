"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/marathon/google-maps-loader";
import type { CourseStep } from "@/lib/marathon/types";

interface MiniMapProps {
  apiKey: string;
  steps: CourseStep[];
  currentIndex: number;
  onSelectStep: (index: number) => void;
}

export default function MiniMap({
  apiKey,
  steps,
  currentIndex,
  onSelectStep,
}: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const onSelectStepRef = useRef(onSelectStep);

  useEffect(() => {
    onSelectStepRef.current = onSelectStep;
  });

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps(apiKey).then((g) => {
      if (cancelled || !containerRef.current || steps.length === 0) return;

      const map = new g.maps.Map(containerRef.current, {
        center: { lat: steps[0].lat, lng: steps[0].lon },
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
      });
      mapRef.current = map;

      const path = steps.map((s) => ({ lat: s.lat, lng: s.lon }));
      new g.maps.Polyline({
        path,
        strokeColor: "#2563eb",
        strokeWeight: 4,
        map,
      });

      const bounds = new g.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      map.fitBounds(bounds);

      const marker = new g.maps.Marker({
        map,
        position: path[0],
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#dc2626",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      markerRef.current = marker;

      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const clickLat = e.latLng.lat();
        const clickLng = e.latLng.lng();
        let closest = 0;
        let closestDist = Infinity;
        steps.forEach((s, i) => {
          const d = (s.lat - clickLat) ** 2 + (s.lon - clickLng) ** 2;
          if (d < closestDist) {
            closestDist = d;
            closest = i;
          }
        });
        onSelectStepRef.current(closest);
      });
    });

    return () => {
      cancelled = true;
    };
  }, [apiKey, steps]);

  useEffect(() => {
    const marker = markerRef.current;
    const map = mapRef.current;
    const step = steps[currentIndex];
    if (!marker || !map || !step) return;
    const pos = { lat: step.lat, lng: step.lon };
    marker.setPosition(pos);
    map.panTo(pos);
  }, [currentIndex, steps]);

  return <div ref={containerRef} className="h-full w-full rounded-lg" />;
}
