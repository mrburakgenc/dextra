# W0NDERSUPERIOR Mimari Dokumantasyonu

## Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 16 + React 19 + TypeScript |
| UI | shadcn/ui (new-york) + Tailwind CSS v4 + Atomic Design |
| Forms | react-hook-form + Zod + @hookform/resolvers |
| Data Fetching | TanStack React Query 5 + Server Actions |
| Backend | NestJS 11 + TypeScript + CQRS (@nestjs/cqrs 11) |
| Validation (BE) | class-validator + ValidationPipe |
| Validation (FE) | Zod v4 |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis (L2) + In-Memory (L1) |
| Messaging | BullMQ (Redis, 8 queue) |
| Auth | JWT (HttpOnly Cookie) + Phone/SMS Login |
| Authorization | CASL (ABAC) + Field-Level + Instance-Level |
| Rate Limiting | Custom 3-Tier Redis + Adaptive Threat Detection |
| Monitoring | Pino + OpenTelemetry + Prometheus + AsyncLocalStorage |

### PostgreSQL Extensions (PostGIS)

```prisma
generator client {
  provider        = "prisma-client"
  previewFeatures = ["postgresqlExtensions"]
}
datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [postgis]
}

model Location {
  id       String   @id @default(uuid())
  position Geometry(Point, 4326)?    // Native PostGIS — Prisma 7+
  zone     Geometry(Polygon, 4326)?  // Mahalle/bölge sınırı

  @@index([position(type: Gist)])     // Spatial index (manuel migration)
}
```

PostGIS native filter'ları (`near`, `within`, `distanceFrom`) type-safe; advanced spatial (`ST_Buffer`, `ST_Intersection`) `$queryRaw` ile.

---

## Bounded Context = Feature (VSA + DDD Eslemesi)

W0NDERSUPERIOR'da DDD "Bounded Context" = VSA "Feature":
- `features/identity/` = Identity Bounded Context
- `features/randevu-sistemi/` = Randevu Bounded Context
- `features/sosyal-yardim/` = Sosyal Yardim Bounded Context

Her Bounded Context kendi **Ubiquitous Language**'ini sahiplenir. Cross-context iletisim 4 yoldan biri ile yapilir:
- Shared Interface Contract (senkron, in-monolith pre-condition)
- Anti-Corruption Layer / ACL (senkron, dis sistem — KPS/banka/e-Devlet)
- Domain Event (asenkron, Outbox uzerinden, fire-and-forget fan-out)
- Saga / Process Manager (asenkron, multi-step, forward-looking)

Detay: Mimari Degismez #1 ve [`IRON_RULES_EVENTS.md` → EVT-00](./IRON_RULES_EVENTS.md).

**Sub-feature:** BC ici tutarlilik adasi (entity cluster / aggregate). Buyuk BC
(örn. identity: 27 cmd + 15 qry + 10 entity) sub-feature'lara bolunur
(users/, groups/, roles/, ...). Sub-feature'lar within-BC serbest import eder;
BC disina tek public yuz `<feature>.module.ts` exports'tur.

---

## Backend: Modular Monolith + Vertical Slice Architecture

```
+-----------------------------------------------------------------------+
|                      MODULAR MONOLITH                                  |
+-----------------------------------------------------------------------+
|                                                                        |
|  +------------------+  +------------------+  +------------------+     |
|  |    IDENTITY      |  |  RANDEVU-SISTEM  |  |  SOSYAL-YARDIM   |     |
|  |   (Vertical      |  |   (Vertical      |  |   (Vertical      |     |
|  |    Slice)        |  |    Slice)        |  |    Slice)        |     |
|  +--------+---------+  +--------+---------+  +--------+---------+     |
|           |                     |                     |               |
|  +--------+---------------------+---------------------+------------+  |
|  |                   SHARED INFRASTRUCTURE                          |  |
|  |  * Database (Prisma + UnitOfWork)  * Authorization (CASL)       |  |
|  |  * Messaging (BullMQ - 8 Queue)   * Monitoring (Audit + Metrics)|  |
|  |  * Security (JWT, Rate Limit)     * External Services (KPS,SMS) |  |
|  +------------------------------------------------------------------+  |
|                                                                        |
+-----------------------------------------------------------------------+
```

### Her Bounded Context'in Ic Yapisi (BC → Sub-feature → Colocated Use-Case)

