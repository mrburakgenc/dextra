import { localInfrastructure } from './local-infrastructure.js';

// Uçtan uca testler asıl ve iz veritabanlarının yerel test adreslerine bağlanır.
process.env['DATABASE_URL'] = localInfrastructure.databaseUrl;
process.env['IZ_DATABASE_URL'] = localInfrastructure.traceDatabaseUrl;
