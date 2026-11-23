# W0NDERSUPERIOR Demir Kurallari — Shared (Backend + Frontend)

Bu kurallar hem backend hem frontend icin gecerlidir. **HICBIR KOSULDA** ihlal edilemez. Violation = Reddedilen kod.

## Kural Taksonomisi

| Kod | Kural | Impact |
|-----|-------|--------|
| VAL-01 | Cift validation zorunlu (Zod + class-validator) | CRITICAL |
| VAL-02 | Karistirma yasak (Backend=class-validator, Frontend=Zod) | CRITICAL |
| VAL-03 | Input validation != Business rule | HIGH |
| ERR-01 | Raw error message client'a donme yasak | CRITICAL |
| ERR-02 | Dogru exception turleri kullan | HIGH |
| API-02 | REST conventions (POST=201, DELETE=204) | HIGH |
| API-03 | Pagination (pageNumber + pageSize) | HIGH |
| API-04 | camelCase JSON response | MEDIUM |
| API-05 | Consistent error format | HIGH |
| CONTRACT-01 | Field name eslesmesi zorunlu | CRITICAL |
| CONTRACT-02 | Cross-reference zorunlu | CRITICAL |
| CONTRACT-03 | Tip eslesmesi (string=z.string, number=z.coerce.number) | HIGH |
| CONTRACT-04 | Enum eslesmesi birebir | HIGH |
| CONTRACT-05 | Response DTO eslesmesi | HIGH |
| SEC-01 | Secret management (.env, env vars) | CRITICAL |
| SEC-02 | JWT RS256 (HS256 yasak) | CRITICAL |
| SEC-03 | Permission check (CASL) | CRITICAL |
| SEC-04 | Redis-backed rate limiting | HIGH |
| SEC-05 | HTTPS production zorunlu | CRITICAL |
| SEC-06 | bcrypt workFactor >= 12 | HIGH |
| SEC-07 | Token storage (hash, plaintext yasak) | CRITICAL |
| SEC-08 | Security headers zorunlu | HIGH |
| SEC-09 | Hardcoded secret yasak | CRITICAL |
| TEST-01 | TDD zorunlu (RED-GREEN-REFACTOR) | CRITICAL |
| TEST-02 | Dogru test araclari (Jest/Vitest/Playwright) | HIGH |
| TEST-03 | Coverage >= %80 | HIGH |
| TEST-04 | Test isolation | HIGH |
| TEST-05 | Mock cleanup (afterEach) | HIGH |
| TEST-06 | Tam dosya yolu ile test execution | HIGH |
| TEST-07 | a11y test (axe-core) zorunlu | HIGH |
| GIT-01 | Turkce commit mesaji | HIGH |
| GIT-02 | Prefix zorunlu (feat/fix/refactor/...) | HIGH |
| GIT-03 | Izinsiz commit yasak | CRITICAL |
| GIT-04 | CLAUDE.md git'e eklenmez | HIGH |
| GIT-05 | force push yasak | CRITICAL |
| GIT-06 | main/master/test branch koruma — dogrudan kod yazma YASAK | CRITICAL |
| GIT-07 | Feature branch zorunlu — test branch'ten dallanir | HIGH |
| GIT-08 | Branch naming convention (feature/W0NDERSUPERIOR-XXX-slug) | MEDIUM |
| GIT-09 | Incremental push | MEDIUM |
| GIT-10 | Worktree ZORUNLU — skill tetiklenince worktree SART | CRITICAL |
| GIT-11 | Merge hedefi = test branch (master/main DEGIL) | CRITICAL |
| GIT-12 | Ana repo sadece git fetch/pull — worktree'de calis | CRITICAL |
| GIT-13 | Worktree adi formati: w0nderSuperior-{jiraNumara} (Jira ID prefix yok, sadece numara) | CRITICAL |
| GIT-14 | Jira biletsiz worktree ACILMAZ — once bilet olustur | CRITICAL |
| GIT-15 | Kullanici onayi OLMADAN operasyon BASLAMAZ | CRITICAL |
| EVID-01 | Evidence before claims | HIGH |
| HARD-01 | Hardcoded deger yasak | CRITICAL |
| ENUM-01 | String literal karsilastirma yasak — const reference zorunlu | CRITICAL |
| ENUM-02 | TS `enum` yasak — `const object as const` zorunlu | CRITICAL |
| ENUM-03 | Magic number yasak — DB sistem_ayarlari veya named const zorunlu | HIGH |
| ENUM-04 | Frontend enum = backend const ile BIREBIR eslesmeli | CRITICAL |
| ENUM-05 | Lookup table varsa const referans DB kod alani ile AYNI olmali | HIGH |
| SCOPE-01 | Agent scope siniri — plan disinda dosya degistirme yasak | CRITICAL |
| SCOPE-02 | Modul siniri — baska modulun dosyasina dokunma yasak | CRITICAL |
| KVKK-04 | Consent Management (cerez + aydinlatma + acik riza) | HIGH |

---

## 1. Validation Kurallari

| KURAL | ACIKLAMA |
|-------|----------|
| Cift validation ZORUNLU | Zod (frontend) + class-validator (backend) |
| Karistirma YASAK | Backend'de Zod YASAK, Frontend'de class-validator YASAK |
| Input validation =/= Business rule | Input: Validator/Schema. Business rule: Handler/Server Action icinde |
| Error mesaji Turkce | Kullaniciya gosterilen mesajlar Turkce |

### Backend = class-validator

```typescript
// DOGRU
export class CreateXxxDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
}

// YASAK - Validation yok
export class CreateXxxDto {
  name: string;  // DECORATOR YOK!
}
```

Global ValidationPipe: `whitelist: true` + `forbidNonWhitelisted: true`

### Frontend = Zod

```typescript
// DOGRU
const createXxxSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

// YASAK - Validation yok
const handleSubmit = (data) => { ... };  // ZOD NEREDE?
```

