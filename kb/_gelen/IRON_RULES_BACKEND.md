# W0NDERSUPERIOR Demir Kurallari — Backend (NestJS / TypeScript)

Bu kurallar backend (NestJS / TypeScript) kodu icin gecerlidir. **HICBIR KOSULDA** ihlal edilemez. Violation = Reddedilen kod.

## Kural Taksonomisi

| Kod | Kural | Impact |
|-----|-------|--------|
| TS-01 | No `any` type | CRITICAL |
| TS-02 | No `as` type assertion | CRITICAL |
| TS-03 | No `!` non-null assertion | HIGH |
| TS-04 | No `console.log/warn/error` | CRITICAL |
| TS-05 | No `@ts-ignore` | HIGH |
| TS-06 | No `Object`, `Function` type | HIGH |
| GUARD-01 | Guard sirasi degistirilemez | CRITICAL |
| CASL-01 | Guard coarse check, Repository tam cozum | CRITICAL |
| CASL-02 | ResourceRegistry + Permission + Role zorunlu | CRITICAL |
| CASL-03 | @SkipPolicies sadece @Public ile | CRITICAL |
<!-- CASL-04: v11'de kaldirildi (eski "Guard ciktisi req'e attach"). -->
| CASL-05 | Repository AbilityFactory inject ZORUNLU (her feature) | CRITICAL |
<!-- CASL-06: v11'de kaldirildi (eski "Eski feature'a ABAC eklemek YASAK"). HER feature ABAC kullanir. -->
| CASL-07 | Handler'da abilityFactory.buildFor() YASAK | CRITICAL |
| CASL-08 | Ability request-scoped memoization (per-request cache) | HIGH |
| RATE-01 | Hassas endpoint ozel rate limit | HIGH |
| RATE-02 | Rate limit bypass yasak | HIGH |
| REPO-01 | Interface + Concrete zorunlu | CRITICAL |
| REPO-02 | Soft delete (deletedAt) zorunlu | CRITICAL |
| REPO-03 | deletedAt filtresi zorunlu | CRITICAL |
| TXN-01 | Multi-write = UoW zorunlu | CRITICAL |
| TXN-02 | Direkt prisma.$transaction yasak | CRITICAL |
| TXN-03 | Outbox Pattern ZORUNLU (BullMQ push transaction disinda YASAK) | CRITICAL |
| TXN-04 | Nested Transaction = SAVEPOINT, flow control disi | HIGH |
| TXN-05 | Transaction Isolation Level (Serializable/RepeatableRead/ReadCommitted) | HIGH |
| TXN-06 | Worker Transaction Disiplini (uzun tx YASAK, batch + ayri tx) | HIGH |
| CONC-01 | Optimistic Locking (version field + check, concurrent write riskli tablolarda) | HIGH |
| DT-01 | UTC Saklama, TRT Gosterme (`@db.Timestamptz` zorunlu) | CRITICAL |
| DT-02 | ISO 8601 API Contract (timezone offset zorunlu) | HIGH |
| DT-03 | Date Range Helper Kullanimi (raw `<`/`>` YASAK) | HIGH |
| MNY-01 | Money = Int (Kurus); Decimal/Float YASAK | CRITICAL |
| CFG-01 | Boot'ta Env Validation (Zod schema, eksik = process.exit) | CRITICAL |
| CFG-02 | Hardcoded URL/Port/Host YASAK (HARD-01 alt-kurali) | HIGH |
| CACHE-01 | Cache Key Naming (`<feature>:<resource>:<id>[:<variant>]`) | HIGH |
| CACHE-02 | TTL ZORUNLU (sonsuz cache yasak) | CRITICAL |
| CACHE-03 | Cache Stampede Korumasi (jitter / stale-while-revalidate / lock) | HIGH |
| BULK-01 | Bulk Operasyon Pattern (batch + ayri tx, skipDuplicates) | CRITICAL |
| MIG-04 | FK ON DELETE Davranisi (Restrict/SetNull/Cascade explicit) | CRITICAL |
| MIG-05 | Index Naming Convention (`idx_*` / `uniq_*` prefix) | HIGH |
| CQRS-01 | Command/Query Naming (Ingilizce fiil + PascalCase + tekil aggregate) | HIGH |
| CQRS-02 | Command Idempotency Key (hassas command'larda zorunlu) | HIGH |
| CASL-09 | Role Hierarchy Explicit (implicit inheritance YASAK) | HIGH |
| CASL-10 | Permission Seed Migration (versionlu, up/down, log tablosu) | HIGH |
| AUTH-01 | Session Timeout (AT 15 dk, RT 7 gun, idle 30 dk) | HIGH |
| AUTH-02 | Concurrent Session Limit (max 3 aktif RT) | MEDIUM |
| AUTH-03 | Sifre Degisikligi = All Sessions Invalidate | CRITICAL |
| AUTH-04 | "Beni hatirla" Kurali (RT TTL 30 gun, idle 7 gun) | MEDIUM |
| JOB-01 | Cron Timezone (Europe/Istanbul zorunlu) | HIGH |
| JOB-02 | Worker Concurrency (her Worker icin tanimli) | HIGH |
| JOB-03 | Circuit Breaker (3rd party API cagrilarinda zorunlu) | HIGH |
| KVKK-01 | Data Retention Policy (her tabloda tanimli, otomatik arsiv cron) | CRITICAL |
| KVKK-02 | Data Export Endpoint (`/me/data-export`, async, ZIP) | HIGH |
| KVKK-03 | Unutulma Hakki / Pseudonymization (hard delete YASAK) | CRITICAL |
| DOC-01 | Swagger ZORUNLU (her endpoint @ApiOperation + @ApiResponse) | HIGH |
| DOC-02 | ADR (Architecture Decision Records) `docs/adr/` | MEDIUM |
| TEST-08 | Test Database Lifecycle (BEGIN/ROLLBACK her testte) | HIGH |
| TEST-09 | Test Data Factory (inline mock YASAK) | HIGH |
| NAME-01 | File Naming kebab-case (`unicorn/filename-case`) | HIGH |
| NAME-02 | Boolean Prefix (`is/has/can/should/did`) | MEDIUM |
| NAME-03 | Function Verb-Prefix (`get/fetch/find/list/load/build/create/save/delete`) | MEDIUM |
| AUDIT-01 | CUD = audit zorunlu | HIGH |
| AUDIT-02 | Async audit (BullMQ) zorunlu | HIGH |
| AUDIT-03 | Audit Log Immutability Enforcement (4 katman) | CRITICAL |
| PII-01 | Log'larda PII maskeleme zorunlu | HIGH |
| EXC-01 | Pokemon exception handling yasak | CRITICAL |
| EXC-02 | Dogru exception turleri kullan | HIGH |
| EXC-03 | Global exception filter zorunlu | HIGH |
| EXC-04 | catch(error: unknown) zorunlu | CRITICAL |
| EXC-05 | Domain Exception ayrimi (DomainError pure; NestJS exception domain'de YASAK) | CRITICAL |
| Observability (OBS-01..12) | Logger/Audit/Metric/Health/Trace/ACL — kanonik: IRON_RULES_OBSERVABILITY.md | → ayrı dosya |
| Events/BullMQ (EVT-00..12) | Cross-feature/Outbox/Idempotency/Versioning/Tombstone/Saga — kanonik: IRON_RULES_EVENTS.md | → ayrı dosya |
| MOD-01 | Feature izolasyonu | CRITICAL |
| MOD-02 | Dependency direction (infra -> domain) | CRITICAL |
| MOD-03 | Controller'da is mantigi yasak | HIGH |
<!-- SCOPE-01 / SCOPE-02: IRON_RULES_SHARED Bolum 10 "Scope Boundary" kanonik kaynaktir; buradan kaldirildi. -->
| PERF-01 | N+1 query yasak — loop icinde Prisma query YASAK, batch kullan | CRITICAL |
| PERF-02 | Pagination max limit zorunlu — pageSize sinirlanmali (max 100) | HIGH |
| PERF-03 | Sort field whitelist zorunlu — kullanici keyfi alan siralayamaz | HIGH |
| PERF-04 | findMany'de select/include optimize — gereksiz relation cekilmez | HIGH |
| CTRL-01 | Controller'da @RequireAction veya @CheckPolicies ZORUNLU (Public haric) | CRITICAL |
| CTRL-02 | Controller input validation — DTO + ValidationPipe zorunlu | CRITICAL |
| CTRL-03 | Controller'da is mantigi YASAK — handler'a devret | HIGH |
| MIG-01 | Migration risk analizi zorunlu (schema degisikliginde) | CRITICAL |
| MIG-02 | Tek adimda kolon silme/rename yasak — expand-contract kullan | CRITICAL |
| MIG-03 | NOT NULL ekleme → default deger veya expand-contract zorunlu | HIGH |

---

## 1. TypeScript Kurallari (Backend)

| YASAK | ALTERNATIF | NEDEN |
|-------|------------|-------|
| `any` | `unknown` + type guard | Type safety |
| `as Type` | Type guard, Zod validation | Runtime safety |
| `value!` | `value?.` optional chaining | Null safety |
| `console.log/warn/error()` | `Logger` (NestJS built-in) | Production logs |
| `// @ts-ignore` | Tipi duzelt | Type safety |
| `Object`, `Function` | Specific type | Type safety |

### `as` Yasagi: SIFIR EXCEPTION

`as` HICBIR YERDE kullanilmaz. Catch block dahil:

```typescript
// YASAK - catch block'ta bile
try { ... } catch (error) {
  logger.error(error as Error);  // YASAK!
}

// DOGRU - unknown + instanceof
try { ... } catch (error: unknown) {
  if (error instanceof Error) {
    logger.error(error.message);
  } else {
    logger.error('Bilinmeyen hata', { error });
  }
}
```

### Logging Kurali

```typescript
// YASAK
console.log('Debug:', user);
console.error('Hata:', error);

// DOGRU - Backend NestJS Logger
this.logger.debug('User fetched', { userId: user.id });
this.logger.error('Operation failed', { error: error.message });
```

---

## 2. Guard Sirasi (DEGISTIRILEMEZ)

```
SmartThrottlerGuard -> OriginGuard -> JwtGuard -> PoliciesGuard
```

Bu sira **ASLA** degistirilemez. Yeni guard eklenecekse PoliciesGuard'dan ONCE olmali.

**Neden bu sira?**

| Sira | Guard | Gorev | Neden bu pozisyonda |
|------|-------|-------|---------------------|
| 1 | SmartThrottlerGuard | Rate limit | Yetkisiz bile olsa flood'u engelle |
| 2 | OriginGuard | CSRF/Origin kontrolu | Origin dogrulamasini auth'tan once yap |
| 3 | JwtGuard | Authentication | Kim oldugunu bil |
| 4 | PoliciesGuard | CASL Authorization | Ne yapabilecegini kontrol et (EN SON) |

```typescript
// YASAK - Guard sirasi degistirmek
@UseGuards(JwtGuard, SmartThrottlerGuard, PoliciesGuard) // YANLIS SIRA!

// DOGRU - Global guard sirasi korunur (app.module'de tanimli)
// Yeni guard eklenecekse SADECE PoliciesGuard'dan once:
// SmartThrottlerGuard -> OriginGuard -> JwtGuard -> [YeniGuard] -> PoliciesGuard
```

---

## 3. CASL Yetkilendirme Kurallari (ABAC)

> **Tek mod: ABAC.** Bi-Modal kavrami v11 refactor'da kaldirildi. HER feature
> Repository-Driven ABAC kullanir. `Resource.abacEnabled: true` varsayilan ve
> her zaman true. Eski feature / RBAC fallback / `roles.includes` kalintisi YOK.

> **ABAC Repository-Driven Pattern (ozet):**
> - **Guard (PoliciesGuard)** coarse-grained karar verir: `ability.can(action, Subject)` → eslesmezse 403, eslesirse handler'a gecer. Guard `permittedFields` / `caslConditions` HESAPLAMAZ.
> - **Repository** ince-grained karar verir: `AbilityFactory` inject + `accessibleBy(ability, action).Subject` ile WHERE injection + `FieldFilterHelper.buildSelect(permittedFields)` ile select projection + write yollarinda instance-level `subject('Xxx', entity)` ile yetki check.
> - **Handler** yetki kodu YAZMAZ — `abilityFactory.buildFor()` ve `accessibleBy(...)` cagrisi handler'da YASAK (CASL-07). Handler sadece `repo.findX(criteria, requesterId)` cagirir; Repository ABAC'i icinde uygular.
> - Boylece CASL-05 (Repository AbilityFactory inject ZORUNLU) ve CASL-07 (Handler buildFor YASAK) **ayni kanonun iki yuzudur**: yetki disiplini Guard + Repository ikilisindedir, handler temizdir.

### Kural 3.1: Guard Coarse Check, Repository Tam Cozum

PoliciesGuard her zaman COARSE-GRAINED kontrol yapar:
- action+subject tipi erisim kontrolu (`ability.can('READ', 'YeniModul')`)
- Default-deny (eslesmezse 403)
- Guard `permittedFields`/`caslConditions` HESAPLAMAZ (Repository yapar)

Repository: AbilityFactory inject + `accessibleBy` + FieldFilterHelper.
Handler: yetki kodu YAZMAZ (CASL-07).

```typescript
// YASAK - Handler'da AbilityFactory.buildFor
async execute(command: CreateXxxCommand) {
  const ability = await this.abilityFactory.buildFor(requesterId);  // YASAK!
  if (!ability.can('CREATE', 'Xxx')) throw new ForbiddenException(); // YASAK!
}

// DOGRU - Handler temiz, Repository ABAC yapar
async execute(query: ListYeniModulQuery) {
  return this.repo.findMany(query.criteria, query.requesterId);  // Repository ABAC yapar
}

// DOGRU - Command path: Guard cozdu, handler temiz
async execute(command: CreateXxxCommand) {
  // Guard zaten yetki kontrolunu yapti, yetkisiz istek buraya ULASMAZ
  const entity = XxxEntity.create(command);
  return this.uow.transaction(async () => {
    return this.uow.xxxs.create(entity);
  });
}
```

### Kural 3.2: ResourceRegistry + Permission + Role

Yeni endpoint eklendiginde UC SEY ZORUNLU:
1. **ResourceRegistry'ye** subject kaydi
2. **Permission** tanimlamasi (Action + Resource)
3. Uygun **Role'lara** atama

Eksik olan varsa -> default-deny (403).

### Kural 3.3: @SkipPolicies Kisitlamasi

`@SkipPolicies()` SADECE `@Public()` route'larda kullanilabilir.
Auth gerektiren endpoint'te CASL bypass YASAK.

**Neden iki decorator?** `@Public` ve `@SkipPolicies` iki ayri katmani devre disi birakir:
- `@Public()` → **auth katmani** (JwtGuard'i bypass eder); kullanici kimligi sorgulanmaz.
- `@SkipPolicies()` → **yetki katmani** (PoliciesGuard'i bypass eder); CASL ability hesabi atlanir.

Bir endpoint'i tamamen acmak icin ikisini de yazmak ZORUNLU. Sadece `@Public()` yazilirsa JwtGuard bypass olur ama PoliciesGuard yine subject/action ararken `req.user` `undefined` oldugu icin default-deny (403) doner. Sadece `@SkipPolicies()` yazilirsa CASL atlanir ama JwtGuard 401 doner.

Kanonik kombinasyon: `@Public() + @SkipPolicies()` + sebep yorumu (en az 5 kelime).

```typescript
// DOGRU
@Public()
@SkipPolicies()  // public health probe — auth ve yetki katmaninin ikisi de bypass
@Get('health')
health() { return { status: 'ok' }; }

// YASAK - Auth gerektiren endpoint'te bypass
@SkipPolicies()  // @Public() YOK -> YASAK!
@Get('dashboard')
dashboard() { ... }
```

<!-- KALDIRILDI (v11 refactor): Kural 3.4 (Guard Ciktisi Req'e Attach — SADECE legacy feature)
     Legacy feature kavrami yok; Guard `permittedFields`/`caslConditions` hesaplamaz.
     Repository AbilityFactory ile kendi hesaplar. -->

<!-- KALDIRILDI (v11 refactor): Kural 3.6 (Eski Feature'a ABAC Eklemek YASAK — CASL-06)
     Eski feature kavrami yok; HER feature ABAC kullanir.
     CASL-06 kurali iptal edildi (audit'te dokumante). -->

### Kural 3.5: ABAC Repository-Driven (CASL-05, CRITICAL)

Repository ZORUNLU pattern (her feature, istisnasiz):
1. Constructor `AbilityFactory` inject edecek
2. findMany/findById/findFirst metodlari `userId: string` parametre alacak
3. `accessibleBy(ability, action).Subject` ile where injection
4. `FieldFilterHelper.buildSelect(permittedFields)` ile select
5. Repository mapper'da PII alan handling (whitelist gore maskeleme)

```typescript
// YASAK - AbilityFactory inject yok
@Injectable()
export class YeniRepository implements IYeniRepository {
  constructor(private prisma: PrismaService) {}  // EKSIK!

  async findMany(criteria: YeniCriteria) {  // userId imzasi YOK!
    return this.prisma.yeni.findMany({ where: criteria });  // ABAC YOK!
  }
}

// DOGRU
@Injectable()
export class YeniRepository implements IYeniRepository {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: AbilityFactory,  // ZORUNLU
  ) {}

  async findMany(criteria: YeniCriteria, userId: string): Promise<PaginatedResult<Yeni>> {
    const ability = await this.abilityFactory.buildFor(userId);
    const caslWhere = accessibleBy(ability, 'READ').Yeni ?? {};
    const fields = FieldFilterHelper.getPermittedFields(ability, 'READ', 'Yeni');
    const select = FieldFilterHelper.buildSelect(fields);

    const [data, total] = await Promise.all([
      this.prisma.yeni.findMany({
        where: { deletedAt: null, ...caslWhere, ...criteria.filters },
        select,
        skip: criteria.skip,
        take: criteria.take,
      }),
      this.prisma.yeni.count({ where: { deletedAt: null, ...caslWhere } }),
    ]);

    return { data: data.map((r) => this.mapToResponse(r, fields)), total, page: ..., limit: ... };
  }
}
```

Detayli pattern icin: **PATTERNS.md Pattern 20** (ABAC Feature).

Ihlal = build fail (gelecek lint rule `w0nderSuperior/abac-repository-injection`), code review reject.

### Kural 3.7: Handler'da AbilityFactory.buildFor YASAK (CASL-07, CRITICAL)

Handler'inda `AbilityFactory.buildFor()` cagirmak YASAK (her feature ABAC).
AbilityFactory **sadece Repository'de** inject edilir.

```typescript
// YASAK - Handler ABAC yapiyor
@QueryHandler(ListYeniQuery)
export class ListYeniHandler {
  constructor(
    @Inject('IYeniRepository') private repo: IYeniRepository,
    private abilityFactory: AbilityFactory,  // YASAK! Bu handler'da olmaz
  ) {}

  async execute(query: ListYeniQuery) {
    const ability = await this.abilityFactory.buildFor(query.requesterId);  // YASAK!
    const where = accessibleBy(ability, 'READ').Yeni;
    return this.repo.findMany({ where });  // Repository ABAC bilmiyor
  }
}

// DOGRU - Handler temiz, Repository ABAC yapar
@QueryHandler(ListYeniQuery)
export class ListYeniHandler {
  constructor(@Inject('IYeniRepository') private repo: IYeniRepository) {}

  async execute(query: ListYeniQuery) {
    return this.repo.findMany(query.criteria, query.requesterId);
  }
}
```

**Istisna:** Write command'larda instance-level final check icin
`throwUnlessCan(ability, action, subject, instance)` kullanilabilir (nadir, dokumante edilmis).

---

### Kural 3.8: @RequireAction vs @CheckPolicies vs @SkipPolicies — Decorator Seçim Kurali

Controller endpoint'inde 3 yetki decorator'undan **TAM 1 tanesi** olmali (CTRL-01). Hangisi?

#### @RequireAction Kanonik Format

```typescript
@RequireAction(Action.<ACTION>, Resource.<Subject>)

// Action: backend/src-v2/shared/authorization/domain/action.const.ts
export const Action = {
  READ: 'READ', CREATE: 'CREATE', UPDATE: 'UPDATE',
  DELETE: 'DELETE', MANAGE: 'MANAGE',
  APPROVE: 'APPROVE', REJECT: 'REJECT', EXPORT: 'EXPORT',
} as const;

// Resource: ResourceRegistry seed ile sync, PascalCase Subject key
export const Resource = {
  Randevu: 'Randevu', YeniModul: 'YeniModul',
} as const;
```

**YASAK formatlar:**
- `@RequireAction('CREATE:Xxx')` — string concat, ENUM-01 ihlali
- `@RequireAction('CREATE', 'Yeni')` — string literal, ENUM-01 ihlali
- `@RequireAction('read:User')` — lowercase + colon, format disi

Hook enforcement: `iron-rules-check.js` bu format disindaki kullanimi BLOCK eder.

#### Decorator Secim Tablosu

| Decorator | NE ZAMAN | ORNEK | YASAK |
|-----------|----------|-------|-------|
| `@RequireAction(action, subject)` | Tek bir CASL action yetkisi gerekli | `@RequireAction(Action.CREATE, Resource.Yeni)` | Cogul action OR sart |
| `@CheckPolicies(handler)` | Karmasik karar: cogul action / dinamik subject / runtime guard | `@CheckPolicies((ability) => ability.can('UPDATE', 'X') \|\| ability.can('APPROVE', 'X'))` | Tek sade action kontrolu (overkill) |
| `@SkipPolicies()` + sebep yorumu | Public endpoint VEYA system endpoint (health, metrics) | `@SkipPolicies() // public health probe` | Auth atlamak icin (CASL-03 ihlali) |

**Karar Akisi:**

```
1. Endpoint authn gerektirmiyor mu (saglik kontrolu, webhook)?
   EVET → @SkipPolicies() + // <sebep> yorumu (Kural 3.3 - en az 5 kelime)
   HAYIR → 2'ye git

2. Tek bir CASL action ile karar verebiliyor musun?
   EVET → @RequireAction(Action.ACTION, Resource.Subject)   <- DEFAULT
   HAYIR → 3'e git

3. Karar AND/OR/koşullu (RBAC + ABAC karisik) mi?
   EVET → @CheckPolicies(handler) — kompleks handler fonksiyonu
   HAYIR → Tasarim hatasi; yetki gereksinimini netlestirmek lazim
```

**Karistirma YASAK:**

```typescript
// YASAK — 2 decorator yan yana
@RequireAction(Action.CREATE, Resource.Yeni)
@CheckPolicies((ability) => ability.can('UPDATE', 'X'))
@Post()
async create() { ... }
// → CTRL-01 conflict: hangisi gecerli? PoliciesGuard ilk match'i alir, runtime karmasiklik.

// DOGRU — @CheckPolicies tek basina cogul kontrol yapar
@CheckPolicies((ability) =>
  ability.can('CREATE', 'Yeni') && ability.can('UPDATE', 'X'))
@Post()
async create() { ... }
```

**@RequireAction Custom Action Tanimlama:**

Yeni custom action eklemek (orn. `APPROVE`, `REJECT`, `EXPORT`) icin:
1. ResourceRegistry'de Resource'un `customActions` array'ine ekle
2. Permission seed dosyasinda role-action-condition satirini ekle
3. Controller endpoint'inde `@RequireAction(Action.CUSTOM_ACTION, Resource.Resource)`
4. (Frontend tarafinda `<Can I="CUSTOM_ACTION" a="Resource">`)

Custom action ekleme HER feature icin serbest — ABAC tek kanon. Adimlar (1) ResourceRegistry'de customActions ekle, (2) Permission seed satiri, (3) `@RequireAction(Action.CUSTOM, Resource.Resource)`, (4) frontend `<Can I="CUSTOM" a="Resource">`.

---

### Kural 3.9: Ability Request-Scoped Memoization (CASL-08, HIGH)

Ayni request icinde N repository call → N `buildFor()` cagrisi israf (L1+L2 cache hit olsa bile object allocation maliyeti var). AbilityFactory **request-scoped memoization** kullanir:

```typescript
@Injectable()
export class AbilityFactory {
  async buildFor(userId: string): Promise<AppAbility> {
    const ctx = requestContext.getStore();
    if (ctx?.ability) return ctx.ability;  // Memoize — ayni request'te tekrar build YOK

    // L1 (in-process memory) + L2 (Redis) cache flow
    const ability = await this.buildFromCache(userId);

    if (ctx) ctx.ability = ability;
    return ability;
  }
}
```

`RequestContext` type'ina `ability?: AppAbility` field eklenir. Cache invalidation: permission/role degisikliginde `policy` queue ile `ability.invalidated` event publish → cross-instance L1 cache flush.

Sebep: Bir request handler 5+ repository call yapabilir (controller → handler → service → repo1 → repo2 → ...). Her birinde `buildFor()` `O(rolePermissions * userGroups)` is yapar. Memoization N kati gereksiz CPU'yu eler.

---

## 4. Rate Limiting Kurallari

### Kural 4.1: Hassas Endpoint Ozel Limit

Hassas endpoint'ler (login, verify, password reset) icin **ozel rate limit ZORUNLU**.
Default tier'a birakma.

| Endpoint Tipi | Ozel Limit Gerekli |
|---------------|-------------------|
| Login/Auth | EVET |
| SMS/OTP | EVET |
| Token refresh | EVET |
| Password reset | EVET |
| Normal CRUD | HAYIR (default tier yeterli) |

### Kural 4.2: Rate Limit Bypass YASAK

Admin haric kimse rate limit bypass edemez.
`@SkipThrottle()` kullanimi sadece Admin tier'da gecerli.

---

## 5. Repository Kurallari

### Kural 5.1: Interface + Concrete ZORUNLU

Her feature'da repository interface (domain layer) + concrete (infrastructure layer) ZORUNLU.
Handler'da direkt Prisma kullanimi YASAK.

```typescript
// YASAK - Handler'da direkt Prisma
async execute(command: CreateXxxCommand) {
  await this.prisma.xxx.create({ data: { ... } });  // YASAK!
}

// DOGRU - Repository uzerinden
async execute(command: CreateXxxCommand) {
  await this.uow.xxxs.create(entity);  // UoW + Repository
}
```

### Kural 5.2: Soft Delete (deletedAt ZORUNLU)

```typescript
// DOGRU - deletedAt ile soft delete
async softDelete(id: string): Promise<void> {
  await this.prisma.xxx.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

// YASAK - Hard delete
async delete(id: string): Promise<void> {
  await this.prisma.xxx.delete({ where: { id } });  // VERI KAYBI!
}
```

### Kural 5.3: deletedAt Filtresi ZORUNLU

```typescript
// DOGRU - deletedAt filtresi var
async findMany(): Promise<Xxx[]> {
  return this.prisma.xxx.findMany({
    where: { deletedAt: null },  // ZORUNLU!
  });
}

// YASAK - Filtre yok
async findMany(): Promise<Xxx[]> {
  return this.prisma.xxx.findMany();  // SILINMIS KAYITLAR DA GELIR!
}
```

---

## 6. Transaction / UnitOfWork Kurallari

> **IUnitOfWork kanonik interface tanimi** (`shared/database/application/unit-of-work.ts`): `transaction(fn, options?)`, `isInTransaction()`, feature module'lerin register ettigi tipli repository property'leri (`uow.basvurular`, `uow.outbox`, ...). Tam interface signature ve isolation level enum'lari icin **→ ARCHITECTURE.md "IUnitOfWork Kanonik Interface"**.

### Kural 6.1: Multi-Write = UnitOfWork ZORUNLU

Birden fazla write islemi (create/update/delete) = UnitOfWork icinde ZORUNLU.

```typescript
// DOGRU
await this.uow.transaction(async () => {
  const user = await this.uow.users.create(userData);
  await this.uow.roles.assignToUser(user.id, roleId);
});

// YASAK - Transaction disinda multi-write
const user = await this.uow.users.create(userData);
await this.uow.roles.assignToUser(user.id, roleId);  // ROLLBACK GARANTISI YOK!
```

### Kural 6.2: Direkt prisma.$transaction YASAK

```typescript
// YASAK
await this.prisma.$transaction(async (tx) => { ... });

// DOGRU - UnitOfWork kullan
await this.uow.transaction(async () => { ... });
```

### Kural 6.3: Outbox Pattern ZORUNLU (TXN-03, CRITICAL)

Audit ve Domain Event'lerin yayini **HICBIR ZAMAN** dogrudan BullMQ push'la yapilmaz. At-least-once guarantee icin **Outbox pattern ZORUNLU**:

1. Handler `uow.transaction()` icinde:
   - Entity yarat/guncelle (DB write)
   - `outbox` tablosuna event satiri yaz (ayni transaction)
2. Transaction commit → DB atomic
3. Worker (`OutboxRelayWorker`) outbox tablosunu polled okur (veya CDC) → BullMQ'ya push
4. Push basarili → outbox satiri `dispatchedAt` set

```typescript
// YASAK - BullMQ push transaction disinda
await this.uow.transaction(async () => {
  await this.uow.xxxs.create(entity);
  await this.auditProducer.push(...);          // YASAK!
  await this.domainEventProducer.publish(...); // YASAK!
});

// DOGRU - Outbox uzerinden (atomic)
await this.uow.transaction(async () => {
  const saved = await this.uow.xxxs.create(entity);
  await this.uow.outbox.append({
    eventType: 'audit.log',
    payload: { entityType: 'Xxx', entityId: saved.id, action: 'create', actorId: requesterId, body: data },
    correlationId: requestContext.getStore()?.correlationId,
  });
  await this.uow.outbox.append({
    eventType: 'xxx.created',
    payload: { xxxId: saved.id },
    correlationId: requestContext.getStore()?.correlationId,
  });
});
```

**Avantaj:** Transaction commit + outbox yazimi atomic. BullMQ down olsa bile event outbox'ta bekler; recovery sonrasi `OutboxRelayWorker` push eder. Replay/retry dogal olarak idempotent (`event.id` + `dispatchedAt`).

**YASAK:** "BullMQ retry mekanizmasi var" diye outbox atlamak — Redis down olursa retry bile yapilamaz.

Detayli implementation pattern: **PATTERNS.md Pattern 22 (Outbox Implementation)**.

### Kural 6.4: Nested Transaction Davranisi (TXN-04, HIGH)

`uow.transaction()` icinde tekrar `uow.transaction()` cagrilirsa:
- Ic cagri **SAVEPOINT** olarak calisir (Postgres SAVEPOINT mekanizmasi)
- Ic transaction rollback → sadece o savepoint'e rollback (dis transaction devam eder)
- Ic transaction commit → no-op (dis commit'i bekler)
- Dis transaction rollback → tum savepoint'ler ve dis transaction rollback

```typescript
await uow.transaction(async () => {
  await uow.xxxs.create(e1);

  try {
    await uow.transaction(async () => {
      await uow.yyys.create(e2);
      throw new Error('inner fail');  // SAVEPOINT rollback
    });
  } catch (err) {
    // e2 rollback edildi, e1 hala canli (dis tx)
  }

  await uow.zzzs.create(e3);  // Bu da dis tx'in parcasi
});
// e1 ve e3 commit, e2 rollback
```

**YASAK:** Nested transaction'i flow control icin kullanmak. Domain rule isteniyorsa exception throw et.

### Kural 6.5: Transaction Isolation Level (TXN-05, HIGH)

Default isolation: **ReadCommitted** (Postgres default).

Business-spesifik isolation kurallari:
- Slot booking, ceza puani, mali islem → **Serializable** (race condition korumasi)
- Rapor/dashboard aggregate → **RepeatableRead** (snapshot tutarliligi)
- CRUD → **ReadCommitted** (default)

```typescript
// DOGRU - Cift booking korumasi
await uow.transaction(async () => {
  const slot = await uow.slotlar.findByIdLocked(slotId);
  if (slot.dolu) throw new SlotDoluError();
  await uow.randevular.create(...);
  await uow.slotlar.markDolu(slotId);
}, { isolationLevel: 'Serializable' });

// DOGRU - Multi-table snapshot read (dashboard)
await uow.transaction(async () => {
  const basvurular = await uow.basvurular.findMany({ ... });
  const odemeler = await uow.odemeler.findMany({ ... });
  return { basvurular, odemeler };
}, { isolationLevel: 'RepeatableRead' });
```

### Kural 6.6: Worker Transaction Disiplini (TXN-06, HIGH)

BullMQ Worker icinde **uzun transaction YASAK**. DB connection pool exhaustion riski.

```typescript
// YASAK - tek transaction icinde 10000 INSERT (pool exhaustion + lock contention)
async process(job) {
  await this.uow.transaction(async () => {
    for (const row of job.data.rows) {  // 10000 satir
      await this.uow.xxxs.create(row);
    }
  });
}

// DOGRU - batch + ayri transaction
async process(job) {
  const batchSize = 100;
  for (let i = 0; i < job.data.rows.length; i += batchSize) {
    const batch = job.data.rows.slice(i, i + batchSize);
    await this.uow.transaction(async () => {
      await this.uow.xxxs.createMany(batch);
    });
  }
}
```

**Limitler:**
- DB `statement_timeout`: 30 saniye
- Transaction timeout (UoW default): 5 saniye
- Worker job timeout (BullMQ): 5 dakika

Uzun isleme = kucuk batch + checkpoint progress (job state) ile bolun.

### Kural 6.8: Test Database Lifecycle (TEST-08, HIGH)

Integration test'lerde DB lifecycle kanonik — **her test transaction icinde calisir + rollback** ile temizlenir. Truncate yerine rollback ~10x hizli + FK chain bozulmaz.

```typescript
// test/integration/setup.ts
beforeAll(async () => {
  // Test DB baslat (Docker postgres veya pglite) — 1 kez migrate
  await execAsync('npx prisma migrate deploy --schema=prisma/schema.prisma');
});

beforeEach(async () => {
  // Her test oncesi transaction baslat
  await prisma.$executeRawUnsafe('BEGIN');
});

afterEach(async () => {
  // Test sonrasi rollback (data temizligi)
  await prisma.$executeRawUnsafe('ROLLBACK');
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

**YASAK kaliplar:**
- Her test icin `truncate all tables` (yavas, FK chain bozulur)
- Her test icin yeni DB (CI'da imkansiz hiz)
- Test'ler arasi state paylasimi (`describe` icinde `let userId` → flaky test)

**Avantaj:** Outbox tablosu kullanan integration test'lerde transaction rollback outbox satirlarini da temizler (istenen davranis).

### Kural 6.9: Test Data Factory (TEST-09, HIGH)

Inline mock data YASAK. **Factory pattern ZORUNLU** — domain invariant'lari guvence altina alir, test verisi yeniden kullanilabilir.

```typescript
// test/factories/basvuru.factory.ts
import { Basvuru } from '@features/sosyal-yardim/basvuru/domain/entities/basvuru.entity';

export const BasvuruFactory = {
  build(overrides: Partial<Basvuru> = {}): Basvuru {
    return Basvuru.create({
      basvuranTc: TcKimlik.create('12345678901'),
      aileUyeleri: [AileUyesiFactory.build()],
      ...overrides,
    });
  },

  buildMany(count: number, overrides: Partial<Basvuru> = {}): Basvuru[] {
    return Array.from({ length: count }, () => BasvuruFactory.build(overrides));
  },

  async create(prisma: PrismaClient, overrides = {}): Promise<Basvuru> {
    const entity = BasvuruFactory.build(overrides);
    return prisma.basvuru.create({ data: entity.toPersistence() });
  },
};

// Test kullanimi
it('should approve only INCELEMEDE basvurular', () => {
  const basvuru = BasvuruFactory.build({ durum: BasvuruDurum.TASLAK });
  expect(() => basvuru.onayla()).toThrow(BasvuruOnaylanamazError);
});
```

Faker.js opsiyonel — random data icin (`faker.person.fullName()`), ama **domain invariant'lari gecirmeli** (faker TC kimlik 11 hane degil — custom generator yaz).

---

## 7. Audit Kurallari

### Kural 7.1: CUD = Audit ZORUNLU

Her Create/Update/Delete isleminde audit log ZORUNLU.

### Kural 7.2: Async Audit (BullMQ)

Audit ASLA senkron yazilmaz. BullMQ AuditJobProducer uzerinden async.

```typescript
// DOGRU - BullMQ async
await this.auditProducer.push({
  entityType: 'Xxx',
  entityId: entity.id,
  action: 'create',
  actorId: requesterId,
  body: data,
});

// YASAK - Senkron audit
await this.prisma.auditLog.create({ data: { ... } });  // SENKRON YASAK!
```

> **Cross-ref:** Audit observability (alert eşikleri, metric, sink) için [`IRON_RULES_OBSERVABILITY.md` → OBS-01](./IRON_RULES_OBSERVABILITY.md) ve [`IRON_RULES_EVENTS.md` → EVT-04](./IRON_RULES_EVENTS.md).

### Kural 7.3: Audit Log Immutability Enforcement (AUDIT-03, CRITICAL)

Audit Log'un silinemez/degistirilemez kurali **4 katmanda** enforce edilir; tek katman yetersizdir.

**1. DB seviyesi (PostgreSQL RLS):**

```sql
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_update ON audit_log FOR UPDATE USING (false);
CREATE POLICY no_delete ON audit_log FOR DELETE USING (false);
```

**2. Application seviyesi:**
- `AuditService` SADECE `create()` metodu expose eder.
- `update`, `delete` metodu YOK (TypeScript tip seviyesinde enforce — interface'de bile yer almaz).

**3. Schema seviyesi:**

```prisma
model AuditLog {
  id          String   @id @default(uuid())
  // ... fields ...
  createdAt   DateTime @default(now())
  // updatedAt YOK — degistirilemez
  // deletedAt YOK — silinemez
}
```

**4. Hook enforcement:** `prisma.auditLog.update` ve `prisma.auditLog.delete` cagrisi → `iron-rules-check.js` CRITICAL block.

**Istisna:** KVKK "Unutulma Hakki" basvurusunda PII alanlari `pseudonymizeByActor` ile maskelenir; satir kendisi silinmez (KVKK-03 ile uyumlu — Kural 20.3).

> **Cross-ref:** KVKK Unutulma Hakkı kapsamında pseudonymization akışı için [`IRON_RULES_EVENTS.md` → EVT-10](./IRON_RULES_EVENTS.md).

---

## 8. PII / KVKK Kurallari

### Kural 8.1: PII Disiplini — 3 Ayri Stream (KVKK Uyumlu)

PII (TC kimlik, telefon, ad-soyad, adres) **3 farkli stream'de farkli davranir**. Tek tip "log" yok; her stream'in amaci, retention'i, erisim politikasi farkli.

| Stream | PII Davranisi | Erisim | Retention | Hedef |
|--------|---------------|--------|-----------|-------|
| **Logger** (operasyonel) | MASKELI | Tum developer | 30 gun | Pino → Loki/CloudWatch |
| **Audit Log** (yasal kayit) | ACIK (PII goruunur) | SADECE `audit:read` permission'li role | 10 yil (KVKK) | PostgreSQL WORM/RLS partitioned |
| **Security Event Log** | MASKELI (son 4 hane) | SOC + `audit:read` | 2 yil | SIEM (Splunk/ELK) |

**Logger stream — PII MASKELI ZORUNLU:**

```typescript
// YASAK - Logger'da acik PII
this.logger.info('User login', { tcKimlik: '12345678901', phone: '5551234567' });

// DOGRU - PiiMaskingHelper ile maskeli
this.logger.info('User login', {
  tcKimlik: PiiMaskingHelper.mask(tcKimlik),  // '123****8901'
  phone: PiiMaskingHelper.maskPhone(phone),    // '555***4567'
});
```

**Audit Log stream — PII ACIK (KVKK 8. madde isleme amaci):**

```typescript
// DOGRU - AuditLog'da PII acik yazilir; erisim CASL `audit:read` permission ile kisitli
await this.outbox.append({
  eventType: 'audit.log',
  payload: {
    entityType: 'User',
    entityId: user.id,
    action: 'login',
    actorId: user.id,
    body: { tcKimlik: user.tcKimlik, phone: user.phone },  // ACIK yaz — yasal kayit
  },
});
```

**Security Event Log stream — kismi maskeleme (son 4 hane gorunur):**

```typescript
// DOGRU - SecurityEventLog'da kismi maskeli (forensics + privacy dengesi)
await this.securityEventProducer.publish({
  eventType: 'security.failed_login',
  payload: {
    tcKimlik: PiiMaskingHelper.maskKeepLast(tcKimlik, 4),  // '*******8901'
    ipAddress: req.ip,
  },
});
```

**KVKK uyum kanonu:** Audit Log icindeki PII silinemez/degistirilemez (AUDIT-03), ama "Unutulma Hakki" (KVKK-03) basvurusunda **pseudonymization** ile aktor satirlari maskelenir — satir kendisi silinmez.

---

## 9. Exception Handling Kurallari

### Kural 9.1: Pokemon Exception Handling YASAK

Tum hatalari yutmak (catch-all + ignore) kesinlikle YASAK. Her exception loglanmali ve uygun sekilde ele alinmali.

```typescript
// YASAK - Pokemon exception handling (hatayi yutma)
try { ... } catch (error) { /* sessizce yut */ }

// YASAK - Generic Error throw
throw new Error('Hata olustu');

// DOGRU - Spesifik NestJS exception + loglama
try { ... }
catch (error: unknown) {
  if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
    this.logger.warn('Duplicate entry attempt', { error: error.message });
    throw new ConflictException('Bu kayit zaten mevcut');
  }
  if (error instanceof Error) {
    this.logger.error('Beklenmeyen hata', { error: error.message, stack: error.stack });
  }
  throw error; // re-throw, yutma YASAK
}
```

### Kural 9.2: Dogru Exception Turleri

| Durum | NestJS Exception | HTTP |
|-------|------------------|------|
| Yetki yok | `ForbiddenException` | 403 |
| Kimlik dogrulanamadi | `UnauthorizedException` | 401 |
| Kayit bulunamadi | `NotFoundException` | 404 |
| Cakisma (duplicate) | `ConflictException` | 409 |
| Gecersiz input | `BadRequestException` | 400 |
| Sunucu hatasi | `InternalServerErrorException` | 500 |
| Is kurali ihlali | `UnprocessableEntityException` | 422 |

```typescript
// DOGRU - Aciklayici Turkce mesaj
throw new ConflictException('Bu email adresi zaten kayitli');
throw new NotFoundException('Kullanici bulunamadi');
throw new UnprocessableEntityException('Randevu iptal suresi gecmis');

// YASAK - Generic mesaj
throw new Error('Hata');
throw new BadRequestException('Error');
```

### Kural 9.3: Exception Filter Pattern

Global exception filter TUM serviste aktif olmali. Handler icinde HTTP response donme YASAK.

```typescript
// DOGRU - Global exception filter (app.module veya main.ts)
app.useGlobalFilters(new AllExceptionsFilter(logger));

// Handler icinde: SADECE exception throw et, HTTP response olusturma
// YASAK
async execute(command: CreateXxxCommand) {
  return { statusCode: 404, message: 'Not found' }; // YASAK! Exception throw et
}

// DOGRU
async execute(command: CreateXxxCommand) {
  const entity = await this.uow.xxxs.findById(command.id);
  if (!entity) throw new NotFoundException('Kayit bulunamadi');
  return entity;
}
```

### Kural 9.4: catch(error: unknown) ZORUNLU

Catch block'ta `error` parametresi **her zaman** `unknown` tipinde olmali.

```typescript
// YASAK
try { ... } catch (error: any) { ... }
try { ... } catch (error: Error) { ... }
try { ... } catch (error) { error.message; } // implicit any

// DOGRU
try { ... } catch (error: unknown) {
  if (error instanceof NotFoundException) {
    throw error; // NestJS exception'lari re-throw
  }
  if (error instanceof Error) {
    this.logger.error(error.message, error.stack);
  }
  throw new InternalServerErrorException('Beklenmeyen bir hata olustu');
}
```

### Kural 9.5: Domain Exception Ayrimi (EXC-05, CRITICAL — MOD-02 ile birlikte)

Domain layer **NestJS exception'larini import EDEMEZ**. Domain framework-bagimsiz olmali; aksi takdirde MOD-02 (Dependency Direction) ihlal olur. Domain layer'da pure exception siniflari kullanilir; handler/controller bunlari HTTP exception'a global filter ile cevirir.

```typescript
// YASAK - Domain layer'da NestJS import (MOD-02 ihlali)
// domain/entities/basvuru.entity.ts
import { ConflictException } from '@nestjs/common';  // YASAK!
class Basvuru {
  onayla() {
    if (...) throw new ConflictException('...');  // YASAK
  }
}

// DOGRU - Pure DomainError
// domain/errors/basvuru.errors.ts
export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class BasvuruOnaylanamazError extends DomainError {
  readonly code = 'BASVURU_ONAYLANAMAZ';
  constructor(public readonly mevcutDurum: BasvuruDurum) {
    super(`Sadece incelemedeki basvurular onaylanir (mevcut: ${mevcutDurum})`);
  }
}

// domain/entities/basvuru.entity.ts
class Basvuru {
  onayla() {
    if (this.durum !== BasvuruDurum.INCELEMEDE) {
      throw new BasvuruOnaylanamazError(this.durum);
    }
  }
}

// shared/filters/domain-error.filter.ts — Global exception filter (Application layer)
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const status = this.mapToHttpStatus(error.code);
    const response = host.switchToHttp().getResponse();
    response.status(status).json({
      statusCode: status,
      code: error.code,
      message: error.message,
    });
  }

  private mapToHttpStatus(code: string): number {
    if (code.endsWith('_BULUNAMADI')) return 404;
    if (code.endsWith('_MEVCUT')) return 409;
    if (code.endsWith('_ONAYLANAMAZ') || code.endsWith('_GECERSIZ')) return 422;
    return 400;
  }
}
```

**Kural:**
- Domain layer'da SADECE `DomainError` ve alt siniflari throw edilir.
- Application/Infrastructure layer NestJS exception kullanabilir (ConflictException, NotFoundException — eski Kural 9.2 tablosu gecerli).
- `DomainErrorFilter` global filter olarak HTTP status'a cevirir; code → HTTP mapping aciktir.

---

## 10. Observability Kurallari

Observability disiplini (Logger + Audit + Metric + Health + Trace) ve "olay → kanal" karar matrisi **kanonik olarak [`IRON_RULES_OBSERVABILITY.md`](./IRON_RULES_OBSERVABILITY.md)**'de tanımlıdır.

**Özet:**
- 3-stream discipline (Logger / Audit / SecurityEvent) — PII ayrı muamele (OBS-01)
- Pino + OpenTelemetry auto-instrument — manuel correlation ID YASAK (OBS-05)
- Olay tipi → kanal karar matrisi sabit; custom davranış PR gerekçesi ister (OBS-03)
- Health check live/ready ayrımı zorunlu (OBS-04)
- Metric discipline: Prometheus naming + cardinality kuralları (OBS-06)
- Outbox/Queue/DLQ observability + alert eşikleri (OBS-07/08/09)
- ACL observability — dış sistemler için metric + circuit state + audit (OBS-12)

**Detay:** [`IRON_RULES_OBSERVABILITY.md`](./IRON_RULES_OBSERVABILITY.md) — 12 kural (OBS-01 ... OBS-12).

---

## 11. Cross-Module Communication Kurallari (BullMQ + Outbox + Events)

Event-driven design (EDD) disiplini **kanonik olarak [`IRON_RULES_EVENTS.md`](./IRON_RULES_EVENTS.md)**'de tanımlıdır.

**Özet:**
- Cross-feature iletişim 4 yoldan biri (EVT-00 Karar Matrisi) — direkt feature import YASAK
- Event envelope v2 (versioning + causation + traceparent) ZORUNLU (EVT-01)
- Outbox pattern (Kural 6.3) bypass YASAK — at-least-once guarantee (EVT-04)
- Idempotent consumer (processedEvents log, composite key) ZORUNLU (EVT-05/06)
- Schema versioning (event.action.vN), DLQ, retry+backoff (EVT-03/07/08)
- Replay/backfill, tombstone (KVKK), ACL boundary, Saga (forward-looking) (EVT-09/10/11/12)

**Detay:** [`IRON_RULES_EVENTS.md`](./IRON_RULES_EVENTS.md) — 13 kural (EVT-00 ... EVT-12).

---

## 12. Module Structure Kurallari

### Kural 12.1: Feature Izolasyonu

Her feature kendi klasorunde **4-Layer Clean Architecture VSA + Pragmatic CQRS** disiplini uygular.

Klasor yapisi + dependency direction + COLOCATE test + module-spesifik guard yasagi: **→ ARCHITECTURE.md "Her Feature'in Ic Yapisi"**.

Feature izolasyon kanonu:
- Feature → feature **DOGRUDAN import YASAK** (`{feature}.module.ts` public exports dahil)
- Iletisim sadece: `shared/`, BullMQ Domain Event (Outbox uzerinden), Shared Interface Contract
- Module-spesifik guard YOK (tum guard'lar `shared/security/` veya `shared/authorization/`)

**Sub-feature yapi kanonu (KURAL-12.5 — yeni alt-kural):**
- Her BC `features/<feature>/` ≥1 sub-feature `<sub-feature>/` icerir. Duz `features/<feature>/application/` (sub-feature'siz) YASAK.
- Sub-feature katmanlari: `domain/ · application/ · infrastructure/ · presentation/ · <sub>.module.ts`. `interface/` adi YASAK — `presentation/` ZORUNLU.
- `application/` use-case'leri COLOCATED: `commands/<use-case>/` ve `queries/<use-case>/` icinde command/query + handler + result + spec. Ayri top-level `handlers/`/`results/`/`dtos/` YASAK.
- DTO klasoru cogul + presentation altinda: `presentation/dtos/` (OPSIYONEL). `dto/` (tekil) ve `interface/dtos/` YASAK.
- İnce sub-feature (yalniz-orchestration, kendi entity'si yok): `domain/` + `infrastructure/` opsiyonel; `application/` + `<sub>.module.ts` yeterli.
- Within-BC import serbest; BC disina tek public yuz `<feature>.module.ts` exports.

### Kural 12.4: Controller Disiplini (CTRL-04, CTRL-05)

**CTRL-04: Controller `@Body()` Command alır, ayrı HTTP DTO YAZILMAZ**

```typescript
// DOGRU — Command class-validator ile HTTP DTO görevi de görür
@Post()
@RequireAction(Action.CREATE, Resource.Xxx)
async create(@Body() command: CreateXxxCommand): Promise<CreateXxxResult> {
  return this.commandBus.execute(command);
}

// YASAK — Ayrı CreateXxxDto + mapping
@Post()
async create(@Body() dto: CreateXxxDto, @Req() req: AuthenticatedRequest) {
  return this.commandBus.execute(
    new CreateXxxCommand(dto.name, dto.description, req.user.sub)  // YASAK!
  );
}
```

**CTRL-05: Handler `Result` POJO döner, `Response`/`Dto` DÖNDÜRMEZ**

```typescript
// DOGRU — Handler return type Result
async execute(command: CreateXxxCommand): Promise<CreateXxxResult> { ... }

// YASAK — Handler HTTP Response döndürüyor (katman ihlali)
async execute(command: CreateXxxCommand): Promise<XxxResponse> { ... }  // YASAK!
async execute(command: CreateXxxCommand): Promise<CreateXxxDto> { ... }  // YASAK!
```

<!-- Kural 5.4: Yer degisikligi nedeniyle Kural 5.5'e tasindi. -->

### Kural 5.5: requesterId Disiplini (SEC-10, SEC-11)

**SEC-10: `requesterId` body'den ASLA okunmaz, `@IsEmpty()` ile reddedilir**

```typescript
// DOGRU
export class CreateXxxCommand extends BaseCommand {
  @IsString() name: string;

  @IsEmpty({ message: 'requesterId body üzerinden gönderilemez' })
  declare requesterId: string;  // BaseCommand'dan miras, interceptor enjekte eder
}

// YASAK — requesterId body'den okuyor
export class CreateXxxCommand {
  @IsString() name: string;
  @IsString() requesterId: string;  // YASAK! Saldırgan kendi ID'sini gönderebilir
}
```

**SEC-11: Tüm Command/Query `BaseCommand`/`BaseQuery`'den extend etmeli + `CommandRequesterInterceptor` global olmalı**

```typescript
// DOGRU
export class CreateXxxCommand extends BaseCommand { ... }
export class ListXxxQuery extends BaseQuery { ... }

// YASAK — implements ICommand (base'ten extend etmiyor)
export class CreateXxxCommand implements ICommand {
  requesterId: string;  // interceptor yakalayamaz! YASAK!
}
```

`app.module.ts`'de **GLOBAL** interceptor bind:
```typescript
{ provide: APP_INTERCEPTOR, useClass: CommandRequesterInterceptor }
```

`CommandRequesterInterceptor` `shared/cqrs/infrastructure/command-requester.interceptor.ts`'te (KANONİK).

### Kural 12.2: Dependency Direction

Domain katmani infrastructure'a BAGIMLI OLAMAZ. Yonu: infrastructure -> domain.

```typescript
// YASAK - Domain'de infrastructure import
// domain/user.entity.ts
import { PrismaClient } from '@prisma/client'; // YASAK! Domain Prisma bilmez

// DOGRU - Domain interface tanimlar, infrastructure implement eder
// domain/user.repository.interface.ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  create(user: User): Promise<User>;
}

// infrastructure/user.repository.ts
export class PrismaUserRepository implements IUserRepository { ... }
```

### Kural 12.3: Handler Icinde Is Mantigi OLMAZ Controller'da

Controller SADECE request alir, handler/service'e iletir, response doner.
Is mantigi (business logic) handler veya service katmaninda.

```typescript
// YASAK - Controller'da is mantigi
@Post()
async create(@Body() dto: CreateXxxDto, @Req() req: Request) {
  const existing = await this.prisma.xxx.findFirst({ where: { name: dto.name } });
  if (existing) throw new ConflictException('Zaten var');
  const entity = await this.prisma.xxx.create({ data: dto });
  await this.auditProducer.push({ ... });
  return entity;
}

// DOGRU - Controller sadece yonlendirir
@Post()
async create(@Body() dto: CreateXxxDto, @Req() req: Request) {
  return this.commandBus.execute(new CreateXxxCommand(dto, req.user.id));
}
```

---

## 13. Performance & Security Kurallari (PERF + CTRL)

### PERF-01: N+1 Query YASAK (CRITICAL)

Loop icinde Prisma query cagrisi YASAKTIR. Batch lookup ZORUNLUDUR.

```typescript
// YASAK — N+1 query (100 satir CSV = 300 DB query)
for (const row of csvRows) {
  const user = await prisma.user.findFirst({ where: { email: row.email } });
  const group = await prisma.group.findFirst({ where: { code: row.groupCode } });
  const role = await prisma.role.findFirst({ where: { code: row.roleCode } });
}

// DOGRU — batch lookup (100 satir CSV = 3 DB query)
const emails = csvRows.map(r => r.email);
const groupCodes = csvRows.map(r => r.groupCode);
const roleCodes = csvRows.map(r => r.roleCode);

const [users, groups, roles] = await Promise.all([
  prisma.user.findMany({ where: { email: { in: emails }, deletedAt: null } }),
  prisma.group.findMany({ where: { code: { in: groupCodes }, isActive: true } }),
  prisma.role.findMany({ where: { code: { in: roleCodes } } }),
]);

const userMap = new Map(users.map(u => [u.email, u]));
// ... map ile eslestir
```

**Neden:** 100 satir import = 300 query. 10.000 satir = 30.000 query. DB'yi oldurur.

### PERF-02: Pagination Max Limit ZORUNLU (HIGH)

Her `findMany` endpoint'inde `pageSize` siniri olmali. Kullanici keyfi buyuk sayi gonderemez.

```typescript
// YASAK — sinir yok
const users = await prisma.user.findMany({
  take: parseInt(query.pageSize),  // pageSize=999999 gonderilebilir!
});

// DOGRU — max limit
const MAX_PAGE_SIZE = 100;
const pageSize = Math.min(parseInt(query.pageSize) || 20, MAX_PAGE_SIZE);
const users = await prisma.user.findMany({ take: pageSize });
```

### PERF-03: Sort Field Whitelist ZORUNLU (HIGH)

Kullanici keyfi alan siralayamaz. Sadece izin verilen alanlar.

```typescript
// YASAK — her sey siralanabilir (blind sort attack: sort=password:asc)
const orderBy = { [query.sortField]: query.sortOrder };

// DOGRU — whitelist
const ALLOWED_SORT_FIELDS = ['name', 'email', 'createdAt', 'active', 'updatedAt'];
const sortField = ALLOWED_SORT_FIELDS.includes(query.sortField) ? query.sortField : 'createdAt';
const orderBy = { [sortField]: query.sortOrder === 'asc' ? 'asc' : 'desc' };
```

**Neden:** `sort=password:asc` ile hash siralama yapilabilir. Hassas alanlar sızar.

### PERF-04: findMany'de Select/Include Optimize (HIGH)

Liste query'lerinde gereksiz relation CEKILMEZ. Sadece gerekli alanlar.

```typescript
// YASAK — her seyi cek
const users = await prisma.user.findMany({ include: { groups: true, roles: true, permissions: true } });

// DOGRU — sadece gerekli alanlar
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true, active: true, createdAt: true },
});
```

### CTRL-01: Controller'da @RequireAction ZORUNLU (CRITICAL)

@Public() olmayan HER endpoint'te @RequireAction veya @CheckPolicies decorator'u OLMALIDIR.
Eksik decorator = yetkisiz erisim.

```typescript
// YASAK — decorator yok, herkes erisebilir
@Get()
async getUsers() { ... }

// DOGRU
@Get()
@RequireAction(Action.READ, Resource.User)
async getUsers() { ... }

// DOGRU — public endpoint (login, register, health)
@Get('health')
@Public()
async health() { ... }
```

### CTRL-02: Controller Input Validation (CRITICAL)

Her endpoint'te DTO + ValidationPipe ZORUNLU. Raw body kabul edilmez.

```typescript
// YASAK — DTO yok, validation yok
@Post()
async create(@Body() body: any) { ... }

// DOGRU
@Post()
@RequireAction(Action.CREATE, Resource.User)
async create(@Body() dto: CreateUserDto) { ... }
```

---

## 14. Migration Kurallari

### Kural 14.1: Expand-Contract Disiplini (MIG-01/02/03)

Schema'da NOT NULL kolon ekleme, kolon silme, rename, type change → **expand-contract** ZORUNLU. Tek migration'da bu islemler YASAK (MIG-02 CRITICAL).

**4-Adim Expand-Contract Playbook:**

```
ADIM 1: EXPAND (yeni durum eklenir, eski korunur)
  - Yeni kolonu NULLABLE ekle (NOT NULL degil)
  - Eski kolonu KORU
  - Yeni constraint/index OPSIYONEL
  Commit: feat(db): expand — Xxx tablosuna yeniColumn eklendi (nullable)
  Deploy: prod'a cik, eski/yeni kod paralel calisir

ADIM 2: BACKFILL (veri tasi)
  - Yeni kolonu eski veriden doldur (BullMQ worker veya bir defalik script)
  - Idempotent: zaten dolulara dokunma
  - Production'da yapilir (migration disinda)
  Commit: chore(db): backfill — yeniColumn 100% doldu

ADIM 3: CONTRACT-NEW (yeni durumu zorunla)
  - Yeni kolonu NOT NULL'a cevir (artik tum satirlarda dolu)
  - Eski kolon hala var (geri donus icin)
  - Kod yeni kolonu okumaya tam gecer
  Commit: feat(db): contract — yeniColumn NOT NULL
  Deploy: prod'a cik, eski kod artik yeni kolonu kullanir

ADIM 4: CONTRACT-OLD (eskiyi sil — opsiyonel)
  - Eski kolon read/write'lardan kaldirilmis olmali (kod taramada dogrula)
  - Eski kolonu drop
  - 1-2 sprint sonra yap (geri donus penceresi)
  Commit: chore(db): contract — eskiColumn drop (yeniColumn migration tamamlandi)
```

### Kural 14.2: YASAK ve DOGRU Kaliplar

**YASAK Kaliplar (MIG-02 CRITICAL ihlal):**

```sql
-- YASAK 1: Tek migration'da NOT NULL ekleme (default'suz)
ALTER TABLE xxx ADD COLUMN yeni text NOT NULL;
-- → Mevcut satirlar icin INSERT/UPDATE prod'da exception atar

