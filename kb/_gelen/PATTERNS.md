# W0NDERSUPERIOR Kod Pattern'leri

Generic ornekler. Gercek projede bu pattern'lere uy.

---

## 1. CQRS Pattern (Pragmatic — Command = HTTP DTO, Result = Response Output)

W0NDERSUPERIOR CQRS disiplininde use-case basina **COLOCATED** klasor kullanilir: `commands/<use-case>/` icinde `<uc>.command.ts` + `<uc>.handler.ts` + `<uc>.result.ts` + `<uc>.handler.spec.ts`. Ayri `handlers/`/`results/` top-level klasor YASAK. Command/Query class-validator decorator'larıyla süslüdür — **HTTP DTO görevi de görür** (ayrı `presentation/dtos/` yazma). Handler `Result` POJO döner — Response DTO **DEĞİL**. `requesterId` body'den ASLA okunmaz; `CommandRequesterInterceptor` (global) otomatik enjekte eder.

### 1.1 BaseCommand / BaseQuery (shared CQRS kanonu)

```typescript
// backend/src-v2/shared/cqrs/domain/base.command.ts

import { ICommand, IQuery } from '@nestjs/cqrs';

/**
 * Tüm Command sınıfları bundan extend eder.
 * requesterId controller'da set EDİLMEZ; CommandRequesterInterceptor enjekte eder.
 */
export abstract class BaseCommand implements ICommand {
  requesterId!: string;  // ! = "interceptor garanti eder"
}

export abstract class BaseQuery implements IQuery {
  requesterId!: string;
}
```

### 1.2 CommandRequesterInterceptor (zorunlu, global)

```typescript
// backend/src-v2/shared/cqrs/infrastructure/command-requester.interceptor.ts

import { Injectable, NestInterceptor, ExecutionContext, CallHandler, UnauthorizedException } from '@nestjs/common';
import { BaseCommand, BaseQuery } from '@/shared/cqrs/domain';
import type { AuthenticatedRequest } from '@/shared/security/domain';

@Injectable()
export class CommandRequesterInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    if (ctx.getType() !== 'http') return next.handle();

    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user?.sub) throw new UnauthorizedException();  // JwtGuard zaten engellemiş olmalı; defense in depth

    // Controller method argümanlarını tara, BaseCommand/Query instance'larına requesterId enjekte et
    for (const arg of ctx.getArgs<unknown[]>()) {
      if (arg instanceof BaseCommand || arg instanceof BaseQuery) {
        arg.requesterId = req.user.sub;
      }
    }

    return next.handle();
  }
}

// app.module.ts — GLOBAL bind ZORUNLU (her command/query için)
{
  provide: APP_INTERCEPTOR,
  useClass: CommandRequesterInterceptor,
}
```

### 1.3 Command Tanımı (class-validator + BaseCommand)

```typescript
// backend/src-v2/features/<feature>/<sub-feature>/application/commands/create-xxx/create-xxx.command.ts

import { IsString, MinLength, IsOptional, IsEmpty } from 'class-validator';
import { BaseCommand } from '@/shared/cqrs/domain';

export class CreateXxxCommand extends BaseCommand {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(10)
  description: string;

  @IsOptional()
  @IsString()
  optionalField?: string;

  // requesterId BaseCommand'dan miras.
  // @IsEmpty body'den enjekte edilmesini engeller (saldırgan kendi ID'sini gönderemez).
  @IsEmpty({ message: 'requesterId body üzerinden gönderilemez (otomatik enjekte edilir)' })
  declare requesterId: string;
}
```

### 1.4 Result Tanımı (handler return type — yeni kategori)

```typescript
// backend/src-v2/features/<feature>/<sub-feature>/application/commands/create-xxx/create-xxx.result.ts

export class CreateXxxResult {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly createdAt: Date,
  ) {}

  static from(entity: XxxEntity): CreateXxxResult {
    return new CreateXxxResult(entity.id, entity.name, entity.createdAt);
  }
}
```

**Not:** `Result` HTTP DTO **değil** — use case'in saf çıktısı. Controller `Result`'ı doğrudan return eder; class-transformer @Expose/@Exclude varsa serialize edilir, yoksa raw JSON.

### 1.5 Command Handler (5 Aşama, Result return)

```typescript
// backend/src-v2/features/<feature>/<sub-feature>/application/commands/create-xxx/create-xxx.handler.ts

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';

@CommandHandler(CreateXxxCommand)
export class CreateXxxCommandHandler implements ICommandHandler<CreateXxxCommand, CreateXxxResult> {
  constructor(
    @Inject('IUnitOfWork') private readonly uow: IUnitOfWork,
    private readonly auditProducer: AuditJobProducer,
  ) {}

  async execute(command: CreateXxxCommand): Promise<CreateXxxResult> {
    const { requesterId, ...data } = command;
    // NOT: Yetkilendirme PoliciesGuard'da çözüldü. Handler yetki kodu YAZMAZ.

    // 1. VALIDATION (business rules)
    const existing = await this.uow.xxxs.findByUniqueField(data.name);
    if (existing) throw new ConflictException('Bu kayit zaten mevcut');

    // 2. TRANSFORM (Entity factory — business rule burada)
    const entity = XxxEntity.create(data);

    // 3. ATOMIC (UnitOfWork transaction)
    const saved = await this.uow.transaction(async () => {
      return this.uow.xxxs.create(entity);
    });

    // 4. AUDIT (BullMQ async)
    await this.auditProducer.push({
      entityType: 'Xxx',
      entityId: saved.id,
      action: 'create',
      actorId: requesterId,
      body: data,
    });

    // 5. RESULT (use case output — HTTP Response DTO DEĞİL)
    return CreateXxxResult.from(saved);
  }
}
```

### 1.6 Query Tanımı (class-validator + BaseQuery)

```typescript
// backend/src-v2/features/<feature>/<sub-feature>/application/queries/list-xxx/list-xxx.query.ts

import { IsOptional, IsString, IsInt, Min, Max, IsEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { BaseQuery } from '@/shared/cqrs/domain';

export class ListXxxQuery extends BaseQuery {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  // ABAC fields: PoliciesGuard request.policyContext'e koyar; ayrı bir
  // QueryPolicyEnricherInterceptor (opsiyonel) Query'e enjekte eder.
  // Veya: Handler içinde requestContext.getStore() ile okunur.

  @IsEmpty()
  declare requesterId: string;
}
```

### 1.7 Query Handler (Result return)

```typescript
// backend/src-v2/features/<feature>/<sub-feature>/application/queries/list-xxx/list-xxx.handler.ts

import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';

@QueryHandler(ListXxxQuery)
export class ListXxxQueryHandler implements IQueryHandler<ListXxxQuery, ListXxxResult> {
  constructor(private readonly xxxRepository: IXxxRepository) {}

  async execute(query: ListXxxQuery): Promise<ListXxxResult> {
    const { search, page, limit, requesterId } = query;
    const policyContext = requestContext.getStore()?.policyContext;  // PoliciesGuard'dan
    const { permittedFields, caslConditions } = policyContext ?? { permittedFields: [], caslConditions: {} };

    const where = {
      deletedAt: null,                    // ZORUNLU (soft delete)
      ...caslConditions,                  // ABAC instance-level filter
      ...(search && { OR: [{ name: { contains: search, mode: 'insensitive' } }] }),
    };

    const paginated = await this.xxxRepository.findMany({
      where,
      select: buildSelect(permittedFields),
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return ListXxxResult.from(paginated);  // PaginatedResult<Xxx> → ListXxxResult
  }
}
```

### 1.8 Controller (Command @Body() + Result return — TEMİZ)

```typescript
// backend/src-v2/features/<feature>/<sub-feature>/presentation/<sub-feature>.controller.ts

@Controller('xxxs')
@UseGuards(SmartThrottlerGuard, OriginGuard, JwtGuard, PoliciesGuard)
export class XxxController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @RequireAction(Action.CREATE, Resource.Xxx)
  async create(@Body() command: CreateXxxCommand): Promise<CreateXxxResult> {
    // requesterId interceptor tarafından set edildi — controller dokunmaz
    return this.commandBus.execute(command);
  }

  @Get()
  @RequireAction(Action.READ, Resource.Xxx)
  async list(@Query() query: ListXxxQuery): Promise<ListXxxResult> {
    return this.queryBus.execute(query);
  }
}
```

**Disiplin özeti:**
- `commands/<use-case>/` colocated (command+handler+result+spec) + `BaseCommand`/`BaseQuery` extend — HTTP DTO görevi de görür
- `presentation/dtos/` **OPSİYONEL** — sadece custom serialization / API versioning için (genellikle boş)
- result use-case klasorunde (`commands/<use-case>/<uc>.result.ts`) — ayri `results/` top-level klasor YASAK
- `CommandRequesterInterceptor` global, otomatik requesterId enjekte eder — controller'da `command.requesterId = ...` YAZMA
- `@IsEmpty()` body'den gelen requesterId'yi 400 ile reddeder (saldırı koruması)

---

## 2. Repository Pattern (KANONIK = Pattern 20 ABAC Repository-Driven)

> Klasik Repository pattern (sadece Prisma sarması) **KALDIRILDI** (v11 refactor).
> CASL-05 (IRON_RULES_BACKEND): Her feature Repository ABAC kullanır.
> Detay: **Pattern 20 — Repository Pattern (ABAC Repository-Driven)** aşağıda.

Kısaca:
- Constructor: `private prisma`, `private abilityFactory`
- Methods: `findById(id, userId)`, `findMany(criteria, userId)`, `update(entity, userId)`, `softDelete(id, userId)`
- userId imzası **ZORUNLU** (CASL-05)
- `AbilityFactory.buildFor(userId)` → `accessibleBy(ability, action).Subject` ile where injection
- `FieldFilterHelper.buildSelect(permittedFields)` ile select whitelist
- `mapToResponse()` ile PII maskeleme

Tam örnek + write methods + nested aggregate için: **Pattern 20** (aşağıda).

---

## 3. Entity Pattern

### Anemic vs Rich Domain Model

YASAK (Anemic):
```typescript
// Entity sadece field tutucu
class Basvuru {
  constructor(public id, public durum, ...) {}
  updateDurum(yeniDurum: string) { this.durum = yeniDurum; }  // Setter, business logic YOK
}

// Handler'da business logic:
async execute(command: OnaylaBasvuruCommand) {
  const basvuru = await this.uow.basvurular.findById(command.id);
  if (basvuru.durum !== 'INCELEMEDE') throw new ConflictException(...);  // Domain rule LEAK
  basvuru.updateDurum('ONAYLANDI');
}
```

DOGRU (Rich):
```typescript
// Entity davranışı sahiplenir
class Basvuru {
  // ... state ...
  onayla(): void {
    if (this.durum !== BasvuruDurum.INCELEMEDE) {
      throw new BasvuruOnaylanamazError(this.durum);  // Domain Exception
    }
    this.durum = BasvuruDurum.ONAYLANDI;
  }
}

// Handler temiz:
async execute(command: OnaylaBasvuruCommand) {
  const basvuru = await this.uow.basvurular.findById(command.id);
  basvuru.onayla();  // Tüm business rule entity'de
  await this.uow.basvurular.save(basvuru);
}
```

```typescript
// backend/src-v2/features/[module]/domain/entities/xxx.entity.ts

export class Xxx {
  constructor(
    public readonly id: string,
    public name: string,
    public description: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
    public deletedAt: Date | null,
  ) {}

  static create(data: { name: string; description?: string }): Xxx {
    return new Xxx(
      crypto.randomUUID(),
      data.name,
      data.description ?? null,
      new Date(),
      new Date(),
      null,
    );
  }

  updateInfo(data: { name?: string; description?: string }): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description;
    this.updatedAt = new Date();
  }

  softDelete(): void {
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }
}
```

### 3.1 Value Object Pattern (Immutable Domain Türü)

