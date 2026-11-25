'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

// İçinde bulunduğu formun gönderimi sürerken kapalı olan gönder düğmesi. erisilebilirAd: görünen
// yazıdan uzun erişilebilir ad (satır başına yinelenen düğmenin hangi kayda ait olduğu).
export function GonderDugmesi({
  children,
  erisilebilirAd,
}: Readonly<{ children: ReactNode; erisilebilirAd?: string }>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-label={erisilebilirAd}
      disabled={pending}
      className="rounded bg-blue-700 px-4 py-2 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:bg-gray-500"
    >
      {children}
    </button>
  );
}