---

## 2. Error Handling Kurallari

### Kural 2.1: Raw Error YASAK

Raw error message ASLA client'a donme. Error sanitization ZORUNLU.

```typescript
// YASAK
return { error: error.message };  // INTERNAL BILGI SIZINTISI!

// DOGRU
if (error instanceof ApiError) {
  return { success: false, error: error.message };
}
return { success: false, error: 'Islem sirasinda bir hata olustu' };
```

### Kural 2.2: Exception Turleri

| Durum | Exception | HTTP |
|-------|-----------|------|
| Yetki yok | ForbiddenException | 403 |
| Kimlik dogrulanamadi | UnauthorizedException | 401 |
| Kayit bulunamadi | NotFoundException | 404 |
| Cakisma (duplicate) | ConflictException | 409 |
| Gecersiz input | BadRequestException | 400 |
| Sunucu hatasi | InternalServerErrorException | 500 |

```typescript
// DOGRU - Aciklayici mesaj
throw new ConflictException('Bu email adresi zaten kayitli');
throw new NotFoundException('Kullanici bulunamadi');

// YASAK - Generic mesaj
throw new Error('Hata');
throw new BadRequestException('Error');
```

---

## 3. API Design Kurallari

| KURAL | ACIKLAMA |
|-------|----------|
| REST conventions | POST=201 Created, GET=200, PUT=200, DELETE=204 |
| Pagination | `pageNumber` + `pageSize` query params (skip/take YASAK) |
| camelCase JSON | Response body camelCase, enum as string |
| Consistent error format | Tum hatalar ayni response yapisi ile donmeli |

```typescript
// DOGRU - REST conventions
@Post()
@HttpCode(HttpStatus.CREATED) // 201
async create(@Body() dto: CreateXxxDto) { ... }

@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT) // 204
async remove(@Param('id') id: string) { ... }

// YASAK - Yanlis status code
@Post()
@HttpCode(200) // POST icin 200 YANLIS, 201 olmali
async create(@Body() dto: CreateXxxDto) { ... }
```

```typescript
// DOGRU - Pagination
// GET /api/v1/users?pageNumber=1&pageSize=20
interface PaginatedResponse<T> {
  data: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

// YASAK - skip/take dogrudan expose etme
// GET /api/v1/users?skip=0&take=20
```

---

## 4. API Contract Alignment Kurallari

> **DEMIR PRENSIP:** Veri ONCE dogrulanir, SONRA islenir. Backend VE frontend'te ayri ayri dogrulama ZORUNLUDUR.
> Hicbir kullanici girdisi dogrulanmadan handler/action'a ulasamaz.

| KURAL | ACIKLAMA | Impact |
|-------|----------|--------|
| Field name eslesmesi ZORUNLU | Frontend Zod schema field isimleri Backend DTO field isimleriyle BIREBIR eslesmek ZORUNDADIR (camelCase) | CRITICAL |
| Cross-reference ZORUNLU | Frontend Zod schema yazarken Backend DTO field isimlerini kontrol et. Farkli isim YASAK | CRITICAL |
| Tip eslesmesi | Backend `string` = Frontend `z.string()`, Backend `number` = Frontend `z.coerce.number()` | HIGH |
| Enum eslesmesi | Backend const degerler = Frontend `z.enum([...])` degerleri BIREBIR ayni (ENUM-04 ile birlikte) | CRITICAL |
| Response DTO eslesmesi | Backend Response DTO field isimleri = Frontend TypeScript interface field isimleri | HIGH |
| Zod-first validation | Frontend'te Zod schema OLMADAN Server Action'a veri gonderme YASAK | CRITICAL |
| class-validator-first | Backend'te class-validator decorator OLMADAN handler'a veri ulasma YASAK | CRITICAL |
| Validation before logic | Handler/Action icinde IS MANTIGI ONCESI validation gecmis OLMALI | CRITICAL |

### Data-First Validation Prensibi

```typescript
// YASAK — validation yok, direkt isleme
async function createBasvuru(data: unknown) {
  const basvuru = await prisma.basvuru.create({ data });  // TEHLIKE!
}

// DOGRU — Frontend: Zod ONCE dogrular
const schema = z.object({
  tcKimlikNo: z.string().length(11),
  ad: z.string().min(2).max(100),
  durumKodu: z.enum(['BEKLEMEDE', 'TESPIT_YAPILDI'] as const),  // ENUM-04 uyumlu
});

export async function createBasvuruAction(formData: FormData): Promise<ActionResult<Basvuru>> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: parsed.error.flatten() };
  // Artik parsed.data TYPE-SAFE
  return await apiPost('/api/v1/basvurular', parsed.data);
}

// DOGRU — Backend: class-validator ONCE dogrular (ValidationPipe)
export class CreateBasvuruDto {
  @IsString() @Length(11, 11) tcKimlikNo: string;
  @IsString() @MinLength(2) @MaxLength(100) ad: string;
  @IsIn(Object.values(SY_BASVURU_DURUM_KODLARI)) durumKodu: string;  // ENUM-01 + ENUM-05 uyumlu
}
```

### Validation Katmanlari (4 Katman)

```
KATMAN 1 — Frontend Zod (form submit oncesi)
  → z.string().min(2), z.enum([...]), z.coerce.number()
  → Kullaniciya ANINDA hata mesaji (UX)

KATMAN 2 — Server Action Zod (server-side re-validation)
  → Ayni schema, ama server'da TEKRAR dogrula
  → Client-side bypass'i engelle

KATMAN 3 — Backend class-validator (DTO pipeline)
  → @IsString(), @IsEnum(), @IsUUID()
  → API sinirinda GARANTI dogrulama

KATMAN 4 — Domain validation (business rules)
  → Entity.Create() factory, Value Object constructor
  → Is kurali dogrulamasi (tarih aralik, yetki, state transition)
```

