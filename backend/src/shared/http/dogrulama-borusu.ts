import {
  type ArgumentMetadata,
  Injectable,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { KodluHata } from './kodlu-hata.js';

export interface DogrulamaAyrintisi {
  readonly alan: string;
  readonly neden: string;
}

// Gövde, sorgu ve yol parametresini decorator'a verilen şemayla doğrular (KR-014):
//   @Body({ schema: sema }) govde: z.infer<typeof sema>
// Şemaya uymayan değer dogrulama_hatasi olur; uyan değer şemanın ürettiği hâliyle uca gider.
// Şema verilmeyen parametre doğrulanmadan geçer (çatının davranışı).
@Injectable()
export class DogrulamaBorusu extends StandardSchemaValidationPipe {
  override async transform<T>(deger: T, meta: ArgumentMetadata): Promise<T> {
    const sema = meta.schema;
    if (sema === undefined || !this.toValidate(meta)) {
      return deger;
    }
    this.stripProtoKeys(deger);
    const sonuc = await this.validate<T>(deger, sema);
    if (sonuc.issues === undefined) {
      return sonuc.value;
    }
    // @Param('id', ...) gibi tek alanlı kullanımda şemanın yolu boştur; alan adı decorator'dan gelir.
    const onek = meta.data === undefined ? [] : [meta.data];
    const ayrinti: DogrulamaAyrintisi[] = sonuc.issues.map((sorun) => ({
      alan: [
        ...onek,
        ...(sorun.path ?? []).map((parca) =>
          String(typeof parca === 'object' ? parca.key : parca),
        ),
      ].join('.'),
      neden: sorun.message,
    }));
    throw new KodluHata('dogrulama_hatasi', 'İstek doğrulanamadı', ayrinti);
  }
}
