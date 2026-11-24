// Lint ayarı: en sıkı tip denetimli kurallar ve klasör sınırları.
// Sınırlar (KR-005, KU-007, KU-009): feature başka feature'ı içe aktarmaz;
// ortak kod (shared) hiçbir feature'ı içe aktarmaz.
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Yetki kütüphanesinin kayıt üzerinde karar veren çağrıları backend'de yasaktır (KR-010 "Derleme
// eşlemesi"; TS-002 AK-19): veri kararını sorgudaki şartla veritabanı verir. Yöntem çağrısı, köşeli
// parantezle erişim, yalın adla çağrı ve adın içe aktarılması yakalanır.
const YETKI_KARAR_CAGRISI = '^(can|cannot|throwUnlessCan|permittedFieldsOf)$';
const YETKI_KARAR_ILETISI =
  "Kayıt üzerinde karar veren yetki çağrısı backend'de yazılmaz; yetki kapısını kullanın.";
const YETKI_KARAR_YASAKLARI = [
  {
    selector: `MemberExpression[computed=false][property.name=/${YETKI_KARAR_CAGRISI}/]`,
    message: YETKI_KARAR_ILETISI,
  },
  {
    selector: `MemberExpression[computed=true][property.value=/${YETKI_KARAR_CAGRISI}/]`,
    message: YETKI_KARAR_ILETISI,
  },
  {
    selector: `CallExpression[callee.name=/${YETKI_KARAR_CAGRISI}/]`,
    message: YETKI_KARAR_ILETISI,
  },
  {
    selector: `ImportSpecifier[imported.name=/${YETKI_KARAR_CAGRISI}/]`,
    message: YETKI_KARAR_ILETISI,
  },
];

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'eslint.config.mjs',
      '**/generated/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': 'error',
      // NestJS modülleri gövdesiz, dekoratörlü sınıflardır.
      '@typescript-eslint/no-extraneous-class': [
        'error',
        { allowWithDecorator: true },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    // Satır içi yorumla kural kapatılamaz; istisna yalnız bu dosyada tanımlanır.
    linterOptions: { noInlineConfig: true },
    settings: {
      // Sınıflama, lint hangi klasörden koşarsa koşsun bu klasöre göre yapılır.
      'boundaries/root-path': import.meta.dirname,
      'boundaries/include': ['src/**/*'],
      'boundaries/legacy-templates': false,
      'boundaries/elements': [
        { type: 'shared', pattern: 'src/shared', partialMatch: false },
        {
          type: 'feature',
          pattern: 'src/features/*',
          capture: ['feature'],
          partialMatch: false,
        },
      ],
      // Kök dosyalar (main.ts, app.module.ts) bir klasör öğesi değildir; dosya olarak sınıflanır.
      'boundaries/files': [
        { pattern: 'src/*.ts', category: 'app' },
        // Ham Prisma istemcisine götüren dosyalar: belirteçler ve üretilen istemci modülleri.
        {
          pattern: [
            'src/shared/database/istemci-belirtecleri.ts',
            'src/shared/database/generated/**',
            'src/shared/database/iz/generated/**',
          ],
          category: 'ham-istemci',
        },
        // Outbox repository'si ve belirteci; feature outbox'a yalnız yazma yüzeyinden ulaşır (KR-011).
        {
          pattern: 'src/shared/messaging/outbox/outbox-repo.ts',
          category: 'outbox-repo',
        },
        // Olay ve iz yolunun feature'a kapalı parçaları (KR-012 Yükümlülük 2): kuyruk kapısının
        // bağdaştırıcısı ve göçü, iki aktarıcı ve repository'leri, tüketici tabanının repository'si.
        // Feature olay yoluna yazma yüzeyinden, abone defterinden ve tüketici tabanından ulaşır.
        {
          pattern: [
            'src/shared/messaging/kuyruk/bullmq-is-kuyrugu.ts',
            'src/shared/messaging/kuyruk/kuyruk-gocu.ts',
            'src/shared/messaging/olay/olay-aktarici.ts',
            'src/shared/messaging/olay/outbox-olay.repository.ts',
            'src/shared/messaging/tuketici/islenen-olay.repository.ts',
            'src/shared/observability/iz/iz-aktarici.ts',
            'src/shared/observability/iz/outbox-iz.repository.ts',
          ],
          category: 'olay-altyapisi',
        },
      ],
      'import/resolver': {
        typescript: { project: `${import.meta.dirname}/tsconfig.json` },
      },
    },
    rules: {
      // Hiçbir öğeye uymayan dosya ya da hedef, sınırı dolanma yolu olmasın diye hatadır.
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            {
              // Kök dosyalar her şeyi bağlar.
              from: { file: { categories: 'app' } },
              allow: {
                to: [
                  { file: { categories: 'app' } },
                  { element: { type: ['shared', 'feature'] } },
                ],
              },
            },
            {
              // Ortak kod yalnız ortak kodu içe aktarır.
              from: { element: { type: 'shared' } },
              allow: { to: { element: { type: 'shared' } } },
            },
            {
              // Feature ortak kodu ve yalnız kendi içini içe aktarır.
              from: { element: { type: 'feature' } },
              allow: {
                to: [
                  { element: { type: 'shared' } },
                  {
                    element: {
                      type: 'feature',
                      captured: {
                        feature: '{{ from.element.captured.feature }}',
                      },
                    },
                  },
                ],
              },
            },
            {
              // Feature ham istemciye ulaşamaz; veri erişimi yalnız Unit of Work'ün iki
              // kapısından geçer (KR-011). Son eşleşen politika geçerli olduğundan sondadır.
              from: { element: { type: 'feature' } },
              disallow: { to: { file: { categories: 'ham-istemci' } } },
            },
            {
              // Feature outbox repository'sine ve belirtecine ulaşamaz; notu yalnız yazma yüzeyi yazar.
              from: { element: { type: 'feature' } },
              disallow: { to: { file: { categories: 'outbox-repo' } } },
            },
            {
              // Feature kuyruk bağdaştırıcısına, aktarıcılara ve tüketici repository'sine ulaşamaz.
              from: { element: { type: 'feature' } },
              disallow: { to: { file: { categories: 'olay-altyapisi' } } },
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', ...YETKI_KARAR_YASAKLARI] },
  },
  {
    // Kuyruk paketi feature'a kapalıdır (KR-012 Yükümlülük 2). Sınır kuralı dış paketlere yalnız
    // checkAllOrigins ile bakar; o ayar her dış paketi izin listesine almayı gerektirdiğinden paket
    // yasağı ESLint'in kendi kuralıyla verilir.
    files: ['src/features/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'bullmq',
              message: 'Feature kuyruk paketini içe aktaramaz.',
            },
          ],
          patterns: [
            {
              group: ['bullmq/*'],
              message: 'Feature kuyruk paketini içe aktaramaz.',
            },
          ],
        },
      ],
      // no-restricted-imports dinamik içe aktarmaya (import(...)) bakmaz; paket adı düz metin ya da
      // şablon metniyle verilen dinamik içe aktarma da yasaktır (TS-003 Onarım). \x2F, "/" demektir;
      // seçici dili düzenli ifadede "/" kabul etmez. Aynı kural adı üstteki bloğu ezdiğinden yetki
      // çağrısı yasakları burada da verilir.
      'no-restricted-syntax': [
        'error',
        ...YETKI_KARAR_YASAKLARI,
        {
          selector:
            "ImportExpression[source.type='Literal'][source.value=/^bullmq($|\\x2F)/]",
          message: 'Feature kuyruk paketini içe aktaramaz.',
        },
        {
          selector:
            "ImportExpression[source.type='TemplateLiteral'][source.quasis.0.value.cooked=/^bullmq($|\\x2F)/]",
          message: 'Feature kuyruk paketini içe aktaramaz.',
        },
      ],
    },
  },
);