W0NDERSUPERIOR'da `features/<feature>/` bir **Bounded Context**'tir. BC, icinde
en az bir **sub-feature** (BC ici alt-alan / aggregate adasi) barindirir. Duz
`features/<feature>/application/` (sub-feature'siz) YASAK.

```
features/<feature>/                        <- Bounded Context (DDD)
+-- <sub-feature>/                         <- BC ici alt-alan (Container)
|   +-- domain/                            <- Business logic (pure, no I/O)
|   |   +-- entities/                      <- rich entity (factory + invariant) (ZORUNLU)
|   |   +-- repositories/                  <- Repository INTERFACE'leri + TOKEN (ZORUNLU)
|   |   +-- value-objects/                 <- Value object'ler (OPSIYONEL)
|   |   +-- services/                      <- Domain service — cross-entity rule (OPSIYONEL)
|   |   +-- read-models/                   <- Paylasilan read shape (OPSIYONEL)
|   |   +-- errors/                        <- Pure DomainError (OPSIYONEL)
|   +-- application/                       <- Use case orchestration
|   |   +-- commands/<use-case>/           <- COLOCATED: command + handler + result + spec
|   |   |   +-- <use-case>.command.ts      <- class-validator + BaseCommand (HTTP DTO görevi)
|   |   |   +-- <use-case>.handler.ts      <- ICommandHandler (5-step orchestration)
|   |   |   +-- <use-case>.result.ts       <- static from(entity) + PII whitelist
|   |   |   +-- <use-case>.handler.spec.ts <- COLOCATE test
|   |   +-- queries/<use-case>/            <- ayni colocated sema (query+handler+result+spec)
|   |   |   +-- _shared/                    <- query'ler arasi ortak read-model (OPSIYONEL)
|   |   +-- _shared/                        <- sub-feature ici app helper (OPSIYONEL)
|   +-- infrastructure/                    <- External concerns
|   |   +-- repositories/                  <- Prisma CONCRETE (ABAC: tx + abilityFactory)
|   |   +-- mappers/                        <- Prisma row <-> domain entity (OPSIYONEL)
|   |   +-- workers/                        <- BullMQ consumer (OPSIYONEL)
|   +-- presentation/                      <- HTTP/API (eski adi "interface" — DEGISTI)
|   |   +-- <sub-feature>.controller.ts    <- sub-feature basina 1 controller
|   |   +-- dtos/                           <- OPSIYONEL — sadece custom serialization
|   +-- <sub-feature>.module.ts            <- sub-feature DI birimi
+-- _shared/                               <- BC-ici cross-cutting (sub->sub paylasim)
|   +-- application/<x>.ts                  <- örn. policy-invalidation helper
|   +-- domain/<x>.ts
+-- <feature>.module.ts                    <- BC aggregate module (sub-module'leri import eder)
+-- <feature>-uow.registrar.ts             <- BC UoW repo factory + ResourceRegistry kaydi
```

**Kritik:**
- `application/commands/<use-case>/` ve `queries/<use-case>/` **COLOCATED** — command/query + handler + result + spec ayni klasorde (VSA locality). Ayri `application/handlers/`, `application/results/`, `application/dtos/` top-level klasor YASAK.
- `application/commands/` + `queries/` class-validator decorator'li + `BaseCommand`/`BaseQuery` extend — HTTP DTO görevi DE görür (DRY)
- `*.result.ts` Handler return tipi — Response DTO **DEĞİL**, framework-bağımsız POJO (`static from(entity)`)
- `presentation/dtos/` **OPSİYONEL** — sadece özel serialization (genellikle boş). `interface/` adi KULLANILMAZ ("interface" TS keyword'u repo interface'leriyle cakisir; `presentation/` Clean Arch kanonu).
- `domain/validators/` KLASORU YOK — input validation Command/Query'de, business rule Entity factory veya `domain/services/`'te
- **Tek-aggregate BC istisnasi:** Cok kucuk BC tek sub-feature ile baslar; sub-feature yine de bir klasor olur (duz `application/` BC kokunde YASAK). Yalniz-orchestration sub-feature (kendi entity'si yok) icin `domain/` + `infrastructure/` opsiyonel — `application/` + `<sub>.module.ts` yeterli ("ince sub-feature kanonu", MODULE_STRUCTURE.md).
- Module-spesifik guard YOK — tum guard'lar `shared/security/` veya `shared/authorization/`'da
- `requesterId` body'den ASLA okunmaz — `CommandRequesterInterceptor` (global) `BaseCommand`/`BaseQuery` instance'larına enjekte eder

**Katman Kurallari:**

```
+-------------------------------------+
|   Interface Layer (Controllers)     |  <- HTTP/REST, DTO validation
+-------------------------------------+
|   Application Layer (Handlers)      |  <- Use case orchestration
+-------------------------------------+
|   Domain Layer (Entities)           |  <- Business logic, pure functions
+-------------------------------------+
|   Infrastructure Layer (Repos)      |  <- Prisma, external services
+-------------------------------------+

Bagimlilik Yonu: Ust -> Alt (ASLA tersi)
```

---

## Frontend: Vertical Slice Architecture + Atomic Design

```
+-----------------------------------------------------------------------+
|                    NEXT.JS 16 APP ROUTER                               |
+-----------------------------------------------------------------------+
|                                                                        |
|  +---------------------------------------------------------------+    |
|  |                    ROUTE GROUPS                                 |    |
|  |  (public)/          (auth)/           (yonetim)/               |    |
|  |   +- giris           +- hesabim       +- dashboard             |    |
|  |   +- kayit           +- randevularim  +- identity/*            |    |
|  |                                        +- randevu-sistemi/*    |    |
|  |  (fullscreen)/                         +- sosyal-yardim/*      |    |
|  |   +- kurul-oturumu                     +- hasta-takip/*        |    |
|  +---------------------------------------------------------------+    |
|                              |                                         |
|  +---------------------------------------------------------------+    |
|  |              VERTICAL SLICE ARCHITECTURE                       |    |
|  |                                                                 |    |
|  |  features/identity/        features/randevu/                  |    |
|  |  +- auth/                  +- actions/*.actions.ts            |    |
|  |  |  +- actions/            +- hooks/use-*.ts                  |    |
|  |  |  +- components/         +- schemas/*.schema.ts             |    |
|  |  |  +- schemas/            +- components/ (atoms/mol/org)      |    |
|  |  +- users/                 +- types/                          |    |
|  |  +- roles/                                                    |    |
|  +---------------------------------------------------------------+    |
|                              |                                         |
|  +---------------------------------------------------------------+    |
|  |                    ATOMIC DESIGN                                |    |
|  |                                                                 |    |
|  |  shared/components/                                             |    |
|  |  +- atoms/         (BackButton, LoadingButton, Spinner, Logo)  |    |
|  |  +- molecules/     (DateRangePicker, Pagination, StatusBadge)  |    |
|  |  +- organisms/     (DataTable, Sidebar, Navbar, Breadcrumb)    |    |
|  |  +- templates/     (DashboardLayout, AuthPageLayout)           |    |
|  +---------------------------------------------------------------+    |
|                                                                        |
+-----------------------------------------------------------------------+
```

### Frontend Feature Ic Yapisi

```
feature/                              <- veya feature/<sub-feature>/ (GROUPED BC)
+-- actions/<name>.actions.ts         <- Server Actions ('use server')
+-- hooks/use-<name>.ts               <- React Query hook'lari (veya queries/use-*.ts)
+-- schemas/<name>.schema.ts          <- Zod schema'lar
+-- components/                       <- Atomic Design: atoms/ molecules/ organisms/
+-- types/                            <- TypeScript tipleri
+-- utils/                            <- Helper'lar, lookup-codes
+-- index.ts                          <- Public API barrel export
```

---

## Guard Zinciri (SIRA DEGISTIRILEMEZ)

```
Request
    |
    v
1. SmartThrottlerGuard    <- Rate limit (Admin unlimited, Auth 5000/min, Anon 300/min)
    |
    v
2. OriginGuard            <- CSRF korumasi (Origin/Referer header)
    |
    v
3. JwtGuard               <- JWT dogrulama (@Public skip)
    |
    v
4. PoliciesGuard          <- CASL/ABAC yetkilendirme (default-deny)
    |                         + permittedFields ve caslConditions req'e attach
    v
Controller -> Handler
```

**Ek Guard'lar (manuel kullanim):**
- `AdminGuard` - ADMIN/SUPER_ADMIN rol kontrolu
- `OptionalJwtGuard` - Opsiyonel auth (public + auth)

---

## CQRS (@nestjs/cqrs)

### Command (Write Operations - CUD)

```
Controller
    | @Post/@Patch/@Delete
    v
CommandBus.execute(new CreateXxxCommand(...))
    |
    v
CreateXxxCommandHandler implements ICommandHandler<CreateXxxCommand>
    |
    +-> 1. VALIDATION     -> Business rule kontrolu (uniqueness, existence)
    |
    +-> 2. TRANSFORM      -> Data donusumu (hash, format)
    |
    +-> 3. ATOMIC         -> UnitOfWork.transaction(async () => { ... })
    |
    +-> 4. AUDIT          -> AuditJobProducer.push() (BullMQ async)
    |
    v
Response

NOT: Yetkilendirme (CASL) PoliciesGuard'da cozulur.
Handler yetki kodu YAZMAZ.
```

### Query (Read Operations - R)

```
Controller
    | @Get
    v
QueryBus.execute(new ListXxxQuery(...))
    |
    v
ListXxxQueryHandler implements IQueryHandler<ListXxxQuery>
    |
    +-> 1. req.permittedFields kullan (Guard'dan gelir)
    |
    +-> 2. req.caslConditions kullan (Guard'dan gelir)
    |
    +-> 3. Prisma query (select + where + paginate)
    |
    v
Paginated Response
```

---

## Repository Pattern (Interface + Concrete ZORUNLU)

### Interface (Domain Layer)

```typescript
// domain/repositories/i-xxx.repository.ts  (v2 konvansiyon: i-<isim>.repository.ts)
export interface IXxxRepository {
  findById(id: string): Promise<Xxx | null>;
  findMany(criteria: XxxCriteria): Promise<PaginatedResult<Xxx>>;
  create(entity: Xxx): Promise<Xxx>;
  update(id: string, data: Partial<Xxx>): Promise<Xxx>;
  softDelete(id: string): Promise<void>;
}
```

### Implementation (Infrastructure Layer)

```typescript
// infrastructure/repositories/xxx.repository.ts
@Injectable()
export class XxxRepository implements IXxxRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Xxx | null> {
    return this.prisma.xxx.findUnique({
      where: { id, deletedAt: null },  // deletedAt ZORUNLU
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.xxx.update({
      where: { id },
      data: { deletedAt: new Date() },  // Hard delete YASAK
    });
  }
}
```

**Kural:** Her feature'da interface + concrete ZORUNLU. Direkt Prisma kullanimi YASAK.

---

## Unit of Work (Tum Feature'larda ZORUNLU)

```typescript
await uow.transaction(async () => {
  const entity = await uow.xxxs.create(data);
  await uow.roles.assignToUser(entity.id, roleId);
  // Hata olursa tamami rollback
});
```

**Kural:** Birden fazla write islemi = UoW ZORUNLU. Direkt `prisma.$transaction` YASAK.

### IUnitOfWork Kanonik Interface

```typescript
// shared/database/application/unit-of-work.ts
export interface IUnitOfWork {
  // Repository erişimi (feature.module.ts UoW'a kayıt eder)
  readonly basvurular: IBasvuruRepository;
  readonly randevular: IRandevuRepository;
  readonly outbox: IOutboxRepository;
  // ... her feature module kendi repo'sunu register eder

  /**
   * Atomic transaction wrapper.
   * Tüm repository call'lar bu transaction içinde çalışır.
   */
  transaction<T>(
    fn: () => Promise<T>,
    options?: {
      isolationLevel?: 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
      timeout?: number;  // ms, default 5000
    },
  ): Promise<T>;

  /**
   * Mevcut transaction var mı? (nested transaction tespiti için)
   */
  isInTransaction(): boolean;
}
```

---

## CASL/ABAC Yetkilendirme

### Permission Hiyerarsisi

```
User
  |
  v
UserGroup (N:M)
  |
  v
Group (Organizasyonel yapi, materialized path)
  |
  v
Role (N:M via RolePermission)
  |
  v
Permission = Action + Resource + Condition + Fields

Ornek: READ:Appointment:{providerId:{{userId}}}:['id','tarih','durum']
        = Sadece kendi hastalarinin randevularini, belirli alanlari gorebilir
```

### AbilityFactory Flow

```
Request geldi
    |
    v
L1: In-Memory Cache (per-process, 5 min TTL)
    | miss
    v
L2: Redis Cache (shared, 15 min TTL)
    | miss
    v
PolicyContextBuilder
    |-> User'in group'lari, role'leri, assignment'lari DB'den cek
    v
fetchRolePermissions
    |-> UserGroup -> Role -> RolePermission -> Permission -> Action + Resource
    v
PolicyCompiler
    |-> Condition materialization: {{userId}} -> gercek ID
    |-> {{groupId}} -> gercek group ID
    |-> {{assigned.Subject}} -> atanmis kayitlar
    v
CASL AbilityBuilder
    |-> can()/cannot() rule'lari priority sirasina gore
    v
Cache Store: L2 -> L1
    v
Ability nesnesi hazir
```

### PoliciesGuard (Global, Her Request'te)

```
1. @Public() veya @SkipPolicies() -> SKIP
2. HTTP method -> CASL action eslestirmesi:
   GET=read, POST=create, PUT/PATCH=update, DELETE=delete
3. @RequireAction('custom:action') varsa -> override
4. ResourceRegistry: URL -> CASL Subject (longest-prefix-match)
5. Esleme yoksa -> 403 (default-deny)
6. ability.can(action, subject) -> 403 veya gecis (COARSE check)
7. Guard ekstra bir sey yapmaz — coarse check yeterli
   -> Handler sadece userId iletir
   -> Repository AbilityFactory inject edip:
      * accessibleBy(ability, action).Subject -> where
      * FieldFilterHelper.buildSelect(fields) -> select
      * mapToResponse'da PII maskeleme
     (Pattern 20 + Kural 3.5)

HANDLER YETKI KODU YAZMAZ (CASL-01, CASL-07).
```

### Decorator'lar

| Decorator | Kullanim |
|-----------|----------|
| `@Public()` | Auth gerektirmeyen route |
| `@SkipPolicies()` | CASL bypass (SADECE @Public ile birlikte) |
| `@RequireAction('wf:approve')` | Custom CASL action |

### Frontend Yetkilendirme (ABAC — tek kanon)

**Tum component'ler `<Can>` veya `useCurrentAbility` kullanir.** RBAC fallback (`user.roles.includes`) YASAK (FE-CASL-01).

**ABAC feature akisi:**
- Login sonrasi `GET /authorization/me` ile `abilityRules` client'a yuklenir
- `AbilityProvider` root layout'ta aktif (`createMongoAbility(abilityRules)`)
- Permission degisikligi SSE/WS ile real-time invalidate

```tsx
// HER feature — Pattern 20
<Can I="UPDATE" a="YeniModul" this={item}>
  <EditButton />
</Can>

// YASAK — role-based gizleme
{user.roles.includes('SY_MUDUR') && <EditButton />}  // FE-CASL-01 ihlali
```

Detayli kurallar: IRON_RULES_FRONTEND.md `Kural 9b` (FE-CASL-01..04).

---

## Rate Limiting

### 3-Tier Sistem (SmartThrottlerGuard)

| Tier | Limit | TTL |
|------|-------|-----|
| Admin | Unlimited (bypass) | - |
| Authenticated | 5000 req/min | 60s |
| Anonymous | 300 req/min | 60s |

### Endpoint-Specific Override'lar

| Endpoint | Limit | TTL | Neden |
|----------|-------|-----|-------|
| `/oturum/login` | 5/min | 60s | Brute force korunmasi |
| `/oturum/verify-phone` | 3/5min | 300s | SMS abuse onleme |
| `/oturum/refresh` | 30/min | 60s | Token refresh limiti |

### Global DDoS Korumasi

10,000 req/min per IP (tum tier'lar icin)

### Adaptive Threat Detection

- Threat level'lar: LOW / MEDIUM / HIGH / CRITICAL
- Otomatik ban: escalating (5min -> 15min -> 1h -> 24h)
- Pattern detection: rapid requests, failed logins, endpoint sweeping

### Response Header'lar (RFC 6585)

```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4995
Retry-After: 60
```

---

## BullMQ Async Messaging

### Queue'lar (8 adet)

| Queue | Amac |
|-------|------|
| `audit` | Async audit log yazimi (KVKK-compliant, WORM/immutable) |
| `domain-events` | Cross-feature domain event fan-out (DomainEventProducer kanonu) |
| `policy` | Policy cache invalidation |
| `emails` | Email gonderimi |
| `appointment-confirmation-reminder` | Randevu onay hatirlatmasi |
| `appointment-start-reminder` | Randevu baslangic hatirlatmasi |
| `hold-expire` | Slot hold suresi dolumu |
| `token-cleanup` | Expired token temizligi |

**Audit vs Domain Event ayrimi:** `audit` queue WORM tabloya yazar (yasal kayit, KVKK), `domain-events` queue cross-feature fan-out icin (loose coupling). Iki ayri sistem — bkz. `lessons-learned/LOGGING.md` karmasa #6.

### Producer/Worker Pattern

```
Handler
    |
    v
AuditJobProducer.push({ entity, action, data })   <- Job queue'ya eklenir
    |                                                   (exponential backoff, 5 retry)
    v
[Redis Queue]
    |
    v
AuditWorker.process(job)                           <- Async islem
    |
    v
AuditLog tablosuna yaz (body + diff)
```

**Kural:** Audit ASLA senkron yazilmaz. BullMQ uzerinden async.

---

## Server Action Pattern

```
Client Component ('use client')
    |
    v
Server Action ('use server')
    |
    +-> 1. Zod Validation (input)
    +-> 2. apiFetch/apiPost/apiGet (backend call)
    +-> 3. revalidatePath (cache bust)
    +-> 4. ActionResult<T> don
    |
    v
Backend API

Return type: ActionResult<T> =
  | { success: true; data?: T; message?: string }
  | { success: false; error: string }
```

**YASAK:**
- Direkt `fetch()` kullanimi
- Client'tan backend'e direkt cagri
- Raw error message donme (sanitize et)

**ZORUNLU:**
- `'use server'` directive
- Zod validation
- `ActionResult<T>` return type

---

## Authentication Flow

```
1. Client: loginWithPhoneAction(phone)
    |
    v
2. Backend: SMS kodu gonder (Asist Iletisim)
    |
    v
3. Client: verifyPhoneAndLoginAction(phone, code)
    |
    v
4. Backend: Dogrula + JWT tokens olustur
    |
    v
5. Backend: HttpOnly cookies set (accessToken + refreshToken)
    |
    v
6. Client: Role-based redirect (getRoleBasedRoute)
```

### Token Refresh

**Server-side:** `apiFetch()` 401 aldiginda mutex ile `/oturum/refresh` cagri
**Client-side:** `BroadcastChannel` + `localStorage` multi-tab koordinasyonu
**Monitor:** `<TokenRefreshMonitor />` (yonetim layout'ta)

---

## Validation Ayrimi

| Taraf | Teknoloji | Kullanim |
|-------|-----------|----------|
| Backend | class-validator + ValidationPipe | DTO'larda decorator-based validation |
| Frontend | Zod + react-hook-form | Form ve API contract validation |

**Backend ValidationPipe (Global):**

```typescript
whitelist: true              // 1. Bilinmeyen field'lari objeden cikar (strip)
forbidNonWhitelisted: true   // 2. Bilinmeyen field varsa 400 throw et (reject)
transform: true              // 3. Plain object → DTO class instance + tip donusumu
```

İkisi birlikte = defense in depth. Sıralama: önce `forbidNonWhitelisted` kontrol → fail ise 400; pass ise `whitelist` strip. Pratikte `forbidNonWhitelisted` kazanır (önce çalışır).

**Frontend Zod:**
- Feature-level: `features/xxx/types/schemas.ts` (form validation)
- API contracts: `shared/lib/api/contracts/*.ts` (request/response validation)

---

## Error Handling

### Backend Exception Filter Zinciri

```
1. UnauthorizedExceptionFilter   <- TOKEN_EXPIRED, TOKEN_REVOKED kodlari korur
    |
    v
2. ValidationExceptionFilter     <- class-validator hatalarini { field, constraints } formatla
    |
    v
3. AllExceptionsFilter           <- Catch-all, structured JSON log, stack trace sadece dev'de
```

### Backend Exception Turleri

| Exception | HTTP | Kullanim |
|-----------|------|----------|
| ForbiddenException | 403 | CASL reject |
| UnauthorizedException | 401 | Token invalid/expired |
| NotFoundException | 404 | Kayit bulunamadi |
| ConflictException | 409 | Duplicate/cakisma |
| BadRequestException | 400 | Gecersiz input |
| InternalServerErrorException | 500 | Sunucu hatasi |

**Kural:** Raw error message ASLA client'a donme. Error sanitization ZORUNLU.

### Frontend ActionResult<T>

```typescript
type ActionResult<T = unknown> =
  | { success: true; data?: T; message?: string }
  | { success: false; error: string; data?: unknown }
```

---

## Observability

### Request Context (AsyncLocalStorage)

```typescript
type ReqContext = {
  requestId: string;
  correlationId: string;        // OTel traceId veya x-correlation-id (OBS-05)
  traceparent?: string;         // W3C Trace Context
  traceId?: string;             // OTel span context
  spanId?: string;
  userId?: string;
  userRoles?: readonly string[];
  ip?: string;
  method?: string;
  path?: string;
  startedAt?: number;
}
```

Her request'te `RequestContextMiddleware` context olusturur (request lifecycle'in EN BASINDA — AsyncLocalStorage run).
OTel `trace.getActiveSpan()` ile traceId/spanId merge edilir; manuel correlationId üretimi YASAK (OBS-05, Pattern 32).
`HttpAuditInterceptor` ve Pino formatter context'i OKUR (sonra, controller'a yakin).

Akis:
```
Request → RequestContextMiddleware (context init)
       → JwtGuard (userId context'e mutate)
       → PoliciesGuard
       → HttpAuditInterceptor (context oku, audit yaz)
       → Handler
```

Tum service'ler (AuditService, exception filter'lar) bu context'e erisir.

### Prometheus Metrics

- `http_request_duration_seconds` (histogram)
- `bullmq_jobs_total` (counter)
- Default Node.js metrics
- Endpoint: `/metrics`

### Audit Trail

Her CUD (Create/Update/Delete) islemi BullMQ uzerinden async audit log yazilir:

```
AuditJobProducer.push({
  entityType: 'Appointment',
  entityId: 'xxx',
  action: 'create',
  actorId: requesterId,
  body: { ... },
  diff: { ... }
})
```

### PII Maskeleme Disiplini (KVKK Uyumlu)

PII (Personal Identifiable Information) **3 ayri stream'de farkli davranis**:

| Stream | PII Davranisi | Erisim | Retention | Hedef |
|--------|---------------|--------|-----------|-------|
| Logger (operasyonel) | MASKELI | Tüm developer | 30 gün | Pino → Loki/CloudWatch |
| Audit Log (yasal kayıt) | AÇIK | SADECE `audit:read` permission'lı role | 10 yıl (KVKK) | PostgreSQL WORM/RLS partitioned |
| Security Event Log | MASKELI (son 4 hane) | SOC + `audit:read` | 2 yıl | SIEM (Splunk/ELK) |

Log'larda PII (TC kimlik, telefon, ad-soyad) `PiiMaskingHelper` ile maskelenir. AuditLog'da PII açık (yasal saklama amacı, CASL ile erişim kısıtlı).

### Log Sink Stratejisi (Day-1 Karari)

| Akis | Sink | Tool | Retention |
|------|------|------|-----------|
| Application log | stdout (JSON) → Loki | Pino + Loki | 30 gun |
| Audit log | PostgreSQL partitioned + WORM | TimescaleDB/RLS | 10 yil |
| Security event | SIEM | Elastic/Splunk | 2 yil |
| Metrics | Prometheus | Prometheus + Grafana | 90 gun |
| Traces | Jaeger | OpenTelemetry → Jaeger | 7 gun |
| Frontend errors | Sentry | Sentry SaaS/self-host | 90 gun |

Sink karari Day-1'de verilir, retrofit edilmez. Infrastructure as code'da tanimli.

---

## Soft Delete (deletedAt STANDARDIZE)

**Yeni kodda:** `deletedAt: Date | null` ZORUNLU. Hard delete YASAK.
**Mevcut eski pattern'ler:** `isActive`, hard delete -> migrate edilecek.

```typescript
// DOGRU - deletedAt pattern
async softDelete(id: string): Promise<void> {
  await this.prisma.xxx.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// Sorgularda ZORUNLU filtre
where: { deletedAt: null, ...otherFilters }
```

---

## Middleware & Security

| Katman | Aciklama |
|--------|----------|
| `helmet()` | Security header'lar |
| `compression()` | Gzip response |
| `cookieParser()` | Cookie parsing |
| `json({ limit: '100kb' })` | Payload size limiti |
| Content-Type Middleware | Sadece `application/json` ve `multipart/form-data` |
| CORS | Whitelist origin'ler (CORS_ORIGIN env) |
| NoCacheInterceptor | `Cache-Control: no-store` tum API response'larda |

---

## Mimari Degismezler (Architectural Invariants)

Asagidaki yapisal kurallar NE OLURSA OLSUN bozulmaz. Bunlar Iron Rules'tan farklidir - Iron Rules kod yazim kurallaridir, bunlar ise mimarinin kendisidir.

### 1. Feature Izolasyonu

Feature modulleri birbirini DOGRUDAN import EDEMEZ — `{feature}.module.ts` public exports dahil.

**Cross-context iletişim 4 yoldan biri ile yapılır:**
- **Shared Interface Contract** — senkron, aynı request (in-monolith pre-condition). `shared/<concern>/domain/i-*.contract.ts`
- **Anti-Corruption Layer (ACL)** — senkron, dış sistem (3rd party HTTP/RPC). `shared/external/<vendor>/`. 8 sorumluluk (Pattern 31).
- **BullMQ Domain Event (Outbox)** — asenkron, eventually consistent, fire-and-forget fan-out. `shared/messaging/`
- **Saga / Process Manager** — asenkron, multi-step, compensation gerekli (forward-looking)

Diğer yollar (event publish + reply bekle, direkt feature import) **YASAK**.
Detay: [`IRON_RULES_EVENTS.md` → EVT-00](./IRON_RULES_EVENTS.md).

```
YASAK:  import { UserService } from '../identity/users/...'
        (randevu-sistemi icinden identity'ye direkt erisim)

DOGRU:  Shared infrastructure uzerinden (UoW, event bus)
```

### Cross-Feature Iletisim Stratejisi

Feature'lar arasi iletisim 4 yoldan biri ile yapilir (Karar Matrisi — [`IRON_RULES_EVENTS.md` → EVT-00](./IRON_RULES_EVENTS.md)):

| Yontem | Ne Zaman | Ornek | Konum |
|--------|----------|-------|-------|
| Shared Interface Contract | Senkron, ayni request icinde | Kullanici var mi kontrolu | `shared/<concern>/domain/i-*.contract.ts` |
| Anti-Corruption Layer (ACL) | Senkron, dis sistem cagrisi | KPS kimlik dogrulama | `shared/external/<vendor>/` (Pattern 31) |
| BullMQ Domain Event (Outbox) | Asenkron, eventually consistent | Randevu olusturuldu -> bildirim gonder | `shared/messaging/` |
| Saga / Process Manager | Asenkron, multi-step, compensation | Randevu iptal -> odeme iade -> bildirim | feature state entity (forward-looking) |

Shared contract: `shared/<concern>/domain/i-*.contract.ts` altinda interface tanimlanir, ilgili feature implement eder, tuketici `@Inject(TOKEN)` ile alir.
BullMQ domain event: Handler `uow.outbox.append()` ile transaction icinde yazar (Kural 6.3); `OutboxRelayWorker` push eder. Direkt `domainEventProducer.publish()` YASAK (EVT-04).
ACL: Dis sistem entegrasyonu — vendor concrete class direkt inject YASAK; contract + 8 sorumluluk (EVT-00, Pattern 31).

KURAL: Feature'dan feature'a DIREKT dependency YOKTUR. Iletisim her zaman shared katman uzerinden.

### 2. Katman Bagimlilik Yonu

```
Interface -> Application -> Domain -> (ASLA tersi)
Infrastructure Domain'i implement eder ama Domain Infrastructure'i bilmez.
```

- Domain layer HICBIR framework import'u icermez (NestJS, Prisma YOK)
- Domain entity'ler pure TypeScript class'laridir
- Repository interface Domain'de, implementation Infrastructure'da

### 3. CQRS Ayirimi

Command ve Query ASLA karistirilmaz:
- Command (write): Veri degistirir, side effect yaratir
- Query (read): Sadece okur, HICBIR side effect yaratmaz
- Bir handler HEM write HEM read YAPAMAZ

```
YASAK:  QueryHandler icinde create/update/delete
YASAK:  CommandHandler icinde baska command dispatch
```

### 4. Server Action Boundary

Frontend ASLA backend'e dogrudan erismez:
- Client Component -> Server Action -> apiFetch -> Backend API
- Bu zincir KIRILAMAZ
- `fetch()` direkt kullanimi YASAK
- Client-side API call YASAK (BFF proxy dahil deprecated)

### 5. Guard Zinciri Butunlugu

4 global guard sirasi ve gorevleri sabittir:

```
SmartThrottlerGuard  -> Kim olursa olsun flood'u engelle
OriginGuard          -> CSRF saldirilarini engelle
JwtGuard             -> Kimlik dogrula
PoliciesGuard        -> Ne yapabilecegini belirle + field/condition coz
```

Guard atlanamaz, sirasi degistirilemez, aradan biri cikarilmaz.

### 6. Shared Tekelligi (Cross-Cutting Concerns)

Su konular SADECE `shared/`'da yasayabilir (her concern kendi **mini-Clean Architecture** disipliniyle):
- CQRS Infrastructure (BaseCommand/BaseQuery, CommandRequesterInterceptor) -> `shared/cqrs/{domain,infrastructure}/`
- Authorization (CASL ABAC) -> `shared/authorization/{domain,application,infrastructure}/`
- Database (Prisma, UoW) -> `shared/database/{application,infrastructure}/`
- Security (JWT, Rate Limit) -> `shared/security/{domain,application,infrastructure}/`
- Messaging (BullMQ, DomainEventProducer, AuditJobProducer) -> `shared/messaging/{domain,application,infrastructure}/`
- **Observability** (Logger + Audit + Metrics + Health + Tracing + Request Context) -> `shared/observability/{logger,audit,metrics,health,tracing,request-context}/`
- **External (Vendor ACL)** -> `shared/external/{kps,sms,banka-pos,edevlet}/` — her vendor 8 sorumluluk sağlar (Pattern 31)
- Exception filters (cross-cutting) -> `shared/filters/`

Feature icinde bunlarin kopyasi/alternatifi OLUSTURULAMAZ.

### 7. Soft Delete Butunlugu

Veritabaninda fiziksel silme (hard delete) YOKTUR:
- Her tablo `deletedAt` kolonu icerir
- Silme = `deletedAt = new Date()`
- Her sorgu `deletedAt: null` filtresi icerir
- Veri ASLA kaybedilmez

### 8. Audit Trail Butunlugu

Her veri degisikligi (CUD) kayit altindadir:
- Audit BullMQ uzerinden asenkron yazilir
- Kim, ne zaman, ne yapti, neyi degistirdi bilgisi saklanir
- Audit log'lar SILINEMEZ ve DEGISTIRILEMEZ
- Bu KVKK/GDPR uyumlulugu icin zorunludur

### 9. Atomic Design Hiyerarsisi (Frontend)

```
Atoms -> Molecules -> Organisms -> Templates -> Pages
```

- Ust seviye alt seviyeyi kullanir, ASLA tersi
- Feature component'leri shared component'leri kullanir, ASLA tersi
- shadcn/ui component'leri Atom seviyesindedir

### 10. Single Source of Truth

| Konu | Tek Kaynak |
|------|-----------|
| Yetki tanimlari | Permission tablosu (DB) |
| Kullanici rolleri | Role + RolePermission tablolari (DB) |
| Rate limit config | SmartThrottlerGuard (kod) |
| Validation kurallari | Backend: DTO, Frontend: Zod schema |
| API kontrati | Backend Controller + DTO |
| UI tema | Tailwind config + shadcn theme |

Ayni bilgi iki yerde TUTULMAZ. Bir degisiklik TEK NOKTADA yapilir.

### 11. Outbox Garantisi

Audit ve Domain Event yayini transaction boundary icinde outbox tablosuna yazilir. BullMQ'ya DOGRUDAN push YASAK (TXN-03 ile birlikte).

```typescript
// YASAK
await uow.transaction(async () => {
  await uow.xxxs.create(entity);
  await this.auditProducer.push(...);   // Transaction DISI!
});

// DOGRU — Outbox icine yaz (atomic)
await uow.transaction(async () => {
  await uow.xxxs.create(entity);
  await uow.outbox.append({ eventType: 'audit.log', payload: {...} });
});
// OutboxRelayWorker outbox'tan okur, BullMQ'ya push eder.
```

Detay: PATTERNS.md Pattern 22 (Outbox Implementation).

### 12. Aggregate Root Boundary

Domain entity'leri **Aggregate** olarak organize edilir:
- Tek root entity (Aggregate Root) + 0..N child entity + value object
- Repository SADECE root icin yazilir; child'lara root uzerinden erisilir
- Transactional consistency = aggregate boundary
- Cross-aggregate referans = sadece root ID (FK var, navigation property YOK)

Detay: PATTERNS.md Pattern 23 (Aggregate Root Pattern).

### 13. OpenTelemetry Trace Propagation

OpenTelemetry trace context, domain event akışına da yayılır.
Manuel correlationId üretimi YASAK — middleware + propagation otomatik.
Detay: [OBS-05](./IRON_RULES_OBSERVABILITY.md), [EVT-01](./IRON_RULES_EVENTS.md), Pattern 32.

### 14. ACL Zorunlulugu (Dis Sistem Entegrasyonu)

Her dış sistem entegrasyonu ACL pattern üzerinden yapılır.
Vendor concrete class direkt inject YASAK.
8 sorumluluk (şema, hata, timeout, retry, circuit, cache, audit, mock) ZORUNLU.
Detay: [EVT-00](./IRON_RULES_EVENTS.md), [EVT-11](./IRON_RULES_EVENTS.md), [OBS-12](./IRON_RULES_OBSERVABILITY.md), Pattern 31.

---

## Test Stratejisi

### Test Piramidi

```
        +-------+
        | E2E   |    <- Az (kritik flow'lar)
        +-------+
       /         \
      +-----------+
      | Integration|  <- Orta (controller + guard + DB)
      +-----------+
     /             \
    +---------------+
    |   Unit Test   |  <- Cok (handler, repository, entity, action)
    +---------------+
```

| Seviye | Kapsam | Arac |
|--------|--------|------|
| Unit | Handler, Repository, Entity, Server Action | Jest + @nestjs/testing |
| Integration | Controller + Guard + ValidationPipe + DB | Jest + Supertest + Test DB |
| E2E | Full user flow (login -> islem -> sonuc) | Playwright (planlanacak) |

**Kural:** Her yeni feature MINIMUM unit test ile baslar. Integration test controller seviyesinde eklenir. E2E kritik is akislari icin yazilir.

---

## i18n Stratejisi

| Alan | Dil | Aciklama |
|------|-----|----------|
| UI metinleri | Turkce | Tek dil (belediye uygulamasi) |
| Validation mesajlari | Turkce | Backend DTO + Frontend Zod |
| API hata mesajlari | Turkce | AllExceptionsFilter sanitize eder |
| NestJS exception'lar | Ingilizce | Framework exception class adlari |
| Log mesajlari | Ingilizce | Gelistirici odakli |
| DB field adlari | Ingilizce | Teknik standard |

**Kural:** Kullaniciya gosterilen her mesaj Turkce olmalidir. Teknik log'lar Ingilizce kalabilir.

---

## API Versioning

**Mevcut:** Versiyonsuz (`/api/identity/users`).

Versiyonlama henuz aktif degil. İlk major breaking API degisikliginde URI-based versioning (`/api/v1/...`) degerlendirilecek. Versiyon karari ilgili `/tasarla` sırasında ADR olarak dokumante edilir.

**Minor degisiklikler** (yeni field, opsiyonel parametre) versiyon GEREKTIRMEZ.
**Breaking change** (field silme, type degisimi) yeni versiyon GEREKTIRIR.

---

## Erisilebilirlik (a11y)

### Zorunlu Standartlar (WCAG 2.1 AA)

| Alan | Gereksinim |
|------|-----------|
| Renk kontrast | Minimum 4.5:1 oran (metin), 3:1 (buyuk metin) |
| Klavye navigasyon | Tum islevler Tab/Enter/Escape ile erisilebilir |
| Focus indicator | Gorunur focus ring (Tailwind `ring-*`) |
| Form label | Her input icin `<FormLabel>` + `htmlFor` ZORUNLU |
| Alt text | Her anlamli gorsel icin `alt` attribute ZORUNLU |
| ARIA | Screen reader destegi: `aria-label`, `aria-describedby`, `role` |
| Hata mesajlari | `aria-invalid` + `aria-describedby` ile hata iliskisi |

**Not:** shadcn/ui bilesenleri varsayilan olarak Radix UI tabanli ve ARIA uyumludur. Ekstra ARIA genellikle gerekmez, ama custom component'lerde kontrol et.

---

## Key Files Reference

Shared concern'ler **mini-Clean Architecture** disiplini ile organize (her concern kendi `domain/application/infrastructure/` katmanlari).

| Ihtiyac | Dosya Konumu |
|---------|--------------|
| **CQRS Infrastructure** | |
| BaseCommand | `backend/src-v2/shared/cqrs/domain/base.command.ts` (KANONİK extend kaynağı) |
| BaseQuery | `backend/src-v2/shared/cqrs/domain/base.query.ts` |
| CommandRequesterInterceptor | `backend/src-v2/shared/cqrs/infrastructure/command-requester.interceptor.ts` |
| **Authorization (CASL ABAC)** | |
| Ability Types | `backend/src-v2/shared/authorization/domain/ability.types.ts` |
| CASL AbilityFactory | `backend/src-v2/shared/authorization/application/ability.factory.ts` |
| Ability Cache | `backend/src-v2/shared/authorization/application/ability-cache.service.ts` |
| PolicyCompiler | `backend/src-v2/shared/authorization/application/policy-compiler.ts` |
| Policy Context Builder | `backend/src-v2/shared/authorization/application/policy-context.builder.ts` |
| Field Filter Helper | `backend/src-v2/shared/authorization/application/field-filter.helper.ts` |
| PoliciesGuard | `backend/src-v2/shared/authorization/infrastructure/policies.guard.ts` |
| ResourceRegistry | `backend/src-v2/shared/authorization/infrastructure/resource-registry.ts` |
| Action const | `backend/src-v2/shared/authorization/domain/action.const.ts` |
| Resource const | `backend/src-v2/shared/authorization/domain/resource.const.ts` |
| **Security (JWT + Rate Limit)** | |
| JWT Strategy | `backend/src-v2/shared/security/application/jwt.strategy.ts` |
| JWT Config | `backend/src-v2/shared/security/application/jwt-config.service.ts` |
| Adaptive Rate Limiter | `backend/src-v2/shared/security/application/adaptive-rate-limiter.service.ts` |
| JwtGuard | `backend/src-v2/shared/security/infrastructure/jwt.guard.ts` |
| SmartThrottlerGuard | `backend/src-v2/shared/security/infrastructure/smart-throttler.guard.ts` |
| **Database (Prisma + UoW)** | |
| IUnitOfWork (port) | `backend/src-v2/shared/database/application/unit-of-work.ts` |
| UnitOfWork (impl) | `backend/src-v2/shared/database/infrastructure/unit-of-work.service.ts` |
| Prisma Service | `backend/src-v2/shared/database/infrastructure/prisma.service.ts` |
| **Messaging (BullMQ)** | |
| Event Envelope Types | `backend/src-v2/shared/messaging/domain/event-envelope.types.ts` |
| DomainEventProducer | `backend/src-v2/shared/messaging/application/domain-event.producer.ts` |
| Audit Job Producer | `backend/src-v2/shared/messaging/application/audit-job.producer.ts` |
| BullMQ Config | `backend/src-v2/shared/messaging/infrastructure/bullmq.config.ts` |
| Domain Event Consumers | `backend/src-v2/shared/messaging/infrastructure/consumers/` |
| **Observability (Logger + Audit + Metrics + Health)** | |
| Logger Config (Pino) | `backend/src-v2/shared/observability/logger/pino-logger.config.ts` |
| Request Context (AsyncLocalStorage) | `backend/src-v2/shared/observability/request-context/request-context.ts` |
| Request Context Middleware | `backend/src-v2/shared/observability/request-context/request-context.middleware.ts` |
| OTel SDK + Instrumentations | `backend/src-v2/shared/observability/tracing/otel-sdk.config.ts` |
| PII Masking Helper | `backend/src-v2/shared/observability/logger/pii-masking.helper.ts` |
| Audit Service | `backend/src-v2/shared/observability/audit/audit.service.ts` |
| Prometheus Metrics | `backend/src-v2/shared/observability/metrics/metrics.service.ts` |
| Health Check | `backend/src-v2/shared/observability/health/health.controller.ts` |
| **Cross-cutting** | |
| Exception Filters | `backend/src-v2/shared/filters/` |
| Prisma Schema | `backend/prisma/schema.prisma` |
| apiFetch | `frontend/src-v2/shared/lib/api/core/api-fetcher.ts` |
| ActionResult | `frontend/src-v2/shared/lib/api/contracts/common.ts` |
| Token Manager | `frontend/src-v2/shared/lib/api/core/api-fetcher.ts` |
