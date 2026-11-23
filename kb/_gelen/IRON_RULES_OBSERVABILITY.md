# W0NDERSUPERIOR Demir Kuralları — Observability

> **Kapsam:** Logger / Audit / Metric / Health / Tracing / FE Observability / ACL Observability disiplini.
> Cross-feature event mekaniği için: [`IRON_RULES_EVENTS.md`](./IRON_RULES_EVENTS.md).
> Backend genel kuralları için: [`IRON_RULES_BACKEND.md`](./IRON_RULES_BACKEND.md).

## Cross-Reference Index

| ID | Kural | Cross-ref |
|---|---|---|
| OBS-01 | 3-Stream Log Discipline (Logger/Audit/SecurityEvent) | Kural 7 (Audit), Kural 8.1 (PII) |
| OBS-02 | Log Level Matrix | OBS-01 |
| OBS-03 | Olay → Kanal Karar Matrisi | OBS-01, EVT-04 |
| OBS-04 | Health Checks (live/ready) | — |
| OBS-05 | Request Context + OpenTelemetry | EVT-01, EVT-02 |
| OBS-06 | Metric Discipline | OBS-03 |
| OBS-07 | Outbox Observability | EVT-04, EVT-06 |
| OBS-08 | Queue Health Observability | EVT-07 |
| OBS-09 | DLQ Alert | EVT-07, OBS-08 |
| OBS-10 | Read Model / Projection Lag (forward-looking) | EVT-09 |
| OBS-11 | Frontend Observability | OBS-05 |
| OBS-12 | External Service (ACL) Observability | EVT-00, EVT-11, Pattern 31 |

---

## Kural 1 (OBS-01) — 3-Stream Log Discipline (CRITICAL)

**Sorumluluk:** PII'li veri her zaman 3 ayrı stream'e gider. Tek "log" disiplini YOK.

### ZORUNLU

| Stream | PII | Hedef | Retention | Erişim |
|---|---|---|---|---|
| **Logger** (operasyonel) | MASKELİ | Pino → Loki | 30 gün | Tüm developer |
| **Audit Log** (yasal kayıt) | AÇIK | Outbox → AuditLog tablosu (WORM/RLS) | 10 yıl (KVKK) | `audit:read` izniyle |
| **Security Event Log** | KISMI MASK (son 4 hane) | SIEM (Splunk/ELK) | 2 yıl | SOC + `audit:read` |

### YASAK

```typescript
// ❌ YASAK — Logger'a açık PII
this.logger.info('User login', { tcKimlik: '12345678901', phone: '5551234567' });

// ❌ YASAK — Senkron audit yazımı (Kural 7.2 ihlali)
await this.prisma.auditLog.create({ data: { ... } });

// ❌ YASAK — Üçünü tek tablo/stream yapmak
```

### Kanonik

```typescript
// Logger — Pino, PII maskeli
this.logger.info('Citizen verified', {
  tcKimlik: tc.toMasked(),                        // '123****8901'
  purpose: 'register',
});

// Audit — Outbox üzerinden async (Kural 6.3 + 7.2)
await this.uow.outbox.append({
  eventType: 'audit.log',
  payload: {
    entityType: 'CitizenVerification',
    action: 'query',
    actorId: requesterId,
    body: { tcKimlik: tc.toString() },             // AÇIK — KVKK 8. madde yasal kayıt
  },
});

// Security Event — partial mask
await this.securityEventProducer.publish({
  eventType: 'security.kps_query',
  payload: {
    tcKimlik: PiiMaskingHelper.maskKeepLast(tc.toString(), 4),  // '*******8901'
    ipAddress: req.ip,
  },
});
```

### BADI Negatif Örnek

- `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-identity.handler.ts:224` — `await this.audit.recordDataChange(...)` **senkron Prisma çağrısı**, outbox üzerinden değil. Kural 7.2 ihlali.

### Cross-Ref

- Kural 6.3 (Outbox), Kural 7.2 (Async Audit), Kural 8.1 (PII Discipline)
- OBS-02 (Log Level), OBS-03 (Karar Matrisi)
- EVT-04 (Outbox Producer), EVT-10 (Tombstone)

### Enforcement

