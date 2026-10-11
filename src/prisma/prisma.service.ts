import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/** The single PrismaClient for the app. Never instantiate PrismaClient elsewhere. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Connected to the database");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
