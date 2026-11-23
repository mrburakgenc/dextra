# W0NDERSUPERIOR Demir Kurallari — Frontend (Next.js + React + TypeScript)

Bu kurallar frontend kodu icin gecerlidir. **HICBIR KOSULDA** ihlal edilemez. Violation = Reddedilen kod.

## Kural Taksonomisi

| Kod | Kural | Impact |
|-----|-------|--------|
| FTS-01 | No `any` type | CRITICAL |
| FTS-02 | No `as` type assertion | CRITICAL |
| FTS-03 | No `!` non-null assertion | HIGH |
| FTS-04 | No `console.log/warn/error` | CRITICAL |
| FTS-05 | No `@ts-ignore` / `@ts-expect-error` | HIGH |
| FTS-06 | No `var` keyword | HIGH |
| FTS-07 | No `==` loose equality | HIGH |
| FTS-08 | No `index` as key (dynamic list) | HIGH |
| FTS-09 | No `useEffect` for data fetch | CRITICAL |
| FTS-10 | No direct DOM manipulation | HIGH |
| FTS-11 | No `dangerouslySetInnerHTML` | CRITICAL |
| SA-01 | Client ASLA dogrudan API'ye istek atmaz | CRITICAL |
| SA-02 | ActionResult<T> donus tipi zorunlu | CRITICAL |
| SA-03 | Zod validation zorunlu | CRITICAL |
| SA-04 | TanStack Query + Server Action | HIGH |
| COMP-01 | Default = Server Component | HIGH |
| COMP-02 | page.tsx icerige gore 'use client' | HIGH |
| COMP-03 | 'use client' en altta (leaf) | MEDIUM |
| BOUNDARY-01 | server-only dosya client import chain'ine SIZMAZ | CRITICAL |
| BOUNDARY-02 | 'use server' dosya SADECE server'dan import edilir | CRITICAL |
| BOUNDARY-03 | Barrel export (index.ts) server/client karistirmaz | CRITICAL |
| COMP-04 | SC'de async/await data fetch | HIGH |
| STATE-01 | Server data = TanStack Query | CRITICAL |
| STATE-02 | URL state = nuqs | HIGH |
| STATE-03 | UI state = Zustand | HIGH |
| STATE-04 | Form state = react-hook-form | HIGH |
| FORM-01 | Zod schema zorunlu | CRITICAL |
| FORM-02 | react-hook-form + zodResolver | HIGH |
| FORM-03 | Server Action submit | HIGH |
| FORM-04 | Cift validation (Zod + class-validator) | CRITICAL |
| A11Y-01 | Semantic HTML zorunlu | HIGH |
| A11Y-02 | Her input'ta label zorunlu | HIGH |
| A11Y-03 | Kontrast orani (4.5:1 / 3:1) | HIGH |
| A11Y-04 | Keyboard navigasyon | HIGH |
| A11Y-05 | Focus visible | HIGH |
| A11Y-06 | Focus management (modal) | HIGH |
| A11Y-07 | aria-live (status/error) | MEDIUM |
| A11Y-08 | Alt text zorunlu | MEDIUM |
| A11Y-09 | prefers-reduced-motion | MEDIUM |
| FE-A11Y-10 | Skip link zorunlu (WCAG 2.4.1) | HIGH |
| PERF-01 | Heavy lib lazy load | HIGH |
| PERF-02 | Tree-shake imports | HIGH |
| PERF-03 | next/image zorunlu | HIGH |
| PERF-04 | next/font zorunlu | MEDIUM |
| PERF-05 | Code split per route | MEDIUM |
| PERF-06 | React.memo sadece gerektiginde | MEDIUM |
| PERF-07 | useMemo sadece pahali hesaplama | MEDIUM |
| PERF-08 | Core Web Vitals hedefleri | HIGH |
| FILE-01 | VSA primary organizer | HIGH |
| FILE-02 | Atomic Design hierarchy | HIGH |
| FILE-03 | Feature-specific vs shared | HIGH |
| FILE-04 | shared/ui dokunma | CRITICAL |
| FILE-05 | PascalCase component naming | MEDIUM |
| FILE-06 | Barrel export yasak | HIGH |
| HOOK-01 | Conditional hook yasak | CRITICAL |
| HOOK-02 | useEffect data fetch yasak | CRITICAL |
| HOOK-03 | Custom hook use prefix zorunlu | MEDIUM |
| FE-LOG-01 | 3 ayri kanal: toast (UI), devLog (dev-only), Sentry (prod telemetry) | CRITICAL |
| TRACE-01 | Frontend trace ID (window.__TRACE_ID = randomUUID) | HIGH |
| TRACE-02 | apiFetch header propagation (x-trace-id, x-correlation-id) | HIGH |
| TRACE-03 | OpenTelemetry onerisi | MEDIUM |
| FE-FORM-05 | Multi-step form pattern (wizard) | HIGH |
| FE-FORM-06 | Auto-save draft (localStorage, debounce 2s, 24h expire) | MEDIUM |
| FE-PERF-09 | Bundle size budget (sayfa bazli max JS kB) | HIGH |
| FE-ROUTE-01 | Route group disiplini (public/auth/yonetim/fullscreen) | MEDIUM |
| FE-DATE-01 | Intl.DateTimeFormat('tr-TR') zorunlu, raw toLocaleString yasak | HIGH |
| MNY-02 | Intl.NumberFormat('tr-TR') zorunlu, toFixed yasak | HIGH |
| FE-CASL-01 | Sayfada <Can> ZORUNLU (roles.includes YASAK) | CRITICAL |
| FE-CASL-02 | <Can> instance-aware kullan (this prop ile) | HIGH |
<!-- FE-CASL-03: v11'de kaldirildi (eski "Eski sayfaya <Can> eklemek YASAK").
     Tum sayfalarda <Can> ZORUNLU (FE-CASL-01). -->