Entity'lerin **kimligi vardir** (id), Value Object'lerin **degeri vardir** (esitlik tum field'larin esitligine baglidir). Kullan: para tutari + para birimi, telefon numarasi + ulke kodu, adres, koordinat, e-posta.

**Kurallar:**
1. **Immutable** — tum field'lar `readonly`; mutate metodu YOK
2. **Self-validating** — constructor private; static factory `Create()` ile dogrulama
3. **Structural equality** — `equals()` metodu kendi alanlarini karsilastirir
4. **Side-effect free** — her metod yeni VO doner (orn. `add()` yeni Money doner)

```typescript
// backend/src-v2/features/[module]/domain/value-objects/money.vo.ts

export class Money {
  private constructor(
    public readonly amount: number,    // kurus cinsi (50.25 TL → 5025)
    public readonly currency: 'TRY' | 'USD' | 'EUR',
  ) {}

  static create(amount: number, currency: 'TRY' | 'USD' | 'EUR'): Money {
    if (!Number.isInteger(amount)) {
      throw new Error('Money.amount tam sayi olmali (kurus cinsi)');
    }
    if (amount < 0) {
      throw new Error('Money.amount negatif olamaz');
    }
    return new Money(amount, currency);
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(`Para birimi uyuşmuyor: ${this.currency} != ${other.currency}`);
    }
    return Money.create(this.amount + other.amount, this.currency);
  }

  multiply(factor: number): Money {
    return Money.create(Math.round(this.amount * factor), this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  toString(): string {
    return `${(this.amount / 100).toFixed(2)} ${this.currency}`;
  }
}
```

**Entity icinde VO Kullanimi:**

```typescript
export class Fatura {
  constructor(
    public readonly id: string,
    public readonly toplam: Money,        // <-- VO, primitive degil
    public readonly faturaNo: FaturaNo,   // <-- VO
    public deletedAt: Date | null,
  ) {}

  static create(data: { toplam: Money; faturaNo: FaturaNo }): Fatura {
    return new Fatura(crypto.randomUUID(), data.toplam, data.faturaNo, null);
  }
}
```

**Prisma Persistance:** VO'lari primitive field'lara serialize et — Prisma sema'sinda `toplam` kolonu yerine `toplamAmount: Int` + `toplamCurrency: String`. Repository mapping katmaninda VO `Create()` ile yeniden ins.

```typescript
// Repository ↔ Domain mapping
private toDomain(row: PrismaXxxRow): Xxx {
  return Xxx.create({
    toplam: Money.create(row.toplamAmount, row.toplamCurrency as Money['currency']),
    faturaNo: FaturaNo.create(row.faturaNoSeri, row.faturaNoSira),
  });
}

private toPersistence(entity: Xxx): PrismaXxxInput {
  return {
    toplamAmount: entity.toplam.amount,
    toplamCurrency: entity.toplam.currency,
    faturaNoSeri: entity.faturaNo.seri,
    faturaNoSira: entity.faturaNo.sira,
  };
}
```

**NE ZAMAN VO YERINE PRIMITIVE BIRAK:**
- Anlam tek field'da yatiyorsa (sadece `email: string`, validation form'da)
- Domain'de davranisi yok (sadece tasiyor)
- ORM esleme efforu kazanci ascarsa (heuristic: 3+ field grubu varsa VO yap)

### Entity Factory Invariant Validation (ZORUNLU)

Static factory metodu (`Entity.create(data)`) sadece field set ETMEZ — invariant'ları doğrular:

```typescript
class Basvuru {
  private constructor(...) {}

  static create(data: CreateBasvuruInput): Basvuru {
    // 1. Invariant validations
    if (data.aileUyeleri.length === 0) {
      throw new DomainError('En az 1 aile uyesi zorunlu');
    }
    if (!TcKimlik.isValid(data.basvuranTc)) {
      throw new DomainError('Gecersiz TC kimlik');
    }
    if (data.aylikGelir < 0) {
      throw new DomainError('Aylik gelir negatif olamaz');
    }

    // 2. State setup
    return new Basvuru(
      crypto.randomUUID(),
      TcKimlik.create(data.basvuranTc),  // VO içinde de validation
      // ...
    );
  }
}
```

Kural:
- Constructor PRIVATE — dışarıdan instantiate yasak
- Factory `Entity.create()` ZORUNLU (named, anlamlı: `Basvuru.olustur(...)` Türkçe tercih)
- Invariant violation → `DomainError` throw
- Class-validator decorator'ları COMMAND'de input doğrulaması, ENTITY'de business invariant — İKİSİ AYRI

---

## 4. Controller Pattern (DEPRECATED)

> Eski "manuel `new CreateXxxCommand(...)` mapping" pattern kaldırıldı (v11 refactor).
> Kanonik controller örneği: **Pattern 1.8** (BaseCommand + class-validator + CommandRequesterInterceptor).
> CTRL-04 (IRON_RULES_BACKEND): Controller `@Body() command: CreateXxxCommand` alır, ayrı HTTP DTO yazılmaz.

---

## 5. DTO Pattern (OPSİYONEL — Custom Serialization İçin)

> `presentation/dtos/` **OPSİYONEL** — çoğu feature'da boş. Pattern 1.3 (CreateXxxCommand class-validator decorator'larıyla) HTTP DTO görevini de görür (DRY).

DTO sadece şu durumlarda yazılır:
- **Custom serialization:** `class-transformer @Expose/@Exclude` ile farklı wire format gerekirse
- **API versioning** (v1/v2 endpoint'ler aynı Command'i farklı şekilde expose ederse)

```typescript
// backend/src-v2/features/<feature>/<sub-feature>/presentation/dtos/legacy-create-xxx.dto.ts
// SADECE custom serialization gerekirse:
export class LegacyCreateXxxDto {
  @Expose({ name: 'user_name' })  // v1 snake_case → v2 camelCase mapping
  userName: string;
}
```

Default: `presentation/dtos/` klasörü boş kalır. Yeni feature yazarken **DTO YAZMAYIN** — Command yeterli.

---

## 6. Module Pattern (Sub-feature + BC Aggregation)

### 6.1 Sub-feature Module (`<sub-feature>.module.ts`)

```typescript
// backend/src-v2/features/<feature>/<sub-feature>/<sub-feature>.module.ts
@Module({
  imports: [CqrsModule /* + BC-paylasilan shared module'ler */],
  controllers: [<Sub>Controller],            // presentation/
  providers: [...CommandHandlers, ...QueryHandlers],
})
export class <Sub>Module {}
```

> NOT: Repo'lar bu module'de provider DEGIL (ABAC repolari `constructor(tx, abilityFactory)`
> alir, Nest TxClient'i enjekte edemez). Repo factory kaydi BC seviyesinde
> `<feature>-uow.registrar.ts`'te merkezidir (6.3).

### 6.2 BC Aggregate Module (`<feature>.module.ts`)

```typescript
// backend/src-v2/features/<feature>/<feature>.module.ts
@Module({
  imports: [
    CqrsModule, DatabaseModule, AuthorizationModule, SecurityModule, MessagingModule, CacheModule,
    UsersModule, GroupsModule, RolesModule, /* ...tum sub-feature module'leri */
  ],
  providers: [ <Feature>UowRegistrar, { provide: USER_LOOKUP, useClass: UserLookupAdapter } ],
  exports: [ USER_LOOKUP ],                   // BC public surface (cross-BC contract)
})
export class <Feature>Module {}
```

### 6.3 UoW Registrar (TEK nokta — repo factory + ResourceRegistry)

```typescript
// backend/src-v2/features/<feature>/<feature>-uow.registrar.ts
@Injectable()
export class <Feature>UowRegistrar implements OnModuleInit {
  constructor(
    @Inject(UNIT_OF_WORK) private uow: IUnitOfWork,
    private resourceRegistry: ResourceRegistry,
    private abilityFactory: AbilityFactory,
  ) {}
  onModuleInit(): void {
    // ABAC repolari — (tx) => new XRepository(tx, abilityFactory)
    this.uow.register(USER_REPOSITORY, (tx) => new UserRepository(tx, this.abilityFactory));
    // ... tum sub-feature repolari (TEK registrar)
    // ResourceRegistry — route prefix -> CASL Subject
    this.resourceRegistry.register('/<route>', Resource.<Subject>);
  }
}
```

**Kural:** BC basina TEK registrar. Sub-module'ler repo factory'sini sahiplenmez (repo'lar BC-paylasilan UoW'a aittir). Sub-module sadece handler/controller sahiplenir.

---

## 7. Server Action Pattern (ActionResult<T> + Zod)

```typescript
// frontend/src-v2/features/[module]/actions/[module].actions.ts

'use server';

import { apiPost, apiGet, apiPatch, apiDelete } from '@/shared/lib/api/core/api-fetcher';
import { ApiError } from '@/shared/lib/api/core/errors';
import type { ActionResult } from '@/shared/lib/api/contracts/common';
import { revalidatePath } from 'next/cache';
import { createXxxSchema, type CreateXxxInput } from '../schemas/xxx.schema';

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

    // 4. ActionResult<T> don
    return { success: true, data: result, message: 'Basariyla olusturuldu' };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Islem sirasinda bir hata olustu' };
  }
}

export async function listXxxAction(
  filters?: ListXxxFilters
): Promise<ActionResult<PaginatedResult<Xxx>>> {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.set('search', filters.search);
    if (filters?.page) params.set('page', String(filters.page));

    const result = await apiGet<PaginatedResult<Xxx>>(
      `/module/xxxs${params.toString() ? `?${params}` : ''}`
    );

    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Veriler alinamadi' };
  }
}

export async function deleteXxxAction(id: string): Promise<ActionResult<void>> {
  try {
    await apiDelete(`/module/xxxs/${id}`);
    revalidatePath('/module/xxxs');
    return { success: true, message: 'Basariyla silindi' };
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: 'Silme islemi basarisiz' };
  }
}
```

---

## 8. React Query Hook Pattern

```typescript
// frontend/src-v2/features/[module]/hooks/use-[module].ts

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listXxxAction,
  createXxxAction,
  deleteXxxAction,
} from '../actions/xxx.actions';

// Query key convention: feature.entity.filter
const xxxKeys = {
  all: ['xxx'] as const,
  lists: () => [...xxxKeys.all, 'list'] as const,
  list: (filters: ListXxxFilters) => [...xxxKeys.lists(), filters] as const,
  details: () => [...xxxKeys.all, 'detail'] as const,
  detail: (id: string) => [...xxxKeys.details(), id] as const,
};

export function useXxxList(filters?: ListXxxFilters) {
  return useQuery({
    queryKey: xxxKeys.list(filters ?? {}),
    queryFn: async () => {
      const result = await listXxxAction(filters);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
  });
}

export function useCreateXxx() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateXxxInput) => {
      const result = await createXxxAction(data);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: xxxKeys.lists() });
    },
  });
}

export function useDeleteXxx() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteXxxAction(id);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: xxxKeys.lists() });
    },
  });
}
```

---

## 9. Form Pattern (react-hook-form + Zod + shadcn)

```typescript
// frontend/src-v2/features/[module]/schemas/[module].schema.ts

import { z } from 'zod';

export const createXxxSchema = z.object({
  name: z.string().min(1, 'Ad zorunludur'),
  description: z.string().optional(),
});

export type CreateXxxInput = z.infer<typeof createXxxSchema>;
```

```tsx
// frontend/src-v2/features/[module]/components/molecules/CreateXxxForm.tsx

'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { createXxxSchema, type CreateXxxInput } from '../../schemas/xxx.schema';
import { useCreateXxx } from '../../hooks/use-xxx';

export function CreateXxxForm() {
  const form = useForm<CreateXxxInput>({
    resolver: zodResolver(createXxxSchema),
    defaultValues: { name: '', description: '' },
  });

  const createMutation = useCreateXxx();

  async function onSubmit(data: CreateXxxInput) {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Basariyla olusturuldu');
      form.reset();
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ad</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Olusturuluyor...' : 'Olustur'}
        </Button>
      </form>
    </Form>
  );
}
```

---

## 10. BullMQ Producer/Worker Pattern

### Producer

```typescript
// backend/src-v2/shared/messaging/application/audit-job.producer.ts

@Injectable()
export class AuditJobProducer {
  constructor(@InjectQueue('audit') private readonly queue: Queue) {}

  async push(data: {
    entityType: string;
    entityId: string;
    action: 'create' | 'update' | 'delete';
    actorId: string;
    body: Record<string, unknown>;
    diff?: Record<string, unknown>;
  }): Promise<void> {
    await this.queue.add('audit-log', data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }
}
```

### Worker

```typescript
// backend/src-v2/shared/observability/audit/audit.worker.ts

@Processor('audit')
export class AuditWorker extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { entityType, entityId, action, actorId, body, diff } = job.data;

    await this.prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        actorId,
        body,
        diff,
        createdAt: new Date(),
      },
    });
  }
}
```

---

## 11. Rate Limit Override Pattern

Yeni hassas endpoint icin ozel rate limit ekleme:

```typescript
// SmartThrottlerGuard icinde endpoint override ekleme
private readonly endpointOverrides = new Map([
  ['/oturum/login', { limit: 5, ttl: 60 }],
  ['/oturum/verify-phone', { limit: 3, ttl: 300 }],
  ['/oturum/refresh', { limit: 30, ttl: 60 }],
  // Yeni hassas endpoint ekle:
  ['/oturum/reset-password', { limit: 3, ttl: 300 }],
]);
```

---

## 12. Validation Pattern

### Backend (class-validator DTO)

```typescript
import {
  IsString, IsNotEmpty, IsOptional, IsUUID,
  IsEmail, IsPhoneNumber, Length, Matches,
} from 'class-validator';
import { IsCaslSubject, IsResourceKey } from '@shared/validators';

export class CreatePermissionDto {
  @IsString()
  @IsNotEmpty()
  @IsCaslSubject()              // Custom: PascalCase model name
  subject: string;

  @IsString()
  @IsNotEmpty()
  @IsResourceKey()              // Custom: lowercase-hyphen format
  resourceKey: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

### Frontend (Zod Schema)

```typescript
import { z } from 'zod';

// Shared primitives
const IdSchema = z.string().uuid();
const PhoneSchema = z.string().regex(/^5\d{9}$/, 'Gecersiz telefon');
const TcKimlikSchema = z.string().length(11).regex(/^\d+$/, 'Gecersiz TC');

// Feature schema
export const createAppointmentSchema = z.object({
  serviceId: IdSchema,
  providerId: IdSchema,
  date: z.string().date(),
  phone: PhoneSchema,
  notes: z.string().max(500).optional(),
});
```

---

## 13. Test Pattern

```typescript
// backend/src-v2/features/<feature>/<sub-feature>/application/commands/create-xxx/create-xxx.handler.spec.ts (COLOCATE)

import { Test, TestingModule } from '@nestjs/testing';

const mockXxxRepoCreate = jest.fn();
const mockAuditPush = jest.fn();
const mockTransaction = jest.fn((callback: () => Promise<unknown>) => callback());

describe('CreateXxxCommandHandler', () => {
  let handler: CreateXxxCommandHandler;

  // AbilityFactory mock — Repository ABAC testleri için
  import { createMongoAbility } from '@casl/ability';

  const mockAbility = createMongoAbility([
    { action: 'READ', subject: 'Xxx' },
    { action: 'UPDATE', subject: 'Xxx', conditions: { aktorId: 'user-1' } },
  ]);

  const mockAbilityFactory = {
    buildFor: jest.fn().mockResolvedValue(mockAbility),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateXxxCommandHandler,
        {
          provide: 'IUnitOfWork',
          useValue: {
            xxxs: { findByUniqueField: jest.fn(), create: mockXxxRepoCreate },
            transaction: mockTransaction,
          },
        },
        {
          provide: AuditJobProducer,
          useValue: { push: mockAuditPush },
        },
        {
          provide: AbilityFactory,
          useValue: mockAbilityFactory,
        },
      ],
    }).compile();

    handler = module.get(CreateXxxCommandHandler);
  });

  afterEach(() => { jest.clearAllMocks(); });

  it('should create xxx successfully', async () => {
    // Arrange
    mockXxxRepoCreate.mockResolvedValue({ id: 'xxx-1', name: 'Test' });

    // Act
    const result = await handler.execute(
      new CreateXxxCommand('Test', 'Desc', 'user-1')
    );

    // Assert
    expect(result.id).toBe('xxx-1');
    expect(mockXxxRepoCreate).toHaveBeenCalled();
    expect(mockAuditPush).toHaveBeenCalledWith(
      expect.objectContaining({ entityType: 'Xxx', action: 'create' })
    );
  });

  it('should throw ConflictException when already exists', async () => {
    // Arrange - findByUniqueField returns existing
    const uow = handler['uow'];
    (uow.xxxs.findByUniqueField as jest.Mock).mockResolvedValue({ id: 'existing' });

    // Act & Assert
    await expect(
      handler.execute(new CreateXxxCommand('Existing', 'Desc', 'user-1'))
    ).rejects.toThrow(ConflictException);

    expect(mockXxxRepoCreate).not.toHaveBeenCalled();
  });
});
```

---

## 14. Error Handling Pattern (Frontend)

```typescript
// Frontend'de hata yakalama
import { ApiError } from '@/shared/lib/api/core/errors';

