let loadPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Mapsはブラウザ上でのみ読み込めます。"));
  }

  if (!apiKey) {
    return Promise.reject(new Error("Google Maps APIキーが未設定です。"));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const callbackName = "__marathonGoogleMapsCallback";
    (window as unknown as Record<string, () => void>)[callbackName] = () => {
      resolve(window.google);
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&callback=${callbackName}&loading=async`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(
        new Error("Google Maps APIの読み込みに失敗しました。APIキーを確認してください。")
      );
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