**KURAL:** Katman 1-3 ATLANILAMAZ. Katman 4 is kuralina gore opsiyonel.

### Contract Mismatch Ornekleri

```
YASAK:
  Backend DTO:  CreateUserDto { userName: string, phoneNumber: string }
  Frontend Zod: createUserSchema = z.object({ name: z.string(), phone: z.string() })
  → "userName" vs "name" = MISMATCH!
  → "phoneNumber" vs "phone" = MISMATCH!

DOGRU:
  Backend DTO:  CreateUserDto { userName: string, phoneNumber: string }
  Frontend Zod: createUserSchema = z.object({ userName: z.string(), phoneNumber: z.string() })
  → camelCase eslesmesi: userName ↔ userName ✓, phoneNumber ↔ phoneNumber ✓
```

### Enum Contract Eslesmesi (ENUM-04 ile birlikte)

```typescript
// BACKEND — shared/constants/*.ts
export const SY_BASVURU_DURUM_KODLARI = {
  BEKLEMEDE: 'BEKLEMEDE',
  TESPIT_YAPILDI: 'TESPIT_YAPILDI',
  KURULDA: 'KURULDA',
  ONAYLANDI: 'ONAYLANDI',
} as const;

// BACKEND DTO — @IsIn ile const'tan dogrulama
export class UpdateBasvuruDurumDto {
  @IsIn(Object.values(SY_BASVURU_DURUM_KODLARI))
  durumKodu: string;
}

// FRONTEND — Zod enum AYNI degerlerle
export const basvuruDurumSchema = z.enum([
  'BEKLEMEDE', 'TESPIT_YAPILDI', 'KURULDA', 'ONAYLANDI'
] as const);

// FRONTEND — Label mapping (UI icin)
export const BASVURU_DURUM_LABELS: Record<BasvuruDurum, string> = {
  BEKLEMEDE: 'Beklemede',
  TESPIT_YAPILDI: 'Tespit Yapıldı',
  KURULDA: 'Kurulda',
  ONAYLANDI: 'Onaylandı',
};
```

**YASAK:** Backend'te olan deger frontend'te YOK, veya tam tersi.

### Contract Dogrulama Zamani

```
GELISTIRME SIRASINDA:
  1. Backend DTO yazilir → field isimleri + tipler + enum'lar
  2. Frontend Zod schema yazilir → BIREBIR ayni field isimleri + tipler + enum'lar
  3. w0nderSuperior-explorer contract check: DTO ↔ Zod field eslesmesi kontrol

REVIEW SIRASINDA:
  spec-reviewer: CONTRACT-01..05 + ENUM-04 birlikte kontrol
  code-quality-reviewer: Validation decorator/schema eksikligi kontrol
```

### Tip Eslesmesi Tablosu

| Backend (class-validator) | Frontend (Zod) | Not |
|---------------------------|----------------|-----|
| `@IsString() name: string` | `name: z.string()` | |
| `@IsInt() count: number` | `count: z.coerce.number().int()` | `coerce` form'dan gelince string→number |
| `@IsUUID() id: string` | `id: z.string().uuid()` | |
| `@IsEmail() email: string` | `email: z.string().email()` | |
| `@IsBoolean() active: boolean` | `active: z.boolean()` | |
| `@IsOptional() @IsString() desc?: string` | `desc: z.string().optional()` | |
| `@IsIn(Object.values(CONST))` | `z.enum([...] as const)` | ENUM-04: const degerleri AYNI |
| `@IsDateString() date: string` | `date: z.string().datetime()` | |
| `@IsArray() @IsString({ each: true }) tags: string[]` | `tags: z.array(z.string())` | |
| `@ValidateNested() @Type(() => SubDto)` | `z.object({ ... })` nested | |

---

## 5. Security Kurallari