| FE-CASL-04 | useCurrentAbility hook ile programatik kontrol | MEDIUM |

---

## 1. TypeScript / React Kurallari

| YASAK | ALTERNATIF | NEDEN |
|-------|------------|-------|
| `any` type | Spesifik tip, `unknown` + type guard | Type safety |
| `as Type` | Type guard, Zod validation | Runtime safety |
| `value!` | `value?.` optional chaining | Null safety |
| `console.log/warn/error()` | Error boundary + toast (sonner) | Production logs |
| `// @ts-ignore` | Tipi duzelt | Type safety |
| `@ts-expect-error` | Tipi duzelt | Type safety bypass |
| `var` keyword | `const` / `let` | Block scoping |
| `==` loose equality | `===` strict equality | Type coercion bug'lari |
| `index` as key (dynamic list) | Unique ID | Re-render ve state kaymasi |
| `useEffect` for data fetch | TanStack Query | Race condition, cache, loading |
| Direct DOM manipulation | React state/ref | Virtual DOM bypass |
| `dangerouslySetInnerHTML` | Sanitize veya text render | XSS riski |

### `as` Yasagi: SIFIR EXCEPTION

```typescript
// YASAK - catch block'ta bile
try { ... } catch (error) {
  toast.error((error as Error).message);  // YASAK!
}

// DOGRU - unknown + instanceof
try { ... } catch (error: unknown) {
  if (error instanceof Error) {
    toast.error(error.message);
  } else {
    toast.error('Beklenmeyen bir hata olustu');
  }
}
```

### FE-LOG-01: 3 Ayri Kanal (CRITICAL)

`console.*` yasak (FTS-04). Yerine 3 kanal:

1. **toast (sonner)** — kullaniciya gosterilir
   `toast.error('Islem basarisiz')`

2. **devLog** — dev/staging'de console, prod'da no-op (tree-shaken)
   `import { devLog } from '@/shared/lib/dev-log'`
   `devLog.debug('Form submit', { values })`

3. **Sentry (veya benzeri)** — production telemetry
   `Sentry.captureException(error)`
   `Sentry.captureMessage('Critical UI flow broken', 'warning')`

"Logger" tek generic isim KULLANILMAZ — amac acik olsun.

```typescript
// YASAK - Production'da bile
console.log('Debug:', user);
console.error('Hata:', error);

// DOGRU - 3 kanal
toast.error('Islem basarisiz');               // Kullaniciya goster
devLog.debug('Form submit', { values });       // Dev-only debug
Sentry.captureException(error);               // Prod telemetry
```

---

## 2. Server/Client Boundary Kurallari (KRITIK)

> **DEMIR KURAL:** next/headers, next/cookies, server-only import eden dosya ASLA client component'e ulasamaz.
> Bu kural ihlali = BUILD HATASI. Runtime'da degil, COMPILE TIME'da patlar.

### BOUNDARY-01: server-only Import Chain Kontrolu (CRITICAL)

```typescript
// YASAK — server-only dosya client chain'ine siziyor
// backend.ts
import 'server-only'
import { cookies } from 'next/headers'
export async function apiFetch(...) { ... }

// api-client.ts (HATALI — backend.ts'i import ediyor)
import { apiFetch } from '@/shared/lib/backend'  // ← SERVER-ONLY!
export function getVehicles() { return apiFetch('/vehicles') }

// services/index.ts (HATALI — barrel export ile yayiliyor)
export * from './api-client'  // ← server-only SIZINTISI!

// page.tsx ('use client') → BUILD ERROR!
import { getVehicles } from '@/features/arac-bakim/services'  // PATLADI!
```

```typescript
// DOGRU — server-only dosya SADECE server'dan import edilir
// actions.ts ('use server')
import { apiFetch } from '@/shared/lib/backend'  // ← OK, server context
export async function getVehicles() { return apiFetch('/vehicles') }

// page.tsx (Server Component)
import { getVehicles } from './actions'  // ← OK, server → server

// client-component.tsx ('use client')
import { useQuery } from '@tanstack/react-query'
import { getVehicles } from './actions'  // ← OK, TanStack queryFn server action cagirir
```

### BOUNDARY-02: Import Chain Dogrulama Kurali

```
BIR DOSYA YAZARKEN VEYA IMPORT EDERKEN SU KONTROLU YAP:

1. Bu dosya 'use client' veya client component mi?
   EVET → Import ettigi TUM dosyalarin chain'ini kontrol et:
     → import A from './A'
       → A, import B from './B' yapiyor mu?
         → B, 'server-only' veya next/headers import ediyor mu?
           → EVET → BUILD HATASI! Import chain'i KES.

2. Barrel export (index.ts) var mi?
   EVET → Bu barrel, server-only VE client dosyalarini KARISTIRIYOR mu?
     → EVET → AYIR! Server export'lari ayri, client export'lari ayri.

KURAL: import yazarken SADECE o dosyaya degil, o dosyanin IMPORT ETTIKLERINE de bak.
```

