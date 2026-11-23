# W0NDERSUPERIOR Demir Kuralları — Events (EDD)

> **Kapsam:** Event-driven design (EDD) disiplini — Cross-Feature iletişim, Outbox/BullMQ/Idempotency, Schema versioning, Tombstone, ACL boundary, Saga.
> Observability disiplini için: [`IRON_RULES_OBSERVABILITY.md`](./IRON_RULES_OBSERVABILITY.md).
> Backend genel kuralları için: [`IRON_RULES_BACKEND.md`](./IRON_RULES_BACKEND.md).

## Cross-Reference Index

| ID | Kural | Cross-ref |
|---|---|---|
| **EVT-00** | **Cross-Feature İletişim Karar Matrisi (mihenk taşı)** | Mimari Değişmez #1 (revised) |
| EVT-01 | Event Envelope v2 (versioning + causation + traceparent) | OBS-05, EVT-02, EVT-03 |
| EVT-02 | Causation + Correlation Discipline | EVT-01, OBS-05 |
| EVT-03 | Schema Versioning (`event.action.vN`) | EVT-01, EVT-09 |
| EVT-04 | Outbox Producer Pattern | Kural 6.3, Pattern 22, OBS-07 |
| EVT-05 | Idempotent Consumer | EVT-06, Pattern 28 |
| EVT-06 | Idempotency Log Tablo Şeması | EVT-05 |
| EVT-07 | DLQ Discipline | OBS-09, EVT-08 |
| EVT-08 | Retry + Exponential Backoff + Jitter | EVT-07 |
| EVT-09 | Replay / Backfill Mode | EVT-03 (upcaster), EVT-05 (dedup) |
| EVT-10 | Tombstone Event (KVKK Unutulma — Strateji B) | Kural 20.3, AUDIT-03, Pattern 30 |
| EVT-11 | ACL Event Boundary | EVT-00, Pattern 31, OBS-12 |
| EVT-12 | Saga / Process Manager (forward-looking) | — |

---

## Kural 0 (EVT-00) — Cross-Feature İletişim Karar Matrisi (CRITICAL)

**Sorumluluk:** Her cross-feature etkileşim **4 yoldan biriyle** yapılır. Yanlış araç seçimi = mimari kırılma.

### ZORUNLU 4 Yöntem Matrisi

| Senaryo | Yöntem | Konum | Karakter |
|---|---|---|---|
| **Senkron pre-condition** ("X olmadan Y başlamaz") | **Shared Interface Contract** | `shared/<concern>/domain/I*.contract.ts` | In-process, aynı request, aynı transaction |
| **Senkron dış sistem çağrısı** (KPS, banka POS, e-Devlet, SMS) | **ACL Pattern** | `shared/external/<vendor>/` | HTTP/SOAP/RPC, 8 sorumluluk (Pattern 31) |
| **Asenkron fan-out** ("olduktan sonra şunlar da olsun") | **BullMQ Domain Event** (Outbox üzerinden) | `shared/messaging/` | Fire-and-forget, eventually consistent |
| **Multi-step asenkron iş** (manuel onay, batch, compensation) | **Saga / Process Manager** | feature içinde state entity | Uzun süreli, compensation gerekli (forward-looking) |

### ZORUNLU Maddeler
1. Her cross-feature etkileşim **bu 4 yoldan biriyle**
2. Handler içinde yöntem **deklare edilir** (yorum):
   ```typescript
   // CROSS-FEATURE COMM: SyncContract via ICitizenVerificationContract
   // CROSS-FEATURE COMM: DomainEvent → user.created.v1
   ```
3. Concern adı **iş odaklı** olur (`citizen-verification`, `payment-verification`, `slot-availability`), sahip feature adına atıf yapmaz
4. Module export'u **sadece contract token**'ını içerir, internal sınıfları değil

### YASAK (BADI'den somut örnekler)

