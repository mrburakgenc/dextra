import { localInfrastructure } from './local-infrastructure.js';

// Uçtan uca testler asıl veritabanının yerel test adresine bağlanır.
process.env['DATABASE_URL'] = localInfrastructure.databaseUrl;