### BOUNDARY-03: Dosya Organizasyonu (Server/Client Ayirimi)

```
DOGRU YAPI — Server ve client AYRI:
features/[modul]/
├── actions.ts              ← 'use server' — apiFetch, cookies, headers
├── actions/                ← Buyuk modullerde dizin
│   ├── get-xxx.ts          ← 'use server'
│   └── create-xxx.ts       ← 'use server'
├── components/
│   ├── xxx-list.tsx        ← 'use client' — TanStack Query ile actions cagirir
│   └── xxx-form.tsx        ← 'use client' — form submit ile actions cagirir
├── types/
│   ├── schemas.ts          ← Zod (client + server'da kullanilabilir)
│   └── xxx.types.ts        ← Pure TypeScript types (her yerde kullanilabilir)
└── hooks/
    └── use-xxx.ts          ← 'use client' — custom hooks

YASAK YAPI — Karisik:
features/[modul]/
├── services/
│   ├── api-client.ts       ← server-only import VAR ama barrel'dan client'a sıziyor!
│   └── index.ts            ← export * → server-only SIZINTISI!
└── components/
    └── xxx.tsx             ← services/ import ediyor → PATLADI!
```

### Sik Karsilasilan Hatalar ve Cozumleri

| Hata | Sebep | Cozum |
|------|-------|-------|
| `next/headers only works in Server Component` | server-only dosya client'a siziyor | Import chain'i kes — actions.ts uzerinden eriş |
| `cookies() can only be called in a Server Component` | cookies client'ta cagirilmaya calisiyor | Server Action'a tasi |
| `You're importing a component that needs server-only` | Barrel export server/client karistiriyor | Barrel'i ayir veya kaldir (FILE-06) |
| `Cannot use useState in a Server Component` | Server component'te client hook | 'use client' ekle veya child component'e tasi |

---

## 2b. Server Action Kurallari (KRITIK)

**TEMEL KURAL: Client ASLA dogrudan API'ye istek ATMAZ. TUM API cagrilari Server Action uzerinden yapilir.**

| YASAK | DOGRU | NEDEN |
|-------|-------|-------|
| Client'ta `fetch('/api/...')` | Server Action cagir | JWT client'ta OLMAZ |
| Component icinde API URL | Server Action arkasinda gizle | Token guvenligi |
| Client-side API key/token | Server Action'da auth | Credential exposure |
| `axios` / client HTTP lib | Server Action -> `apiFetch` | Tek API noktasi |

### Data Fetch Akisi

```
Ilk sayfa yuklemesi:
  Server Component -> Server Action -> Backend REST API
  (streaming, parallel Promise.all)

Client interaction (filtre, sayfa, arama):
  TanStack Query queryFn -> Server Action -> Backend REST API
  (cache, refetch, stale-while-revalidate)

Form submit (create/update/delete):
  useActionState -> Server Action -> Backend REST API
  -> revalidatePath (server cache) + invalidateQueries (client cache)
```

### Server Action Sablonu

```typescript
// features/{feature}/actions/{action}.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function createXxxAction(
  data: CreateXxxInput
): Promise<ActionResult<Xxx>> {
  try {
    // 1. Zod Validation ZORUNLU
    const validated = createXxxSchema.parse(data);

    // 2. Backend call
    const result = await apiPost<Xxx>('/module/xxxs', validated);

    // 3. Revalidate
    revalidatePath('/module/xxxs');

    // 4. ActionResult<T> ZORUNLU
    return { success: true, data: result, message: 'Basariyla olusturuldu' };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Islem sirasinda bir hata olustu' };
  }
}
```

**YASAK:**
- Direkt `fetch()` kullanimi
- `ActionResult<T>` donmeme
- Zod validation atlama
- `error as Error` kullanma

### TanStack Query + Server Action

```tsx
// features/{feature}/hooks/use-xxxs.ts
import { getXxxs } from '../actions/xxxs';

export function useXxxs(filters: XxxFilters) {
  return useQuery({
    queryKey: xxxKeys.list(filters),
    queryFn: () => getXxxs(filters), // Server Action cagirir, client API'ye GITMEZ
    staleTime: 30_000,
  });
}
```

---

## 3. Server / Client Component Kurallari

| KURAL | ACIKLAMA |
|-------|----------|
| Default = Server Component | `'use client'` SADECE interactive component'ler icin |
| page.tsx = Icerige gore | Interaktifse `'use client'`, statikse Server Component |
| layout.tsx = Server Component | Provider wrapper haric |
| `'use client'` en altta | Boundary mumkun oldugunca leaf component'te |
| SC'de async/await | Data fetch Server Component'te, prop olarak gec |

### page.tsx 'use client' Kurali

page.tsx dosyalarinda `'use client'` kullanimi sayfa icerigine gore belirlenir:

**'use client' KULLANILMALI — sayfa interaktif ise:**
- useState, useEffect, useRef veya herhangi bir hook kullaniyorsa
- Form, tablo, modal, tab gibi state gerektiren UI iceriyorsa
- TanStack Query hook'lari (useQuery, useMutation) kullaniyorsa
- Event handler'lar (onClick, onChange, onSubmit) iceriyorsa