`iron-rules-check.js` — `prisma.auditLog.create` doğrudan çağrı = CRITICAL block (AUDIT-03'ün genişletmesi).

## Kural 2 (OBS-02) — Log Level Matrix (HIGH)

**Sorumluluk:** Hangi level ne zaman, structured logging.

### ZORUNLU Tablo

| Level | Kullanım | Production'da | Alert |
|---|---|---|---|
| `fatal` | Process kapatacak (DB down, config eksik) | EVET | + page |
| `error` | İşlem başarısız + exception (5xx) | EVET | + alert |
| `warn` | Başarılı ama dikkat (deprecation, fallback, 4xx, retry) | EVET | — |
| `info` | Önemli iş olayı (CUD, login, payment) | EVET | — |
| `debug` | Geliştirici (payload, query) | HAYIR | — |
| `trace` | Çok detaylı (her fonksiyon adımı) | HAYIR | — |

### ZORUNLU
- Structured logging (object payload)
- Production'da `info` ve üstü yayınlanır
- `debug` ASLA production'a sızmaz (env-based filter + `LOG_LEVEL=info`)
- Pino logger kullanılır (NestJS default Logger değil — ARCHITECTURE.md Tech Stack)

### YASAK

```typescript
// ❌ String interpolation
this.logger.log(`User ${user.name} created entity ${entity.id}`);

// ❌ console.* — Pino zorunlu
console.log('debug info');
console.error('error');
```

### Kanonik

```typescript
this.logger.info('Entity created', { userId, entityId, action: 'create' });
this.logger.warn('Retry attempt', { attempt: 2, maxAttempts: 3, errorCode: 'ECONNRESET' });
this.logger.error('External service failure', { service: 'kps', durationMs, errorCode });
```

### BADI Notu

BADI'de `this.logger.log(...)` kullanılıyor (örn. `verify-identity.handler.ts:51`) ama **level seçimi tutarsız** — burada `info` daha uygun olurdu.

### Cross-Ref

OBS-01 (3-Stream), OBS-03 (Karar Matrisi).

### Enforcement

ESLint rule (template literal logger argümanı = error) + `iron-rules-check.js` `console.*` block.

## Kural 3 (OBS-03) — Olay → Kanal Karar Matrisi (CRITICAL)

**Sorumluluk:** Her olay tipi sabit bir kanala gider. Custom davranış PR'da gerekçe ister.

### ZORUNLU Matris

| Olay Tipi | Logger | Audit | Metric | Security Event |
|---|---|---|---|---|
| Domain Mutation (CUD) | `info` | ✅ ZORUNLU | counter++ | — |
| Security Event (login, logout, password reset, role change) | `info` | ✅ ZORUNLU | counter++ | ✅ |
| Authorization Failure (403) | `warn` | — | counter++ | ✅ |
| Validation Failure (400) | `debug` | — | counter++ | — |
| System Error (500) | `error` (stack) | — | counter++ | + alert |
| External API Call | `debug` (req) / `error` (fail) | — | duration histogram | — |
| BullMQ Job | `info` (start) / `error` (fail) | — | duration + failure | — |
| Cache Hit/Miss | — | — | counter++ | — |
| Rate Limit Ban | `warn` | ✅ | counter++ | ✅ |
| External Service Circuit Open | `error` | — | gauge=1 | + alert |

### YASAK

- ❌ Handler'ın **kendi yorumunu** yapması — matris bağlayıcı, custom davranış için PR gerekçesi şart
- ❌ Bir olayı aynı anda hem audit hem detailed log yapmak (Kural 7 CUD için audit yeter, log info seviyesi)
- ❌ Cache miss'i `info` log yazmak (cardinality patlaması)

### BADI Negatif Örnek

- BADI handler'ları kendi yorumlarını yapıyor — `verify-identity.handler.ts` KPS sorguyu hem audit hem log ediyor (CUD değil); başka handler'lar audit yapıyor ama metric yok.

### Cross-Ref

OBS-01, OBS-02, OBS-06 (Metric), EVT-04 (Outbox — audit channel mechanics).

### Enforcement

Soft (review-time checklist). PR template'inde "olay tipi → seçilen kanal" alanı zorunlu — reviewer matrisi doğrular.

## Kural 4 (OBS-04) — Health Checks (HIGH)

**Sorumluluk:** Liveness vs Readiness ayrı endpoint, load balancer doğru endpoint'i çağırır.

### ZORUNLU
- `/health/live` — "Process ayakta mı?" — sadece 200 return + uptime
- `/health/ready` — "Trafik kabul edebilir mi?" — DB + Redis + zorunlu bağımlılıklar
- `@Public()` + `@SkipPolicies()` (load balancer auth'a sahip değil)
- `@nestjs/terminus` kullan (manual implementation YASAK)

### Dış Servis Health Check Politikası
- KPS, SMS gibi dış servisler `/ready` check'ine **dahil edilmez**
- Bunların down'u uygulamanın trafiği reddetmesine sebep olmamalı
- Circuit breaker (Pattern 31 S5) bu durumu yönetir, health check değil

### Kanonik

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get('live')
  @Public()
  @SkipPolicies()
  live() {
    return { status: 'up', uptime: process.uptime() };
  }

  @Get('ready')
  @Public()
  @SkipPolicies()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
```

### YASAK
- ❌ Tek `/health` endpoint (liveness vs readiness farkı kritik — k8s liveness restart, readiness sadece trafik kapatır)
- ❌ Health check'te dış API çağrısı (KPS down → tüm prod down olur)
- ❌ Auth gerektiren health endpoint (load balancer çağıramaz)
- ❌ Health check içinde ağır query (DB ping yeterli, COUNT(*) yapmak yasak)

### Cross-Ref

Kural 10.3 (önceki yapıda, taşınıyor). Pattern 31 (ACL — circuit breaker dış servis sağlığını yönetir).

---

## Kural 5 (OBS-05) — Request Context + OpenTelemetry (CRITICAL)

**Sorumluluk:** Tek bir trace ID HTTP→Handler→Outbox→BullMQ→Consumer→Cross-service zincirinin uçtan uca akar.

### ZORUNLU
- **Middleware** (NestJS Interceptor değil) request lifecycle başında `AsyncLocalStorage` başlatır
- `x-request-id`, `x-correlation-id`, `traceparent` (W3C Trace Context) header'ları okur
- OpenTelemetry **auto-instrumentation** açık: `@opentelemetry/sdk-node` + http + nestjs-core + bullmq + pino + ioredis
- Domain event envelope'a `correlationId` ve `traceparent` request context'ten otomatik konur (EnvelopeBuilder)
- Pino formatter her log satırına `requestId`, `correlationId`, `traceId`, `spanId` otomatik inject eder

### YASAK
- ❌ Manuel `crypto.randomUUID()` ile correlationId üretmek (OTel zaten yapıyor)
- ❌ NestJS Interceptor'da context başlatmak (middleware'den önce çalışmaz)
- ❌ OTel SDK olmadan manuel header propagation

### Kanonik

```typescript
// shared/observability/request-context/request-context.middleware.ts
import { trace, context } from '@opentelemetry/api';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const activeSpan = trace.getActiveSpan();
    const spanContext = activeSpan?.spanContext();

    const ctx: ReqContext = {
      requestId: (req.headers['x-request-id'] as string) ?? randomUUID(),
      correlationId:
        (req.headers['x-correlation-id'] as string) ??
        spanContext?.traceId ??
        randomUUID(),
      traceparent: (req.headers['traceparent'] as string) ?? this.buildTraceparent(spanContext),
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
      ip: req.ip,
      method: req.method,
      path: req.path,
      startedAt: Date.now(),
    };

    requestContext.run(ctx, () => next());
  }

  private buildTraceparent(sc?: { traceId: string; spanId: string }): string | undefined {
    if (!sc) return undefined;
    return `00-${sc.traceId}-${sc.spanId}-01`;
  }
}
```

### BADI Negatif Örnek
- `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-identity.handler.ts` — OTel auto-instrument yok, manuel correlationId hiç ele alınmıyor (correlationId field hiç kullanılmıyor handler boyunca).

### Cross-Ref
EVT-01 (Event Envelope), EVT-02 (Causation/Correlation), Pattern 32 (OTel ↔ Correlation Merge).

### Enforcement
Hook → `crypto.randomUUID()` ile `correlationId` set eden handler = WARN (gelecek hook eklemesi).

---

## Kural 6 (OBS-06) — Metric Discipline (HIGH)

**Sorumluluk:** Her domain mutation/external API/job metric üretir. Cardinality patlaması yasak.

### ZORUNLU
- **Naming:** `<domain>.<action>.<measurement>` (Prometheus convention)
- Her **Domain Mutation** → `counter++` (örn. `appointment.created_total`)
- Her **External API** → duration histogram (örn. `kps.verify.duration_ms`)
- Her **BullMQ Job** → duration histogram + failure counter
- **Label'lar sınırlı set:** `feature`, `result`, `status` OK

### YASAK
- ❌ **Yüksek cardinality label:** `userId`, `tcKimlik`, `email` label YASAK (Prometheus memory patlar)
- ❌ Counter yerine string log ("3 randevu yaratıldı") — agregasyon imkânsız
- ❌ Metric'i `info` log'a yazıp orada bırakmak — Prometheus okuyamaz

### Kanonik

```typescript
this.metrics.counter('appointment.created_total', { feature: 'randevu-sistemi' }).inc();
this.metrics.histogram('kps.verify.duration_ms', { result: 'verified' }).observe(durationMs);
this.metrics.gauge('outbox.unflushed_count').set(unflushedCount);
```

### Alert Kanonu
- `rate(http_requests_total{status=~"5.."}[5m]) > 0.05` → 500 oranı %5+
- `kps.circuit.state == 1` → KPS circuit açıldı
- `outbox.unflushed_count > 1000` → outbox birikti

### BADI Negatif Örnek
- BADI'de Prometheus metric tanımları yok (sadece `prom-client` paketi ARCHITECTURE.md'de bahsedilmiş, fiili kullanım yok). KPS sorguları audit'leniyor ama duration histogram yok.

### Cross-Ref
OBS-03 (Karar Matrisi), OBS-07 (Outbox), OBS-08 (Queue), OBS-12 (ACL Observability).

### Enforcement
Soft (review-time): PR template'inde "yeni domain mutation eklendi mi? Metric counter eklendi mi?" sorusu zorunlu.

---

## Kural 7 (OBS-07) — Outbox Observability (CRITICAL)

**Sorumluluk:** Outbox tablosu sessizce birikmesin / relay worker ölmesin.

### ZORUNLU Metrics
- `outbox.unflushed_count` (gauge) — kaç satır henüz BullMQ'ya push edilmemiş
- `outbox.oldest_unflushed_age_seconds` (gauge) — en eski bekleyenin yaşı
- `outbox.flush_duration_ms` (histogram) — relay worker tek tur süresi
- `outbox.flush_failures_total` (counter) — relay başarısızlık sayısı

### ZORUNLU Alert
- `outbox.unflushed_count > 1000` → P2 (notify)
- `outbox.oldest_unflushed_age_seconds > 300` → P1 (5 dk bekleyen = relay worker ölü demek)
- `rate(outbox.flush_failures_total[5m]) > 0.1/min` → P1

### YASAK
- ❌ Outbox yazıp metric'ini ölçmemek (silent fail riski — relay worker öldü mü bilinmez)

### Kanonik

```typescript
// shared/messaging/infrastructure/outbox-relay.worker.ts
private async tick(): Promise<void> {
  const start = Date.now();
  try {
    const rows = await this.prisma.outbox.findMany({ /* ... */ });
    for (const row of rows) await this.dispatch(row);

    const stats = await this.prisma.outbox.aggregate({
      _count: { _all: true },
      _min: { createdAt: true },
      where: { dispatchedAt: null },
    });
    this.metrics.gauge('outbox.unflushed_count').set(stats._count._all);
    if (stats._min.createdAt) {
      const ageSec = (Date.now() - stats._min.createdAt.getTime()) / 1000;
      this.metrics.gauge('outbox.oldest_unflushed_age_seconds').set(ageSec);
    }
  } finally {
    this.metrics.histogram('outbox.flush_duration_ms').observe(Date.now() - start);
  }
}
```

### BADI Negatif Örnek
- BADI'de outbox pattern fiili olarak hiçbir handler'da kullanılmıyor (T5 referansı: `verify-sms.handler.ts:148-156` welcome SMS fire-and-forget Promise — bu outbox değil).

### Cross-Ref
EVT-04 (Outbox Producer), Kural 6.3 (TXN-03, mevcut).

### Enforcement
Hook (gelecek): outbox tablosu yazımı + relay worker olmadığında WARN.

---

## Kural 8 (OBS-08) — Queue Health Observability (HIGH)

**Sorumluluk:** Her BullMQ queue'nun sağlık göstergeleri Prometheus'ta görünür.

### ZORUNLU Metrics (her BullMQ queue için)
- `bullmq.queue.depth` (gauge) — bekleyen job sayısı
- `bullmq.queue.oldest_waiting_age_seconds` (gauge) — en eski bekleyenin yaşı
- `bullmq.worker.concurrency_utilization` (gauge) — kullanılan / toplam concurrency oranı
- `bullmq.job.duration_ms` (histogram) — job süresi
- `bullmq.job.failures_total` (counter) — başarısızlık

### Kanonik (BullMQ + OTel auto-instrument)

```typescript
import { BullMQOtel } from 'bullmq-otel';

