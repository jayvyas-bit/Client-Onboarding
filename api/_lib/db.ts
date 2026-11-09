import postgres from "postgres";

let sqlClient: ReturnType<typeof postgres> | null = null;

export function getSql() {
  if (!sqlClient) {
    const connectionString = process.env.SUPABASE_DB_URL;
    if (!connectionString) {
      throw new Error("SUPABASE_DB_URL environment variable is not set");
    }
    sqlClient = postgres(connectionString, {
      ssl: "require",
      prepare: false,
    });
  }
  return sqlClient;
}