**'use client' KULLANILMAMALI — sayfa statik ise:**
- Sadece veri gosterimi yapan, interaksiyon olmayan sayfalar
- `export const metadata` kullanilmasi gereken SEO sayfalari
- async Server Component olarak direkt veri cekebilecek basit sayfalar

**Guvenlik kurali (degismez):**
- `'use client'` bilesenlerinde secret, API key, DB baglantisi, hassas config OLMAMALI
- Hassas logic her zaman Server Action veya API route icinde kalmali
- Bu kural page.tsx'in client veya server olmasindan bagimsizdir

**YAPILMAMASI GEREKEN:**
- Tum page.tsx dosyalarindan toplu `'use client'` kaldirma
- Interaktif sayfalari zorla Server Component + Client child olarak ikiye bolme (boilerplate artar, performans farki sifir)
- Statik sayfalara gereksiz `'use client'` ekleme

```tsx
// DOGRU - Interaktif sayfa, 'use client' kullan
// app/(dashboard)/xxxs/page.tsx
'use client';

export default function XxxPage() {
  const { data } = useQuery({ queryKey: ['xxxs'], queryFn: () => getXxxs() });
  const [filters, setFilters] = useQueryStates({ ... });
  return (
    <div>
      <XxxFilterBar filters={filters} onChange={setFilters} />
      <XxxTable data={data} />
    </div>
  );
}
```

```tsx
// DOGRU - Statik/veri cekme sayfasi, Server Component kalsin
// app/(dashboard)/about/page.tsx
export const metadata = { title: 'Hakkinda' };

export default async function AboutPage() {
  const info = await getAboutInfo(); // Server Action
  return <AboutContent data={info} />;
}
```

```tsx
// YASAK - Interaktif sayfayi zorla ikiye bolme (gereksiz boilerplate)
// app/(dashboard)/xxxs/page.tsx (Server Component)
export default async function XxxPage() {
  return <XxxPageContent />; // Sadece 1 client component render, bos wrapper
}
// features/xxx/components/xxx-page-content.tsx
'use client';
export function XxxPageContent() { /* TUM logic burada */ }
```

```tsx
// DOGRU - 'use client' leaf component'te (her zaman gecerli)
// features/xxx/components/xxx-filter-bar.tsx
'use client';

import { useQueryStates } from 'nuqs';

export function XxxFilterBar() {
  const [filters, setFilters] = useQueryStates({ ... });
  return <div>...</div>;
}
```

---

## 4. State Management Kurallari

| Data Tipi | Arac | NEDEN |
|-----------|------|-------|
| Server data (entities) | TanStack Query | Cache, refetch, optimistic |
| URL state (filtre, sayfa) | nuqs | Shareable, bookmark, back button |
| Client UI state | Zustand | Selector isolation, persist |
| Form state | react-hook-form | Uncontrolled, performant |

| YASAK | DOGRU | NEDEN |
|-------|-------|-------|
| Server data Zustand'da | TanStack Query | Cache invalidation, stale control |
| useState for URL params | nuqs useQueryStates | URL kaybolur, paylasilamaz |
| Redux | Zustand + TQ | Overengineering |
| React Context for state | Zustand | Context = re-render cascade |

```tsx
// YASAK - Server data Zustand'da
const useStore = create((set) => ({
  users: [],
  fetchUsers: async () => {
    const users = await getUsers(); // Server Action
    set({ users }); // YASAK! TanStack Query kullan
  },
}));

// DOGRU - TanStack Query ile server data
const { data: users } = useQuery({
  queryKey: ['users'],
  queryFn: () => getUsers(), // Server Action
});
```

---

## 5. Form & Validation Kurallari

| KURAL | ACIKLAMA |
|-------|----------|
| Zod schema ZORUNLU | Her form icin Zod schema |
| react-hook-form | useForm + zodResolver |
| Server Action submit | useActionState ile progressive enhancement |
| Cift validation | Zod (frontend) + class-validator (backend) — IKISI DE ZORUNLU |
| Inline error | Input yaninda hata mesaji + aria-describedby |

```tsx
// DOGRU - react-hook-form + Zod + Server Action
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createXxxSchema, type CreateXxxInput } from '../schemas/xxx';
import { createXxxAction } from '../actions/xxx';

export function XxxForm() {
  const form = useForm<CreateXxxInput>({
    resolver: zodResolver(createXxxSchema),
  });

  const onSubmit = async (data: CreateXxxInput) => {
    const result = await createXxxAction(data);
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="name">Ad</label>
        <Input id="name" {...form.register('name')} aria-describedby="name-error" />
        {form.formState.errors.name && (
          <p id="name-error" role="alert">{form.formState.errors.name.message}</p>
        )}
      </div>
      <Button type="submit">Kaydet</Button>
    </form>
  );
}
```

```typescript
// YASAK - Validation yok
const handleSubmit = (data) => { ... };  // ZOD NEREDE?

// YASAK - Sadece frontend validation
const schema = z.object({ name: z.string() });
// Backend'de class-validator OLMADAN = guvenlik acigi!
```

### FE-FORM-05: Multi-Step Form Pattern (Wizard) (HIGH)

Cok adimli form (wizard) icin kanonik pattern:

```tsx
// features/sosyal-yardim/basvuru/components/BasvuruWizard.tsx
'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { basvuruWizardSchema, type BasvuruWizardInput } from '../schemas';

const STEPS = ['kisisel-bilgiler', 'aile-uyeleri', 'mali-beyan', 'belgeler', 'onay'] as const;

export function BasvuruWizard() {
  const [step, setStep] = useState<typeof STEPS[number]>('kisisel-bilgiler');
  const form = useForm<BasvuruWizardInput>({
    resolver: zodResolver(basvuruWizardSchema),
    mode: 'onBlur',
    defaultValues: loadDraftFromStorage(),  // Auto-save (FE-FORM-06)
  });

  // Auto-save (debounced)
  useAutoSave(form.watch(), 'basvuru-draft', 2000);

  const handleNext = async () => {
    const currentFields = STEP_FIELDS[step];
    const isValid = await form.trigger(currentFields);
    if (!isValid) return;
    const nextIdx = STEPS.indexOf(step) + 1;
    if (nextIdx < STEPS.length) setStep(STEPS[nextIdx]);
  };

  return (
    <FormProvider {...form}>
      <Stepper currentStep={step} steps={STEPS} />
      {step === 'kisisel-bilgiler' && <KisiselBilgilerStep />}
      {step === 'aile-uyeleri' && <AileUyeleriStep />}
      {/* ... */}
      <WizardNav onNext={handleNext} onPrev={() => setStep(prev)} />
    </FormProvider>
  );
}
```

Kural:
- Tek `useForm` instance — adimlar arasi state paylasimi
- Zod schema tek (`basvuruWizardSchema`), ama step-bazli field validation `form.trigger(stepFields)`
- Final submit son adimda
- Browser back button → step geriye git, form data kaybolmaz

### FE-FORM-06: Auto-Save Draft (MEDIUM)

Multi-step veya uzun formlarda auto-save localStorage'a:

```typescript
// shared/hooks/useAutoSave.ts
export function useAutoSave<T>(value: T, key: string, debounceMs = 2000) {
  const debouncedValue = useDebounce(value, debounceMs);

  useEffect(() => {
    if (!debouncedValue) return;
    localStorage.setItem(`draft:${key}`, JSON.stringify({
      data: debouncedValue,
      savedAt: new Date().toISOString(),
    }));
  }, [debouncedValue, key]);
}

export function loadDraftFromStorage<T>(key: string): T | undefined {
  const raw = localStorage.getItem(`draft:${key}`);
  if (!raw) return;
  const { data, savedAt } = JSON.parse(raw);
  // 24 saat sonra eski draft'lar silinir
  if (Date.now() - new Date(savedAt).getTime() > 86400000) {
    localStorage.removeItem(`draft:${key}`);
    return;
  }
  return data;
}
```

Kural:
- Submit basarili → `localStorage.removeItem('draft:...')` zorunlu
- 24 saat eski draft otomatik silinir
- PII iceren draft'lar (TC kimlik, telefon) localStorage'a YAZILMAZ — sadece state'te kalir, ya da encrypted

---

## 6. Accessibility (a11y) Kurallari — WCAG 2.1 AA

| KURAL | ACIKLAMA |
|-------|----------|
| Semantic HTML | `<nav>`, `<main>`, `<section>`, `<form>`, `<table>` — `<div>` soup YASAK |
| Her input'ta label | `<label htmlFor>` ZORUNLU, placeholder YETERSIZ |
| Kontrast orani | Normal text 4.5:1, large text 3:1 |
| Keyboard navigasyon | Tab order = visual order, tum islevler keyboard erisilebilir |
| Focus visible | `:focus-visible` ring HER ZAMAN gorunur |
| Focus management | Modal acilinca -> ilk element, kapaninca -> tetikleyen butona |
| aria-live | Status mesajlari `polite`, hata mesajlari `assertive` |
| Alt text | Tum gorsellerde `alt`, decorative ise `alt=""` |
| prefers-reduced-motion | Animasyonlar bu media query'i kontrol eder |

```tsx
// YASAK - div soup, label yok, focus yok
<div onClick={handleClick}>
  <div>
    <input placeholder="Email" />
    <div className="btn" onClick={handleSubmit}>Gonder</div>
  </div>
</div>

// DOGRU - Semantic HTML, label, keyboard, focus
<form onSubmit={handleSubmit}>
  <div>
    <label htmlFor="email">Email</label>
    <input
      id="email"
      type="email"
      aria-describedby="email-error"
      aria-invalid={!!errors.email}
    />
    {errors.email && (
      <p id="email-error" role="alert" aria-live="assertive">
        {errors.email.message}
      </p>
    )}
  </div>
  <button type="submit">Gonder</button>
</form>
```

```tsx
// DOGRU - Focus management (Modal)
export function ConfirmDialog({ open, onClose, triggerRef }) {
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      firstFocusRef.current?.focus(); // Modal acilinca ilk elemente focus
    } else {
      triggerRef.current?.focus(); // Kapaninca tetikleyen butona don
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <button ref={firstFocusRef}>Iptal</button>
        <button>Onayla</button>
      </DialogContent>
    </Dialog>
  );
}
```

```css
/* DOGRU - prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### FE-A11Y-10: Skip Link Zorunlu (HIGH) — WCAG 2.4.1

Her sayfada "Ana icerige atla" linki zorunlu:

```tsx
// shared/components/atoms/SkipLink.tsx
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded"
    >
      Ana icerige atla
    </a>
  );
}

// app/layout.tsx
<body>
  <SkipLink />
  <Header />
  <main id="main-content" tabIndex={-1}>
    {children}
  </main>