| KURAL | ACIKLAMA |
|-------|----------|
| Secret management | `.env.local` (dev), env vars (prod). Source code'da secret YASAK |
| JWT RS256 | Asymmetric key. HS256 YASAK |
| Permission check | Backend: PoliciesGuard (CASL). Frontend: CASL `Can` component |
| Rate limiting | Redis-backed. In-memory rate limit YASAK (multi-instance'da calismaz) |
| HTTPS | Production'da zorunlu |
| Password hashing | bcrypt workFactor >= 12 |
| Token storage | Refresh token hash (SHA-256). Plaintext YASAK. JWT client bundle'da YASAK |
| Security headers | X-Content-Type-Options, X-Frame-Options, CSP, HSTS |
| Hardcoded secret | Source code'da YASAK |

```typescript
// YASAK - Hardcoded secret
const JWT_SECRET = 'my-super-secret-key'; // YASAK!
const API_KEY = 'sk-1234567890'; // YASAK!

// DOGRU - Environment variable
const jwtSecret = this.configService.get<string>('JWT_SECRET');
const apiKey = process.env.API_KEY;
```

```typescript
// YASAK - HS256
JwtModule.register({
  secret: 'shared-secret', // YASAK! HS256 symmetric
});

// DOGRU - RS256
JwtModule.register({
  privateKey: fs.readFileSync('private.pem'),
  publicKey: fs.readFileSync('public.pem'),
  signOptions: { algorithm: 'RS256' },
});
```

```tsx
// DOGRU - Frontend'de CASL permission check
import { Can } from '@casl/react';

<Can I="create" a="User">
  <CreateUserButton />
</Can>

// YASAK - Permission check yok
<CreateUserButton /> // Herkes goruyor!
```

---

## 6. Test Kurallari

### Kural 6.1: TDD ZORUNLU

```
1. TEST YAZ (RED) -> Test FAIL etmeli
2. KOD YAZ (GREEN) -> Test PASS etmeli
3. REFACTOR -> Test hala PASS
4. COMMIT -> Evidence ile
```

### Kural 6.2: Test Araclari

| Alan | Arac | Aciklama |
|------|------|----------|
| Backend unit test | Jest + @nestjs/testing | Her handler min 1 happy + 1 error |
| Frontend component test | Vitest + RTL + MSW | getByRole > getByTestId |
| Backend integration test | supertest | API endpoint testleri |
| Frontend E2E test | Playwright | Kritik kullanici akislari |
| a11y test | axe-core | Her component'te ZORUNLU |

### Kural 6.3: Coverage Hedef

Minimum **%80** line coverage. Bu hedefin altinda PR merge YASAK.

### Kural 6.4: Test Isolation

Her test kendi data'sini olusturur, baska teste bagimli DEGIL.

```typescript
// YASAK - Testler arasi bagimlilik
describe('User CRUD', () => {
  let userId: string; // Test arasi paylasim YASAK!
  it('should create', () => { userId = result.id; });
  it('should read', () => { await getUser(userId); }); // Onceki teste bagimli!
});

// DOGRU - Her test izole
describe('User CRUD', () => {
  it('should create', () => {
    const user = await createUser(mockData());
    expect(user.id).toBeDefined();
  });
  it('should read', () => {
    const user = await createUser(mockData()); // Kendi data'sini olustur
    const found = await getUser(user.id);
    expect(found.id).toBe(user.id);
  });
});
```

### Kural 6.5: Mock Cleanup ZORUNLU

```typescript
afterEach(() => {
  jest.clearAllMocks();
});
```

### Kural 6.7: Test Execution & Memory Kurallari

| KURAL | ACIKLAMA |
|-------|----------|
| TAM dosya yolu ZORUNLU | Task sirasinda `--testPathPattern` YASAK, tam dosya yolu ver |
| Full suite SADECE final | Tum testler yalnizca final kontrolde ve /review'da calistirilir |
| Watch mode YASAK | `jest --watch` / `vitest --watch` agent icinde YASAK (RAM leak) |
| `--no-coverage` RED/GREEN | RED/GREEN fazinda coverage hesaplamasi gereksiz, RAM tasarrufu |
| `--forceExit` integration | Integration testlerde `--forceExit` ZORUNLU (acik handle temizligi) |
| `--maxWorkers=2` integration | Integration testlerde worker sayisi sinirla (RAM tasarrufu) |
| E2E sadece final | Playwright testler task sirasinda CALISTIRILMAZ, sadece final kontrolde |

```bash
# DOGRU - Task sirasinda (tam dosya yolu — Jest filesystem scan ATLANIR)
# Handler spec'leri COLOCATE: commands/<use-case>/ icinde, __tests__/ alt-klasoru YOK
npx jest -- src-v2/features/identity/users/application/commands/create-user/create-user.handler.spec.ts --no-coverage
npx vitest run src-v2/features/identity/components/__tests__/user-form.test.tsx
npx jest --config jest.integration.config.ts -- test/integration/identity/user.api.spec.ts --forceExit --maxWorkers=2 --no-coverage

# YASAK - Task sirasinda
npm test                                           # TUM backend testleri calistirir!
npx vitest run                                     # TUM frontend testleri calistirir!
npx playwright test                                # TUM E2E testleri calistirir!
npx jest --testPathPattern=user                    # Pattern genis eslesiyor, tum user testleri!
jest --watch                                       # RAM leak + agent'ta anlamsiz!

# DOGRU - Final kontrol (1 kez)
npm test && npx vitest run && npx playwright test && npm run build
```

**Neden tam dosya yolu?**
- `--testPathPattern=user` → `create-user`, `update-user`, `delete-user`, `user-list` HEPSINI esler
- `npx jest -- tam/yol/create-user.handler.spec.ts` → SADECE o dosya yuklenir, scan atlanir
- Buyuk projelerde filesystem scan bile RAM yer, tam yol ile bu adim atlanir

### Kural 6.6: a11y Test ZORUNLU

```tsx
// DOGRU - axe-core ile a11y test
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

it('should have no a11y violations', async () => {
  const { container } = render(<XxxForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 7. Git & Worktree Kurallari

### 7.1 Branch Stratejisi

```
DEMIR KURALLAR:
  1. test branch'te KOD YAZILMAZ — NOKTA.
  2. Herhangi bir skill tetiklendiginde (/w0nderSuperior, /tasarla, /uygula, /review) → WORKTREE ZORUNLU.
  3. Worktree adi = Jira task ID → w0nderSuperior-{numara}. ISTISNASIZ.
  4. Jira bileti OLMADAN worktree ACILMAZ. Bilet yoksa ONCE olusturulur.
  5. Kullanici onayi OLMADAN HICBIR operasyon BASLAMAZ.

YAPI (projenin UST DIZININDE, yanyana):
  C:\projects\
  ├── w0nderSuperior/                → test branch (BASE — dokunulmaz, sadece fetch/pull)
  ├── w0nderSuperior-100/       → feature/W0NDERSUPERIOR-100-randevu-sms (worktree)
  ├── w0nderSuperior-101/       → fix/W0NDERSUPERIOR-101-login-hata (worktree)
  └── w0nderSuperior-103/       → fix/W0NDERSUPERIOR-103-casl-permission (worktree)

  NOT: Worktree'ler .claude/ icinde DEGIL, projenin YANINDA ust dizinde olusturulur.

KURALLAR:
  1. Ana repo (w0nderSuperior/) HER ZAMAN test branch'inde kalir
  2. w0nderSuperior/ dizininde KOD YAZILMAZ, DOCS YAZILMAZ, DOSYA DEGISTIRILMEZ
  3. w0nderSuperior/ dizininde sadece: git fetch, git pull, git worktree add/remove
  4. Yeni branch = SADECE test branch'ten dallanir (baska branch YASAK)
  5. Branch acmadan ONCE: git checkout test && git pull origin test (ZORUNLU)
  6. Merge hedefi = test branch (PR → test)
  7. Tum gelistirme (kod, docs, test, plan) worktree dizinlerinde yapilir
  8. Worktree dizin adi = Jira task ID: w0nderSuperior-{numara} (BASKA ISIM YASAK)
  9. Baska branch'i base almak KESINLIKLE YASAK (feature/X'ten dallanma YOK)
  10. Jira bileti OLMADAN worktree OLUSTURULAMAZ
  11. Kullanici onayi OLMADAN operasyon BASLATILMAZ
