import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../auth-schema";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [expo()],
  socialProviders: {},
  trustedOrigins: [
    "myapp://",
    ...(process.env.NODE_ENV === "development" ? ["exp://", "exp://**"] : []),
  ],
  logger: {
    log: (level, message, ...args) => {
      console.log(`${level}: ${message}`);
      console.log(JSON.stringify(args, null, 2));
    },
  },
});