</body>
```

Kural:
- `<SkipLink />` her layout'ta zorunlu (root + sub-layouts)
- `<main id="main-content">` tek olmali (per page)
- Klavye `Tab` ile ilk Tab basisinda gorunur olmali

---

## 7. Bundle & Performance Kurallari

| KURAL | ACIKLAMA |
|-------|----------|
| Heavy lib lazy load | Chart, map -> `dynamic(() => import(...), { ssr: false })` |
| Tree-shake imports | `import { format } from 'date-fns'` — full import YASAK |
| Image optimization | `next/image` + width/height + priority (LCP) |
| Font optimization | `next/font` — CDN font link YASAK |
| Code split per route | Next.js otomatik, buyuk feature lib -> dynamic import |
| React.memo | SADECE: memo child'a gecen prop + parent sik render |
| useMemo | SADECE: pahali hesaplama (sort/filter 1000+ item) |
| useCallback | SADECE: memo child prop + useEffect dependency |
| Core Web Vitals | LCP < 2.5s, FID < 100ms, CLS < 0.1, INP < 200ms |

```tsx
// YASAK - Heavy library static import
import { Chart } from 'chart.js'; // Bundle'a tamamen dahil olur!

// DOGRU - Dynamic import
const Chart = dynamic(() => import('../components/chart'), { ssr: false });
```

```tsx
// YASAK - Gereksiz memo/useMemo/useCallback
const MemoizedItem = React.memo(SimpleListItem); // Basit component, memo GEREKSIZ

// DOGRU - Gercekten gerektiginde
const sortedItems = useMemo(
  () => items.sort((a, b) => a.name.localeCompare(b.name)),
  [items], // 1000+ item sort -> useMemo DOGRU
);
```

```tsx
// YASAK - CDN font
<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" />

// DOGRU - next/font
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });
```

### FE-PERF-09: Bundle Size Budget (HIGH)

Sayfa bazli bundle budget — Next.js `analyze` ile kontrol:

| Sayfa Tipi | Initial JS Max | Total Page Weight Max |
|------------|----------------|------------------------|
| Public (giris, kayit) | 150 kB | 300 kB |
| Auth (hesabim, randevularim) | 200 kB | 500 kB |
| Yonetim (dashboard, list) | 250 kB | 800 kB |
| Heavy (rapor, harita) | 350 kB | 1.5 MB |

CI'da `npx next build && next-bundle-analyzer` → budget asimi = build fail.

Tools:
- `@next/bundle-analyzer`
- `bundlesize` paketi (CI integration)

Hangi sayfanin hangi budget'a girdigi `next.config.js`'de tanimli.

---

## 8. Component & Dosya Yapisi Kurallari

| KURAL | ACIKLAMA |
|-------|----------|
| VSA primary | Feature klasoru birincil organizer |
| Atomic Design | Feature icinde atoms/molecules/organisms/templates |
| 1 feature -> feature'da | Component tek feature'a ozel ise `features/{f}/components/` |
| 2+ feature -> shared | Cross-feature ise `shared/components/` |
| shared/ui DOKUNMA | shadcn/ui dosyalari — sadece `npx shadcn add` ile |
| Naming | Component: PascalCase, hook: useCamelCase, action: camelCase, schema: PascalCaseSchema |
| Barrel export YASAK | `index.ts` re-export dosyasi KULLANMA — dogrudan import |

```
src/
  app/                          # Next.js App Router
    (dashboard)/
      xxxs/
        page.tsx                # Server Component (ASLA 'use client')
        loading.tsx
        error.tsx
  features/
    xxx/
      actions/                  # Server Actions
        get-xxxs.ts
        create-xxx.ts
      components/               # Feature-specific components
        xxx-list.tsx
        xxx-form.tsx
        xxx-filter-bar.tsx
      hooks/                    # Feature-specific hooks
        use-xxxs.ts
      schemas/                  # Zod schemas
        xxx.ts
  shared/
    components/                 # Cross-feature components
      data-table/
      confirm-dialog/
    ui/                         # shadcn/ui — DOKUNMA
      button.tsx
      input.tsx
    lib/                        # Utilities
      api-client.ts
    hooks/                      # Cross-feature hooks
      use-debounce.ts
```

```typescript
// YASAK - Barrel export
// features/xxx/components/index.ts
export { XxxList } from './xxx-list';
export { XxxForm } from './xxx-form';

// DOGRU - Dogrudan import
import { XxxList } from '@/features/xxx/components/xxx-list';
import { XxxForm } from '@/features/xxx/components/xxx-form';
```

---

## 9. Hook Kurallari

### Kural 9.1: Conditional Hook YASAK

```tsx
// YASAK - conditional hook
if (isAdmin) {
  const data = useQuery(...); // Hook conditional YASAK
}

// DOGRU - her zaman cagir, enabled ile kontrol
const data = useQuery({
  queryKey: ['admin-data'],
  queryFn: () => getAdminData(),
  enabled: isAdmin,
});
```

### Kural 9.2: useEffect ile Data Fetch YASAK

```tsx
// YASAK - useEffect ile data fetch
useEffect(() => {
  fetch('/api/users').then(res => res.json()).then(setUsers);
}, []);

