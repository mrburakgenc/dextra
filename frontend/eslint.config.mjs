// Lint ayarı: tip bilgili katı kurallar, çatının ve hook'ların kuralları, katman sınırı.
// Sınır (TS-004 Yapı): içe aktarma src/app -> src/features -> src/shared yönünde serbesttir;
// tersi ve bir feature'dan öbürüne içe aktarma hatadır.
import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'next-env.d.ts',
      'eslint.config.mjs',
      'postcss.config.mjs',
    ],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  nextPlugin.configs['core-web-vitals'],
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    // Satır içi yorumla kural kapatılamaz.
    linterOptions: { noInlineConfig: true },
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      // Sınıflama, lint hangi klasörden koşarsa koşsun bu klasöre göre yapılır.
      'boundaries/root-path': import.meta.dirname,
      'boundaries/include': ['src/**/*'],
      'boundaries/legacy-templates': false,
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app', partialMatch: false },
        { type: 'shared', pattern: 'src/shared', partialMatch: false },
        {
          type: 'feature',
          pattern: 'src/features/*',
          capture: ['feature'],
          partialMatch: false,
        },
        {
          type: 'ara-katman',
          pattern: ['src/proxy.ts', 'src/proxy.test.ts'],
          mode: 'full',
        },
      ],
      'import/resolver': {
        node: { extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'] },
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
              // Yönlendirme katmanı her katmanı içe aktarır.
              from: { element: { type: 'app' } },
              allow: {
                to: { element: { type: ['app', 'feature', 'shared'] } },
              },
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
              // Ortak kod yalnız ortak kodu içe aktarır.
              from: { element: { type: 'shared' } },
              allow: { to: { element: { type: 'shared' } } },
            },
            {
              // Ara katman ortak kodu ve yalnız kendini (testi ara katmanı) içe aktarır.
              from: { element: { type: 'ara-katman' } },
              allow: { to: { element: { type: ['ara-katman', 'shared'] } } },
            },
          ],
        },
      ],
    },
  },
  {
    // Tür zorlama (`as Tür`, `<Tür>deger`) yasaktır; tür daraltılarak ya da şemayla okunarak elde
    // edilir. `as const` serbesttir (kural onu kendisi muaf tutar). Test dosyaları kapsam dışıdır.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
    },
  },
  {
    // Tarih ve sayı yalnız src/shared/bicim içinde biçimlenir (KR-014; TS-004 Yapı).
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/bicim/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].map(
          (property) => ({
            property,
            message: 'Tarih ve sayı src/shared/bicim yardımcılarıyla biçimlenir.',
          }),
        ),
        ...['DateTimeFormat', 'NumberFormat'].map((property) => ({
          object: 'Intl',
          property,
          message: 'Tarih ve sayı src/shared/bicim yardımcılarıyla biçimlenir.',
        })),
      ],
    },
  },
);