export async function someAction(): Promise<ActionResult<Data>> {
  try {
    const result = await apiPost<Data>('/endpoint', data);
    return { success: true, data: result };
  } catch (error: unknown) {
    // 1. Bilinen API hatalari
    if (error instanceof ApiError) {
      return { success: false, error: error.message };
    }

    // 2. Network/timeout hatalari
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { success: false, error: 'Baglanti hatasi. Lutfen tekrar deneyin.' };
    }

    // 3. Bilinmeyen hatalar - ASLA raw error donme
    return { success: false, error: 'Beklenmeyen bir hata olustu' };
  }
}
```

---

## 15. deletedAt Global Filter Pattern (OTOMASYON ONERISI)

> **DIKKAT:** `deletedAt: null` filtresi her sorguda ZORUNLUDUR (IRON_RULES Kural 5.3).
> Bu kural degismez. Asagidaki ONERI, bu zorunlu filtreyi OTOMATIZE etmenin
> yollarini sunar — filtrenin kendisi degil, DRY otomasyon yaklasimi oneridir.

Mevcut durumda her repository metodu `deletedAt: null` filtresini manuel olarak eklemektedir. Bu yaklasim hata yapma riskini arttirir (bir sorguda unutulabilir). Asagida iki alternatif otomasyon yaklasimi sunulmaktadir:

### Yaklasim 1: Prisma Middleware (Otomatik Filtre)

```typescript
// backend/src-v2/shared/database/infrastructure/prisma-soft-delete.middleware.ts
// ONERI: Bu middleware tum sorgulara otomatik deletedAt: null filtresi ekler

import { Prisma } from '@prisma/client';

export function softDeleteMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    if (['findMany', 'findFirst', 'findUnique', 'count'].includes(params.action)) {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};
      if (params.args.where.deletedAt === undefined) {
        params.args.where.deletedAt = null;
      }
    }
    return next(params);
  };
}
```

### Yaklasim 2: Base Repository Class (Abstract Class)

```typescript
// backend/src-v2/shared/database/infrastructure/base.repository.ts

export abstract class BasePrismaRepository<T> {
  protected abstract readonly model: string;

  constructor(protected readonly prisma: PrismaService) {}

  protected defaultWhere(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { deletedAt: null, ...extra };
  }