```

### 7.2 Worktree Oluşturma Ön Koşulları (ZORUNLU)

```
HERHANGI BIR SKILL TETIKLENDIGINDE (/w0nderSuperior, /tasarla, /uygula, /review):

ADIM 0: JIRA BILET KONTROLU
  Jira bilet numarasi var mi? (W0NDERSUPERIOR-XXX)
    EVET → ADIM 1'e gec
    HAYIR → Kullaniciya sor:
      "Bu is icin Jira'da bilet yok. Bilet olusturayim mi?
       Baslik: [ozellik/bug aciklamasi]
       Tip: [Story/Bug/Task — otomatik tespit]
       Onayliyor musun? [evet / hayir]"
      
      EVET → Atlassian MCP: jira_create_issue (resmi fallback: createJiraIssue)
             + acilis sozlesmesi (reporter + mention — JIRA_PROTOCOL.md Bolum 3)
             → W0NDERSUPERIOR-XXX numarasi alinir
      HAYIR → OPERASYON IPTAL. Jira biletsiz is YAPILMAZ.
              (Bu bolum worktree/branch acan PIPELINE isleri icindir. Worktree
               ACMAYAN pipeline-disi kucuk iste HAYIR-istisnasi icin kanonik
               kaynak: JIRA_PROTOCOL.md Bolum 2 iki-katman kurali.)

ADIM 1: KULLANICI ONAYI
  "W0NDERSUPERIOR-XXX icin worktree olusturulacak:
    Dizin: ../w0nderSuperior-XXX/
    Branch: [feature/fix/refactor]/W0NDERSUPERIOR-XXX-[slug]
    Base: test (guncel)
    
    Devam? [evet / hayir]"
  
  EVET → ADIM 2'ye gec
  HAYIR → OPERASYON IPTAL

ADIM 2: TEST BRANCH GUNCELLE
  cd w0nderSuperior/
  git checkout test
  git pull origin test

ADIM 3: WORKTREE OLUSTUR
  git worktree add -B [prefix]/W0NDERSUPERIOR-XXX-[slug] ../w0nderSuperior-XXX test
  → SADECE test'ten dallanir
  → ../w0nderSuperior-XXX/ dizini olusur

ADIM 4: WORKTREE'YE GEC
  cd ../w0nderSuperior-XXX/
  → Artik bu dizinde calisma baslar (docs, kod, test, her sey)

YASAK — baska branch'ten dallanma:
  git worktree add ... feature/W0NDERSUPERIOR-99  ← YASAK!
  git worktree add ... master           ← YASAK!
  git worktree add ... main             ← YASAK!
  → SADECE test branch base alinir

YASAK — Jira biletsiz worktree:
  git worktree add ../w0nderSuperior-my-feature   ← YASAK! Jira ID yok
  git worktree add ../w0nderSuperior-quick-fix    ← YASAK! Jira ID yok
  → Worktree adi HER ZAMAN w0nderSuperior-{numara}
```

### 7.3 Worktree Calisma ve Tamamlanma

```
CALISMA:
  cd ../w0nderSuperior-XXX/
  → Kod yazma, docs yazma, test, commit, push — HEPSI burada
  → w0nderSuperior/ dizini KESINLIKLE DOKUNULMAZ

TAMAMLANMA:
  → PR olustur: [prefix]/W0NDERSUPERIOR-XXX-[slug] → test
  → PR merge edildikten sonra:
    cd ../w0nderSuperior/
    git worktree remove ../w0nderSuperior-XXX
    git branch -d [prefix]/W0NDERSUPERIOR-XXX-[slug]

PARALEL CALISMA:
  Birden fazla worktree AYNI ANDA calisabilir:
    w0nderSuperior-100/ → Agent 1 calisiyor (feature)
    w0nderSuperior-101/ → Agent 2 calisiyor (bugfix)
    w0nderSuperior-103/ → Agent 3 calisiyor (security fix)
  Her biri kendi branch'inde, birbirini GORMEZ
  Conflict check: tum worktree'ler bitince cross-diff yapilir
```

### 7.3 Branch Naming

| Tip | Format | Ornek |
|-----|--------|-------|
| Feature | `feature/W0NDERSUPERIOR-XXX-slug` | `feature/W0NDERSUPERIOR-100-randevu-sms` |
| Bugfix | `fix/W0NDERSUPERIOR-XXX-slug` | `fix/W0NDERSUPERIOR-101-login-hata` |
| Refactor | `refactor/W0NDERSUPERIOR-XXX-slug` | `refactor/W0NDERSUPERIOR-102-dashboard-perf` |
| Hotfix | `hotfix/W0NDERSUPERIOR-XXX-slug` | `hotfix/W0NDERSUPERIOR-199-critical-fix` |

### 7.4 Commit Kurallari

| KURAL | ACIKLAMA |
|-------|----------|
| Turkce commit | Commit mesajlari Turkce olmali |
| Prefix ZORUNLU | feat, fix, refactor, docs, test, chore, style, perf |
| Jira ID opsiyonel | Jira bileti varsa commit mesajina `[W0NDERSUPERIOR-123]` ekle |
| Izinsiz commit YOK | Kullanici onayi olmadan commit atilmaz |
| CLAUDE.md korumali | CLAUDE.md asla git'e eklenmez |
| force push YASAK | `git push --force` yasak |
| test/main/master koruma | Bu branch'lere DOGRUDAN commit YASAK |
| Incremental push | Her task tamamlandiginda `git push origin <branch>` |

```bash
# DOGRU — worktree'de calis
git worktree add -B feature/W0NDERSUPERIOR-123-kullanici-yonetimi ../w0nderSuperior-123 test
cd ../w0nderSuperior-123/
# ... kod yaz, test et ...
git commit -m "feat(identity): kullanici olusturma handler'i eklendi [W0NDERSUPERIOR-123]"
git push origin feature/W0NDERSUPERIOR-123-kullanici-yonetimi
# PR: feature/W0NDERSUPERIOR-123-kullanici-yonetimi → test