const queue = new Queue('domain-events', { /* ... */ });
new BullMQOtel(queue);  // ← Tek satır, hepsi otomatik
```

### YASAK
- ❌ Manuel metric instrumentation (BullMQOtel zaten yapıyor — tekrar etme)
- ❌ Queue depth'i log'a yazıp Prometheus'a yazmamak (Prometheus aggregate edemez)

### BADI Negatif Örnek
- BADI'de BullMQ kullanılıyor (audit + emails queue) ama queue health metric'i yok — Redis Commander manuel görüntüleme tek kanal.

### Cross-Ref
EVT-07 (DLQ Discipline), OBS-09 (DLQ Alert), Pattern 32 (OTel auto-instrument).

### Enforcement
Hook (gelecek): yeni `new Queue(...)` çağrısı varsa `new BullMQOtel(...)` eşliği bekle.

---

## Kural 9 (OBS-09) — DLQ Alert (HIGH)

**Sorumluluk:** DLQ'ya düşen her event görünür ve alertli — kayıp event tolere edilemez.

### ZORUNLU
- DLQ'ya düşen her job → `securityEventProducer.publish({ eventType: 'system.dlq_job', payload: { queue, jobId, reason, lastError } })`
- DLQ size monitor: `bullmq.dlq.size` (gauge)
- Manuel replay endpoint: `POST /admin/dlq/:queueName/:jobId/replay` (CASL `admin:replayDlq`)
- Replay endpoint **audit'li** (kim, ne zaman, hangi job, neden replay)

### ZORUNLU Alert Eşikleri
- `bullmq.dlq.size > 0` → P3 (her DLQ job dikkat — incelemeye gir)
- `bullmq.dlq.size > 10` → P2 (manuel inceleme şart — sistemik sorun)
- Yeni DLQ entry hızı > 1/min → P1 (sistem patlamış — derhal incident)

### YASAK
- ❌ DLQ'yu sessizce büyütmek (alert yok, dashboard yok)
- ❌ DLQ entry'leri otomatik silmek (manuel inceleme şart, audit gerekir)
- ❌ Replay endpoint'i auth'suz açmak

### Kanonik

```typescript
// shared/messaging/infrastructure/dlq-listener.ts
@Injectable()
export class DlqListener {
  @OnQueueFailed({ queueName: 'domain-events' })
  async onFailed(job: Job, error: Error) {
    if (job.attemptsMade >= job.opts.attempts!) {
      // DLQ'ya gidiyor — security event publish
      await this.securityEvents.publish({
        eventType: 'system.dlq_job',
        payload: {
          queue: 'domain-events',
          jobId: job.id,
          eventType: job.name,
          reason: 'max_attempts_exceeded',
          lastError: error.message,
        },
      });
      this.metrics.gauge('bullmq.dlq.size', { queue: 'domain-events' }).inc();
    }
  }
}
```

### BADI Negatif Örnek
- BADI'de DLQ pattern fiilen uygulanmamış — `failed` job'lar BullMQ'da `removeOnFail` default'una göre işleniyor, alert yok.

### Cross-Ref
EVT-07 (DLQ Discipline), OBS-08 (Queue Health).

### Enforcement
Hook (gelecek): `new Queue(...)` çağrısında `removeOnFail: false` zorunlu — hook ekleyebilir.

---

## Kural 10 (OBS-10) — Read Model / Projection Lag (forward-looking, HIGH)

**Sorumluluk:** CQRS read model eklendiğinde **lag observable** olmalı — eventual consistency'nin gerçek değeri görünür.

### ZORUNLU (read model varsa)
- Her projection update'i → `projection.<name>.lag_seconds` (gauge veya histogram)
  - `lag = now() - event.timestamp` event handler içinde hesapla
- Alert: `projection.<name>.lag_seconds > 30` → P2 (read model 30 sn'den fazla geride)
- Alert: `projection.<name>.lag_seconds > 300` → P1 (5 dk geri = handler ölü veya event akışı bozuk)

### YASAK (read model eklendiğinde)
- ❌ Projection lag metric'i yazmamak — gözlem olmadan eventual consistency güvenilemez
- ❌ Projection'ı senkron handle etmek — event-driven değil CQRS değil
- ❌ Read model'i write store'la aynı transaction'da güncellemek (CQRS amacını bozar)

### Kanonik

```typescript
@Process('appointment.created.v1')
async handleAppointmentCreated(job: Job<EventEnvelope<AppointmentCreatedPayload>>) {
  // Idempotency check (EVT-05)
  if (await this.processedEvents.exists(job.data.eventId, this.consumerId)) return;

  // Lag hesabı
  const lagSeconds = (Date.now() - new Date(job.data.timestamp).getTime()) / 1000;
  this.metrics.histogram('projection.appointment_list.lag_seconds').observe(lagSeconds);

  // Projection update (idempotent — upsert)
  await this.projection.upsert(job.data.payload);

  // Mark processed
  await this.processedEvents.markProcessed(job.data.eventId, this.consumerId);
}
```

### Forward-Looking Uyarı
Read model şu an YAGNI — eklenirse bu kural **otomatik bağlayıcı**. Implementation eklendiğinde sadece concrete projection class'ları yazılır; lag metric IdempotentConsumerBase helper içinde otomatik gelir (sonraki iterasyonda).

### BADI Notu
BADI'de CQRS read tarafı yok (Pragmatic CQRS — read = query, write = command, same DB). Bu kural gerçek CQRS'e geçildiğinde aktive olur.

### Cross-Ref
EVT-09 (Replay/Backfill — projection rebuild senaryosu), EVT-05 (Idempotency).

### Enforcement
Forward-looking — projection eklendiğinde hook AST ile `@Process` + `projection.upsert` desenini bulup `projection.*.lag_seconds` metric'i bekleyecek.

---

## Kural 11 (OBS-11) — Frontend Observability (HIGH)

**Sorumluluk:** Frontend'de 3 ayrı kanal — kullanıcıya, geliştiriciye, production telemetry'sine. Tek "logger.ts" yasak.

### ZORUNLU 3 Kanal

```typescript
// 1. User-facing — toast (kullanıcıya görünür)
import { toast } from 'sonner';
toast.error('İşlem başarısız oldu');
toast.success('Randevu oluşturuldu');