  async findById(id: string): Promise<T | null> {
    return (this.prisma as any)[this.model].findUnique({
      where: this.defaultWhere({ id }),
    });
  }
}
```

**Not:** Her iki yaklasim da `deletedAt: null` filtresini merkezi hale getirir. Middleware yaklasimi daha az mudahale gerektirir, ancak Prisma Client Extensions ile uyumluluk kontrol edilmelidir. Mevcut durumda her repository'de manuel ekleme devam etmektedir.

---

## 16. Cross-Feature Iletisim Pattern

> **Outbox ile entegrasyon (TXN-03):** Domain event seçildiğinde (karar matrisi sonucu) doğrudan `domainEventProducer.publish()` çağırılmaz; `uow.outbox.append()` ile transaction içinde yazılır. Detay: **Pattern 22 (Outbox)**.

Feature modulleri birbirini DOGRUDAN import edemez (Mimari Degismez #1). Feature'lar arasi iletisim su yollarla yapilir:

### 16.0 Karar Matrisi — Event mi, Interface Contract mi?

Cross-module iletisim icin 3 yontem var. **Yanlis secim** = ya gereksiz coupling ya da consistency riski.

```
START: Feature A, Feature B'den BIR SEY ihtiyac duyuyor.

  1. Bu istek SENKRON cevap istiyor mu (B'den DATA dondurmesi gerekli)?
       EVET → 2'ye git
       HAYIR → 3'e git

  2. Senkron cevap → Shared Interface Contract (alt yontem 2):
       - B'nin Public API'sini shared/<concern>/domain/ icine cikart
       - A: shared interface'i inject eder (dogrudan B import DEGIL)
       - Eg. shared/identity/domain/IUserLookup.ts → A bunu inject eder

  3. Asenkron → BullMQ Domain Event (alt yontem 1):
       - A event publish eder ("appointment.created")
       - B subscribe eder, kendi isini yapar
       - Eger B fail ederse A etkilenmez
       - Eg. randevu olusturulunca SMS gonder, audit kaydet, vs.

  ÖZEL DURUM: Cogul B,C,D notifikasyon istiyor mu?
       EVET → DOMAIN EVENT (1) — N alici icin tek event broadcast
              (interface contract olsaydi A her aliciyi bilirdi → kotu coupling)

  ÖZEL DURUM: Sira ZORUNLU mi (A sonra B sonra C, eventual consistency YETERSIZ)?
       EVET → INTERFACE CONTRACT (2) — handler icinde SIRAYLA cagir
              (event order eventual; sira garantili degil)

  ÖZEL DURUM: B feature'i hic yoksa A calismali mi?
       EVET → DOMAIN EVENT (1) — B yoksa event biriker, A calisir
       HAYIR → INTERFACE CONTRACT (2) — B yoksa A da hata atar (deliberate)
```

**Karar Ozeti Tablosu:**

| Senaryo | Yontem | Sebep |
|---------|--------|-------|
| "B'den X bilgisini al, geri don" | Interface Contract | Senkron cevap gerekli |
| "Olay oldu, ilgili herkes haber alsin" | Domain Event | N alici, async ok |
| "A bittiyse B'yi de tetikle ama sira onemli" | Interface Contract (handler icinde cagri) | Sira garanti |
| "Audit/log/SMS/notification" | Domain Event | Side effect, A blocking olamaz |
| "Cross-aggregate validation" | Interface Contract | Senkron veri ihtiyaci |
| "Workflow tetikleme" | Domain Event | Decoupling + retry |

**YASAK 3. Yontem: Direct Service Import**

```typescript
// YASAK — feature A, feature B'yi direkt import etti
import { UserService } from '../../identity/application/services/user.service';
// Mimari Degismez #1 ihlali → CRITICAL
// Cozum: yukaridaki karar matrisinden hangisi uygunsa onu sec
```


### 1. BullMQ Domain Event (Asenkron Iletisim)

```typescript
// YASAK: import { UserService } from '../identity/users/...'
// DOGRU: BullMQ domain event uzerinden iletisim

// 1. Event tanimlama (shared/messaging/domain/event-envelope.types.ts)
export interface DomainEvent {
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

// 2. Event publish (kaynak feature handler'inda, audit sonrasi)
await this.domainEventProducer.publish({
  eventType: 'appointment.created',
  payload: { appointmentId: saved.id, userId: command.userId },
  occurredAt: new Date(),
});

// 3. Event consume (hedef feature'da)
@Processor('domain-events')
export class IdentityDomainEventConsumer extends WorkerHost {
  async process(job: Job<DomainEvent>): Promise<void> {
    if (job.data.eventType === 'appointment.created') {
      // identity modulu kendi isini yapar
    }
  }
}
```

### 2. Shared Interface Contract (Senkron Iletisim)

Senkron iletisim gerekiyorsa `shared/` altinda interface contract tanimla, her iki feature bu interface'i implement etsin.

```typescript
// shared/identity/domain/i-user-lookup.contract.ts  (v2 canon: shared/<concern>/domain/i-*.contract.ts)
export interface IUserLookup {
  existsById(userId: string): Promise<boolean>;
}

// identity feature implement eder
// randevu feature kullanir (DI ile inject)
```

**Kural:** Feature'dan feature'a DIREKT dependency YOKTUR. Iletisim her zaman shared katman uzerinden yapilir.

---

## 17. Error Display Pattern (Frontend)

Frontend'de 3 seviye hata gosterimi vardir:

### 1. Toast (Genel Hatalar - Sonner)

Mutation veya aksiyon sonrasi genel hatalar icin `toast` kullanilir.

```tsx
const mutation = useCreateXxx();

async function onSubmit(data: CreateXxxInput) {
  try {
    await mutation.mutateAsync(data);
    toast.success('Basariyla olusturuldu');
  } catch (error: unknown) {
    if (error instanceof Error) {
      toast.error(error.message);
    }
  }
}
```

### 2. Inline Alert (Sayfa Seviyesi Mesaj - shadcn Alert)

Form ustu veya sayfa seviyesinde belirgin hata mesajlari icin `Alert` bileseni kullanilir.

```tsx
{error && (
  <Alert variant="destructive">
    <AlertDescription>{error.message}</AlertDescription>
  </Alert>
)}
```

### 3. Field-Level (Zod Validation - Otomatik FormMessage)

`zodResolver` + `FormMessage` bileseni field seviyesindeki validation hatalarini otomatik gosterir. Ekstra kod gerekmez.

```tsx
// zodResolver + FormMessage bileseni otomatik gosterir
// Ekstra kod gerekmez - Pattern 9'daki Form Pattern'e bak
```

---

## 18. Loading/Pending State Pattern

### 1. Skeleton Loading (Liste Yuklenirken)

```tsx
const { data, isLoading, error } = useXxxList(filters);

if (isLoading) return <XxxTableSkeleton />;
if (error) return <Alert variant="destructive">{error.message}</Alert>;
```

### 2. Button Pending State

```tsx
<Button type="submit" disabled={mutation.isPending}>
  {mutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
</Button>
```

### 3. Optimistic Update (Ileri Seviye)

```tsx
useMutation({
  mutationFn: updateXxxAction,
  onMutate: async (updated) => {
    await queryClient.cancelQueries({ queryKey: xxxKeys.lists() });
    const previous = queryClient.getQueryData(xxxKeys.lists());
    queryClient.setQueryData(xxxKeys.lists(), (old: Xxx[]) =>
      old.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    );
    return { previous };
  },
  onError: (_err, _vars, context) => {
    if (context?.previous) {
      queryClient.setQueryData(xxxKeys.lists(), context.previous);
    }
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: xxxKeys.lists() });
  },
});
```

**Not:** Optimistic update sadece kullanici deneyimini iyilestirmek icin kullanilir. `onError`'da eski veriye geri donulur, `onSettled`'da sunucudan gercek veri cekilir.

---

## 19. File Upload Pattern

### Backend (NestJS Controller)

```typescript
// backend/src-v2/features/<feature>/<sub-feature>/presentation/<sub-feature>.controller.ts

@Post('upload')
@UseInterceptors(FileInterceptor('file', {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
}))
@ApiConsumes('multipart/form-data')
async upload(
  @UploadedFile() file: Express.Multer.File,
  @Req() req: AuthenticatedRequest,
) {
  const command = new UploadFileCommand(file, req.user.sub);
  return this.commandBus.execute(command);
}
```

### Frontend (Server Action)

```typescript
// frontend/src-v2/features/[module]/actions/upload.actions.ts
'use server';

import { apiPost } from '@/shared/lib/api/core/api-fetcher';
import type { ActionResult } from '@/shared/lib/api/contracts/common';

export async function uploadFileAction(
  formData: FormData
): Promise<ActionResult<FileResponse>> {
  try {
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return { success: false, error: 'Dosya secilmedi' };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: 'Dosya 10MB sinirini asiyor' };
    }

    const result = await apiPost<FileResponse>('/module/files/upload', formData);
    revalidatePath('/module/files');
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof ApiError) return { success: false, error: error.message };
    return { success: false, error: 'Dosya yuklenemedi' };
  }
}
```

**Kurallar:**
- Dosya boyutu hem frontend'de hem backend'de kontrol edilir (defense in depth)
- Izin verilen MIME type'lar backend'de whitelist ile belirlenir
- Upload islemi Server Action uzerinden yapilir, direkt client-to-backend YASAK
- CQRS pattern'i takip edilir: `UploadFileCommand` -> Handler

---

## 20. Repository Pattern (ABAC Repository-Driven) — Her Feature İçin Kanonik

> **HER feature ABAC kullanir.** Bi-Modal kavrami v11 refactor'da kaldirildi.
> Her yeni Resource `abacEnabled: true` ile seed edilir (alan zaten varsayilan true; mevcut
> abacEnabled alan tarihi referans icin korunur ama HER ZAMAN true).

### 20.0 Pattern Kapsami

Tum feature'lar Repository-Driven ABAC kullanir:

```
TEK YOL: HER FEATURE → PATTERN 20 (ABAC tam guc)
  - Resource seed: abacEnabled: true (varsayilan)
  - Repository: AbilityFactory inject (CASL-05)
  - Handler: AbilityFactory.buildFor() YASAK (CASL-07)
  - Custom action: @RequireAction(Action.<ACTION>, Resource.<Subject>) serbest
  - UI guard: <Can I="ACTION" a="Resource"> ZORUNLU
  - PII whitelist + mapToResponse maskeleme ZORUNLU
```

**ABAC-only sebepleri (v11 refactor sonrasi):**

| Sebep | Aciklama |
|-------|----------|
| Tek kanon = az hata | RBAC + ABAC paralel destek developer'i karistirir → role check + CASL ayni endpoint'te yaziliyor |
| Permission tutarlilik | Tum Resource'lar ABAC -> Permission seed formati tek; cross-feature audit tek format |
| Hook enforcement | CASL-05/07 hook detection her feature'da BLOCK; istisna logic'i kalmadi |
| Frontend `<Can>` zorunlu | Component'lerde role gizleme YASAK; `<Can>` ile tutarli UI guard |
| Custom action serbest | Her feature kendi action setini @RequireAction ile dogrudan tanimlar |

### 20.1 Resource Seed (abacEnabled: true)

```typescript
// backend/prisma/seeds/features/[modul]/casl.seed.ts
await prisma.resource.upsert({
  where: { key: 'YeniModul' },
  update: { abacEnabled: true },
  create: {
    key: 'YeniModul',
    model: 'YeniModul',
    route: 'yeni-modul',
    abacEnabled: true,        // ZORUNLU — her resource ABAC kullanir
    menuLabel: 'Yeni Modul',
    menuIcon: 'FileText',
    menuPermissionAction: 'READ',
  },
});
```

### 20.2 Permission Seed (Condition + Fields ZORUNLU)

```typescript
// Mudur: tam yetki (her sey)
{
  action: { connect: { code: 'MANAGE' } },
  resource: { connect: { key: 'YeniModul' } },
  // condition: yok -> her seye yetkili
}

// Personel: kendi grubunun kayitlari, sinirli alanlar
{
  action: { connect: { code: 'READ' } },
  resource: { connect: { key: 'YeniModul' } },
  condition: { groupPath: { startsWith: '{{groupPath}}' } },
}

// RolePermission seed (fields whitelist):
{
  role: { connect: { code: 'YENI_MODUL_PERSONEL' } },
  permission: { connect: { id: readPerm.id } },
  fields: ['id', 'ad', 'durum', 'olusturmaTarihi'],  // WHITELIST
}
```

### 20.3 Repository (AbilityFactory Inject)

```typescript
@Injectable()
export class YeniModulRepository implements IYeniModulRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: AbilityFactory,  // ZORUNLU
  ) {}

  async findMany(criteria: YeniModulCriteria, userId: string): Promise<PaginatedResult<YeniModul>> {
    const ability = await this.abilityFactory.buildFor(userId);

    // 1. ABAC where injection (instance-level)
    const accessible = accessibleBy(ability, 'READ').YeniModul;
    if (accessible === undefined) {
      throw new ForbiddenError('Bu kaynaga READ erisimi yok');
    }
    const caslWhere = accessible;
    const where = {
      deletedAt: null,
      ...caslWhere,
      ...criteria.filters,
    };

    // 2. Field-level select (whitelist)
    const fields = FieldFilterHelper.getPermittedFields(ability, 'READ', 'YeniModul');
    const select = FieldFilterHelper.buildSelect(fields);

    // 3. Query
    const [records, total] = await Promise.all([
      this.prisma.yeniModul.findMany({ where, select, skip: criteria.skip, take: criteria.take }),
      this.prisma.yeniModul.count({ where }),
    ]);

    // 4. Map with PII handling
    return {
      data: records.map((r) => this.mapToResponse(r, fields)),
      total,
      page: Math.floor((criteria.skip ?? 0) / (criteria.take ?? 20)) + 1,
      limit: criteria.take ?? 20,
    };
  }

  private mapToResponse(entity: any, allowedFields: string[]): Partial<YeniModul> {
    const response: any = {};
    for (const field of allowedFields) {
      if (field === 'tcKimlikNoSon4' && entity.tcKimlikNo) {
        response.tcKimlikNoSon4 = PiiMaskingHelper.last4(entity.tcKimlikNo);
      } else if (field in entity) {
        response[field] = entity[field];
      }
    }
    return response;
  }

  async findById(id: string, userId: string): Promise<YeniModul | null> {
    const ability = await this.abilityFactory.buildFor(userId);
    const accessible = accessibleBy(ability, 'READ').YeniModul;
    if (accessible === undefined) {
      throw new ForbiddenError('Bu kaynaga READ erisimi yok');
    }
    const caslWhere = accessible;

    const record = await this.prisma.yeniModul.findFirst({
      where: { id, deletedAt: null, ...caslWhere },
    });

    return record ? this.mapToEntity(record) : null;
  }
}
```

### 20.4 Handler (Yetki Kodu YAZMAZ — CASL-07)

```typescript
@QueryHandler(ListYeniModulQuery)
export class ListYeniModulHandler implements IQueryHandler<ListYeniModulQuery> {
  constructor(
    @Inject('IYeniModulRepository')
    private readonly repo: IYeniModulRepository,
  ) {}

  async execute(query: ListYeniModulQuery) {
    // Handler temiz — sadece userId iletir, Repository ABAC enforcement yapar
    return this.repo.findMany(query.criteria, query.requesterId);
  }
}
```

### 20.5 Write Command — Domain Business Rule (Entity Method / Domain Service) + CASL Custom Action

> **Not:** "Domain Validator" terimi YANILTICI olduğu için **kaldırıldı**. Business rule iki yerden birinde yaşar:
> 1. **Entity.create()** factory veya entity method'u (örn. `.approve()`) — state machine kuralları
> 2. **Domain Service** (`domain/services/`) — cross-entity rule'lar (birden fazla entity'yi kapsayan iş kuralı)
>
> Input validation ise Command/Query seviyesinde (`class-validator` decorator'ları ile — Command HTTP DTO görevini de görür; ayrı `presentation/dtos/` gerekmez).

```typescript
// Domain: state machine (kim degil, ne degisebilir kurali)
class YeniModulEntity {
  approve(): void {
    if (!['DRAFT', 'IN_REVIEW'].includes(this.status)) {
      throw new UnprocessableEntityException('Sadece taslak/incelemede basvuru onaylanir');
    }
    this.status = 'APPROVED';
  }
}

// Controller: custom action (kim yetkili kurali — CASL'e)
@Patch(':id/approve')
@RequireAction(Action.APPROVE, Resource.YeniModul)   // Custom action — sadece KURUL_UYESI rolune atanmis
async approve(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
  return this.commandBus.execute(new ApproveYeniModulCommand(id, req.user.sub));
}

// Handler: domain cagrisi
async execute(command: ApproveYeniModulCommand) {
  const entity = await this.uow.yeniModuls.findById(command.id, command.requesterId);
  if (!entity) throw new NotFoundException();

  entity.approve();  // Domain state machine

  await this.uow.transaction(() => this.uow.yeniModuls.update(entity));
  await this.auditProducer.push({ /* ... */ });
}
```

### 20.6 Frontend `<Can>` Pattern

```tsx
'use client';
import { Can } from '@/shared/components/atoms/Can';