# YASAK
git checkout test && git commit   # test'te commit YASAK
git checkout master && git commit # master'da commit YASAK
git push --force origin test      # force push YASAK
# Ana repo dizininde kod yazmak YASAK
```

---

## 8. Evidence Before Claims

```markdown
YASAK: "Handler'i yazdim, calisiyor."

ZORUNLU:
## CreateUserHandler
$ npm test -- --testPathPattern=create-user.handler
 PASS  4/4 tests passed
```

**Cikti gostermeden "calisiyor" deme.**

---

## 9. Hardcoded Deger YASAK (HARD-01)

```typescript
// YASAK
const ADMIN_ROLE_ID = 'role-123';
const MAX_ATTEMPTS = 3;
const API_URL = 'http://localhost:3000';

// DOGRU
const adminRole = await this.uow.roles.findByCode('ADMIN');
const maxAttempts = this.configService.get('auth.maxAttempts');
const apiUrl = process.env.API_URL;
```

---

## 9a. Enum & Constant Kurallari (ENUM-01..05)

### ENUM-01: String Literal Karsilastirma YASAK (CRITICAL)

Kodda string literal ile durum/tip/kod karsilastirmasi YASAKTIR. Const reference ZORUNLUDUR.

```typescript
// YASAK — string literal karsilastirma
const onayliSayisi = durumlar.filter((d) => d === 'ONAYLANDI').length;
if (dagitim.durum.kod === 'ASKIDA') { ... }
if (basvuru.kararDurumu === 'REDDEDILDI') { ... }
const iptalDurumlari = ['ONAYLANDI', 'REDDEDILDI', 'IPTAL_EDILDI'];

// DOGRU — const reference
import { SY_KARAR_DURUM_KODLARI } from '../../shared/constants/karar-durum-kodlari';
const onayliSayisi = durumlar.filter(
  (d) => d === SY_KARAR_DURUM_KODLARI.ONAYLANDI
).length;
if (dagitim.durum.kod === SY_SICAK_YEMEK_DURUM_KODLARI.ASKIDA) { ... }

// DOGRU — destructured
const { ONAYLANDI, REDDEDILDI, IPTAL_EDILDI } = SY_KARAR_DURUM_KODLARI;
const iptalDurumlari = [ONAYLANDI, REDDEDILDI, IPTAL_EDILDI];
```

**Neden:** Typo runtime'da sessizce yanlis sonuc uretir. Const ile compile-time hata yakalanir.

**Kapsam:** switch/case, if/else, filter, find, includes, ===, !== ile yapilan TUM karsilastirmalar.

**Istisna:** MIME type (`'application/pdf'`), HTTP method (`'GET'`), `NODE_ENV`, form mode (`'create'`/`'edit'`).

### ENUM-02: TypeScript `enum` YASAK (CRITICAL)

TS `enum` keyword KULLANILMAZ. Yerine `const object as const` + branded type KULLANILIR.

```typescript
// YASAK — TS enum (tree-shaking bozar, Prisma ile isim cakar, IIFE uretir)
export enum RaporTipi {
  BASVURU_OZET = 'BASVURU_OZET',
  YARDIM_DAGILIM = 'YARDIM_DAGILIM',
}

// DOGRU — const object as const
export const RAPOR_TIPI = {
  BASVURU_OZET: 'BASVURU_OZET',
  YARDIM_DAGILIM: 'YARDIM_DAGILIM',
} as const;

export type RaporTipi = typeof RAPOR_TIPI[keyof typeof RAPOR_TIPI];
```

**Neden:**
- TS enum tree-shaking'i bozar (IIFE uretir, dead code eliminate edilemez)
- Prisma enum ile ayni isim kullanilinca cakisma olusur
- `const as const` ayni type safety'i saglar + daha iyi performans

**Kapsam:** Backend + Frontend. Prisma enum HARIC (Prisma schema'daki enum'lar Prisma'nin kendi islevi).

**Prisma enum import SERBEST:**
```typescript
// SERBEST — Prisma enum'u dogrudan kullanmak
import { HtTrackingStatus } from '@prisma/client';
if (durum === HtTrackingStatus.KAPALI) { ... }

// ALTERNATIF — Prisma enum yerine const referans (domain layer Prisma'ya bagimli olmasin diyorsan)
import { HT_TRACKING_STATUS } from '../../shared/constants/tracking-status';
if (durum === HT_TRACKING_STATUS.KAPALI) { ... }
```

### ENUM-03: Magic Number YASAK (HIGH)

Ham sayi kodda GIZLI is kurali olarak KULLANILAMAZ. Named const veya DB sistem_ayarlari ZORUNLUDUR.

```typescript
// YASAK — magic number
if (gun < 15) { return new Date(yil, ay, 15); }
const sureyAy = 12;
pageSize: number = 20;
@Max(150)  // 150 ne?

// DOGRU — DB'den (is kurali degisebilir)
const baslangicGunu = await this.sistemAyariService.getNumeric(
  SISTEM_AYARI_KODLARI.YARDIM_BASLANGIC_GUNU, 15  // fallback
);

