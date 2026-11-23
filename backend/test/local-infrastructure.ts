// Yerel geliştirme altyapısının adresleri (kökteki docker-compose.yml).
// Sır taşımaz: yerel PostgreSQL parolasız ve yalnız bu makineye açıktır.
export const localInfrastructure = {
  databaseUrl: 'postgresql://dextra@localhost:5440/dextra',
  traceDatabaseUrl: 'postgresql://dextra@localhost:5440/dextra_iz',
  redisUrl: 'redis://localhost:6390',
} as const;