export function YeniModulCard({ item }: { item: YeniModul }) {
  return (
    <Card>
      <CardContent>
        <h3>{item.ad}</h3>

        {/* Field-level: PII alani sadece yetkisi olana */}
        <Can I="READ" a="YeniModul" field="tcKimlikNo">
          <p>TC: {item.tcKimlikNo}</p>
        </Can>

        {/* Instance-level: bu kaydi update edebilir mi */}
        <Can I="UPDATE" a="YeniModul" this={item}>
          <EditButton id={item.id} />
        </Can>

        {/* Custom action: APPROVE — sadece kurul uyesi */}
        <Can I="APPROVE" a="YeniModul" this={item}>
          <ApproveButton id={item.id} />
        </Can>
      </CardContent>
    </Card>
  );
}
```

### 20.8 Write Methods Instance-Level ABAC

UPDATE/DELETE için instance-level kontrol ZORUNLU:

```typescript
@Injectable()
export class BasvuruRepository implements IBasvuruRepository {
  constructor(
    private prisma: PrismaService,
    private abilityFactory: AbilityFactory,
  ) {}

  async update(entity: Basvuru, userId: string): Promise<Basvuru> {
    const ability = await this.abilityFactory.buildFor(userId);

    // Instance-level check
    if (!ability.can('UPDATE', subject('Basvuru', entity))) {
      throw new ForbiddenError('Bu basvuruyu guncelleme yetkisi yok');
    }

    // Field-level write whitelist
    const writableFields = FieldFilterHelper.getWritableFields(ability, 'UPDATE', 'Basvuru');
    const safeData = pick(entity.toPersistence(), writableFields);

    const updated = await this.prisma.basvuru.update({
      where: { id: entity.id, deletedAt: null },
      data: safeData,
    });

    return this.toDomain(updated);
  }

  async softDelete(id: string, userId: string): Promise<void> {
    const entity = await this.findById(id, userId);
    if (!entity) throw new NotFoundError('Basvuru bulunamadi');

    const ability = await this.abilityFactory.buildFor(userId);
    if (!ability.can('DELETE', subject('Basvuru', entity))) {
      throw new ForbiddenError('Silme yetkisi yok');
    }

    await this.prisma.basvuru.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
```

### 20.9 Nested Aggregate ABAC

Aggregate child'lar (örn. Basvuru.belgeler[]) için ayrı ABAC kontrolü:
- Root entity'ye ABAC uygulanır (Basvuru görünür mü)
- Child collection'a field-level whitelist uygulanır (belgeler okunabilir mi)
- Cross-aggregate erişim (Belge'yi başka aggregate'ten import) AbilityFactory ile ayrı kontrol

Repository pattern:
```typescript
async findById(id: string, userId: string): Promise<Basvuru | null> {
  const ability = await this.abilityFactory.buildFor(userId);
  const caslWhere = accessibleBy(ability, 'READ').Basvuru;
  if (caslWhere === undefined) throw new ForbiddenError();

  const includeFields = FieldFilterHelper.getPermittedFields(ability, 'READ', 'Basvuru');
  const includeBelgeler = includeFields.includes('belgeler');

  const record = await this.prisma.basvuru.findFirst({
    where: { id, deletedAt: null, ...caslWhere },
    include: {
      belgeler: includeBelgeler ? { where: { deletedAt: null } } : false,
      aileUyeleri: includeFields.includes('aileUyeleri') ? true : false,
    },
  });

  return record ? this.toDomain(record) : null;
}
```

### 20.7 Checklist — ABAC Feature (her feature icin)

PR acmadan once 5 zorunlu kontrol:

- [ ] Resource seed `abacEnabled: true` iceriyor
- [ ] Permission seed condition + fields tanimli (her rol icin)
- [ ] Repository AbilityFactory constructor inject ediyor
- [ ] Repository methods userId parametre aliyor
- [ ] Frontend ekranlarda `<Can>` pattern'i kullaniyor (RBAC `roles.includes` YOK)

---

<!-- KALDIRILDI (v11 refactor): Pattern 21 (Eski Feature'a Dokunma — Negative Pattern)
     Bi-Modal kavrami v11 refactor ile kaldirildi. HER feature ABAC kullanir.
     Eski feature konsepti, abacEnabled false durumu, roles.includes RBAC pattern'i,
     CASL-06 kurali artik YOK.
     Tum feature'lar Pattern 20'yi uygular. -->

> **Bi-Modal kavrami kaldirildi.** Plugin v11 refactor sonrasi tum feature'lar
> ABAC kullanir (Pattern 20). Eski feature / `abacEnabled: false` / RBAC fallback
> akilda tutulmaz. Her Resource seed'i `abacEnabled: true` ile baslar.

---

## 22. Outbox Pattern (At-least-once Event Delivery)

### Outbox Tablosu (Prisma)

```prisma
model OutboxEvent {
  id            String    @id @default(uuid())
  eventType     String    // 'user.created', 'audit.log', vs.
  payload       Json
  correlationId String
  createdAt     DateTime  @default(now())
  dispatchedAt  DateTime? // null = pending, doluysa BullMQ'ya gönderilmiş

  @@index([dispatchedAt, createdAt])
}
```

### Handler Pattern (Outbox ile)

```typescript
async execute(command: CreateXxxCommand): Promise<CreateXxxResult> {
  const { requesterId, ...data } = command;

  const result = await this.uow.transaction(async () => {
    const entity = XxxEntity.create(data);
    const saved = await this.uow.xxxs.create(entity);

    // Outbox writes — ATOMIC with entity
    await this.uow.outbox.append({
      eventType: 'audit.log',
      payload: { entityType: 'Xxx', entityId: saved.id, action: 'create', actorId: requesterId, body: data },
      correlationId: requestContext.getStore()?.correlationId,
    });

    await this.uow.outbox.append({
      eventType: 'xxx.created',
      payload: { xxxId: saved.id, name: saved.name },
      correlationId: requestContext.getStore()?.correlationId,
    });

    return saved;
  });

  return CreateXxxResult.from(result);
}
```

### Outbox Relay Worker (shared/messaging/infrastructure)

```typescript
@Injectable()
export class OutboxRelayWorker {
  @Cron('*/2 * * * * *')  // Her 2 saniyede bir
  async relay() {
    const pending = await this.prisma.outboxEvent.findMany({
      where: { dispatchedAt: null },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });

    for (const event of pending) {
      const queue = this.routeToQueue(event.eventType);  // 'audit' veya 'domain-events'
      await queue.add(event.eventType, event.payload, {
        jobId: event.id,  // Idempotency
      });
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { dispatchedAt: new Date() },
      });
    }
  }
}
```

**Kural:** Outbox tablosu da `deletedAt` filtresi gerektirmez (zaten append-only).
30 gün sonra `dispatchedAt IS NOT NULL` satırları cron job ile arşivlenir.

> Outbox + idempotent consumer kombinasyonu çoğu compensation senaryosunu kapsar. Karmaşık çoklu-adım workflow için Saga pattern Faz 2 dokümanında ele alınır.

---

## 23. Aggregate Root Pattern

### Aggregate Root Entity

```typescript
export class Basvuru {
  private constructor(
    public readonly id: string,
    public readonly basvuruNo: BasvuruNo,           // Value Object
    public readonly basvuranTcKimlik: TcKimlik,     // Value Object
    public durum: BasvuruDurum,                     // State machine
    private readonly _aileUyeleri: AileUyesi[],     // Private child collection
    private readonly _belgeler: Belge[],
    public readonly malBeyani: MalBeyani | null,
    public readonly olusturmaTarihi: Date,
    public deletedAt: Date | null,
  ) {}

  // Factory — invariant validation BURADA
  static create(data: {
    basvuranTcKimlik: TcKimlik;
    aileUyeleri: AileUyesi[];
  }): Basvuru {
    if (data.aileUyeleri.length === 0) {
      throw new DomainError('Basvuru en az 1 aile uyesi gerektirir');
    }
    if (data.aileUyeleri.length > 12) {
      throw new DomainError('Bir basvuruda en fazla 12 aile uyesi olabilir');
    }
    return new Basvuru(
      crypto.randomUUID(),
      BasvuruNo.create(),
      data.basvuranTcKimlik,
      BasvuruDurum.TASLAK,
      data.aileUyeleri,
      [],
      null,
      new Date(),
      null,
    );
  }

  // Child erişimi public READ-ONLY
  get aileUyeleri(): readonly AileUyesi[] {
    return this._aileUyeleri;
  }

  // Behavior — child management ROOT ÜZERINDEN
  addBelge(belge: Belge): void {
    if (this.durum === BasvuruDurum.ONAYLANDI) {
      throw new DomainError('Onaylanmis basvuruya belge eklenemez');
    }
    this._belgeler.push(belge);
  }

  // State transition (state machine)
  onayla(): DomainEvent[] {
    if (this.durum !== BasvuruDurum.INCELEMEDE) {
      throw new DomainError('Sadece incelemedeki basvurular onaylanir');
    }
    this.durum = BasvuruDurum.ONAYLANDI;
    return [new BasvuruOnaylandiEvent(this.id, new Date())];
  }
}
```

### Kural

- Child entity'lere `Repository` YOK — sadece root için repository
- Child'lar root üzerinden okunur (`basvuru.belgeler`)
- Child mutation root method'larıyla (`basvuru.addBelge(...)`)
- Cross-aggregate referans = sadece root ID ile (FK var, navigasyon yok)

---

## 24. Domain Exception Pattern

```typescript
// domain/errors/basvuru.errors.ts — pure TypeScript
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

// shared/filters/domain-error.filter.ts — Global exception filter
@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const status = this.mapToHttpStatus(error.code);  // BASVURU_ONAYLANAMAZ → 422
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
- Domain layer'da SADECE `DomainError` ve alt sınıfları throw edilir
- Application/Infrastructure layer NestJS exception kullanabilir (ConflictException, NotFoundException)
- DomainErrorFilter global filter olarak HTTP status'a çevirir
- Domain layer NestJS exception'larını import EDEMEZ (MOD-02)

---

## 25. Anti-Corruption Layer (3rd Party Integration)