// DOGRU — named const (sabit teknik limit)
const DEFAULT_PAGE_SIZE = 20;
const MAX_YASLI_YAS = 150;  // Nufus kayit sistemi limiti
const VARSAYILAN_YARDIM_SURE_AY = 12;  // DB'de yoksa fallback
```

**Karar agaci:**
| Soru | Evet | Hayir |
|------|------|-------|
| Belediye degistirmek isteyebilir mi? | DB sistem_ayarlari | Named const |
| Deployment'a gore degisir mi? | Environment variable | Named const |
| Teknik limit mi? (array size, timeout) | Named const (aciklamali) | - |

**Istisna:** 0, 1, -1 gibi trivial sayilar. `setTimeout(fn, 0)`. Array index. Loop increment.

### ENUM-04: Frontend-Backend Enum Senkronizasyonu (CRITICAL)

Frontend'teki enum/const degerleri backend ile BIREBIR eslesmeli. Farkli deger seti = CONTRACT ihlali.

```typescript
// BACKEND — shared/constants/karar-durum-kodlari.ts
export const SY_KARAR_DURUM_KODLARI = {
  ONAYLANDI: 'ONAYLANDI',
  REDDEDILDI: 'REDDEDILDI',
  SARTLI_ONAY: 'SARTLI_ONAY',
  ERTELENDI: 'ERTELENDI',
} as const;

// FRONTEND — Zod schema AYNI degerlerle
export const syKararDurumSchema = z.enum([
  'ONAYLANDI', 'REDDEDILDI', 'SARTLI_ONAY', 'ERTELENDI'
] as const);

// FRONTEND — Label mapping (UI goruntuleme)
export const SY_KARAR_DURUM_LABELS: Record<SyKararDurum, string> = {
  ONAYLANDI: 'Onaylandi',
  REDDEDILDI: 'Reddedildi',
  SARTLI_ONAY: 'Sartli Onay',
  ERTELENDI: 'Ertelendi',
};
```

**YASAK:** Frontend'te backend'de olmayan deger, veya backend'de frontend'te olmayan deger.

**Senkronizasyon kontrolu:** `/review` sirasinda `w0nderSuperior:spec-reviewer` agent'i CONTRACT-04 + ENUM-04 birlikte kontrol eder.

### ENUM-05: Lookup Table Referans Tutarliligi (HIGH)

Const object'teki degerler DB'deki lookup table'in `kod` alaniyla BIREBIR eslesmeli. Seed dosyasi ile const dosyasi AYNI degerleri icermeli.

```typescript
// DB (seed): lkSyDecisionStatus tablosu
// { kod: 'ONAYLANDI', adi: 'Onaylandı', siraNo: 1 }
// { kod: 'REDDEDILDI', adi: 'Reddedildi', siraNo: 2 }

// CONST: shared/constants/karar-durum-kodlari.ts
export const SY_KARAR_DURUM_KODLARI = {
  ONAYLANDI: 'ONAYLANDI',     // = DB kod alani
  REDDEDILDI: 'REDDEDILDI',   // = DB kod alani
} as const;
```

**KURAL:** Yeni durum ekleme = 3 yer guncelle:
1. DB seed dosyasi (lookup.seed.ts)
2. Backend const dosyasi (shared/constants/*.ts)
3. Frontend const/Zod dosyasi (types/enums.ts veya schemas.ts)

**Eksik guncelleme = CONTRACT ihlali.**

### Const Dosya Organizasyonu (Referans)

```
backend/src-v2/features/[modul]/_shared/constants/
├── basvuru-durum-kodlari.ts     ← Lk*ApplicationStatus ile sync
├── karar-durum-kodlari.ts       ← Lk*DecisionStatus ile sync
├── takip-durum-kodlari.ts       ← Lk*TrackingStatus ile sync
├── teslim-durum-kodlari.ts      ← Lk*DeliveryStatus ile sync
├── sistem-ayari-kodlari.ts      ← *SystemSetting.kod ile sync
└── index.ts                     ← Barrel export

backend/src-v2/shared/constants/
└── lookup-codes.ts              ← Cross-module sabitler (ROLE, STATUS, ...)
```

> **Feature-ici paylasim dizini (KARMA):** Baskin konvansiyon `_shared/` (cogu feature). Istisna: bazi feature'lar (`genciala`, `surec-motoru`, `ecap`) underscore'suz `shared/` kullanir — re-root/tarama her iki ismi de kapsamali.

### Kabul Edilebilir Istisnalar (ENUM kurallari disinda)

| Istisna | Ornek | Neden |
|---------|-------|-------|
| MIME type | `'application/pdf'` | Standart, degismez |
| HTTP method | `'GET'`, `'POST'` | Standart, degismez |
| Environment | `NODE_ENV === 'development'` | Framework convention |
| Form mode | `'create'` / `'edit'` | UI-local, domain disinda |
| Regex pattern | `/^5\d{9}$/` | Validation, domain disinda |
| Prisma enum import | `HtTrackingStatus.KAPALI` | Prisma'nin kendi type system'i |
| Guard order | `[SmartThrottlerGuard, ...]` | GUARD-01 geregi degistirilemez |
| CSS class | `'text-red-500'` | UI styling, domain disinda |

---

## 10. Scope Boundary Kurallari

### Kural 10.1: Agent Scope Siniri (SCOPE-01)

Agent SADECE plan dosyasinda belirtilen modul path'lerini degistirir. Scope disi dosya degisikligi = BLOCKER violation.

```
DOGRU:
  Plan: Hedef Dosyalar: backend/src-v2/features/randevu/yonetici/...
  Agent: backend/src-v2/features/randevu/yonetici/presentation/yonetici.controller.ts
  → AYNI modul, OK

YASAK:
  Plan: Hedef Dosyalar: backend/src-v2/features/randevu/yonetici/...
  Agent: backend/src-v2/features/randevu/vatandas/presentation/vatandas.controller.ts
  → FARKLI sub-modul! SCOPE IHLALI!

YASAK:
  Plan: Hedef Dosyalar: backend/src-v2/features/randevu/...
  Agent: backend/src-v2/features/identity/users/...
  → FARKLI modul! SCOPE IHLALI!