-- YASAK 2: Tek migration'da rename
ALTER TABLE xxx RENAME COLUMN eski TO yeni;
-- → Eski kodla yeni kod paralel deployment'ta eskiyi bulamaz

-- YASAK 3: Tek migration'da type change
ALTER TABLE xxx ALTER COLUMN sayi TYPE bigint;
-- → Buyuk tablolarda table lock; uzun deployment downtime
```

**DOGRU Kaliplar:**

```sql
-- DOGRU 1: NOT NULL with default (kucuk tablo, basit case)
ALTER TABLE xxx ADD COLUMN yeni text NOT NULL DEFAULT 'placeholder';
-- + sonra default'u kaldir (Adim 3'te)

-- DOGRU 2: Rename = ADD + COPY + DROP (4 step expand-contract)
-- Adim 1: ADD COLUMN yeni (nullable)
-- Adim 2: UPDATE xxx SET yeni = eski WHERE yeni IS NULL
-- Adim 3: ALTER COLUMN yeni SET NOT NULL
-- Adim 4: DROP COLUMN eski (1-2 sprint sonra)
```

### Kural 14.3: Migration Risk Analizi ve Hook Enforcement

**Migration Risk Analizi (MIG-01 — her schema PR'da ZORUNLU):**

| Soru | Karar |
|------|-------|
| Bu migration veri kaybedebilir mi? | EVET → expand-contract zorunlu |
| Bu migration buyuk tabloda lock yapar mi? | EVET → off-peak deployment, CONCURRENTLY ekle |
| Bu migration backward-incompat mi (eski deploy goz onunde)? | EVET → expand-contract, 2 deployment cycle |
| Rollback plani var mi? | YOKSA → migration onaylanmaz |

**MIG-02 hook detection (P1 backlog):**

`prisma migrate diff` ciktisinda asagidaki desenler CRITICAL block:
- `ALTER TABLE.*ADD COLUMN.*NOT NULL` (default yoksa)
- `RENAME COLUMN`
- `DROP COLUMN` (1 sprint icinde eklenen kolon icin — `git log` ile dogrula)

### Kural 14.4: FK ON DELETE Davranisi (MIG-04, CRITICAL)

Foreign Key relations'larda `onDelete` davranisi **NET tanimlanir**. Default: **Restrict** (silmeden once child referanslari temizle).

```prisma
// YASAK - onDelete belirtilmemis (DB default belirsiz)
model Belge {
  basvuruId String
  basvuru   Basvuru @relation(fields: [basvuruId], references: [id])
}

