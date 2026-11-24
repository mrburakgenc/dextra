import { generateKeyPairSync, randomBytes } from 'node:crypto';
import {
  ACIK_ANAHTAR_DEGISKENI,
  OZEL_ANAHTAR_DEGISKENI,
} from '../src/shared/guvenlik/belirtec.js';
import { ARACI_KATMAN_SIRRI_DEGISKENI } from '../src/shared/guvenlik/istemci-adresi-imzasi.js';
import { localInfrastructure } from './local-infrastructure.js';

// Uçtan uca testler asıl ve iz veritabanlarının yerel test adreslerine bağlanır.
process.env['DATABASE_URL'] = localInfrastructure.databaseUrl;
process.env['IZ_DATABASE_URL'] = localInfrastructure.traceDatabaseUrl;

// Kimlik guard'ının ortamı (TS-002 AK-6, AK-8): belirteç anahtar çifti (RS256, PEM) ve aracı katman
// sırrı süreç başında üretilir; depoya anahtar yazılmaz. Uygulamayı açan testler ve onların alt
// süreçleri bu ortamı alır.
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
process.env[OZEL_ANAHTAR_DEGISKENI] = privateKey;
process.env[ACIK_ANAHTAR_DEGISKENI] = publicKey;
process.env[ARACI_KATMAN_SIRRI_DEGISKENI] = randomBytes(32).toString('hex');
