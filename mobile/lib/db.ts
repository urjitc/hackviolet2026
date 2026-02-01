import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../auth-schema";

const connectionString = process.env.DATABASE_URL!;

// Singleton pattern to prevent connection leaks during hot reload
const globalForDb = globalThis as unknown as {
    conn: postgres.Sql | undefined;
};

const client = globalForDb.conn ?? postgres(connectionString, {
    prepare: false,
    max: 1,
});

if (process.env.NODE_ENV !== "production") globalForDb.conn = client;

export const db = drizzle(client, { schema });