> **Bu pattern Pattern 31'e taşınmıştır.**
> Detay: [Pattern 31 — Anti-Corruption Layer (ACL) Pattern](#pattern-31--anti-corruption-layer-acl-pattern)
>
> Pattern 25 başlığı backward-compatibility için korunur — eski cross-ref'ler buradan Pattern 31'e yönlendirilir.

---

## 26. Specification Pattern (Complex Domain Query)

Complex business rule query'leri (örn. "yardım almaya uygun başvurular") handler'da Prisma where ile yazılırsa domain leak olur. Specification pattern domain'de yazılır, infrastructure'da Prisma'ya çevrilir.

```typescript
// domain/specifications/yardim-uygunluk.spec.ts
export class YardimaUygunSpecification {
  constructor(
    private readonly minAylikGelir: number,
    private readonly maxAylikGelir: number,
    private readonly minAileUyeSayisi: number,
  ) {}

  isSatisfiedBy(basvuru: Basvuru): boolean {
    return basvuru.aylikGelir >= this.minAylikGelir
        && basvuru.aylikGelir <= this.maxAylikGelir
        && basvuru.aileUyeleri.length >= this.minAileUyeSayisi
        && basvuru.durum === BasvuruDurum.INCELEMEDE;
  }

  // Infrastructure çevirisi (Prisma where)
  toPrismaWhere(): Prisma.BasvuruWhereInput {
    return {
      aylikGelir: { gte: this.minAylikGelir, lte: this.maxAylikGelir },
      aileUyeleri: { _count: { gte: this.minAileUyeSayisi } },
      durum: BasvuruDurum.INCELEMEDE,
    };
  }
}

// Handler kullanımı
async execute(query: ListUygunBasvurularQuery) {
  const spec = new YardimaUygunSpecification(2000, 15000, 3);
  return this.basvuruRepo.findBySpecification(spec, query.requesterId);
}
```

---

## 27. Domain Service Kullanımı

Domain Service **cross-entity business rule** için kullanılır. Tek entity üzerinde yapılabiliyorsa entity method'una koy; iki+ entity gerektiriyorsa domain service.

```typescript
// domain/services/basvuru-onay.service.ts
export class BasvuruOnaySolicitor {
  // Cross-entity rule: Basvuru ONAYLANIRKEN tüm aile üyelerinin TC KPS doğrulaması olmuş olmalı
  validateOnayKosulu(basvuru: Basvuru, kpsDogrulama: KimlikBilgisi[]): void {
    const dogrulanmis = new Set(kpsDogrulama.map(k => k.tcKimlik.value));
    const eksik = basvuru.aileUyeleri.filter(u => !dogrulanmis.has(u.tcKimlik.value));
    if (eksik.length > 0) {
      throw new BasvuruEksikKpsDogrulamasiError(eksik.map(u => u.tcKimlik.maskeli()));
    }
  }
}
```

**Kural:**
- Tek entity = entity method (Pattern 23 / Rich Domain)
- İki+ entity = domain service
- Domain service framework-independent (NestJS @Injectable HAYIR — pure class)
- Application layer'da @Injectable wrapper oluşturulur (DI için)

---

## Pattern 28 — Idempotency Log Pattern

### Hangi Kuralı Uygular
[EVT-05 (Idempotent Consumer)](./IRON_RULES_EVENTS.md#kural-5-evt-05--idempotent-consumer-critical), [EVT-06 (Idempotency Log Tablo Şeması)](./IRON_RULES_EVENTS.md#kural-6-evt-06--idempotency-log-tablo-şeması-high)

### Ne Zaman Kullan
Her `@Process(...)` decorator'lı BullMQ consumer'da. **İstisnasız.**

### Ne Zaman Kullanma
- Tek seferlik / sync command handler'larda (BullMQ değil)
- Cache invalidation gibi natural-idempotent operasyonlarda (upsert zaten dedup)

### Anatomi

```
backend/src-v2/shared/messaging/
├── domain/processed-event.entity.ts          ← Prisma model
├── application/
│   ├── processed-event.repository.ts        ← exists/markProcessed
│   └── idempotent.consumer.base.ts          ← Helper base class
└── infrastructure/
    └── processed-event-cleanup.cron.ts      ← 90-day retention cleanup
```

### Kanonik — Helper Base Class

```typescript
// shared/messaging/application/idempotent.consumer.base.ts
@Injectable()
export abstract class IdempotentConsumerBase {
  protected abstract readonly consumerId: string;
  protected abstract readonly logger: Logger;

  constructor(protected readonly processedEvents: ProcessedEventRepository) {}

  protected async processOnce<TPayload>(
    job: Job<EventEnvelope<TPayload>>,
    handler: (envelope: EventEnvelope<TPayload>) => Promise<void>,
  ): Promise<void> {
    const { eventId } = job.data;

    // Idempotency check
    if (await this.processedEvents.exists(eventId, this.consumerId)) {
      this.logger.warn('Duplicate event skipped', { eventId, consumerId: this.consumerId });
      return;
    }

    // Process
    await handler(job.data);

    // Mark processed (success only)
    await this.processedEvents.markProcessed(eventId, this.consumerId);
  }
}
```

### Kanonik — Consumer Kullanımı

```typescript
@Processor('domain-events')
export class IdentityDomainEventConsumer extends IdempotentConsumerBase {
  protected readonly consumerId = 'identity:user-created-listener';
  protected readonly logger = new Logger(IdentityDomainEventConsumer.name);

  constructor(
    processedEvents: ProcessedEventRepository,
    private readonly userListProjection: UserListProjection,
    private readonly smsContract: ISmsContract,
  ) {
    super(processedEvents);
  }

  @Process('user.created.v1')
  async handleUserCreated(job: Job<EventEnvelope<UserCreatedV1Payload>>) {
    await this.processOnce(job, async (env) => {
      await this.userListProjection.upsert(env.payload);
      if (!env._replay) {
        await this.smsContract.sendWelcomeSms(env.payload.phone, env.payload.fullName);
      }
    });
  }
}
```

### Testing

```typescript
describe('IdentityDomainEventConsumer', () => {
  it('aynı eventId 2 kez gelse 1 kez işlenir', async () => {
    const job1 = mockJob({ eventId: 'evt-1', payload: { ... } });
    await consumer.handleUserCreated(job1);
    await consumer.handleUserCreated(job1);  // duplicate

    expect(userListProjection.upsert).toHaveBeenCalledTimes(1);
    expect(smsContract.sendWelcomeSms).toHaveBeenCalledTimes(1);
  });

  it('replay flag varken SMS gönderilmez', async () => {
    const job = mockJob({ eventId: 'evt-2', _replay: true, payload: { ... } });
    await consumer.handleUserCreated(job);

    expect(userListProjection.upsert).toHaveBeenCalled();
    expect(smsContract.sendWelcomeSms).not.toHaveBeenCalled();
  });
});
```

### Anti-Pattern (BADI'den)
> NOT: Aşağıdaki mutlak `D:\BADI\...` yolları **v1-arşiv, geçersiz** — yalnızca tarihsel anti-pattern kanıtı. Bu yollarda dosya ARAMAYIN/AÇMAYIN (v2 aktif ağaç `backend/src-v2/`).

BADI'de hiç BullMQ consumer yok. Welcome SMS `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-sms.handler.ts:148-156` fire-and-forget Promise — idempotency yok, dedup yok, retry yok. Yeni proje bu pattern'a göre yazılır.

### Cross-Ref
EVT-05, EVT-06, EVT-09 (replay flag dedup'a etki etmez — yine mark processed).

---

## Pattern 29 — Event Schema Versioning Pattern

### Hangi Kuralı Uygular
[EVT-03 (Schema Versioning)](./IRON_RULES_EVENTS.md#kural-3-evt-03--schema-versioning-high)

### Ne Zaman Kullan
- Yeni event yaratırken (her event semantik versiyon taşır)
- Mevcut event payload'ı **breaking** değişirken (yeni versiyon emit + cleanup playbook)

### 4-Faz Migration Playbook

#### Faz 1 — Hazırlık (PR #1)
1. Yeni payload type `UserCreatedV2Payload` tanımla
2. Yeni eventType `'user.created.v2'`
3. Schema versioning testleri yaz (her ikisi de geçer)

#### Faz 2 — Dual Publish (PR #2 — production'a geçer)

```typescript
// Producer her ikisini de publish eder
await this.outbox.append(this.envelopeBuilder.build({
  eventType: 'user.created.v1',
  eventVersion: 1,
  source: 'identity',
  payload: { userId, email },
}));
await this.outbox.append(this.envelopeBuilder.build({
  eventType: 'user.created.v2',
  eventVersion: 2,
  source: 'identity',
  payload: { userId, email, ad, soyad },
}));
```

#### Faz 3 — Consumer Migration (her consumer ayrı PR)

```typescript
@Processor('domain-events')
export class IdentityListener {
  // Eski (deprecated)
  @Process('user.created.v1')
  async handleV1(job: Job<EventEnvelope<UserCreatedV1Payload>>) {
    this.logger.warn('v1 listener still active — migrate to v2', { eventId: job.data.eventId });
    // eski mantık
  }

  // Yeni
  @Process('user.created.v2')
  async handleV2(job: Job<EventEnvelope<UserCreatedV2Payload>>) {
    // yeni mantık
  }
}
```

#### Faz 4 — Cleanup (PR #N — tüm consumer'lar v2'ye geçtikten sonra)
1. Producer artık sadece v2 publish eder (v1 emit kaldırılır)
2. v1 listener'lar silinir
3. v1 payload type silinir
4. Schema registry'den v1 işaretlenir (audit için)

### Backward-Compatible Değişiklikler (aynı versiyon OK)
- Yeni opsiyonel alan ekleme
- Enum'a yeni değer ekleme (consumer default case'i ele alıyor olmalı)
- Documentation/comment değişikliği

### Breaking Changes (yeni versiyon ZORUNLU)
- Required alan silme
- Field type değiştirme (string → object)
- Alan semantiği değiştirme (`amount` artık kuruş değil lira)
- Enum değeri silme/yeniden tanımlama

### Decoder Strategy — Upcaster (opsiyonel)

Eski event'leri yeni schema'ya çevirmek için (özellikle replay/projection rebuild için):

```typescript
// shared/messaging/upcasters/user-created-upcaster.ts
@Injectable()
export class UserCreatedUpcaster {
  upcast(envelope: EventEnvelope<UserCreatedV1Payload>): EventEnvelope<UserCreatedV2Payload> {
    return {
      ...envelope,
      eventType: 'user.created.v2',
      eventVersion: 2,
      payload: {
        ...envelope.payload,
        ad: 'unknown',     // Default — v1'de bu alan yoktu
        soyad: 'unknown',
      },
    };
  }
}
```

### Anti-Pattern (Kavramsal)
- "v1 payload'ı silelim çünkü kimse kullanmıyor" — replay/audit için saklanmalı
- "Tek versiyon, payload'ı değiştirelim" — silent kırılma, downstream consumer'lar haber almaz

### Cross-Ref
EVT-03 (Schema Versioning Rule), EVT-09 (Replay — upcaster gerekli olabilir).

---

## Pattern 30 — Tombstone Event Pattern (KVKK Unutulma — Strateji B Pseudonymization)

### Hangi Kuralı Uygular
[EVT-10 (Tombstone Event)](./IRON_RULES_EVENTS.md#kural-10-evt-10--tombstone-event-kvkk-unutulma-hakkı--strateji-b-pseudonymization-critical), [Kural 20.3 (KVKK-03 Unutulma Hakkı)](./IRON_RULES_BACKEND.md)

### Ne Zaman Kullan
- KVKK Madde 7 başvurusu (vatandaş kendi silme talebi)
- Mahkeme kararı / yasal silme
- Admin tarafından politika ihlali silme

### Ne Zaman Kullanma
- Soft delete (deletedAt) — bu KVKK silme değil, application-level
- Hata düzeltme — UPDATE yeterli

### End-to-End Akış

```
1. POST /kvkk/forget-me                                    (vatandaş self-service)
   veya POST /admin/kvkk/forget/:userId                    (admin)
   ↓
2. ForgetUserCommand → ForgetUserHandler
   ↓
3. Transaction:
   a) User entity: blocked=true, pseudonymized fields (name, tcKimlik, phone, address)
   b) Outbox: user.forgotten.v1 event
   ↓
4. Outbox relay → BullMQ
   ↓
5. Tüm consumer'lar (per-feature pseudonymize listener):
   - identity:user-forgotten-listener         → kendi projection'unda pseudonymize
   - randevu-sistemi:user-forgotten-listener  → randevu kayıtlarındaki PII pseudonymize
   - sosyal-yardim:user-forgotten-listener    → başvuru kayıtları
   - vatandas-kayit:user-forgotten-listener   → dosya/aile-uyesi
   - audit:user-forgotten-listener            → audit_log içindeki PII pseudonymize (SATIR SİLİNMEZ)
   - outbox:user-forgotten-listener           → outbox geçmiş payload'larındaki PII pseudonymize
```

### Kanonik — Command + Handler

```typescript
// features/identity/users/application/commands/forget-user/forget-user.command.ts
export class ForgetUserCommand extends BaseCommand {
  @IsUUID() readonly userId!: string;
  @IsIn(['user_request', 'admin_action', 'court_order']) readonly reason!: ForgetReason;
}

// features/identity/users/application/commands/forget-user/forget-user.handler.ts
@CommandHandler(ForgetUserCommand)
export class ForgetUserHandler {
  async execute(cmd: ForgetUserCommand): Promise<void> {
    return this.uow.transaction(async () => {
      const user = await this.uow.users.findById(cmd.userId);
      if (!user) throw new NotFoundException('Kullanici bulunamadi');

      const pseudonym = `[REDACTED-${cmd.userId.slice(0, 8)}]`;
      user.pseudonymize(pseudonym);                 // tcKimlik, phone, name, address → pseudonym
      user.block('kvkk_forgotten');
      await this.uow.users.update(user);

      await this.uow.outbox.append(this.envelopeBuilder.build({
        eventType: 'user.forgotten.v1',
        eventVersion: 1,
        source: 'identity',
        causationId: cmd.commandId,
        payload: {
          userId: cmd.userId,
          tcKimlikNo: user.originalTcKimlikNo,      // Pre-pseudonymize value (listener'lar bunu arar)
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

### Kanonik — Audit Listener (KVKK-03 + AUDIT-03 Uyumlu)

```typescript
@Processor('domain-events')
export class AuditLogForgottenListener extends IdempotentConsumerBase {
  protected readonly consumerId = 'audit:user-forgotten-listener';
  protected readonly logger = new Logger(AuditLogForgottenListener.name);

  @Process('user.forgotten.v1')
  async handleUserForgotten(job: Job<EventEnvelope<UserForgottenV1Payload>>) {
    await this.processOnce(job, async (env) => {
      const { tcKimlikNo, pseudonym } = env.payload;

      // Audit log içinde PII pseudonymize — SATIR SİLİNMEZ (KVKK-03 + AUDIT-03)
      await this.prisma.$executeRaw`
        UPDATE audit_log
        SET payload = jsonb_set(payload, '{tcKimlikNo}', ${`"${pseudonym}"`}::jsonb)
        WHERE payload->>'tcKimlikNo' = ${tcKimlikNo}
      `;
      await this.prisma.$executeRaw`
        UPDATE audit_log
        SET payload = jsonb_set(payload, '{phone}', '"[REDACTED]"'::jsonb)
        WHERE actor_id = ${env.payload.userId}
      `;
    });
  }
}
```

### KVKK Denetim Sorgusu (Somut Açıklama)

```sql
-- "X TC kimlik'in verisi nasıl anonimleştirildi?"
SELECT 
  entity_type, 
  entity_id, 
  action, 
  created_at,
  payload->>'tcKimlikNo' AS current_value
FROM audit_log
WHERE entity_id = '<userId>'
ORDER BY created_at;

-- Beklenen sonuç:
-- pseudonymize öncesi gerçek TC (örn. '12345678901')
-- pseudonymize sonrası [REDACTED-xxxxxxxx]
```

### Strateji A vs B (Karar Geçmişi)

| | Strateji A — Crypto-Shredding | Strateji B — Pseudonymization (Seçilen) |
|---|---|---|
| Karmaşıklık | Yüksek (per-user-key service, key rotation, encrypted at rest) | Düşük (batch UPDATE) |
| Silme performansı | O(1) | O(N) — büyük volume'da yavaş |
| Read cost | Her event read = decrypt | Read cost yok |
| KVKK denetim açıklaması | "Anahtar silindi, veri okunamıyor" — abstract | "Şu alanlar maskelendi, satırlar duruyor" — somut |
| Belediye scale (1M kayıt) | Overkill | Yeterli (gece batch silme OK) |

**Karar:** Strateji B (Pseudonymization) — brainstorming spec Bölüm 3.7. Strateji A forward-looking yedek.

### Anti-Pattern
- `prisma.auditLog.delete()` çağırmak — KVKK-03 ile AUDIT-03 ikisi de yasaklar
- Pseudonymize öncesi PII'yi log'a yazmak (zaten audit içinde, ek log şart değil)
- Pseudonymize edilecek alanları (name, address) AT olduğu gibi bırakmak — hepsi pseudonymize

### BADI Notu
BADI'de KVKK silme akışı tanımsız. Audit immutability (AUDIT-03) Kural 7.3'te var ama unutulma hakkı (KVKK-03) Kural 20.3'te genel terms — concrete pattern yok. Yeni proje için Day 1 kanonik.

### Cross-Ref
EVT-10 (Tombstone Rule), [Kural 7.3 AUDIT-03](./IRON_RULES_BACKEND.md), [Kural 20.3 KVKK-03](./IRON_RULES_BACKEND.md), Pattern 28 (Idempotent listener pattern).

---

## Pattern 31 — Anti-Corruption Layer (ACL) Pattern

### Hangi Kuralı Uygular
[EVT-00 (Cross-Feature İletişim Karar Matrisi)](./IRON_RULES_EVENTS.md#kural-0-evt-00--cross-feature-i̇letişim-karar-matrisi-critical), [EVT-11 (ACL Event Boundary)](./IRON_RULES_EVENTS.md#kural-11-evt-11--acl-event-boundary-high), [OBS-12 (External Service Observability)](./IRON_RULES_OBSERVABILITY.md#kural-12-obs-12--external-service-acl-observability-critical)

### Ne Zaman Kullan
**Her dış sistem entegrasyonunda:**
- KPS (NVI Kimlik Paylaşım Sistemi)
- SMS gateway (NetGSM, Twilio)
- Banka POS (3D Secure)
- e-Devlet API
- Email SMTP
- File upload (S3, MinIO)
- 3rd party Türk e-Devlet API'leri

### Ne Zaman Kullanma
- İç feature'lar arası (Shared Contract yeter — bu pattern değil)
- Tek seferlik script (ad-hoc data import)

### 8 Sorumluluk Checklist (ZORUNLU — hepsi her ACL'da)

| # | Sorumluluk | Implementation |
|---|---|---|
| **S1** | Şema çevirisi (vendor → domain) | Vendor types `shared/external/<vendor>/domain/`'de PRIVATE; ACL içinde domain VO/result'a çevrilir |
| **S2** | Hata çevirisi (vendor → domain exception) | `<vendor>-error-mapper.ts` — vendor error code → domain exception class |
| **S3** | Timeout (call başına deadline) | `Promise.race([call, timeout(envMs)])` — domain exception fırlat |
| **S4** | Retry + exponential backoff + jitter | `<vendor>-retry.policy.ts` — retryable vs non-retryable ayrımı |
| **S5** | Circuit breaker | `<vendor>-circuit-breaker.config.ts` — CLOSED/OPEN/HALF-OPEN |
| **S6** | Cache (read API'lerde) | `<vendor>-cache.policy.ts` — L1 in-memory + L2 Redis + negative cache |
| **S7** | Audit + log + metric (3-stream) | `audit.append` (outbox) + `logger` (masked) + `metrics` (histogram/counter/gauge) |
| **S8** | Mock/Fake substitution (test/dev) | `InMemory<Concern>Fake` — contract test'le real impl ile aynı suite |

### Anatomi (Kanonik Klasör Yapısı)

```
backend/src-v2/shared/
├── citizen-verification/                       ← CONCERN (domain konsepti, vendor-agnostic)
│   ├── domain/
│   │   ├── citizen-verification.contract.ts   ← Interface + TOKEN
│   │   ├── citizen-verification.exceptions.ts ← Domain exception hiyerarşisi
│   │   └── value-objects/
│   │       ├── tc-kimlik.vo.ts
│   │       ├── service-area.vo.ts             ← KOCAELI=41/BASISKELE=2058 ENCAPSULATE
│   │       └── citizen-name.vo.ts
│   ├── application/
│   │   └── citizen-verification.types.ts      ← Result DTO
│   └── testing/
│       └── in-memory-citizen-verification.fake.ts  ← Fake impl (S8)
│
└── external/                                   ← VENDOR-aware ACL'lar
    └── kps/                                    ← KPS-spesifik adapter
        ├── kps.module.ts                      ← DI + Config
        ├── application/
        │   ├── kps-citizen-verification.acl.ts ← ICitizenVerificationContract impl
        │   ├── kps.client.ts                  ← SOAP/HTTP low-level
        │   ├── kps-circuit-breaker.config.ts  ← S5
        │   ├── kps-retry.policy.ts            ← S4
        │   └── kps-cache.policy.ts            ← S6
        ├── domain/
        │   ├── kps-response.types.ts          ← PRIVATE — vendor şeması, dış export YOK
        │   └── kps-error-mapper.ts            ← S2
        └── infrastructure/
            └── kps-soap.adapter.ts            ← SOAP wire detay
```

**Üç altın kural:**
1. Concern klasörü adı **iş odaklı**: `citizen-verification` (yapılacak iş), feature adı değil.
2. Vendor types **shared/external/<vendor>/domain/'de private** — feature'lar bu types'ı import edemez.
3. Domain VO'lar vendor kodlarını encapsulate eder — `ServiceArea.isInServiceArea(41, 2058)` (handler'da 41/2058 hardcoded yasak).

### Kanonik Kod — KpsCitizenVerificationAcl (Tam İmplementasyon)

```typescript
@Injectable()
export class KpsCitizenVerificationAcl implements ICitizenVerificationContract {
  private readonly logger = new Logger(KpsCitizenVerificationAcl.name);

  constructor(
    private readonly kpsClient: KpsClient,                    // Low-level wire (S1 setup)
    private readonly circuitBreaker: KpsCircuitBreaker,       // S5
    private readonly retryPolicy: KpsRetryPolicy,             // S4
    private readonly cache: ICacheService,                    // S6
    private readonly audit: IAuditOutboxProducer,             // S7 (outbox üzerinden)
    private readonly metrics: IMetricsService,                // S7
    private readonly errorMapper: KpsErrorMapper,             // S2
    @Inject('KPS_CONFIG') private readonly config: KpsConfig, // CFG-01
  ) {}

  async verify(input: CitizenVerificationInput): Promise<CitizenVerificationResult> {
    const start = Date.now();
    const cacheKey = `kps:verify:${input.tcKimlikNo.toString()}:${input.birthDate.toIsoString()}`;

    // S6 — Cache (24 saat TTL, privacy + performance)
    const cached = await this.cache.get<CitizenVerificationResult>(cacheKey);
    if (cached) {
      this.metrics.counter('kps.verify.cache_hit').inc();
      return { ...cached, source: 'cache' };
    }

    // S5 — Circuit breaker (açıksa hemen fail-fast)
    if (this.circuitBreaker.isOpen()) {
      this.metrics.counter('kps.verify.circuit_open').inc();
      throw new CitizenVerificationUnavailableException(this.circuitBreaker.retryAfterSeconds());
    }

    // S3+S4 — Timeout + Retry + Exponential Backoff + Jitter
    const kpsRaw = await this.retryPolicy.execute(async () => {
      return this.circuitBreaker.execute(async () => {
        return Promise.race([
          this.callKpsBoth(input),
          this.timeout(this.config.timeoutMs),
        ]);
      });
    });

    // S2 — Hata çevirisi (vendor → domain)
    if (!kpsRaw.address.success) {
      const domainError = this.errorMapper.mapAddressError(kpsRaw.address.errorCode);
      await this.auditFailure(input, kpsRaw, 'address', Date.now() - start);
      throw domainError;
    }
    if (!kpsRaw.yakinlik.success) {
      const domainError = this.errorMapper.mapYakinlikError(kpsRaw.yakinlik.errorCode);
      await this.auditFailure(input, kpsRaw, 'yakinlik', Date.now() - start);
      throw domainError;
    }

    // S1 — Şema çevirisi (KPS DTO → domain DTO)
    const kpsAd = kpsRaw.yakinlik.data.ad;
    const kpsSoyad = kpsRaw.yakinlik.data.soyad;
    const adresBilgisi = kpsRaw.address.data.adresBilgisi;

    // Domain VO ile karşılaştırma — vendor kodları (41, 2058) DOMAIN'e SIZMAZ
    const inServiceArea = ServiceArea.isInServiceArea(adresBilgisi.ilKodu, adresBilgisi.ilceKodu);
    if (!inServiceArea) {
      const result: CitizenVerificationResult = {
        verified: false,
        reason: 'not_in_service_area',
        detail: 'Sadece Basiskele ilcesinde ikamet eden vatandaslarimiza hizmet vermekteyiz.',
      };
      await this.cache.set(cacheKey, result, this.config.cacheTtlSeconds);
      await this.auditSuccess(input, result, Date.now() - start);
      return result;
    }

    const adMatches = input.expectedFirstName.equalsTurkish(CitizenName.create(kpsAd));
    const soyadMatches = input.expectedLastName.equalsTurkish(CitizenName.create(kpsSoyad));
    if (!adMatches || !soyadMatches) {
      const result: CitizenVerificationResult = {
        verified: false,
        reason: 'name_mismatch',
        detail: !adMatches ? 'Girilen ad nufus kayitlariyla uyusmuyor' : 'Girilen soyad nufus kayitlariyla uyusmuyor',
      };
      await this.cache.set(cacheKey, result, this.config.cacheTtlSeconds);
      await this.auditSuccess(input, result, Date.now() - start);
      return result;
    }

    const result: CitizenVerificationResult = {
      verified: true,
      identity: {
        firstName: CitizenName.create(kpsAd),
        lastName: CitizenName.create(kpsSoyad),
        address: adresBilgisi.adres,
        isInServiceArea: true,
      },
      source: 'kps',
    };

    await this.cache.set(cacheKey, result, this.config.cacheTtlSeconds);
    await this.auditSuccess(input, result, Date.now() - start);
    this.metrics.histogram('kps.verify.duration_ms').observe(Date.now() - start);
    return result;
  }

  private async callKpsBoth(input: CitizenVerificationInput) {
    // S1 — KPS'in iki API'sini paralel çağır
    const [address, yakinlik] = await Promise.all([
      this.kpsClient.queryAddress({ /* DTO mapping */ }),
      this.kpsClient.queryYakinlikListesi({ /* DTO mapping */ }),
    ]);
    return { address, yakinlik };
  }

  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new CitizenVerificationUnavailableException(60)), ms),
    );
  }

  private async auditSuccess(input: CitizenVerificationInput, result: CitizenVerificationResult, durationMs: number) {
    // S7 — 3-stream: audit (KVKK), log (masked), metric
    await this.audit.append({
      eventType: 'audit.log',
      payload: {
        entityType: 'CitizenVerification',
        action: 'query',
        actorId: input.correlationId,
        body: {
          tcKimlik: input.tcKimlikNo.toString(),    // AÇIK (audit — KVKK 8. madde)
          purpose: input.purpose,
          verified: result.verified,
          reason: result.verified ? undefined : result.reason,
          durationMs,
          source: 'kps',
        },
      },
    });
    this.logger.log('Citizen verification completed', {
      tcKimlik: input.tcKimlikNo.toMasked(),       // MASKELI (log — Kural 8.1)
      verified: result.verified,
      durationMs,
    });
  }

  private async auditFailure(input: CitizenVerificationInput, raw: any, source: string, durationMs: number) {
    this.metrics.counter('kps.verify.failure', { source }).inc();
    this.logger.warn('Citizen verification failed', {
      tcKimlik: input.tcKimlikNo.toMasked(),
      source,
      durationMs,
    });
    // Audit'i yine outbox üzerinden — failure de yasal kayıt
  }
}
```

### Kanonik — Module Wiring

```typescript
@Module({
  imports: [CqrsModule, CacheModule, MessagingModule],
  providers: [
    KpsClient,
    KpsCircuitBreaker,
    KpsRetryPolicy,
    KpsErrorMapper,
    KpsCitizenVerificationAcl,
    {
      provide: CITIZEN_VERIFICATION_CONTRACT,
      useExisting: KpsCitizenVerificationAcl,
    },
    {
      provide: 'KPS_CONFIG',
      useFactory: (config: ConfigService) => ({
        baseUrl: config.getOrThrow('KPS_BASE_URL'),
        timeoutMs: config.get<number>('KPS_TIMEOUT_MS', 3000),
        cacheTtlSeconds: config.get<number>('KPS_CACHE_TTL_SEC', 86400),  // 24 saat
        retryMaxAttempts: config.get<number>('KPS_RETRY_MAX', 3),
        retryBaseDelayMs: config.get<number>('KPS_RETRY_BASE_MS', 200),
        circuitBreakerThreshold: config.get<number>('KPS_CB_THRESHOLD', 5),
        circuitBreakerWindowSec: config.get<number>('KPS_CB_WINDOW_SEC', 60),
      } satisfies KpsConfig),
      inject: [ConfigService],
    },
  ],
  exports: [CITIZEN_VERIFICATION_CONTRACT],  // SADECE token — internal KpsClient export değil
})
export class KpsModule {}
```

### Contract Test (S8 — ZORUNLU)

Hem real (`KpsCitizenVerificationAcl`) hem fake (`InMemoryCitizenVerificationFake`) **aynı test suite'inden** geçer.

```typescript
function citizenVerificationContractTests(getImpl: () => ICitizenVerificationContract) {
  it('verified citizen returns verified=true', async () => {
    const impl = getImpl();
    const result = await impl.verify({
      tcKimlikNo: TcKimlikNo.create('11111111110'),
      birthDate: BirthDate.fromParts(1990, 1, 1),
      expectedFirstName: CitizenName.create('TEST'),
      expectedLastName: CitizenName.create('USER'),
      correlationId: 'test-1',
      purpose: 'register',
    });
    expect(result.verified).toBe(true);
  });

  it('non-Basiskele returns not_in_service_area', async () => { /* ... */ });
  it('name mismatch returns name_mismatch', async () => { /* ... */ });
  it('tc not found returns tc_not_found', async () => { /* ... */ });
}