// DOGRU - onDelete explicit
model Belge {
  basvuruId String
  basvuru   Basvuru @relation(
    fields: [basvuruId],
    references: [id],
    onDelete: Restrict   // Basvuru silinince hata throw
  )
}
```

**Karar matrisi:**

| Senaryo | onDelete | Sebep |
|---------|----------|-------|
| Aggregate child (Basvuru → Belge) | Restrict | Soft delete via aggregate root, child'a dokunma |
| Loose reference (User → createdBy) | SetNull | Audit/history preserve |
| Junction table (UserGroup) | Cascade | Junction satiri anlamsizlasir |
| Hard dependency (Permission → RolePermission) | Cascade | Junction satiri |

Migration PR'i bu karar matrisinden secilen degeri **acikca belirtmeli** (PR description).

### Kural 14.5: Index Naming Convention (MIG-05, HIGH)

Index isimleri acik, okunakli olmali. Format:

`idx_<table>_<col1>[_<col2>][_partial]`
- `uniq_<table>_<col>` (unique index = `uniq_` prefix)

Ornekler:
- `idx_basvuru_durum` (single column)
- `idx_basvuru_durum_olusturma_tarihi` (composite)
- `idx_basvuru_aktif` (partial: WHERE `deletedAt IS NULL`)
- `uniq_user_email` (unique)

```prisma
model Basvuru {
  durum            String
  olusturmaTarihi  DateTime
  deletedAt        DateTime?

  @@index([durum, olusturmaTarihi], name: "idx_basvuru_durum_olusturma_tarihi")
  @@index([durum], name: "idx_basvuru_aktif", where: "deletedAt IS NULL")
}
```

Auto-generated Prisma isimler (`Basvuru_durum_idx`) **YASAK** — okunmuyor, query plan debug zor.

---

## 15. Concurrency Kurallari

### Kural 15.1: Optimistic Locking ZORUNLU (CONC-01, HIGH — concurrent write riskli tablolarda)

Concurrent update riski olan tablolar `version` field icerir; her UPDATE'te version check + increment yapilir. Iki kullanici ayni anda guncellerse ikincisi `ConcurrentModificationError` alir.

**Schema:**

```prisma
model Randevu {
  id        String   @id @default(uuid())
  // ... fields ...
  version   Int      @default(0)
  updatedAt DateTime @updatedAt
}
```

**Repository update'te version check:**

```typescript
async update(entity: Randevu, userId: string): Promise<Randevu> {
  const result = await this.prisma.randevu.updateMany({
    where: {
      id: entity.id,
      version: entity.version,  // Optimistic check
      deletedAt: null,
    },
    data: {
      ...entity.toPersistence(),
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    throw new ConcurrentModificationError(
      'Bu kayit baska bir kullanici tarafindan guncellendi'
    );
  }

  return { ...entity, version: entity.version + 1 };
}
```

**Hangi tablolar (genel kural: state machine veya hesaplama iceren entity):**
- Randevu (cift booking)
- Basvuru.durum (state machine)
- CezaPuan (concurrent eklemeler)
- MalBeyani (toplam hesaplama)

**`ConcurrentModificationError` = DomainError alt sinifi** (Kural 9.5 — EXC-05). Global filter HTTP 409 Conflict'e cevirir.

---

## 16. Date/Time + Money Kurallari

### Kural 16.1: UTC Saklama, TRT Gosterme (DT-01, CRITICAL)

DB'de tum datetime **UTC olarak saklanir**. Kullaniciya gosterirken `Europe/Istanbul` timezone'a cevrilir.

```typescript
// YASAK - kayma riski (local time interpretation belirsiz)
const randevu = await prisma.randevu.create({
  data: { tarih: new Date('2026-05-19 14:00') }
});

// DOGRU - backend her zaman UTC
const tarihTr = '2026-05-19T14:00:00';  // Istemciden gelen TR local time
const tarihUtc = zonedTimeToUtc(tarihTr, 'Europe/Istanbul');  // → 2026-05-19T11:00:00Z
await prisma.randevu.create({ data: { tarih: tarihUtc } });

// Frontend - gosterirken cevir
import { formatInTimeZone } from 'date-fns-tz';
formatInTimeZone(randevu.tarih, 'Europe/Istanbul', 'dd MMM yyyy HH:mm', { locale: tr });
```

**Prisma schema:**

```prisma
model Randevu {
  tarih DateTime @db.Timestamptz(6)  // Timezone-aware, UTC stored
}
```

Kural: `@db.Timestamp` (timezone-naive) **YASAK**; `@db.Timestamptz` zorunlu.

### Kural 16.2: ISO 8601 API Contract (DT-02, HIGH)

API request/response'da tum datetime **ISO 8601 with timezone offset**:
- DOGRU: `2026-05-19T14:00:00+03:00` veya `2026-05-19T11:00:00Z`
- YASAK: `'2026-05-19 14:00'` (timezone yok), `1716120000000` (epoch — okunmaz), `'19/05/2026 14:00'` (locale-dependent)

**Validation:**
- class-validator: `@IsISO8601({ strict: true })`
- Zod: `z.string().datetime({ offset: true })`

### Kural 16.3: Date Range Helper Kullanimi (DT-03, HIGH)

"Bugun basvuranlar" gibi sorgular icin raw `<`, `>` ile datetime karsilastirmasi YASAK. Helper kullanimi zorunlu.

```typescript
// YASAK - 'bugun 00:00:00 mi, su an mi?' belirsiz
const bugun = new Date();
const kayitlar = await prisma.basvuru.findMany({
  where: { olusturmaTarihi: { gte: bugun } }
});

// DOGRU - startOfDay/endOfDay + timezone
import { startOfDay, endOfDay } from 'date-fns';
import { zonedTimeToUtc } from 'date-fns-tz';

const tz = 'Europe/Istanbul';
const start = zonedTimeToUtc(startOfDay(new Date()), tz);
const end = zonedTimeToUtc(endOfDay(new Date()), tz);

const kayitlar = await prisma.basvuru.findMany({
  where: { olusturmaTarihi: { gte: start, lte: end } }
});
```

### Kural 16.4: Money = Int (Kurus) (MNY-01, CRITICAL)

Para tutarlari DB'de **Int (kurus cinsi)** saklanir; Decimal/Float YASAK (floating point rounding errors).

```prisma
// YASAK
model Yardim {
  miktar Decimal @db.Decimal(10, 2)  // Float aritmetik = rounding errors
}

// DOGRU
model Yardim {
  miktarKurus Int     // 50.25 TRY → 5025
  paraBirimi  String  // 'TRY', 'USD'
}
```

Domain layer'da **Money VO** ile sarmalanir (PATTERNS.md Pattern 3.1). Hesaplama `Money.create()` + `add/subtract/multiply` metodlariyla — raw aritmetik YASAK.

**Istisna:** Decimal sadece **dis sistemden gelen "raw report" verisi** icin (KPS, banka entegrasyonu) — domain'e girmeden Money'e cevrilir (ACL — Pattern 25 — kapsami).

Frontend gosterim (referans, esas IRON_RULES_FRONTEND/SHARED'da): `Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' })`.

---

## 17. Config + Cache + Bulk Kurallari

### Kural 17.1: Boot'ta Env Validation (CFG-01, CRITICAL)

Uygulama boot'unda tum env var'lar **Zod schema ile dogrulanir**. Eksik veya gecersiz = startup fail (`process.exit(1)`); runtime'da `undefined` env okumak YASAK.

```typescript
// src/shared/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_PRIVATE_KEY: z.string().min(100),
  JWT_PUBLIC_KEY: z.string().min(100),
  CORS_ORIGIN: z.string().transform(s => s.split(',')),
  // ...
});

export type Env = z.infer<typeof envSchema>;

// main.ts
const env = envSchema.parse(process.env);  // throw on missing/invalid
```

**YASAK:** Service icinde `process.env.X` dogrudan okuma — ConfigService veya Env type uzerinden inject edilmeli.

### Kural 17.2: Hardcoded URL/Port/Host YASAK (CFG-02, HIGH — HARD-01 alt kurali)

URL, port, host, timeout, retry count gibi tum konfig **env var'dan okunur**. HARD-01 (Hardcoded deger YASAK — IRON_RULES_SHARED) bu alt-kurali kapsar; vurgu icin ayri:
- DB connection string, Redis URL, 3rd party API endpoint → env
- Timeout (5000ms), retry count (3), batch size (100) → env (varsayilan kabul ama override edilebilir)
- Sabit hala "magic number" ise comment + sebep + eslestirilmis env override key

### Kural 17.3: Cache Key Naming (CACHE-01, HIGH)

Tum Redis key'leri sabit formata uyar:

`<feature>:<resource>:<id>[:<variant>]`

Ornekler:
- `identity:user:abc-123`
- `identity:ability:user-abc-123:v2`        (variant = cache version)
- `randevu:slot:abc-123:bookings`           (variant = sub-resource)

**YASAK:**
- `user_${id}` (kisa, cakisma riski)
- `auth:perm:${userId}` (feature adi yok, naming dagini)

Helper: `shared/lib/cache/key-builder.ts` icinde `buildCacheKey(feature, resource, id, variant?)`.

### Kural 17.4: TTL ZORUNLU (CACHE-02, CRITICAL)

Redis'e yazilan **her key TTL icermelidir**. Sonsuz cache YASAK (memory leak + stale data).

```typescript
// YASAK
await redis.set(key, value);  // No TTL → leak

// DOGRU
await redis.set(key, value, 'EX', 300);  // 5 dakika
```

**Feature bazinda TTL standardi:**

| Feature | Resource | TTL | Sebep |
|---------|----------|-----|-------|
| Ability cache (L1 memory) | User ability | 5 dk | L1 hot-path erisim + permission cache hierarchy |
| Ability cache (L2 Redis) | User ability | 15 dk | Cross-instance share |
| Lookup tables | Status codes, roles | 1 saat | Nadir degisir |
| Permission cache | Per-user CASL | 15 dk | Permission degisikligi SSE invalidate |
| Rate limit counter | IP-based | 60s | Window |
| API response (idempotent GET) | Per-endpoint | 30s-5dk | Endpoint-spesifik |

Default: 5 dakika. Custom TTL acik gerekce ister.

### Kural 17.5: Cache Stampede Korumasi (CACHE-03, HIGH)

Popular key expire olunca DB'ye N paralel sorgu = **thundering herd**. Mitigation:

1. **Jittered TTL:** TTL'e +-%10 randomness:
   ```typescript
   const ttl = 300 + Math.floor(Math.random() * 60) - 30;  // 270-330s
   ```

2. **Stale-while-revalidate:** Cache expire olsa bile eski degeri 30s daha dondur, arka planda yenile:
   ```typescript
   const cached = await cache.getWithStale(key);
   if (cached.fresh) return cached.value;
   if (cached.stale) {
     refreshInBackground(key);
     return cached.value;
   }
   return fetchAndCache(key);
   ```

3. **Distributed lock:** Ayni key icin ilk request DB'ye gitsin, digerleri beklesin:
   ```typescript
   const lock = await redis.set(`lock:${key}`, '1', 'NX', 'EX', 10);
   if (lock) {
     const fresh = await fetchFromDb();
     await cache.set(key, fresh, 300);
     await redis.del(`lock:${key}`);
     return fresh;
   }
   await sleep(50); return cache.get(key);
   ```

CASL Ability cache icin: **stale-while-revalidate** kanonik.

### Kural 17.6: Bulk Operasyon Pattern (BULK-01, CRITICAL)

100+ satir insert/update icin **dongu icinde `create()` YASAK** (N+1 family — PERF-01 ile uyumlu).

```typescript
// YASAK - 1000 INSERT round trip
for (const row of csvRows) {
  await prisma.basvuru.create({ data: row });
}

// DOGRU - batch + ayri transaction + skipDuplicates
const batchSize = 100;
for (let i = 0; i < csvRows.length; i += batchSize) {
  const batch = csvRows.slice(i, i + batchSize);
  await uow.transaction(async () => {
    await prisma.basvuru.createMany({
      data: batch,
      skipDuplicates: true,  // Unique constraint cakismasinda skip
    });
  });
}
```

**Performans referans:**
- 1000 row x 5ms (create) = 5000ms (~5s)
- 1000 row / 100 batch x 50ms (createMany) = 500ms (~0.5s) — **10x hizli**

**Audit kurali:** Bulk operation'da her satir icin **ayri audit YASAK** — ozet audit (`eventType: 'bulk_import', count: N, source: '...'`) tek satir. Detayli denetim isteniyorsa ayri raw-data tablosu (audit degil).

---

## 18. CQRS + CASL Hierarchy Kurallari

### Kural 18.1: Command/Query Naming (CQRS-01, HIGH)

Command/Query naming kanonik. Ingilizce fiil + PascalCase + aggregate adi tekil (List sorgulari haric).

| Kategori | Format | Ornekler | YASAK |
|----------|--------|----------|-------|
| Create | `Create<Aggregate>Command` | `CreateBasvuruCommand` | `BasvuruyuOlusturCommand`, `AddBasvuruCommand` |
| Update | `Update<Aggregate>Command` | `UpdateBasvuruCommand` | `EditBasvuruCommand`, `BasvuruyuGuncelleCommand` |
| Delete | `Delete<Aggregate>Command` | `DeleteBasvuruCommand` | `RemoveBasvuruCommand` |
| Custom action | `<Action><Aggregate>Command` | `ApproveBasvuruCommand`, `CancelRandevuCommand` | `BasvuruApproveCommand` (sira ters) |
| Get single | `Get<Aggregate>Query` | `GetBasvuruQuery` | `FindBasvuruQuery`, `FetchBasvuruQuery` |
| List | `List<Aggregate>Query` | `ListBasvurularQuery` (plural for resource set) | `GetBasvuruListQuery`, `BasvuruListQuery` |
| Specialized list | `<Modifier><Aggregate>Query` | `SearchBasvurularQuery`, `ExportBasvurularQuery` | — |

**Kural:**
- Ingilizce fiil (Create/Update/Delete/Approve/Reject/Cancel/Export/Search)
- PascalCase
- **Past tense YASAK** (`CreatedBasvuruCommand` — bu event'tir, command degil)
- Aggregate adi PascalCase, tekil (List sorgularinda cogul — `ListBasvurularQuery` resource set'i ifade eder)

### Kural 18.2: Command Idempotency Key (CQRS-02, HIGH)

Hassas (mali, kritik state change) command'larda **idempotency key zorunlu**. Client UUID uretir; aynisi 2 kez gelse bile islem 1 kez yapilir.

```typescript
export class OdemeYapCommand extends BaseCommand {
  @IsString() @IsUUID()
  idempotencyKey: string;  // Client UUID uretir

  @IsString() basvuruId: string;
  @IsInt() miktarKurus: number;
}

@CommandHandler(OdemeYapCommand)
export class OdemeYapHandler {
  async execute(command: OdemeYapCommand) {
    // 1. Idempotency check
    const existing = await this.idempotencyStore.get(command.idempotencyKey);
    if (existing) return existing.result;  // Replay = cached result

    // 2. Reserve key (5 dakika lock)
    await this.idempotencyStore.reserve(command.idempotencyKey, 300);

    // 3. Islemi yap
    const result = await this.uow.transaction(async () => { ... });

    // 4. Sonucu cache'le (24 saat)
    await this.idempotencyStore.complete(command.idempotencyKey, result, 86400);
    return result;
  }
}
```

**Hangi command'larda zorunlu:**
- Odeme/mali islem
- Randevu olusturma (cift booking)
- Ceza kesme
- Bulk import (replay = duplicate)

Diger command'larda opsiyonel (HTTP header `Idempotency-Key` ile gonderilebilir).

### Kural 18.3: Role Hierarchy Explicit (CASL-09, HIGH)

Role inheritance YASAK. ADMIN → MUDUR → PERSONEL tipi **implicit inheritance YOK**. Her role kendi permission seti **acikca tanimlar**.

```typescript
// YASAK - implicit inheritance umut etme (CASL'de yok zaten)
const adminRole = createRole('ADMIN', { inherits: 'MUDUR' });

// DOGRU - permission seed'inde explicit
// PERSONEL: temel okuma
{ role: 'BASVURU_PERSONEL', action: 'READ', resource: 'Basvuru', condition: { groupPath: '{{groupPath}}' } }

// MUDUR: kendi yetkileri (PERSONEL'den miras ALMAZ)
{ role: 'BASVURU_MUDUR', action: 'READ', resource: 'Basvuru' }  // Tum grup
{ role: 'BASVURU_MUDUR', action: 'UPDATE', resource: 'Basvuru' }
{ role: 'BASVURU_MUDUR', action: 'APPROVE', resource: 'Basvuru' }

// ADMIN: MANAGE = ALL
{ role: 'ADMIN', action: 'MANAGE', resource: 'all' }
```

**Avantaj:** Her role hangi permission'a sahip = seed dosyasinda dogrudan okunabilir. Inheritance debug zorlugu yok; "MUDUR neden READ yetkisine sahip?" sorusunun cevabi tek satirda.

DRY istegi varsa: seed dosyasinda **JS array compose** ile (kod seviyesinde) — runtime'da CASL ability'sine 1:1 yansir.

### Kural 18.4: Permission Seed Migration (CASL-10, HIGH)

Permission seed degisikligi = **schema migration gibi versionlanir**. Bir kerelik script YASAK; uygulanan migration'lar `PermissionMigrationLog` tablosunda tutulur.

Klasor: `backend/prisma/seeds/permissions/migrations/`

```
2026-05-19-add-basvuru-export-permission.ts
2026-05-20-revoke-personel-mal-beyani-read.ts
```

Her migration `up` + `down`:

```typescript
// 2026-05-19-add-basvuru-export-permission.ts
export default {
  id: '2026-05-19-add-basvuru-export-permission',
  description: 'BASVURU_MUDUR rolune EXPORT yetkisi eklendi',

  async up(prisma: PrismaClient) {
    const permission = await prisma.permission.create({
      data: { action: 'EXPORT', resource: { connect: { key: 'Basvuru' } } },
    });
    await prisma.rolePermission.create({
      data: { roleId: muduRoleId, permissionId: permission.id },
    });
  },

  async down(prisma: PrismaClient) {
    await prisma.rolePermission.deleteMany({
      where: { permission: { action: 'EXPORT', resource: { key: 'Basvuru' } } }
    });
    await prisma.permission.deleteMany({
      where: { action: 'EXPORT', resource: { key: 'Basvuru' } }
    });
  },
};
```

**Production deployment:**
1. Migration runner permission seed migration'larini sirayla calistirir
2. `PermissionMigrationLog` tablosunda uygulanan migration'lar tutulur (idempotent)
3. Tum online user'lar `policy` queue uzerinden ability cache invalidate (CASL-08 memoization da temizlenir)

---

## 19. Auth/Session + Background Jobs

### Kural 19.1: Session Timeout (AUTH-01, HIGH)

JWT access token + refresh token disiplini. Cookie HttpOnly + SameSite. Idle + Absolute timeout iki kanal ayri.

| Token | TTL | Renew | Storage |
|-------|-----|-------|---------|
| Access token | 15 dk | Refresh ile yeni AT | HttpOnly Cookie |
| Refresh token | 7 gun | Idle 30 dk → expire (auto-logout); Absolute 7 gun | HttpOnly Cookie, hash DB |
| "Beni hatirla" RT | 30 gun | Idle 7 gun → expire; Absolute 30 gun | HttpOnly Cookie, hash DB |

**Idle timeout:** 30 dakika kullanici aktivitesi yoksa RT invalidate.
**Absolute timeout:** RT yaratilma tarihinden 7 (veya 30) gun sonra invalidate.

```prisma
model RefreshToken {
  tokenHash    String   @unique
  userId       String
  lastUsedAt   DateTime @default(now())
  expiresAt    DateTime
  rememberMe   Boolean  @default(false)
}
```

Her refresh request'te:
1. `lastUsedAt` guncellenir
2. `lastUsedAt > 30 dk once` ise → expire
3. `expiresAt < now()` ise → expire

### Kural 19.2: Concurrent Session Limit (AUTH-02, MEDIUM)

Kullanici **max 3 aktif refresh token**. 4. login = en eskisi invalidate.

```typescript
async createRefreshToken(userId: string): Promise<string> {
  const activeTokens = await this.uow.refreshTokens.findActive(userId);

  if (activeTokens.length >= 3) {
    const oldest = activeTokens.sort((a, b) => a.lastUsedAt - b.lastUsedAt)[0];
    await this.uow.refreshTokens.invalidate(oldest.id);
  }

  return this.uow.refreshTokens.create({ userId, ... });
}
```

**Audit:** Session invalidate → `security.session.evicted` event publish (SecurityEventLog).

### Kural 19.3: Sifre Degisikligi = All Sessions Invalidate (AUTH-03, CRITICAL)

Kullanici sifresini degistirince **TUM refresh token'lar invalidate**. Ayni kural: telefon/SMS dogrulama degisikligi, role degisikligi, hesap askiya alma.

```typescript
async changePassword(userId: string, newPassword: string) {
  await this.uow.transaction(async () => {
    await this.uow.users.updatePasswordHash(userId, await hash(newPassword));
    await this.uow.refreshTokens.invalidateAll(userId);
  });

  // Cache invalidation (outbox uzerinden — TXN-03 ile uyumlu)
  await this.uow.outbox.append({
    eventType: 'user.password.changed',
    payload: { userId },
  });
}
```

### Kural 19.4: "Beni hatirla" Kurali (AUTH-04, MEDIUM)

Login endpoint `rememberMe: boolean` field destekler:
- `rememberMe: true` → RT TTL = 30 gun, idle 7 gun
- `rememberMe: false` (default) → RT TTL = 7 gun, idle 30 dk

**Frontend cookie:**
- `rememberMe: true` → cookie Max-Age = 30 gun
- `rememberMe: false` → session cookie (browser kapaninca silinir)

### Kural 19.5: Cron Timezone (JOB-01, HIGH)

Tum `@Cron` decorator'larinda **timezone ZORUNLU**. Sunucu UTC calisir; raw cron expression UTC olarak yorumlanir → TR saatlerinden 3 saat kayma. Belediye operasyon saatleri icin kritik.

```typescript
// YASAK - timezone yok (9:00 — UTC mi TR mi belirsiz)
@Cron('0 9 * * *')

// DOGRU - TR 09:00
@Cron('0 9 * * *', { timeZone: 'Europe/Istanbul' })
```

### Kural 19.6: Worker Concurrency (JOB-02, HIGH)

Her BullMQ Worker icin **`concurrency` tanimli** — varsayilan `1` (sirali) buyuk queue'larda patlar.

```typescript
@Processor('audit', { concurrency: 10 })
@Processor('emails', { concurrency: 5 })
@Processor('appointment-confirmation-reminder', { concurrency: 20 })
```

**Varsayilan degerler:**

| Queue | Concurrency | Sebep |
|-------|-------------|-------|
| audit | 10 | Hafif DB write, paralel ok |
| domain-events | 20 | Fan-out, paralel kritik |
| policy | 5 | Cache invalidation, fazla paralelizm gereksiz |
| emails | 5 | SMTP rate limit |
| appointment-reminder | 20 | Cok sayida, paralel ok |
| hold-expire | 3 | DB transaction-heavy |
| token-cleanup | 1 | Background, agir olmasin |

### Kural 19.7: Circuit Breaker (JOB-03, HIGH)

3rd party API (KPS, UlakBel, SMS, e-Devlet) cagrilarinda **circuit breaker ZORUNLU**. Hata oraninin yuksek oldugu sistemlerde fallback'e dusulur; downstream system korunur.

```typescript
import CircuitBreaker from 'opossum';

const breaker = new CircuitBreaker(
  (tcKimlik: string) => kpsClient.kimlikSorgu(tcKimlik),
  {
    timeout: 5000,                  // 5s timeout
    errorThresholdPercentage: 50,   // %50 hata orani → OPEN
    resetTimeout: 30000,            // 30s sonra HALF_OPEN
    rollingCountTimeout: 60000,     // 1 dk window
    rollingCountBuckets: 10,
  }
);

breaker.fallback(() => ({
  status: 'KPS_UNAVAILABLE',
  message: 'KPS servisi gecici olarak kullanilamiyor',
}));

breaker.on('open', () => {
  logger.warn('KPS circuit breaker OPEN');
  metrics.counter('circuit_breaker_open').inc({ service: 'kps' });
});
```

**States:**
- **CLOSED**: Normal akis
- **OPEN**: %X hata → istekler dogrudan fallback (DB'ye gitmiyor, 30s bekle)
- **HALF_OPEN**: Test request → basarili = CLOSED, fail = OPEN

Tum 3rd party integration'lar (KPS, UlakBel, SMS, e-Devlet) breaker'la sarmalanir; Anti-Corruption Layer (Pattern 25) ile birlikte calisir.

---

## 20. KVKK / Legal Kurallari

### Kural 20.1: Data Retention Policy (KVKK-01, CRITICAL)

**Her tabloda retention policy tanimli** + otomatik arsiv cron. Retention'siz tablo yasal risk.

**Retention tablosu (ornek — `docs/legal/retention-policy.md` kanonik):**

| Tablo | Aktif retention | Arsiv retention | Toplam | Sebep |
|-------|-----------------|------------------|--------|-------|
| User | Kullanici aktif oldugu surece | Silindikten 10 yil | Sinirsiz | Audit trail |
| Basvuru | 5 yil | 10 yil | 15 yil | KVKK + idare |
| AuditLog | — (immutable) | 10 yil | 10 yil | KVKK |
| SecurityEventLog | 6 ay | 2 yil | 2 yil | SOC |
| RefreshToken | 30 gun (expire sonrasi) | 90 gun | 90 gun | Forensics |
| KpsKimlikCache | 30 gun | — | 30 gun | Onbellek |
| ApplicationLog (Pino) | 30 gun | — | 30 gun | Operasyonel |

**Implementasyon:**

```typescript
// shared/legal/retention/retention.service.ts
@Cron('0 2 * * *', { timeZone: 'Europe/Istanbul' })  // Her gun 02:00 (JOB-01 uyumlu)
async archiveExpiredData() {
  for (const policy of RETENTION_POLICIES) {
    const cutoff = subYears(new Date(), policy.activeYears);
    await this.archiveTable(policy.table, cutoff);
  }
}
```

Audit Log silinemez (AUDIT-03) — 10 yil sonra ayri "cold storage" partition'a tasinir, satir kendisi DROP edilmez.

### Kural 20.2: Data Export Endpoint (KVKK-02, HIGH)

**KVKK 11. madde** geregi kullanici kendi verilerini indirebilir. Async (BullMQ) + email ile indirme linki.

Endpoint: `GET /api/me/data-export`
- Output: ZIP (JSON + PDF ozet)
- Icerik: User profile, basvurular, randevular, audit log (kendi aktiviteleri), KPS cache
- Async — BullMQ job → email ile indirme linki (10 dk gecerli)

```typescript
@Get('/me/data-export')
@RequireAction(Action.READ, Resource.SelfData)
async exportMyData(@Req() req: AuthenticatedRequest) {
  const jobId = await this.dataExportQueue.add('export-user-data', {
    userId: req.user.sub,
    correlationId: requestContext.getStore()?.correlationId,
  });
  return { jobId, message: 'Veri ihracati hazirlaniyor, e-postaniza link gonderilecek' };
}
```

**Resource:** `SelfData` (CASL Subject) — sadece kendi verisine erisim (`{ userId: '{{userId}}' }` condition ile ABAC enforce).

### Kural 20.3: Unutulma Hakki / Pseudonymization (KVKK-03, CRITICAL)

Silme talebi → **hard delete YOK** (audit trail kaybedilemez — AUDIT-03 ile uyumlu). Yerine **pseudonymization** uygulanir: PII alanlar maskelenir, kayit kendisi korunur.

```typescript
async pseudonymizeUser(userId: string) {
  await this.uow.transaction(async () => {
    const user = await this.uow.users.findById(userId);

    await this.uow.users.update(userId, {
      tcKimlikNo: `DELETED-${crypto.randomUUID()}`,
      ad: 'Silinmis',
      soyad: 'Kullanici',
      telefon: null,
      email: null,
      adres: null,
      deletedAt: new Date(),
      pseudonymizedAt: new Date(),
    });

    // Audit trail KORUNUR (action ID, timestamp) ama PII icerigi pseudonymize
    await this.uow.auditLogs.pseudonymizeByActor(userId);
  });

  // Cross-feature event (outbox uzerinden — TXN-03)
  await this.outbox.append({
    eventType: 'user.pseudonymized',
    payload: { userId, pseudonymizedAt: new Date() },
  });
}
```

Audit log'da `actorId` korunur (kim yapmisti) ama PII (ad, soyad, tcKimlik) `'PSEUDONYMIZED'` ile degistirilir.

**Kanonik kural:** AuditLog'da PII alani **pseudonymize EDILEBILIR**; AuditLog'un kendisi (satir) **SILINEMEZ** (AUDIT-03 ile celismez — immutability satir bazinda).

(KVKK-04 Consent Management → **IRON_RULES_SHARED Bolum 12** kanonik kaynak; backend tarafinda sadece `UserConsent` tablosu + Cron retention.)

---

## 21. Documentation Kurallari

### Kural 21.1: Swagger ZORUNLU (DOC-01, HIGH)

Her endpoint (Public haric) **Swagger decorator'lariyla dokumante** edilir. Production'da degil, dev + staging'de Swagger UI yayinlanir (`/api/docs`).

**Zorunlu decorator'lar:**
- `@ApiTags(...)` — Controller basinda, modul ismiyle
- `@ApiOperation({ summary, description })` — endpoint method'unda
- `@ApiResponse(...)` — beklenen status code'lar (en az 200/201/400/403)
- `@ApiBearerAuth(...)` — auth gerektiriyorsa

```typescript
@Controller('basvurular')
@ApiTags('Sosyal Yardim — Basvurular')
@ApiBearerAuth('JWT-auth')
export class BasvuruController {
  @Post()
  @RequireAction(Action.CREATE, Resource.Basvuru)
  @ApiOperation({
    summary: 'Yeni basvuru olustur',
    description: 'Vatandas kendi basvurusunu olusturur. Aile uyeleri + mal beyani zorunlu.',
  })
  @ApiResponse({ status: 201, type: CreateBasvuruResult })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Yetki yok' })
  @ApiResponse({ status: 409, description: 'Bu TC ile aktif basvuru mevcut' })
  async create(@Body() command: CreateBasvuruCommand): Promise<CreateBasvuruResult> {
    return this.commandBus.execute(command);
  }
}
```

### Kural 21.2: ADR — Architecture Decision Records (DOC-02, MEDIUM)

Onemli mimari kararlar `docs/adr/` altinda dokumante edilir. **Tek satirlik karar degil** — context + alternatif + sonuc aciklanan kararlar.

Klasor yapisi:

```
docs/adr/
├── 2026-05-19-cqrs-pragmatic-approach.md
├── 2026-05-20-outbox-pattern-adoption.md
├── 2026-05-25-aggregate-root-boundary.md
└── 0001-template.md
```

**Format:**

```markdown
# ADR: <Karar Basligi>

**Tarih:** 2026-05-19
**Durum:** Accepted | Superseded by ADR-XXX | Deprecated
**Karar Verenler:** @mrburakgenc

## Baglam
[Hangi problemi cozuyoruz, alternatifler neler]

## Karar
[Hangi yaklasimi sectik]

## Sonuclar
[Pozitif + negatif etkiler]

## Alternatifler
[Diger dusunulen secenekler ve neden reddedildigi]
```

**Ne zaman ADR yazilir:**
- Yeni framework/library adoption
- Mimari pattern degisikligi
- Veri saklama/migration stratejisi
- Cross-feature contract degisikligi

---

## 22. Naming Conventions

### Kural 22.1: File Naming kebab-case (NAME-01, HIGH)

Tum dosya isimleri **kebab-case**. ESLint: `unicorn/filename-case` rule = `kebabCase`.

```
DOGRU:
  create-basvuru.handler.ts
  basvuru.entity.ts
  basvuru-list.tsx
  use-basvuru-list.ts

YASAK:
  CreateBasvuruHandler.ts (PascalCase)
  createBasvuru.handler.ts (camelCase)
  create_basvuru.handler.ts (snake_case)
  BasvuruList.tsx (PascalCase — class degil)
```

**Istisna:**
- Next.js ozel dosyalar: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx` (Next.js convention)
- README, LICENSE, CHANGELOG (root level UPPERCASE — git convention)

### Kural 22.2: Boolean Prefix (NAME-02, MEDIUM)

Boolean degisken/property/method'larda **prefix zorunlu** — niyeti tipten degil isimden okuyabilmek icin.

| Prefix | Kullanim | Ornek |
|--------|----------|-------|
| `is` | State/durum | `isActive`, `isPending`, `isLoggedIn` |
| `has` | Sahiplik/varlik | `hasPermission`, `hasError`, `hasUnreadMessages` |
| `can` | Yetenek | `canEdit`, `canDelete`, `canApprove` |
| `should` | Karar/oneri | `shouldRetry`, `shouldRefresh` |
| `did` | Gecmis eylem | `didMount`, `didFetch` |

```typescript
// YASAK
const active: boolean = true;
const permission: boolean = ...;

// DOGRU
const isActive: boolean = true;
const hasPermission: boolean = ...;
```

### Kural 22.3: Function Verb-Prefix (NAME-03, MEDIUM)

Function naming **verb-first**; verb anlamsal (her birinin contract'i farkli).

| Prefix | Anlam | Ornek |
|--------|-------|-------|
| `get` | Cache'ten veya sync return — hizli, hata atmaz | `getUserDisplayName(user)` |
| `fetch` | Remote/IO async — hata atabilir | `fetchUserFromKps(tc)` |
| `find` | Araniyor, bulunmayabilir (nullable return) | `findBasvuruById(id): Basvuru \| null` |
| `list` | Pagination + filter | `listBasvurular(criteria)` |
| `load` | Tum aggregate'i hydrate | `loadBasvuruWithChildren(id)` |
| `build` | Factory, pure construction | `buildAbility(rules)` |
| `create` | Yeni entity olustur (DB write veya domain) | `createBasvuru(data)` |
| `save` | Persist (insert veya update) | `saveBasvuru(entity)` |
| `delete` | Soft delete | `deleteBasvuru(id, userId)` |
| `is/has/can` | Boolean return | `isEligible(basvuru)` |

**Kural ozeti:**
- `get` → undefined donerse `?:` ile isaretle, async olabilir
- `find` → null donerse explicit `| null`
- `fetch` → async + may throw (network error)
- `list` → her zaman array + meta (`PaginatedResult<T>`)

---

## Ozet: Backend Demir Kurallar

| Kod | Kural | Kisaca | Impact |
|-----|-------|--------|--------|
| TS-01..06 | TypeScript | any, as, !, console.log YASAK | CRITICAL |
| GUARD-01 | Guard Sirasi | Throttle -> Origin -> JWT -> CASL, degistirme | CRITICAL |
| CASL-01 | CASL: Guard coarse, Repository tam | Handler yetki kodu yazmaz | CRITICAL |
| CASL-02 | CASL: ResourceRegistry | Yeni endpoint = kayit + permission + role | CRITICAL |
| CASL-03 | CASL: SkipPolicies | Sadece @Public ile birlikte | CRITICAL |
| CASL-05 | ABAC Repository | AbilityFactory inject + accessibleBy + FieldFilterHelper (her feature) | CRITICAL |
| CASL-07 | Handler buildFor YASAK | abilityFactory.buildFor() handler'da YASAK | CRITICAL |
| RATE-01..02 | Rate Limit | Hassas endpoint = ozel limit, bypass yasak | HIGH |
| REPO-01..03 | Repository | Interface+concrete zorunlu, deletedAt zorunlu | CRITICAL |
| TXN-01..02 | Transaction | Multi-write = UoW, direkt $transaction yasak | CRITICAL |
| AUDIT-01..02 | Audit | CUD = audit zorunlu, BullMQ async | HIGH |
| PII-01 | PII/KVKK | Log'larda PII maskeleme zorunlu | HIGH |
| EXC-01..04 | Exception Handling | Pokemon YASAK, spesifik exception, catch(error: unknown) | CRITICAL |
| OBS-01..12 | Observability | Logger/Audit/Metric/Health/Trace/ACL — kanonik: IRON_RULES_OBSERVABILITY.md | → ayrı dosya |
| EVT-00..12 | Events (EDD) | Cross-feature/Outbox/Idempotency/Versioning/Tombstone/Saga — kanonik: IRON_RULES_EVENTS.md | → ayrı dosya |
| MOD-01..03 | Module Structure | Feature izolasyonu, dependency direction, controller'da is mantigi yok | CRITICAL |
| PERF-01..04 | Performance | N+1 YASAK, pageSize limit, sort whitelist, select optimize | CRITICAL |
| CTRL-01..03 | Controller | @RequireAction zorunlu, DTO validation, is mantigi handler'da | CRITICAL |
| MIG-01..03 | Migration | Risk analizi, expand-contract, NOT NULL default | CRITICAL |