| Yasak Madde | BADI'de Konum | Sebep |
|---|---|---|
| Concrete service direkt inject | `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-identity.handler.ts:33` `private readonly kpsService: KpsService` | Vendor lock-in, test imkânsız |
| Cross-feature entity import | `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-identity.handler.ts:19` `import { SmsVerification } from '@features/identity/auth/domain/...'` | Bounded context ihlali |
| Cross-feature repository import | `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-identity.handler.ts:22` `import { UserRepository } from '@features/identity/users/...'` | Internal'a sızma |
| `forwardRef` ile module bağlama | `D:\BADI\badi\backend\src\features\formlar\public\public.module.ts:80-84` (5 farklı identity modülü) | Circular dependency = tasarım kokusu |
| Vendor şeması domain'de | `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-identity.handler.ts:113-117` `kpsResponse.data?.adresBilgisi?.ilKodu` | Vendor değişince 7 yer kırılır |
| Vendor kodu hardcoded | `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-identity.handler.ts:110-111` `KOCAELI_IL_KODU = 41` (iki dosyada) | Magic number, tek nokta değil |
| Event publish + wait-reply | (BADI'de yok, kavramsal yasak) | Request-reply over MQ anti-pattern |

### Kanonik — 4 Senaryo Örneği

**Senaryo 1: Senkron pre-condition (Shared Contract)**

```typescript
// shared/citizen-verification/domain/citizen-verification.contract.ts
export const CITIZEN_VERIFICATION_CONTRACT = Symbol('ICitizenVerificationContract');
export interface ICitizenVerificationContract {
  verify(input: CitizenVerificationInput): Promise<CitizenVerificationResult>;
}

// features/randevu-sistemi/application/handlers/create-randevu.handler.ts
@CommandHandler(CreateRandevuCommand)
export class CreateRandevuHandler {
  constructor(
    @Inject(CITIZEN_VERIFICATION_CONTRACT)
    private readonly citizenVerification: ICitizenVerificationContract,
  ) {}

  async execute(cmd: CreateRandevuCommand) {
    // CROSS-FEATURE COMM: SyncContract
    const result = await this.citizenVerification.verify({ /* ... */ });
    if (!result.verified) throw new UnprocessableEntityException(result.detail);
    // ... transaction + outbox
  }
}
```

**Senaryo 2: ACL (dış sistem)**

`KpsCitizenVerificationAcl` `ICitizenVerificationContract` implement eder.
8 sorumluluk (S1-S8) zorunlu — detay: [Pattern 31](./PATTERNS.md#pattern-31).

**Senaryo 3: Asenkron Domain Event**

```typescript
return this.uow.transaction(async () => {
  const r = await this.uow.randevular.create(input);
  // CROSS-FEATURE COMM: DomainEvent → randevu.created.v1
  await this.uow.outbox.append(this.envelopeBuilder.build({
    eventType: 'randevu.created.v1',
    eventVersion: 1,
    source: 'randevu-sistemi',
    payload: { randevuId: r.id, citizenId: r.citizenId },
  }));
  return r;
});
```

**Senaryo 4: Saga (forward-looking)**

Multi-step iş akışı için state machine — detay: EVT-12.

### Cross-Ref
EVT-11 (ACL Boundary), Mimari Değişmez #1 (revised — ARCHITECTURE.md), Pattern 16 (Cross-Feature İletişim), Pattern 31 (ACL).

### Enforcement
- AST: feature A → feature B internal import = CRITICAL block (hook iron-rules-check.js — T11)
- AST: `forwardRef(() => XModule)` = WARN (T12)
- AST: vendor concrete class (KpsService, SmsService, vb.) direkt inject (ACL dışında) = CRITICAL (T12)

---

## Kural 1 (EVT-01) — Event Envelope v2 (CRITICAL)

**Sorumluluk:** Tüm domain event'ler **standardize envelope**'da yayınlanır.

### ZORUNLU TypeScript Şeması

```typescript
interface EventEnvelope<TPayload = unknown> {
  // === Identity ===
  readonly eventId: string;                              // UUID — unique per event
  readonly eventType: `${string}.${string}.v${number}`;  // 'user.created.v1' (versiyonlu)
  readonly eventVersion: number;

  // === Origin ===
  readonly source: string;                                // feature slug (örn. 'identity', '-module' suffix YOK)
  readonly producerInstanceId: string;                    // App instance UUID

  // === Tracing ===
  readonly correlationId: string;                         // İlk request'ten gelen
  readonly causationId: string | null;                    // Bu event'i tetikleyen command/event ID
  readonly traceparent?: string;                          // W3C Trace Context

  // === Time ===
  readonly timestamp: string;                             // ISO 8601 UTC

  // === Replay ===
  readonly _replay?: boolean;
  readonly _replaySource?: 'csv-import' | 'db-restore' | 'manual-dlq-replay' | 'projection-rebuild';

  // === Schema ===
  readonly payloadSchemaUri?: string;

  // === Data ===
  readonly payload: TPayload;
}
```

### YASAK
- Raw payload (envelope'suz): `publish({ userId: '123' })`
- Eksik `eventVersion`
- Eksik `causationId` (null değil — **explicit `null` veya değer**, `undefined` yasak)
- Local timezone timestamp (UTC zorunlu)
- `eventType` regex'e uymaması (`/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.v\d+$/`)

### Kanonik (EnvelopeBuilder ile)

```typescript
await this.outbox.append(this.envelopeBuilder.build({
  eventType: 'randevu.created.v1',
  eventVersion: 1,
  source: 'randevu-sistemi',
  causationId: command.commandId,
  payload: { randevuId, citizenId },
}));

// EnvelopeBuilder içinde requestContext.getStore() ile correlationId/traceparent otomatik
```

### BADI Negatif Örnek
- BADI'de domain event publish edilmiyor. Welcome SMS fire-and-forget: `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-sms.handler.ts:148-156` — envelope yok, retry yok, dedup yok.

### Cross-Ref
EVT-02 (causation/correlation), EVT-03 (versioning), EVT-04 (Outbox), OBS-05 (Request Context + OTel).

### Enforcement
- AST: `outbox.append({ ... })` envelope alanları eksik → CRITICAL (T13)
- AST: `eventType` regex format uymazsa → CRITICAL (T13)
- AST: `domainEventProducer.publish` doğrudan çağrısı → CRITICAL (Kural 6.3 ihlali — EVT-04, T14)

---

## Kural 2 (EVT-02) — Causation + Correlation Discipline (HIGH)

**Sorumluluk:** Olay zincirini **geriye doğru izleyebil** — "Nasıl buraya geldik?" sorusunun cevabı.

### Tanım
- **correlationId:** Zincirin **ilk** harici tetikleyicisinin ID'si (request, scheduled job, webhook). Tüm zincirde **aynı kalır**.
- **causationId:** Bu olayı **doğrudan tetikleyen** önceki olay/command'ın ID'si. Her hop'ta **değişir**.

### Zincir Örneği

```
1. User → POST /randevu
   correlationId = req-abc123, no causationId

2. CreateRandevuCommand (cmd-1)
   command.correlationId = req-abc123
   command.causationId = null

3. randevu.created (e1) — handler yarattı
   correlationId = req-abc123
   causationId = cmd-1

4. SendNotificationCommand (cmd-2) — listener tetikledi
   command.correlationId = req-abc123
   command.causationId = e1

5. notification.sent (e2) — handler yarattı
   correlationId = req-abc123
   causationId = cmd-2
```

### ZORUNLU
- Her event/command'da causationId **doldurulur** (null veya değer — undefined yasak)
- `BaseCommand`'da `commandId: string` alanı (CommandRequesterInterceptor üretir)
- Listener bir command tetiklediğinde: `command.causationId = event.eventId`

### YASAK
- causationId'yi `undefined` bırakmak (null = "yok" explicit, undefined = "düşünülmedi")
- correlationId'yi her hop'ta yeniden üretmek (zincir kopar, debug imkânsız)
- causation chain'i log'a inline yazmak (audit log'da yapı zaten var)

### Debugging Sorgusu (causation chain backward)

```sql
WITH RECURSIVE chain AS (
  SELECT * FROM audit_log WHERE entity_id = '<randevu_id>'
  UNION
  SELECT al.* FROM audit_log al
  JOIN chain c ON al.event_id = c.causation_id
)
SELECT * FROM chain ORDER BY timestamp;
```

### BADI Negatif Örnek
BADI'de causationId hiç yok — `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-identity.handler.ts`, `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-sms.handler.ts`, `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\mark-attendance.handler.ts` hiçbirinde causation/correlation tracking yok. "Bu randevu nasıl yaratıldı?" sorusu cevapsız.

### Cross-Ref
EVT-01 (Envelope), OBS-05 (Request Context).

### Enforcement
AST: command/event publish'inde `causationId` alan eksik → WARN (sonra CRITICAL).

---

## Kural 3 (EVT-03) — Schema Versioning (HIGH)

**Sorumluluk:** Event şemaları değiştiğinde **sessizce kırılma**.

### ZORUNLU
- Event type semantic version suffix taşır: `user.created.v1`
- Yeni opsiyonel alan ekleme (backward-compatible) → aynı versiyonda kalır
- **Breaking change** → yeni versiyon (`v2`)
- Geçiş protokolü: Producer dual-publish → Consumer'lar v2'ye geçer → Producer v1'i kapatır

### Backward-Compatible (aynı versiyon)
- Yeni opsiyonel alan ekleme
- Enum'a yeni değer ekleme (consumer default case'i ele alıyorsa)

### Breaking Change (yeni versiyon ZORUNLU)
- Required alan silme
- Field type değiştirme (string → object)
- Alan semantiği değişikliği (`amount` artık kuruş değil lira)
- Enum değeri silme/yeniden tanımlama

### Migration Playbook (4 Faz)

**Faz 1 — Hazırlık (PR #1):** Yeni payload type tanımla, yeni eventType, test yaz.

**Faz 2 — Dual Publish (PR #2):**
```typescript
await this.outbox.append(builder.build({ eventType: 'user.created.v1', eventVersion: 1, payload: { userId, email } }));
await this.outbox.append(builder.build({ eventType: 'user.created.v2', eventVersion: 2, payload: { userId, email, ad, soyad } }));
```

**Faz 3 — Consumer Migration:** Her consumer ayrı PR, v2 listener ekle, v1 listener `@Deprecated`.

**Faz 4 — Cleanup:** Tüm consumer'lar v2'ye geçtikten sonra v1 silinir. Detay: Pattern 29 (T8).

### YASAK
- Silent schema change (versiyon değiştirmeden payload değiştirmek)
- Tek versiyon, "payload'ı değiştirelim" yaklaşımı
- v1 payload'ı silmek replay/backfill bitmeden (EVT-09 ile çelişir)

### BADI Negatif Örnek
BADI'de event publish yok, schema versioning kavramsal olarak ele alınmadı. Yeni proje için Day 1'den uygulanmalı.

### Cross-Ref
EVT-01 (Envelope), EVT-09 (Replay — upcaster), Pattern 29 (Schema Versioning Pattern).

### Enforcement
- AST: `eventType` regex `/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.v\d+$/` — uymazsa CRITICAL (T13).
- PR review: payload type değişmiş + eventVersion aynı → reviewer check (soft).

---

## Kural 4 (EVT-04) — Outbox Producer Pattern (CRITICAL)

**Sorumluluk:** Domain event'ler ASLA doğrudan BullMQ'ya push edilmez. Outbox tablosu zorunlu — at-least-once guarantee için.

> Bu kural [`IRON_RULES_BACKEND.md` → Kural 6.3 (TXN-03)](./IRON_RULES_BACKEND.md)'ün cross-doc özetlemesidir. Tam metin Backend dosyasında.

### ZORUNLU
- Handler `uow.transaction()` içinde **outbox satırı yazar** (entity + outbox aynı transaction)
- `OutboxRelayWorker` outbox tablosundan okur, BullMQ'ya push eder
- At-least-once guarantee: Redis down olsa bile event outbox'ta bekler
- Outbox dispatched satırlar 30 gün sonra cleanup (cron job, T15+)

### Outbox Schema (Prisma)

```prisma
model Outbox {
  id                String    @id @default(uuid())
  eventType         String
  eventVersion      Int       @default(1)
  envelope          Json                              // Tam envelope (causationId, correlationId, traceparent)
  payload           Json
  partitionKey      String?                            // Sıralı dispatch (aynı aggregate)
  createdAt         DateTime  @default(now())
  dispatchedAt      DateTime?                          // Null = bekliyor
  failureCount      Int       @default(0)
  lastFailureAt     DateTime?
  lastError         String?

  @@index([dispatchedAt, createdAt])
  @@index([partitionKey, dispatchedAt])
  @@index([eventType, createdAt])
  @@map("outbox")
}
```

### YASAK

```typescript
// YASAK — Outbox bypass — Redis down olursa event kaybolur
await this.uow.transaction(async () => {
  await this.uow.randevular.create(r);
  await this.domainEventProducer.publish({ ... });  // YASAK
});

// YASAK — Transaction dışı outbox — atomic değil
await this.uow.randevular.create(r);
await this.uow.outbox.append({ ... });  // YASAK (entity yaratıldı ama event yazılmadı)
```

### Kanonik

```typescript
return this.uow.transaction(async () => {
  const r = await this.uow.randevular.create(input);
  await this.uow.outbox.append(this.envelopeBuilder.build({
    eventType: 'randevu.created.v1',
    eventVersion: 1,
    source: 'randevu-sistemi',
    causationId: cmd.commandId,
    payload: { randevuId: r.id, citizenId: r.citizenId },
  }));
  return r;
});
```

### BADI Negatif Örnek
- BADI'de outbox **hiç kullanılmıyor**. Welcome SMS: `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-sms.handler.ts:148-156` — fire-and-forget Promise, kayıp riski yüksek.
- Audit senkron: `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-identity.handler.ts:224` — direkt Prisma çağrısı.

### Cross-Ref
Kural 6.3 (TXN-03 — tam metin), Pattern 22 (Outbox Pattern), OBS-07 (Outbox Observability).

### Enforcement
- AST: `domainEventProducer.publish` doğrudan çağrısı (relay worker dışında) → CRITICAL (T14)
- Hook: Outbox tablosu olmadan deploy YASAK (smoke test)

---

## Kural 5 (EVT-05) — Idempotent Consumer (CRITICAL)

**Sorumluluk:** Aynı event 2 kez işlenirse aynı sonuç — at-least-once delivery'de duplicate immune.

### ZORUNLU
- Her consumer eventId ile dedup yapar
- Idempotency log tablosu zorunlu (EVT-06)
- Composite key: (eventId, consumerId) — aynı event farklı consumer'larda işlenebilir
- `IdempotentConsumerBase` helper class extend edilir (Pattern 28)

### Kanonik

```typescript
@Processor('domain-events')
export class IdentityDomainEventConsumer extends IdempotentConsumerBase {
  protected readonly consumerId = 'identity:user-created-listener';

  @Process('user.created.v1')
  async handleUserCreated(job: Job<EventEnvelope<UserCreatedPayload>>) {
    await this.processOnce(job, async (env) => {
      await this.userListProjection.upsert(env.payload);
      if (!env._replay) {
        await this.smsContract.sendWelcomeSms(env.payload.phone, env.payload.fullName);
      }
    });
  }
}

// IdempotentConsumerBase (shared/messaging/application/)
@Injectable()
export abstract class IdempotentConsumerBase {
  protected abstract readonly consumerId: string;
  constructor(protected readonly processedEvents: ProcessedEventRepository) {}

  protected async processOnce<TPayload>(
    job: Job<EventEnvelope<TPayload>>,
    handler: (envelope: EventEnvelope<TPayload>) => Promise<void>,
  ): Promise<void> {
    const { eventId } = job.data;
    if (await this.processedEvents.exists(eventId, this.consumerId)) return;
    await handler(job.data);
    await this.processedEvents.markProcessed(eventId, this.consumerId);
  }
}
```

### YASAK
- Idempotency check'i ATLAYAN consumer (`@Process` decorator var, dedup yok)
- Process **öncesi** mark processed (failure'da yanlış dedup — handler crashed but marked done)
- Tek key (sadece eventId) — farklı consumer'lar aynı event'i farklı amaçla işleyebilir
- Manuel idempotency (eventId'yi başka tabloda hash ile kontrol etmek) — kanonik tablo şart

### BADI Negatif Örnek
BADI'de @Process consumer fiilen yok. Yeni proje için Day 1'den zorunlu.

### Cross-Ref
EVT-06 (Idempotency Log Tablo Şeması), EVT-09 (Replay flag dedup'a etki etmez), Pattern 28 (Idempotency Log Pattern).

### Enforcement
AST: `@Process(...)` decorator + body içinde `processedEvents.exists` veya `processOnce` çağrısı yok → CRITICAL (T14).

---

## Kural 6 (EVT-06) — Idempotency Log Tablo Şeması (HIGH)

**Sorumluluk:** Dedup için kanonik tablo şeması — her consumer için aynı yapı.

### ZORUNLU Schema (Prisma)

```prisma
model ProcessedEvent {
  eventId       String                              // Event UUID
  consumerId    String                              // 'identity:user-created-listener'
  processedAt   DateTime  @default(now())
  resultStatus  String?                              // 'success' | 'skipped' | 'replay'
  resultHash    String?                              // İşlemin output hash'i (debug için, opsiyonel)

  @@id([eventId, consumerId])                       // Composite primary key
  @@index([processedAt])                              // Cleanup query
  @@index([consumerId, processedAt])                  // Per-consumer stats
  @@map("processed_events")
}
```

### ZORUNLU Cleanup
- Cron job: 90 gün öncesi `processedAt < NOW() - INTERVAL '90 days'` → DELETE
- Partition by month (>10M satır beklenirse)

### ZORUNLU Repository Operations
- `exists(eventId, consumerId): Promise<boolean>`
- `markProcessed(eventId, consumerId, options?): Promise<void>`
- `update`, `delete` metodu YOK (cleanup hariç — bu tablo append-only)

### Kanonik Repository

```typescript
@Injectable()
export class ProcessedEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async exists(eventId: string, consumerId: string): Promise<boolean> {
    const row = await this.prisma.processedEvent.findUnique({
      where: { eventId_consumerId: { eventId, consumerId } },
    });
    return row !== null;
  }

  async markProcessed(
    eventId: string,
    consumerId: string,
    options?: { status?: string; resultHash?: string },
  ): Promise<void> {
    await this.prisma.processedEvent.create({
      data: {
        eventId,
        consumerId,
        resultStatus: options?.status ?? 'success',
        resultHash: options?.resultHash,
      },
    });
  }
  // update/delete metodu YOK — append-only
}
```

### YASAK
- Tek key (sadece eventId) — composite şart
- Sınırsız retention (tablo şişer, query yavaşlar)
- Repository'de update/delete metodu (cleanup cron hariç)

### BADI Notu
BADI'de bu tablo fiilen yok. Yeni proje için Day 1'den şema migration ile eklenmeli.

### Cross-Ref
EVT-05 (Idempotent Consumer), Pattern 28 (Idempotency Log Pattern).

---

## Kural 7 (EVT-07) — DLQ Discipline (HIGH)

**Sorumluluk:** Başarısız event'ler kaybolmaz, manuel inceleme/replay edilebilir.

### ZORUNLU
- Her queue'nun DLQ'su var (`{queue}-dlq`)
- `removeOnFail: false` (BullMQ kanonu — DLQ'da kalır)
- DLQ entry metadata: `originalEventId`, `consumerId`, `failureCount`, `lastError` (stack), `firstFailedAt`, `lastFailedAt`, `reason`
- Manuel replay endpoint: `POST /admin/dlq/:queueName/:jobId/replay` (CASL `admin:replayDlq`)
- Audit'li (kim, ne zaman, hangi job, neden replay)

### Failure Sebepleri (`reason` field)
- `max_attempts_exceeded` — retry sayısı aşıldı
- `non_retryable` — 4xx hata, schema mismatch, business rule violation (`UnrecoverableError` throw)
- `consumer_killed` — worker process kapandı (recovery'de pickup)

### ZORUNLU Queue Config

```typescript
const queue = new Queue('domain-events', {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: { age: 86400 },
    removeOnFail: false,  // ← DLQ'da kalır
  },
});
```

### YASAK
- `removeOnFail: true` (event sessizce kaybolur)
- DLQ olmadan deploy
- DLQ entry'leri auth'suz silmek (audit gerekli)
- Manuel replay'de idempotency log'u temizlemek (replay = dedup hâlâ devrede)

### BADI Notu
BADI'de DLQ pattern uygulanmamış. KPS_SECURITY_ANALYSIS.md'de "kayıp event" senaryosu için risk var.

### Cross-Ref
OBS-09 (DLQ Alert eşikleri), EVT-08 (Retry + Backoff), EVT-09 (Manuel replay).

### Enforcement
Hook (gelecek): `new Queue(...)` çağrısında `removeOnFail: true` veya yoksa → CRITICAL.

---

## Kural 8 (EVT-08) — Retry + Exponential Backoff + Jitter (HIGH)

**Sorumluluk:** Transient hatalar otomatik düzelir, thundering herd önlenir.

### ZORUNLU Konfigürasyon

```typescript
const defaultJobOptions = {
  attempts: 5,                                       // job-type'a göre override
  backoff: {
    type: 'exponential',
    delay: 1000,                                     // 1s, 2s, 4s, 8s, 16s
  },
  // BullMQ 5+ otomatik jitter (full jitter strategy)
  removeOnComplete: { age: 86400 },                  // 24 saat sonra sil
  removeOnFail: false,                                // DLQ'da kalır
};
```

### Retryable vs Non-Retryable Ayrımı

| Retryable (RETRY) | Non-Retryable (DLQ'ya direkt) |
|---|---|
| Network error (`ECONNRESET`, `ETIMEDOUT`) | Validation error (4xx) |
| 5xx HTTP hata | Schema mismatch |
| Transient DB lock | Business rule violation |
| Timeout | Idempotency-Key conflict |

### Non-Retryable Error Handling

```typescript
@Process('user.created.v1')
async handle(job: Job) {
  try {
    await this.process(job.data);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof BusinessRuleViolation) {
      throw new UnrecoverableError(error.message);  // BullMQ retry YAPMAZ, direkt DLQ
    }
    throw error;  // Diğer hatalar retry edilir
  }
}
```

### YASAK
- Sabit aralık retry (`{type: 'fixed', delay: 1000}`) → thundering herd
- Sınırsız attempt (`attempts: Infinity`)
- 4xx hatasını retry etmek (boş yere DB/dış servis yükü)
- Jitter'sız exponential (BullMQ 5+ default jitter, override etme)

### BADI Notu
BADI'de retry konfigüre edilmemiş veya tutarsız (BullMQ default kullanılıyor). Yeni proje için tüm queue'larda `defaultJobOptions` zorunlu.

### Cross-Ref
EVT-07 (DLQ Discipline), OBS-08 (Queue Health metric'leri retry attempts'i izler).

### Enforcement
Hook: `new Queue(...)` config'inde `attempts` ve `backoff.type === 'exponential'` zorunlu kontrol.

---

## Kural 9 (EVT-09) — Replay / Backfill Mode (MEDIUM)

**Sorumluluk:** Event'ler güvenle tekrar oynatılabilir — side effect'siz, audit-konsistent.

### ZORUNLU
- Replay edilen event envelope'a `_replay: true` flag konur
- Replay kaynağı: `_replaySource: 'csv-import' | 'db-restore' | 'manual-dlq-replay' | 'projection-rebuild'`
- Consumer replay flag'i okur ve:
  - **Idempotency check yine yapar** (mark processed)
  - **Dış servis çağrıları SKIP** (SMS, email, payment, push notification)
  - **Audit'i tekrar yazmaz** (zaten yazılmış orijinal)
  - **Read model projection update eder** (idempotent — upsert)

### Kanonik

```typescript
@Process('user.created.v1')
async handle(job: Job<EventEnvelope<UserCreatedPayload>>) {
  const isReplay = job.data._replay === true;

  // Always (idempotent — upsert)
  await this.projectionRepo.upsertUserListView(job.data.payload);

  // Skip if replay (side effects)
  if (!isReplay) {
    await this.smsService.sendWelcomeSms(job.data.payload.phone);
    await this.auditOutbox.append({ ... });
  }
}
```

### Backfill Akışı (Operasyonel)

1. Aktif consumer pause: `await queue.pause()`
2. Tüm tarihsel event'lere `_replay: true` + `_replaySource: 'csv-import'` ile outbox'a write
3. Relay worker push eder
4. Consumer process eder (idempotent + side-effect-free)
5. Backfill bittiğinde consumer resume: `await queue.resume()`

### YASAK
- Replay flag olmadan event tekrar publish
- Replay sırasında dış servis çağrısı (SMS, payment double-send)
- Replay'de idempotency log'u temizlemek (dedup hâlâ devrede olmalı)
- `_replaySource` yokken `_replay: true` (kaynak tanımsız → debug imkânsız)

### BADI Notu
BADI'de replay/backfill kavramı yok. Yeni proje için projection rebuild senaryosunda kritik.

### Cross-Ref
EVT-03 (Schema versioning — upcaster ile eski event'leri yeni şemaya çevir), EVT-05 (Idempotency — replay yine dedup'a uyar).

### Enforcement
Hook (gelecek): outbox.append içinde `_replay: true` varsa `_replaySource` da zorunlu kontrol.

---

## Kural 10 (EVT-10) — Tombstone Event (KVKK Unutulma Hakkı — Strateji B Pseudonymization) (CRITICAL)

**Sorumluluk:** KVKK silme talebinde geçmiş event'lerde PII anonimleşir.

### Strateji Kararı: B — Pseudonymization

Brainstorming kararı (spec Bölüm 3.7): **Strateji B (Pseudonymization)** seçildi.
- Operasyonel basitlik (per-user-key service yok)
- Belediye scale'inde (1M kayıt) batch UPDATE yeterli
- KVKK denetiminde "şu alanlar maskelendi" somut açıklama
- Strateji A (Crypto-shredding) forward-looking yedek — gelecekte gerekirse eklenebilir

### ZORUNLU Akış (End-to-End)

```
1. POST /kvkk/forget-me  veya  POST /admin/kvkk/forget/:userId
   ↓
2. ForgetUserCommand → ForgetUserHandler
   ↓
3. Transaction:
   a) User entity: blocked=true, pseudonymized fields
   b) Outbox: user.forgotten.v1 event
   ↓
4. Outbox relay → BullMQ
   ↓
5. Tüm consumer'lar pseudonymize:
   - identity:user-forgotten-listener
   - randevu-sistemi:user-forgotten-listener
   - sosyal-yardim:user-forgotten-listener
   - vatandas-kayit:user-forgotten-listener
   - audit:user-forgotten-listener (KVKK-03: satır SİLİNMEZ, sadece pseudonymize)
   - outbox:user-forgotten-listener (geçmiş event payload'larında PII pseudonymize)
```

### Kanonik — Command + Handler

```typescript
// features/identity/application/commands/forget-user.command.ts
export class ForgetUserCommand extends BaseCommand {
  @IsUUID() readonly userId!: string;
  @IsIn(['user_request', 'admin_action', 'court_order']) readonly reason!: ForgetReason;
}

// features/identity/application/handlers/forget-user.handler.ts
@CommandHandler(ForgetUserCommand)
export class ForgetUserHandler {
  async execute(cmd: ForgetUserCommand): Promise<void> {
    return this.uow.transaction(async () => {
      const user = await this.uow.users.findById(cmd.userId);
      if (!user) throw new NotFoundException('Kullanici bulunamadi');

      const pseudonym = `[REDACTED-${cmd.userId.slice(0, 8)}]`;
      user.pseudonymize(pseudonym);
      user.block('kvkk_forgotten');
      await this.uow.users.update(user);

      await this.uow.outbox.append(this.envelopeBuilder.build({
        eventType: 'user.forgotten.v1',
        eventVersion: 1,
        source: 'identity',
        causationId: cmd.commandId,
        payload: {
          userId: cmd.userId,
          tcKimlikNo: user.originalTcKimlikNo,
          forgottenAt: new Date().toISOString(),
          requestedBy: cmd.requesterId,
          reason: cmd.reason,
          pseudonym,
        },
      }));
    });
  }
}
```

### Kanonik — Audit Listener Pattern

```typescript
@Process('user.forgotten.v1')
async handleUserForgotten(job: Job<EventEnvelope<UserForgottenPayload>>) {
  await this.processOnce(job, async (env) => {
    const { tcKimlikNo, pseudonym } = env.payload;
    // Audit log içinde PII pseudonymize — satır SİLİNMEZ (KVKK-03 + AUDIT-03)
    await this.prisma.$executeRaw`
      UPDATE audit_log
      SET payload = jsonb_set(payload, '{tcKimlikNo}', ${`"${pseudonym}"`}::jsonb)
      WHERE payload->>'tcKimlikNo' = ${tcKimlikNo}
    `;
  });
}
```

### KVKK Denetim Sorgusu

```sql
-- "X TC kimlik'in verisi nasıl anonimleştirildi?"
SELECT entity_id, action, created_at, payload->>'tcKimlikNo' AS value
FROM audit_log
WHERE entity_id = '<userId>'
ORDER BY created_at;
-- Beklenen: pseudonymize öncesi gerçek TC, sonrası [REDACTED-xxxxxxxx]
```

### YASAK
- `prisma.auditLog.delete()` — KVKK-03 ile AUDIT-03 ikisi de silmeyi yasaklar
- Pseudonymize öncesi PII'yi log'a yazmak (zaten audit içinde, ek log şart değil)
- Strateji A (crypto-shredding) eklemek — şu an karar B (gelecek brainstorming gerekli)
- Pseudonymize edilemeyen alanları (örn. `name` "Mehmet" gibi) AT olduğu gibi bırakmak — `name` da pseudonymize edilir

### BADI Notu
BADI'de KVKK silme akışı tanımsız. Audit immutability (AUDIT-03) Kural 7.3'te var ama unutulma hakkı (KVKK-03) Kural 20.3'te genel terms ile — concrete pattern yok.

### Cross-Ref
[`IRON_RULES_BACKEND.md` → Kural 20.3 (KVKK-03)](./IRON_RULES_BACKEND.md), [Kural 7.3 (AUDIT-03)](./IRON_RULES_BACKEND.md), Pattern 30 (Tombstone Event Pattern — Strateji B).

### Enforcement
- AST: `prisma.auditLog.update/delete` doğrudan çağrısı (audit-log-forgotten-listener hariç) → CRITICAL (T14)
- Hook: ForgetUserCommand olmadan KVKK endpoint deploy → smoke test fail

---

## Kural 11 (EVT-11) — ACL Event Boundary (HIGH)

**Sorumluluk:** Dış sistemden gelen event'ler (webhook'lar) **vendor şemasıyla** publish edilmez. ACL içinde domain konseptine çevrilir.

### ZORUNLU
- ACL'ın publish ettiği event'ler **domain konseptleri**
- Webhook payload'ı domain event payload'ına direkt yazılmaz — ACL içinde çevrilir
- Event type isimleri: `payment.received.v1` (ZORUNLU) — `stripe.charge.succeeded` (YASAK)

### Kanonik

```typescript
@Controller('webhooks')
export class PaymentWebhookController {
  constructor(
    @Inject(PAYMENT_PROVIDER_CONTRACT)
    private readonly payment: IPaymentProviderContract,
  ) {}

  @Post('payment')
  async handleWebhook(@Body() vendor: unknown, @Headers() headers: Record<string, string>) {
    // 1. ACL içinde webhook signature verify + parse + translate
    const domainEvent = await this.payment.translateWebhook(vendor, headers);

    // 2. Outbox'a domain event yaz
    await this.uow.transaction(async () => {
      await this.uow.outbox.append(this.envelopeBuilder.build({
        eventType: domainEvent.type,            // 'payment.received.v1'
        eventVersion: domainEvent.version,
        source: 'shared/external/banka-pos',    // ACL kendisini source belirtir
        payload: domainEvent.payload,
      }));
    });

    return { received: true };  // Webhook ack
  }
}
```

### YASAK
- Webhook payload'ını doğrudan event olarak publish (`publish({ eventType: 'stripe.webhook', payload: req.body })`)
- Vendor event isimleri domain'de (`event.kps.queryAddress.completed`)
- ACL bypass: webhook controller doğrudan handler'ı tetiklesin (event/outbox atlanır)

### BADI Notu
BADI'de webhook controller yok. Gelecekte banka POS veya e-Devlet webhook'ları için bu kural Day 1 zorunlu.

### Cross-Ref
EVT-00 (Karar Matrisi — ACL maddesi), Pattern 31 (ACL — 8 sorumluluk), OBS-12 (ACL Observability).

### Enforcement
PR review: webhook controller'da `outbox.append` çağrısı doğrudan vendor payload ile yapılırsa → reviewer fix.

---

## Kural 12 (EVT-12) — Saga / Process Manager (forward-looking, MEDIUM)

**Sorumluluk:** Multi-step asenkron iş akışı için **state machine** disiplini.

### ZORUNLU (Saga eklendiğinde)
1. **State entity'sinde saklanır** — hafızada DEĞİL (process restart'ta kayıp olmamalı)
2. **Her state geçişi event publish eder** (audit trail)
3. **Compensation handler her forward transition için tanımlı**
4. **Timeout zorunlu** (örn. 7 gün, sonra auto-fail + compensation)
5. **Saga ASLA senkron orchestrate edilmez** (Saga = uzun süreli iş, dakikalar/günler)

### Forward-Looking Schema İskeleti

```prisma
model SagaInstance {
  id              String   @id @default(uuid())
  sagaType        String                                    // 'RandevuOnayWorkflow'
  aggregateId     String                                    // Hangi entity (örn. randevuId)
  state           String                                    // saga-specific enum
  currentStep     Int      @default(0)
  startedAt       DateTime @default(now())
  expiresAt       DateTime                                  // Timeout deadline (örn. 7 gün)
  completedAt     DateTime?
  failedAt        DateTime?
  failureReason   String?
  transitions     Json     @default("[]")                   // [{from, to, at, by, event}]
  compensations   Json?                                     // hangi compensation tetiklendi
  metadata        Json?

  @@index([sagaType, state])                                // "Bekleyen randevu sagaları"
  @@index([expiresAt])                                       // Timeout cron
  @@index([aggregateId])                                     // "Bu randevunun sagası var mı"
  @@map("saga_instances")
}
```

### Forward-Looking Pattern İskeleti

```typescript
// shared/messaging/domain/saga.base.ts
export abstract class SagaBase<TState extends string> {
  protected abstract readonly sagaType: string;
  protected abstract readonly initialState: TState;
  protected abstract readonly terminalStates: ReadonlySet<TState>;
  protected abstract readonly timeoutMs: number;

  protected abstract handleEvent(
    state: TState,
    event: EventEnvelope,
  ): Promise<{ nextState: TState; commandToDispatch?: ICommand } | null>;

  protected abstract compensate(state: TState): Promise<void>;
  protected abstract onTimeout(): Promise<void>;
}
```

### YASAK (Saga eklendiğinde)
- In-memory state (process restart = kayıp)
- Compensation tanımlamadan saga başlatmak
- Timeout'suz saga (consumer ölürse saga sonsuza kadar pending)
- Sync orchestration (uzun süreli iş senkron olamaz)

### YAGNI Uyarısı
Şu an saga implement edilmiyor. Manuel onay süreci, çok adımlı para işlemi, batch işlem eklendiğinde **bu çerçeveye uyacak**.

### BADI Notu
BADI'de saga pattern yok. Yeni proje için forward-looking — sadece şema + base class iskelet hazır.

### Cross-Ref
EVT-00 (Karar Matrisi — Saga maddesi 4. yöntem).

### Enforcement
Forward-looking — saga implement edildiğinde hook'lar eklenir (SagaBase extend zorunlu, timeout zorunlu, vb.).

---

## Karar Matrisi (EVT-00 Tekrarı — Hızlı Referans)

| Senaryo | Yöntem | Konum | Karakter |
|---|---|---|---|
| Senkron pre-condition | Shared Interface Contract | `shared/<concern>/domain/I*.contract.ts` | In-process, aynı request, aynı transaction |
| Senkron dış sistem çağrısı | ACL Pattern | `shared/external/<vendor>/` | HTTP/SOAP/RPC, 8 sorumluluk (Pattern 31) |
| Asenkron fan-out | BullMQ Domain Event (Outbox) | `shared/messaging/` | Fire-and-forget, eventually consistent |
| Multi-step asenkron iş | Saga / Process Manager | feature içinde state entity | Uzun süreli, compensation (forward-looking) |

---

## Anti-Pattern Cataloğu (BADI Satırlarına Link)

| Anti-Pattern | BADI Konum | Hangi Kural |
|---|---|---|
| Vendor service direkt inject | `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-identity.handler.ts:33` | EVT-00, Pattern 31 |
| Cross-feature entity import | `verify-identity.handler.ts:19` | EVT-00 |
| Cross-feature repository import | `verify-identity.handler.ts:22` | EVT-00 |
| Vendor şeması domain'de | `verify-identity.handler.ts:113-117` | EVT-00 |
| Vendor kodu hardcoded | `verify-identity.handler.ts:110-111` (iki dosyada) | EVT-00, CFG-02 |
| Senkron audit | `verify-identity.handler.ts:224` | Kural 7.2, OBS-01, EVT-04 |
| Fire-and-forget Promise (welcome SMS) | `verify-sms.handler.ts:148-156` | EVT-04, EVT-08 |
| forwardRef coupling | `D:\BADI\badi\backend\src\features\formlar\public\public.module.ts:80-84` | EVT-00.4 |
| Duplicate KPS validation (290+143 satır) | `verify-identity.handler.ts` + `D:\BADI\badi\backend\src\features\randevu-sistemi\yonetici\application\handlers\verify-kps-external.handler.ts` | EVT-00, Pattern 31 |

---

## Schema Versioning Geçiş Rehberi (Operasyonel Playbook)

Detay: Pattern 29 (T8).

**Özet 4 Faz:**
1. **Hazırlık:** Yeni payload type + yeni eventType + test yaz.
2. **Dual Publish:** Producer hem v1 hem v2 emit eder.
3. **Consumer Migration:** Her consumer ayrı PR, v2 listener ekle, v1 `@Deprecated`.
4. **Cleanup:** Tüm consumer'lar v2'ye geçtikten sonra v1 silinir.

---

## Saga Rehberi (Forward-Looking — Boş)

Saga şu an YAGNI (EVT-12 çerçevesi hazır). Manuel onay süreci, çok adımlı para işlemi veya batch işlem akışı eklendiğinde bu rehber doldurulacak.

İlk saga eklenecek senaryolar (tahmini öncelik sırasıyla):
- Randevu iptal → ödeme iade → bildirim
- Sosyal yardım başvuru inceleme (memur manuel onay)
- Toplu randevu oluşturma (batch)

---

## Cross-Reference Index (Detaylı)

| Konu | Bu Dosyada | Diğer Dosyalarda |
|---|---|---|
| Cross-feature iletişim | EVT-00 | Mimari Değişmez #1 (ARCHITECTURE.md), Pattern 16, Pattern 31 |
| Envelope | EVT-01 | Pattern 32 (OTel merge), OBS-05 |
| Causation/Correlation | EVT-02 | OBS-05, Pattern 32 |
| Schema versioning | EVT-03 | Pattern 29, EVT-09 (upcaster) |
| Outbox | EVT-04 | Kural 6.3 (TXN-03), Pattern 22, OBS-07 |
| Idempotency | EVT-05, EVT-06 | Pattern 28 |
| DLQ | EVT-07 | OBS-09, OBS-08 |
| Retry | EVT-08 | OBS-08 (metric), JOB-03 (circuit breaker) |
| Replay | EVT-09 | EVT-03 (upcaster), EVT-05 (dedup) |
| KVKK Tombstone | EVT-10 | Kural 20.3 (KVKK-03), Kural 7.3 (AUDIT-03), OBS-01 (PII), Pattern 30 |
| ACL Event Boundary | EVT-11 | EVT-00, Pattern 31, OBS-12 |
| Saga | EVT-12 | EVT-00 (4. yöntem) |
