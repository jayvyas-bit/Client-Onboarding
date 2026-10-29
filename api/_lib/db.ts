import postgres from "postgres";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  throw new Error("SUPABASE_DB_URL environment variable is not set");
}

export const sql = postgres(connectionString, {
  ssl: "require",
  prepare: false,
});