describe('KpsCitizenVerificationAcl (real)', () => 
  citizenVerificationContractTests(() => testContainer.get(KpsCitizenVerificationAcl)));

describe('InMemoryCitizenVerificationFake', () => 
  citizenVerificationContractTests(() => new InMemoryCitizenVerificationFake()));
```

### Anti-Pattern (BADI'den Somut)
> NOT: Aşağıdaki mutlak `D:\BADI\...` yolları **v1-arşiv, geçersiz** — yalnızca tarihsel anti-pattern kanıtı. Bu yollarda dosya ARAMAYIN/AÇMAYIN (v2 aktif ağaç `backend/src-v2/`).

- `D:\BADI\badi\backend\src\features\formlar\public\application\handlers\verify-identity.handler.ts:33` — `private readonly kpsService: KpsService` (vendor concrete inject)
- `verify-identity.handler.ts:53` — `await this.kpsService.queryAddress({...})` (vendor API doğrudan)
- `verify-identity.handler.ts:110-111` — `const KOCAELI_IL_KODU = 41;` (vendor kodu domain'de)
- BADI'de 7 modülde KpsService direkt inject (KPS_SECURITY_ANALYSIS.md tespit) — tek değişiklik 7 yerde
- BADI'de circuit breaker yok, cache yok, retry yok (KPS_SECURITY_ANALYSIS.md Risk-1/Risk-2)

### Cross-Ref
EVT-00 (Karar Matrisi — ACL maddesi), EVT-11 (ACL Event Boundary), OBS-12 (ACL Observability), Pattern 25 (legacy redirect — bu pattern'a yönlendirilir).

---

## Pattern 32 — OTel ↔ Domain Event Correlation Merge

### Hangi Kuralı Uygular
[OBS-05 (Request Context + OpenTelemetry)](./IRON_RULES_OBSERVABILITY.md#kural-5-obs-05--request-context--opentelemetry-critical), [EVT-01 (Event Envelope v2)](./IRON_RULES_EVENTS.md#kural-1-evt-01--event-envelope-v2-critical), [EVT-02 (Causation + Correlation)](./IRON_RULES_EVENTS.md#kural-2-evt-02--causation--correlation-discipline-high)

### Ne Zaman Kullan
**Her request lifecycle'da.** Bu pattern proje altyapısının temeli — proje boot'unda kurulur, runtime'da görünmez işler. Doğru kurulmazsa trace bozulur, debug imkânsız.

### Anatomi

```
backend/src-v2/shared/observability/
├── request-context/
│   ├── request-context.ts                  ← AsyncLocalStorage + ReqContext interface
│   ├── request-context.middleware.ts       ← Middleware (OTel ile birleşik)
│   └── request-context.module.ts
├── logger/
│   └── pino-logger.config.ts               ← Formatter: her log'a context inject
└── tracing/
    ├── otel-sdk.config.ts                  ← OpenTelemetry SDK setup
    ├── otel-instrumentations.config.ts     ← HTTP, BullMQ, NestJS, Pino, IORedis auto-instrument
    └── bullmq-context-propagation.ts       ← Producer inject + Consumer extract