```

### Kural 10.2: Modul Siniri (SCOPE-02)

Bir task'ta birden fazla modulun dosyasini degistirmek YASAKTIR. Cross-module degisiklik gerekiyorsa:
1. Her modul icin AYRI task olusturulur
2. Her task FARKLI agent'a dispatch edilir
3. Her task'in kendi scope'u vardir

```
YASAK — Tek task'ta iki modul:
  T07: Controller + Guards
  Hedef Dosyalar:
    - backend/src-v2/features/randevu/yonetici/...
    - backend/src-v2/features/randevu/vatandas/...  ← FARKLI sub-modul!

DOGRU — Her modul ayri task:
  T07: Yonetici Controller
  Hedef Dosyalar:
    - backend/src-v2/features/randevu/yonetici/...

  T08: Vatandas Controller
  Hedef Dosyalar:
    - backend/src-v2/features/randevu/vatandas/...
```

**Istisna:** `shared/` altindaki dosyalar (CASL, UoW, Prisma schema) plan'da acikca belirtilmisse degistirilebilir.

---

<!-- KALDIRILDI (v11 refactor): 10b Bi-Modal ABAC Sinirlari (SH-CASL-01, SH-CASL-02)
     ABAC tek kanon — Resource.abacEnabled her zaman true. abacEnabled flag bayrak gibi
     kullanilmiyor; gecis prosedur'u (false → true) konu disi. -->

> **ABAC tek kanon.** Her Resource `abacEnabled: true` ile baslar; bayrak okunmaz,
> davranis dallanmaz. Bi-Modal sinirlari (SH-CASL-01/02) v11 refactor'da kaldirildi.
> Detayli backend kurallari: IRON_RULES_BACKEND.md `Kural 3` (CASL-01/02/03/05/07).
> Detayli frontend kurallari: IRON_RULES_FRONTEND.md `Kural 9b` (FE-CASL-01/02/04).
> Pattern referansi: PATTERNS.md `Pattern 20` (ABAC Feature — her feature icin).

---

## 11. Anti-Pattern Kontrol Listesi

Her PR'da kontrol et:

- [ ] Cross-module tight coupling YOKTUR (moduller izole)
- [ ] N+1 query YOKTUR (batch/include kullanilmis)
- [ ] DLQ'suz BullMQ consumer YOKTUR
- [ ] Hardcoded secret YOKTUR (env var kullanilmis)
- [ ] String literal karsilastirma YOKTUR — const reference kullanilmis (ENUM-01)
- [ ] TS `enum` keyword YOKTUR — `const as const` kullanilmis (ENUM-02)
- [ ] Magic number YOKTUR — named const veya DB ayari kullanilmis (ENUM-03)
- [ ] Frontend enum degerleri backend const ile BIREBIR eslesiyor (ENUM-04)
- [ ] Client dogrudan API cagirmiyor (Server Action kullanilmis)
- [ ] Frontend Zod schema field isimleri Backend DTO ile BIREBIR eslesiyor
- [ ] Cift validation var (Zod frontend + class-validator backend)
- [ ] Raw error client'a donmuyor (sanitize edilmis)
- [ ] PII log'larda maskelenmis
- [ ] JWT client bundle'da YOKTUR
- [ ] Test coverage %80 uzerinde
- [ ] TDD uygulanmis (RED -> GREEN -> REFACTOR)
- [ ] Commit mesaji Turkce + prefix'li
- [ ] Permission check backend VE frontend'de var

---

## Ozet: Shared Demir Kurallar

| Kod | Kural | Kisaca | Impact |
|-----|-------|--------|--------|
| VAL-01..03 | Validation | Backend: class-validator, Frontend: Zod, karistirma YASAK | CRITICAL |
| ERR-01..02 | Error Handling | Raw error YASAK, exception turleri tablosu | CRITICAL |
| API-02..05 | API Design | REST conventions, pagination, camelCase, consistent error format | HIGH |
| CONTRACT-01..05 | API Contract | Data-first validation, Zod+class-validator zorunlu, FE↔BE birebir | CRITICAL |
| SEC-01..09 | Security | RS256, env vars, CASL, bcrypt, HTTPS, token hash | CRITICAL |
| TEST-01..07 | Test | TDD ZORUNLU, Jest+RTL+MSW+Playwright, %80 coverage, a11y | CRITICAL |
| GIT-01..15 | Git & Worktree | Worktree ZORUNLU, Jira biletsiz YOK, kullanici onaysiz YOK, base=test | CRITICAL |
| EVID-01 | Evidence | Cikti gostermeden claim yapma | HIGH |
| HARD-01 | Hardcoded | Config/env kullan, hardcoded deger YASAK | CRITICAL |
| ENUM-01..05 | Enum & Const | String literal yasak, TS enum yasak, magic number yasak, FE-BE sync | CRITICAL |
| KVKK-04 | KVKK / Privacy | Consent Management (cerez + aydinlatma + acik riza) | HIGH |

---

## 12. KVKK / Privacy Kurallari

### KVKK-04: Consent Management (HIGH)

Cerez onayi + aydinlatma metni + acik riza alanlari KVKK uyumlulugu icin zorunludur.

```prisma
model UserConsent {
  id          String   @id @default(uuid())
  userId      String?
  sessionId   String?  // Anon kullanici icin
  consentType String   // 'cookie_analytics', 'cookie_marketing', 'kvkk_aydinlatma', 'sms_pazarlama'
  granted     Boolean
  grantedAt   DateTime @default(now())
  revokedAt   DateTime?
  ipAddress   String   // Audit
  userAgent   String

  @@index([userId, consentType])
}
```

Frontend cerez banner: `shared/components/molecules/CookieConsent.tsx`
- Sayfaya ilk geliste goster
- "Hepsini kabul et", "Tercihler", "Sadece zorunlu" butonlari
- localStorage `consentGivenAt` ile kontrol (1 yil gecerli)

Tum tracking/analytics script'leri consent ile kosullu yuklenir.
