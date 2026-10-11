import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { setupApp } from "../src/setup-app";

/**
 * Smoke tests that need no database: PrismaService is replaced with a stub so
 * the module graph, global prefix, guards and error envelope can be verified.
 */
describe("App (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    setupApp(app, { corsOrigin: "http://localhost:3000" });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/health returns ok", async () => {
    const response = await request(app.getHttpServer()).get("/api/health").expect(200);
    expect(response.body).toMatchObject({ data: { status: "ok" } });
  });

  it("unknown routes use the error envelope", async () => {
    const response = await request(app.getHttpServer()).get("/api/does-not-exist").expect(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(typeof response.body.error.message).toBe("string");
  });

  it("admin routes reject requests without a token", async () => {
    const response = await request(app.getHttpServer()).get("/api/admin/items").expect(401);
    expect(response.body).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in to continue." },
    });
  });

  it("admin routes reject a malformed token", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/admin/claims")
      .set("Authorization", "Bearer not-a-real-token")
      .expect(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/auth/login validates the body with the frontend's sentences", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "" })
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields).toEqual({
      email: "Enter a valid email address.",
      password: "Enter your password.",
    });
  });

  it("POST /api/items returns field errors keyed like the report form", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/items")
      .field("name", "")
      .field("category", "Spaceships")
      .field("email", "nope")
      .field("phone", "12")
      .field("foundDate", "2999-01-01")
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.fields).toMatchObject({
      name: "Add a name for the item.",
      category: "Choose a category.",
      description: "Add a few identifying details.",
      location: "Add where it was found.",
      foundDate: "The date found cannot be in the future.",
      reporterName: "Enter your full name.",
      email: "Enter a valid email address.",
      phone: "Enter a valid phone number.",
    });
  });

  it("CORS allows the Next.js dev origin", async () => {
    const response = await request(app.getHttpServer())
      .options("/api/items")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET");
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });
});
