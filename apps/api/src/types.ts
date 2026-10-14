import type { AppEnv } from "@mails/core";
import type { Database } from "@mails/db";

export interface HonoEnv {
  Bindings: AppEnv;
  Variables: {
    db: Database;
    projectId: string;
    keyId: string;
  };
}
