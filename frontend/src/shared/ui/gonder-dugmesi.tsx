'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

// İçinde bulunduğu formun gönderimi sürerken kapalı olan gönder düğmesi.
export function GonderDugmesi({ children }: Readonly<{ children: ReactNode }>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-blue-700 px-4 py-2 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:bg-gray-500"
    >
      {children}
    </button>
  );
}