// DOGRU - TanStack Query + Server Action
const { data: users, isLoading } = useQuery({
  queryKey: ['users'],
  queryFn: () => getUsers(), // Server Action
});
```

### Kural 9.3: Custom Hook Naming

```typescript
// YASAK - use prefix'siz
function fetchUsers() { return useQuery(...); } // 'use' prefix ZORUNLU

// DOGRU
function useUsers() { return useQuery(...); }
```

---

## 9b. CASL/ABAC Frontend Kurallari (tek kanon)

> **HER sayfa ABAC kullanir.** Bi-Modal kavrami v11 refactor'da kaldirildi. Plugin'in
> backend tarafinda her Resource `abacEnabled: true` ile baslar; frontend de simetrik.

### FE-CASL-01: Sayfada `<Can>` ZORUNLU (CRITICAL)

Tum sayfalarda permission check icin SADECE `<Can>` veya `useCurrentAbility` kullan. `roles.includes(...)` YASAK.

```tsx
// YASAK - RBAC kontrolu
{user.roles.includes('ADMIN') && <DeleteButton />}

// DOGRU - <Can> pattern (CASL ability)
<Can I="DELETE" a="YeniModul" this={item}>
  <DeleteButton />
</Can>
```

Sebep: ABAC condition + field whitelist sadece `<Can>` ile uygulanir. `roles.includes` instance-level filtreyi gormez.

### FE-CASL-02: `<Can>` Instance-Aware (HIGH)

ABAC'in gucunden faydalanmak icin instance ver. Sadece type-level kontrol yetersiz.

```tsx
// EKSIK - sadece type-level (her kayit icin ayni sonuc)
<Can I="UPDATE" a="YeniModul">
  <EditButton />
</Can>

// TAM - instance-level (her kayit icin condition degerlendirilir)
<Can I="UPDATE" a="YeniModul" this={item}>
  <EditButton />
</Can>
```

Sebep: Backend `condition: { groupPath: { startsWith: '{{groupPath}}' } }` tanimlamis. Instance vermeden frontend bunu uygulayamaz.

**Field-level kullanim:**

```tsx
<Can I="READ" a="YeniModul" field="tcKimlikNo">
  <p>TC: {item.tcKimlikNo}</p>
</Can>
```

<!-- KALDIRILDI (v11 refactor): FE-CASL-03 (Eski Sayfaya <Can> Eklemek YASAK)
     Eski sayfa kavrami yok; tum sayfalarda <Can> ZORUNLU (FE-CASL-01). -->


### FE-CASL-04: `useCurrentAbility` Hook Pattern (MEDIUM)

Programatik kontrol (event handler icinde, conditional logic) icin hook kullan:

```typescript
'use client';
import { useCurrentAbility } from '@/shared/lib/casl/use-current-ability';
import { subject } from '@casl/ability';

export function YeniModulRow({ item }: { item: YeniModul }) {
  const ability = useCurrentAbility();
  const canEdit = ability.can('UPDATE', subject('YeniModul', item));

  return (
    <tr>
      <td>{item.ad}</td>
      <td>
        <Button onClick={handleClick} disabled={!canEdit}>
          Duzenle
        </Button>
      </td>
    </tr>
  );
}
```

**Kural:** `subject(typeName, instance)` ile sarmadan `ability.can('UPDATE', item)` cagrisi instance-level kontrol yapamaz.

---

## 10. Anti-Pattern Kontrol Listesi

Her PR'da kontrol et:

- [ ] Client'tan dogrudan API call YOKTUR (Server Action kullanilmis)
- [ ] server-only dosya client import chain'ine SIZMAMIS (BOUNDARY-01)
- [ ] Barrel export server/client KARISTIRMAMIS (BOUNDARY-03)
- [ ] 'use client' dosyasinda next/headers, next/cookies import YOKTUR
- [ ] JWT/token client bundle'da YOKTUR
- [ ] `any` type YOKTUR
- [ ] `as Type` YOKTUR
- [ ] `console.log` YOKTUR
- [ ] page.tsx'de `'use client'` icerige gore dogru kullanilmis (interaktifse var, statikse yok)
- [ ] Server data Zustand'da tutulMUYOR (TanStack Query kullanilmis)
- [ ] Heavy library static import YOKTUR (dynamic import kullanilmis)
- [ ] Semantic HTML kullanilmis (`<div>` soup degil)
- [ ] Her input'ta `<label>` var
- [ ] Focus management dogru (modal, delete, navigation)
- [ ] `useEffect` ile data fetch YOKTUR (TanStack Query kullanilmis)
- [ ] Barrel export (`index.ts`) YOKTUR
- [ ] Zod validation her form'da VAR
- [ ] `prefers-reduced-motion` kontrol edilmis (animasyonlar)
- [ ] Sayfada `<Can>` pattern kullanilmis, `roles.includes` YOK (FE-CASL-01)
- [ ] `<Can>` instance-aware kullanilmis (`this={item}` prop'u var) (FE-CASL-02)

---

## 11. Tracing & Correlation Kurallari

### TRACE-01: Frontend Trace ID Yonetimi (HIGH)

Browser sayfasi acildiginda trace context kurulur:
- `window.__TRACE_ID` = `crypto.randomUUID()` (sayfa session'i boyunca sabit)
- Server Action icinde `headers().get('x-trace-id')` → yoksa yeni UUID uret
- `x-correlation-id` = `trace_id + ':' + randomUUID()` (her action icin unique)

### TRACE-02: apiFetch Header Propagation (HIGH)

Tum apiFetch cagrilari header'lari otomatik ekler:
- `x-trace-id` (sayfa boyu sabit)
- `x-correlation-id` (her aksiyon icin unique)

Server Action implementation:

```typescript
'use server';
import { headers } from 'next/headers';