// 2. Developer dev/staging — devLog
import { devLog } from '@/shared/lib/dev-log';
devLog.debug('Form submit', { values });  // production'da no-op (tree-shaken)

// 3. Production telemetry — Sentry
import { Sentry } from '@/shared/lib/sentry';
Sentry.captureException(error, { tags: { feature: 'randevu' }});
Sentry.captureMessage('Critical UI flow broken', 'warning');
```

### YASAK
- ❌ `console.*` (ESLint enforce — production bundle'a sızması production hatası)
- ❌ Tek "logger.ts" generic isim — amaç açık olsun (`dev-log.ts`, `sentry-client.ts`, `user-toast.ts` ayrı dosyalar)
- ❌ Production bundle'a `devLog` sızması (build config + tree-shake doğrulamalı)
- ❌ Sentry'ye PII fragmentı (`tcKimlik`, `email`) — `beforeSend` hook ile filtrele

### Trace Propagation
- `apiFetch` her isteğe `traceparent` (W3C) header'ı ekler
- Backend OTel ile birleşir → tek trace ID FE → BE → DB → BullMQ

```typescript
// shared/lib/api-fetch.ts
import { trace, propagation, context } from '@opentelemetry/api';

export async function apiFetch(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  propagation.inject(context.active(), headers, {
    set: (h, k, v) => (h as Headers).set(k, v),
  });
  // headers şimdi traceparent (ve gerekirse tracestate) içerir
  return fetch(url, { ...init, headers });
}
```

### Kanonik Sentry Config

```typescript
// app/sentry-client.config.ts
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend(event) {
    // PII filtrele
    if (event.request?.headers) {
      delete event.request.headers['cookie'];
      delete event.request.headers['authorization'];
    }
    return event;
  },
  tracesSampleRate: 0.1,  // production: 10%
});
```

### BADI Negatif Örnek
- `D:\BADI\badi\frontend\src\shared\lib\logger.ts` — generic isim, davranışı tanımsız (LOGGING.md Karmaşa #8). Production'da no-op mu, console.log mu, Sentry'ye mi gidiyor — belirsiz.

### Cross-Ref
OBS-05 (Request Context + OTel — backend tarafı), Pattern 32 (OTel ↔ Correlation Merge).

### Enforcement
ESLint rule: `no-console` enabled in `frontend/`. Hook: `import.*logger` matching generic logger.ts = WARN (rename suggestion).

---

## Kural 12 (OBS-12) — External Service (ACL) Observability (CRITICAL)

**Sorumluluk:** Her ACL'ın 8 sorumluluğunun S7 (audit + log + metric) tarafı. Dış servis sağlığı, performansı, hata oranı görünür.

### ZORUNLU Metrics (her ACL için)

| Metric Türü | Örnek İsim | Tip | Label |
|---|---|---|---|
| Request counter | `<vendor>.<endpoint>.requests_total` | counter | `purpose` |
| Duration histogram | `<vendor>.<endpoint>.duration_ms` | histogram | `result` |
| Result counter | `<vendor>.<endpoint>.result` | counter | `verified`, `reason` |
| Circuit state | `<vendor>.circuit.state` | gauge (0=CLOSED, 1=OPEN, 0.5=HALF_OPEN) | — |
| Cache hit/miss | `<vendor>.cache.hit_total` / `miss_total` | counter | — |
| Retry attempts | `<vendor>.retry.attempts_total` | counter | `attempt` |

Örnek (KPS için): `kps.verify.requests_total`, `kps.verify.duration_ms`, `kps.circuit.state`.

### ZORUNLU Log/Audit Ayrımı (3-stream uygulaması)
- ACL içinde her başarılı sorgu → `audit.append({ eventType: 'audit.log', ... })` (KVKK kapsamı — açık PII)
- Her başarısız sorgu → `logger.warn` + `securityEvent` (anomali tespit)
- Her circuit open/close → `securityEvent` + P1 alert (dış sistem ölmüş demek)

### OTel Span

```typescript
const span = tracer.startSpan('kps.verify', {
  attributes: {
    'service.external': 'kps',
    'service.external.endpoint': 'queryAddress',
    'kps.purpose': input.purpose,  // 'register' | 'appointment' gibi
    // ASLA: 'kps.tc_kimlik' — PII span tracking sistemine gider
  },
});
try {
  // ... ACL call
  span.setStatus({ code: SpanStatusCode.OK });
} catch (error) {
  span.recordException(error as Error);
  span.setStatus({ code: SpanStatusCode.ERROR });
  throw error;
} finally {
  span.end();
}
```

### ZORUNLU Alert Kanonu (ACL Bazlı)
- `<acl>.verify.duration_ms.p99 > 5000` → P2 (dış servis yavaşladı)
- `<acl>.circuit.state == 1` → P1 (circuit açık — dış servis ölü)
- `rate(<acl>.verify.result{verified="false"}[5m]) > 0.5` → P2 (anormal yüksek red — fraud, hata, veya iş kuralı değişti)

### YASAK
- ❌ ACL içinde PII'yi span/log attribute'a yazmak (`'kps.tc_kimlik': '12345678901'` YASAK)
- ❌ Metric eklemeden ACL deploy etmek — gözlem olmadan circuit/cache çalışıp çalışmadığı bilinmez
- ❌ Ortak metric ismi (örn. `external.request_total`) — vendor bazlı izolasyon şart (`kps.*`, `sms.*`)

### BADI Negatif Örnek
- BADI KpsService içinde `audit.recordSecurity({event: 'kps_query', ...})` var ama:
  - Metric YOK (`kps.verify.*` counter/histogram yok)
  - Circuit breaker YOK (Pattern 31 S5 uygulanmamış)
  - Cache YOK (Pattern 31 S6 uygulanmamış)
  - `D:\BADI\badi\KPS_SECURITY_ANALYSIS.md` Risk-1 ve Risk-2 bu eksiklikleri dokümante etti.

### Cross-Ref
EVT-00 (Karar Matrisi — ACL maddesi), EVT-11 (ACL Event Boundary), Pattern 31 (ACL Pattern — 8 sorumluluk).

### Enforcement
Hook: `shared/external/<vendor>/` altında `acl.ts` dosyası varsa, `metrics.histogram` veya `metrics.counter` çağrısı bulunmalı — yoksa WARN.

---

## Karar Matrisi (OBS-03 Tekrarı — Hızlı Referans)

| Olay Tipi | Logger | Audit | Metric | Security Event |
|---|---|---|---|---|
| Domain Mutation (CUD) | `info` | ✅ ZORUNLU | counter++ | — |
| Security Event (login, logout, password reset, role change) | `info` | ✅ ZORUNLU | counter++ | ✅ |
| Authorization Failure (403) | `warn` | — | counter++ | ✅ |
| Validation Failure (400) | `debug` | — | counter++ | — |
| System Error (500) | `error` (stack) | — | counter++ | + alert |
| External API Call | `debug` (req) / `error` (fail) | — | duration histogram | — |
| BullMQ Job | `info` (start) / `error` (fail) | — | duration + failure | — |
| Cache Hit/Miss | — | — | counter++ | — |
| Rate Limit Ban | `warn` | ✅ | counter++ | ✅ |
| External Service Circuit Open | `error` | — | gauge=1 | + alert |

---

## Alert Kanonu (Tüm Eşikler Tek Yerde)

| Metric | Eşik | Öncelik | Kaynak Kural |
|---|---|---|---|
| `http_requests_total{status=~"5.."}` rate[5m] | > 0.05 | P2 | OBS-06 |
| `outbox.unflushed_count` | > 1000 | P2 | OBS-07 |
| `outbox.oldest_unflushed_age_seconds` | > 300 | P1 | OBS-07 |
| `outbox.flush_failures_total` rate[5m] | > 0.1/min | P1 | OBS-07 |
| `bullmq.dlq.size` | > 0 | P3 | OBS-09 |
| `bullmq.dlq.size` | > 10 | P2 | OBS-09 |
| `bullmq.dlq` yeni entry rate | > 1/min | P1 | OBS-09 |
| `projection.<name>.lag_seconds` | > 30 | P2 | OBS-10 |
| `projection.<name>.lag_seconds` | > 300 | P1 | OBS-10 |
| `<acl>.verify.duration_ms.p99` | > 5000 | P2 | OBS-12 |
| `<acl>.circuit.state` | == 1 | P1 | OBS-12 |
| `<acl>.verify.result{verified="false"}` rate[5m] | > 0.5 | P2 | OBS-12 |

---

## Sink Kararları

| Akış | Sink | Tool | Retention |
|---|---|---|---|
| Application log | stdout (JSON) → Loki | Pino | 30 gün |
| Audit log | PostgreSQL partitioned + WORM/RLS | Custom (Outbox üzerinden) | 10 yıl (KVKK) |
| Security event | SIEM | Elastic/Splunk | 2 yıl |
| Metrics | Prometheus | prom-client + bullmq-otel | 90 gün |
| Traces | Tempo veya Jaeger | OpenTelemetry → OTLP | 7 gün |
| Frontend errors | Sentry | @sentry/nextjs | 90 gün |

---

## Cross-Reference Index (Detaylı)

| Konu | Bu Dosyada | Diğer Dosyalarda |
|---|---|---|
| Audit | OBS-01 | Kural 7 (Backend), EVT-04 (Events), EVT-10 (KVKK pseudonymize) |
| PII | OBS-01 | Kural 8.1 (Backend) |
| Outbox | OBS-07 | EVT-04 (Producer), Kural 6.3 (TXN-03), Pattern 22 |
| OTel | OBS-05 | EVT-01 (Envelope), EVT-02 (Causation), Pattern 32 |
| DLQ | OBS-09 | EVT-07 (Discipline), OBS-08 (Queue Health) |
| ACL | OBS-12 | EVT-00 (Karar Matrisi), EVT-11 (Boundary), Pattern 31 |
| Read Model | OBS-10 | EVT-09 (Replay) |
| KVKK | OBS-01 (PII discipline) | Kural 7.3 (Audit), Kural 20.3 (KVKK-03), EVT-10 (Tombstone) |
