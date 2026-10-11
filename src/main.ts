import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { type Env } from "./config/env";
import { setupApp } from "./setup-app";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService<Env, true>);

  setupApp(app, { corsOrigin: config.get("CORS_ORIGIN", { infer: true }) });
  app.enableShutdownHooks();

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  Logger.log(`LostNFind API listening on http://localhost:${port}/api`, "Bootstrap");
}

void bootstrap();
