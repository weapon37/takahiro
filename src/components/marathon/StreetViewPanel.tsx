"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/marathon/google-maps-loader";
import type { CourseStep } from "@/lib/marathon/types";

interface StreetViewPanelProps {
  apiKey: string;
  step: CourseStep;
}

export default function StreetViewPanel({ apiKey, step }: StreetViewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panoramaRef = useRef<google.maps.StreetViewPanorama | null>(null);
  const serviceRef = useRef<google.maps.StreetViewService | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [ready, setReady] = useState(false);

  const goToStep = useCallback((s: CourseStep) => {
    const panorama = panoramaRef.current;
    const service = serviceRef.current;
    if (!panorama || !service) return;

    setNotFound(false);
    service.getPanorama(
      { location: { lat: s.lat, lng: s.lon }, radius: 60 },
      (data, status) => {
        if (status === google.maps.StreetViewStatus.OK && data?.location?.pano) {
          panorama.setPano(data.location.pano);
          panorama.setPov({ heading: s.heading, pitch: 0 });
          panorama.setVisible(true);
        } else {
          setNotFound(true);
        }
      }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then((g) => {
        if (cancelled || !containerRef.current) return;
        panoramaRef.current = new g.maps.StreetViewPanorama(containerRef.current, {
          pov: { heading: step.heading, pitch: 0 },
          zoom: 1,
          addressControl: false,
          fullscreenControl: true,
          motionTracking: false,
          motionTrackingControl: false,
        });
        serviceRef.current = new g.maps.StreetViewService();
        setReady(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    if (!ready) return;
    goToStep(step);
  }, [ready, step, goToStep]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-red-50 dark:bg-red-950 p-6 text-center text-sm text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900">
      <div ref={containerRef} className="h-full w-full" />
      {notFound && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6 text-center text-sm text-white">
          この地点周辺のストリートビュー画像が見つかりませんでした
        </div>
      )}
    </div>
  );
}
