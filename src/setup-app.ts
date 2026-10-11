import { type INestApplication } from "@nestjs/common";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

export interface SetupAppOptions {
  corsOrigin: string;
}

/**
 * Applies the app-wide HTTP configuration. Shared by main.ts and the e2e
 * tests so both run the exact same prefix, CORS and error formatting.
 */
export function setupApp(app: INestApplication, options: SetupAppOptions): INestApplication {
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: options.corsOrigin,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  return app;
}