export async function someAction(...) {
  const h = await headers();
  const traceId = h.get('x-trace-id') ?? crypto.randomUUID();
  const correlationId = `${traceId}:${crypto.randomUUID()}`;
  return apiFetch('/endpoint', {
    headers: { 'x-trace-id': traceId, 'x-correlation-id': correlationId },
  });
}
```

### TRACE-03: OpenTelemetry Onerisi (MEDIUM)

Manuel header propagation yerine `@opentelemetry/sdk-node` + `@opentelemetry/instrumentation-http` ile auto-instrument tercih edilir. Manuel yazildiysa context.propagation API'sine sadik kalinir.

---

## 12. Frontend Routing

### FE-ROUTE-01: Route Group Disiplini (MEDIUM)

Next.js route gruplari kanonik:

| Group | Amac | Layout | Auth |
|-------|------|--------|------|
| `(public)/` | Giris, kayit, hakkinda, sss | Sade header, footer | Anon |
| `(auth)/` | Hesabim, randevularim, basvurularim | User dashboard | Authenticated user |
| `(yonetim)/` | Admin paneli, modul yonetimi | Admin sidebar | `MANAGE` permission |
| `(fullscreen)/` | Kurul oturumu, sunum modu | Header/sidebar yok | Authenticated + role |
| `(api)/` | API route handler'lar | — | Sunucu ici |

Klasor adi **parantez icinde** = route'a yansimaz (`/giris` → `(public)/giris/page.tsx`).

**YASAK:**
- `dashboard/` (route group olmadan) → `/dashboard` URL'sinde
- `(yonetim)/` icinde anon erisimli sayfa → permission ihlali

---

## 13. Frontend Date & Money

### FE-DATE-01: `Intl.DateTimeFormat('tr-TR')` Zorunlu (HIGH)

Frontend tarih/saat gosterimi kanonik:

**YASAK:**
```tsx
new Date().toLocaleString()           // Browser locale - belirsiz
date.toLocaleDateString('en-US')      // Ingilizce format Turkce sayfada
moment(date).format('DD.MM.YYYY')     // moment.js deprecated
```

**DOGRU:**
```tsx
// shared/lib/format/date.ts
import { formatInTimeZone } from 'date-fns-tz';
import { tr } from 'date-fns/locale';

export const formatDate = (date: Date | string) =>
  formatInTimeZone(date, 'Europe/Istanbul', 'dd MMM yyyy', { locale: tr });
  // → '19 May 2026'

export const formatDateTime = (date: Date | string) =>
  formatInTimeZone(date, 'Europe/Istanbul', 'dd MMM yyyy HH:mm', { locale: tr });
  // → '19 May 2026 14:30'

export const formatRelative = (date: Date | string) =>
  formatDistanceToNow(date, { locale: tr, addSuffix: true });
  // → '3 saat once'
```

Library: `date-fns` + `date-fns-tz` (tree-shakeable, locale destekli).

### MNY-02: `Intl.NumberFormat('tr-TR')` Zorunlu (HIGH)

Frontend para gosterimi tek format:

**YASAK:**
```tsx
<span>{(amount / 100).toFixed(2)} TL</span>        // → '1234.56 TL'
<span>{amount.toLocaleString()}</span>             // browser locale - belirsiz
```

**DOGRU:**
```tsx
const formatTRY = (kurus: number) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(kurus / 100);

<span>{formatTRY(yardim.miktarKurus)}</span>  // → '1.234,56 ₺'
```

Helper: `shared/lib/format/money.ts` icinde `formatTRY()`, `formatUSD()` exported.

---

## Ozet: Frontend Demir Kurallar

| Kod | Kural | Kisaca | Impact |
|-----|-------|--------|--------|
| FTS-01..11 | TypeScript/React | any, as, !, console.log, @ts-ignore YASAK | CRITICAL |
| SA-01..04 | Server Action | Client API'ye GITMEZ, Server Action ZORUNLU | CRITICAL |
| BOUNDARY-01..03 | Server/Client | server-only client'a SIZMAZ, barrel karistirmaz | CRITICAL |
| COMP-01..04 | SC/CC | Default SC, page.tsx icerige gore, leaf'te CC | HIGH |
| STATE-01..04 | State Management | Server data=TQ, URL=nuqs, UI=Zustand, Form=RHF | CRITICAL |
| FORM-01..04 | Form & Validation | Zod + RHF + Server Action + cift validation | CRITICAL |
| A11Y-01..09 | a11y WCAG 2.1 AA | Semantic HTML, label, kontrast, keyboard, focus | HIGH |
| PERF-01..08 | Bundle & Performance | Heavy lib lazy, tree-shake, next/image, memo gerektiginde | HIGH |
| FILE-01..06 | Dosya Yapisi | VSA primary, Atomic Design, barrel export YASAK | HIGH |
| HOOK-01..03 | Hook Kurallari | Conditional hook YASAK, useEffect fetch YASAK | CRITICAL |
| FE-CASL-01,02,04 | CASL/ABAC Frontend | `<Can>` ZORUNLU, instance-aware, useCurrentAbility hook | CRITICAL |