```

### Kanonik — Implementation Noktaları

| Katman | Implementation |
|---|---|
| App bootstrap | `@opentelemetry/sdk-node` initialize + `@opentelemetry/instrumentation-{http,nestjs-core,bullmq,pino,ioredis}` register |
| HTTP middleware | `RequestContextMiddleware` → AsyncLocalStorage başlat + OTel span ID merge |
| Auth Guard sonra | `ctx.userId = user.id; ctx.userRoles = user.roles` mutate |
| Pino formatter | Her log satırına `requestId/correlationId/traceId/spanId/userId` otomatik inject |
| Outbox `append` | `EventEnvelopeBuilder.build()` request context'ten otomatik okur |
| Outbox relay → BullMQ | `propagation.inject(context.active(), carrier)` ile traceparent job'a |
| BullMQ consumer | `propagation.extract(...)` ile parent context restore + child span başlat |
| OTel SDK exporter | OTLP → Tempo veya Jaeger collector |

### Kanonik — Middleware (OTel Auto-Instrument ile Birleşik)

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

### Kanonik — Pino Formatter

```typescript
// shared/observability/logger/pino-logger.config.ts
export const pinoConfig: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    log(obj) {
      const ctx = requestContext.getStore();
      if (!ctx) return obj;
      return {
        ...obj,
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        traceId: ctx.traceId,
        spanId: ctx.spanId,
        userId: ctx.userId,
      };
    },
  },
  // PII redaction (Kural 8.1)
  redact: {
    paths: ['*.tcKimlikNo', '*.tcKimlik', '*.password', '*.token', '*.accessToken', '*.refreshToken'],
    censor: '[REDACTED]',
  },
};
```

### Kanonik — BullMQ Producer/Consumer Propagation

```typescript
// shared/messaging/infrastructure/bullmq.config.ts
import { context, propagation, trace } from '@opentelemetry/api';

// Producer (outbox relay): job'a OTel context inject
async function pushWithTrace(queue: Queue, name: string, data: EventEnvelope) {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return queue.add(name, { ...data, _otelCarrier: carrier });
}

// Consumer: job'dan OTel context extract + child span başlat
@Process('user.created.v1')
async handleUserCreated(job: Job<EventEnvelope & { _otelCarrier?: Record<string, string> }>) {
  const parentContext = job.data._otelCarrier
    ? propagation.extract(context.active(), job.data._otelCarrier)
    : context.active();

  await context.with(parentContext, async () => {
    const span = trace.getTracer('bullmq').startSpan('user.created.v1 handler');
    try {
      await this.process(job.data.payload);
    } finally {
      span.end();
    }
  });
}
```

### Kullanım Sırasında (Handler 0 Satır)

Pattern doğru kurulduktan sonra **handler hiçbir şey yapmaz**:

```typescript
@CommandHandler(CreateRandevuCommand)
export class CreateRandevuHandler {
  async execute(cmd: CreateRandevuCommand) {
    // correlationId/traceId burada hiç görünmez — middleware ve envelope builder otomatik
    this.logger.info('Randevu yaratiliyor', { citizenId: cmd.citizenId });
    // ↑ Pino formatter otomatik: { requestId, correlationId, traceId, spanId, ...}

    await this.uow.outbox.append(this.envelope.build({
      eventType: 'randevu.created.v1',
      eventVersion: 1,
      source: 'randevu-sistemi',
      payload: { ... },
    }));
    // ↑ envelope.build içinde requestContext'ten correlationId, traceparent otomatik
  }
}
```

### E2E Doğrulama

```bash
# Tek request → tüm log/audit/event'lerde aynı correlationId
1. POST /api/randevu/create — header { x-request-id: 'test-123' }
2. Loki query: { correlationId="test-123" }
   → HTTP request log + handler log + outbox.append log + relay log + consumer log + projection log
3. Tempo query: traceId=<spanContext>
   → Span chain: HTTP → Handler → Outbox.append → BullMQ producer → BullMQ consumer
```

### Anti-Pattern (BADI'den ve Genel)
- BADI'de `verify-identity.handler.ts` — correlationId hiç kullanılmıyor, manuel üretim de yok
- Manuel `crypto.randomUUID()` ile correlation üret — OTel zaten yapıyor, çift work
- Pino formatter olmadan log yazımı — debug imkânsız

### Cross-Ref
OBS-05, EVT-01, EVT-02.
