import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { validateEnv } from "./config/env";
import { MailerModule } from "./integrations/mailer/mailer.module";
import { StorageModule } from "./integrations/storage/storage.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ClaimsModule } from "./modules/claims/claims.module";
import { FilesModule } from "./modules/files/files.module";
import { ItemsModule } from "./modules/items/items.module";
import { LostItemsModule } from "./modules/lost-items/lost-items.module";
import { StatsModule } from "./modules/stats/stats.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // .env = hand-written app settings; .env.local = written by `neon link`.
      // Tests inject their own env and never read a file.
      envFilePath: [".env", ".env.local"],
      ignoreEnvFile: process.env.NODE_ENV === "test",
    }),
    PrismaModule,
    StorageModule,
    MailerModule,
    AuthModule,
    ItemsModule,
    ClaimsModule,
    LostItemsModule,
    StatsModule,
    FilesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
