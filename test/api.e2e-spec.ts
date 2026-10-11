import { type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { Readable } from "node:stream";
import request from "supertest";
import { seed, type SeedResult } from "../prisma/seed";
import { AppModule } from "../src/app.module";
import { type MailMessage, MailerService } from "../src/integrations/mailer/mailer.service";
import { StorageService } from "../src/integrations/storage/storage.service";
import { setupApp } from "../src/setup-app";

/**
 * Full API flow against a real Postgres database (DATABASE_URL_TEST).
 * Skipped when that variable is not set. Mail and Cloudinary are stubbed.
 *
 *   docker run -d --name lostnfind-test-pg -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test \
 *     -e POSTGRES_DB=lostnfind_test -p 5433:5432 postgres:16-alpine
 *   DATABASE_URL_TEST=postgresql://test:test@localhost:5433/lostnfind_test npm run test:e2e
 */
const describeDb = process.env.DATABASE_URL_TEST ? describe : describe.skip;

const ADMIN_EMAIL = "admin@test.local";
const ADMIN_PASSWORD = "test-password-123";
const UPLOADED_URL = "http://localhost:4000/api/files/items/uploaded.jpg";

const validReport = {
  name: "Blue water bottle",
  category: "Other",
  description: "Steel bottle with a dented lid",
  location: "Central Station, platform 2",
  foundDate: "2026-10-01",
  reporterName: "Pat Doe",
  email: "pat@example.com",
  phone: "+1 555 012 3456",
};

const validClaim = {
  name: "Robin Harper",
  email: "robin@example.com",
  phone: "+1 202 555 0121",
  description: "Silver watch with a navy dial",
  proof: "Initials R.H. inside the clasp",
};

describeDb("API (e2e, database)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let seeded: SeedResult;
  let token: string;
  const sentMail: MailMessage[] = [];

  const api = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) => req.set("Authorization", `Bearer ${token}`);
  const slugId = (slug: string) => {
    const id = seeded.itemIdBySlug.get(slug);
    if (!id) throw new Error(`missing seeded item ${slug}`);
    return id;
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.claim.deleteMany();
    await prisma.foundItem.deleteMany();
    await prisma.lostItem.deleteMany();
    await prisma.user.deleteMany();
    seeded = await seed(prisma, { adminEmail: ADMIN_EMAIL, adminPassword: ADMIN_PASSWORD });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailerService)
      .useValue({
        adminEmail: "ops@test.local",
        send: (message: MailMessage) => {
          sentMail.push(message);
          return Promise.resolve();
        },
      })
      .overrideProvider(StorageService)
      .useValue({
        uploadImage: () => Promise.resolve(UPLOADED_URL),
        getObject: (key: string) =>
          Promise.resolve(
            key === "items/uploaded.jpg" || key === "claims/proof.png"
              ? {
                  body: Readable.from([Buffer.from("fake-bytes")]),
                  contentType: "image/jpeg",
                  contentLength: 10,
                }
              : null,
          ),
      })
      .compile();

    app = moduleRef.createNestApplication();
    setupApp(app, { corsOrigin: "http://localhost:3000" });
    await app.init();

    const login = await api()
      .post("/api/auth/login")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    token = login.body.data.token;
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  // ----- auth ---------------------------------------------------------------

  describe("auth", () => {
    it("rejects a wrong password", async () => {
      const response = await api()
        .post("/api/auth/login")
        .send({ email: ADMIN_EMAIL, password: "wrong-password" })
        .expect(401);
      expect(response.body.error).toEqual({
        code: "UNAUTHORIZED",
        message: "Incorrect email or password.",
      });
    });

    it("returns the signed-in admin from /me", async () => {
      const response = await asAdmin(api().get("/api/auth/me")).expect(200);
      expect(response.body.data).toMatchObject({ email: ADMIN_EMAIL, role: "ADMIN" });
      expect(response.body.data.passwordHash).toBeUndefined();
    });
  });

  // ----- public items -------------------------------------------------------

  describe("GET /api/items", () => {
    it("lists only approved or returned items in the public shape", async () => {
      const response = await api().get("/api/items").expect(200);
      const { data, total } = response.body;
      expect(total).toBe(9); // 11 seeded: 8 approved + 1 returned are public; 1 pending + 1 rejected are not
      expect(data).toHaveLength(9);
      const names: string[] = data.map((item: { name: string }) => item.name);
      expect(names).not.toContain("Cream scarf with fringe"); // pending
      expect(names).not.toContain("Canvas tote bag"); // rejected
      expect(data[0]).toEqual({
        id: expect.any(String),
        name: "Silver wristwatch",
        category: "Accessories",
        description: expect.any(String),
        location: "Riverside Park, near the east entrance",
        foundDate: "2026-10-08",
        image: expect.stringContaining("https://"),
        status: "Waiting for owner",
      });
      expect(data[0].reporter).toBeUndefined();
      expect(data[0].reviewStatus).toBeUndefined();
    });

    it("filters by q (including category label) and category, and sorts", async () => {
      const byQuery = await api().get("/api/items").query({ q: "riverside" }).expect(200);
      expect(byQuery.body.data.map((i: { name: string }) => i.name)).toEqual(["Silver wristwatch"]);

      const byCategoryWord = await api().get("/api/items").query({ q: "bags" }).expect(200);
      expect(byCategoryWord.body.total).toBe(2);

      const byCategory = await api()
        .get("/api/items")
        .query({ category: "Electronics", sort: "name" })
        .expect(200);
      expect(byCategory.body.data.map((i: { name: string }) => i.name)).toEqual([
        "Compact digital camera",
        "Wireless headphones",
      ]);

      const oldest = await api().get("/api/items").query({ sort: "oldest", limit: 1 }).expect(200);
      expect(oldest.body.data[0].name).toBe("Cream knit scarf");
      expect(oldest.body.total).toBe(9);
    });

    it("rejects an unknown category with a field error", async () => {
      const response = await api().get("/api/items").query({ category: "Spaceships" }).expect(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.fields.category).toBeDefined();
    });
  });

  describe("GET /api/items/:id", () => {
    it("returns an approved item by id or slug", async () => {
      const bySlug = await api().get("/api/items/silver-watch").expect(200);
      const byId = await api()
        .get(`/api/items/${slugId("silver-watch")}`)
        .expect(200);
      expect(bySlug.body.data).toEqual(byId.body.data);
    });

    it("hides pending and rejected items with a 404", async () => {
      await api().get("/api/items/fringed-scarf-review").expect(404);
      await api().get("/api/items/canvas-tote-review").expect(404);
      const missing = await api().get("/api/items/does-not-exist").expect(404);
      expect(missing.body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/items", () => {
    it("creates a pending report and returns the public shape", async () => {
      const req = api().post("/api/items");
      for (const [key, value] of Object.entries(validReport)) req.field(key, value);
      req.attach("image", Buffer.from("fake-image-bytes"), {
        filename: "bottle.jpg",
        contentType: "image/jpeg",
      });
      const response = await req.expect(201);

      expect(response.body.data).toMatchObject({
        name: validReport.name,
        category: "Other",
        status: "Waiting for owner",
        image: UPLOADED_URL,
      });
      expect(response.body.data.reporter).toBeUndefined();

      const stored = await prisma.foundItem.findUnique({ where: { id: response.body.data.id } });
      expect(stored?.reviewStatus).toBe("PENDING_REVIEW");
      expect(stored?.reporterEmail).toBe("pat@example.com");

      // not public until approved
      await api().get(`/api/items/${response.body.data.id}`).expect(404);
    });

    it("rejects a non-image upload with fields.image", async () => {
      const req = api().post("/api/items");
      for (const [key, value] of Object.entries(validReport)) req.field(key, value);
      req.attach("image", Buffer.from("%PDF-1.4"), {
        filename: "scan.pdf",
        contentType: "application/pdf",
      });
      const response = await req.expect(400);
      expect(response.body.error.fields).toEqual({ image: "Choose an image file to continue." });
    });

    it("accepts a plain JSON body too", async () => {
      await api()
        .post("/api/items")
        .send({ ...validReport, whatsapp: "+44 7700 900123" })
        .expect(201);
    });
  });

  // ----- public claims ------------------------------------------------------

  describe("POST /api/items/:id/claims", () => {
    it("creates a pending claim on an approved item and emails the admin", async () => {
      sentMail.length = 0;
      const response = await api()
        .post("/api/items/wireless-headphones/claims")
        .send(validClaim)
        .expect(201);
      expect(response.body.data).toEqual({ id: expect.any(String), status: "Pending" });

      expect(sentMail).toHaveLength(1);
      expect(sentMail[0].to).toBe("ops@test.local");
      expect(sentMail[0].subject).toContain("Wireless headphones");
    });

    it("validates with the claim form's sentences", async () => {
      const response = await api()
        .post("/api/items/wireless-headphones/claims")
        .send({ email: "bad", phone: "1" })
        .expect(400);
      expect(response.body.error.fields).toEqual({
        name: "Enter your full name.",
        email: "Enter a valid email address.",
        phone: "Enter a valid phone number.",
        description: "Describe the item you lost.",
        proof: "Share a detail only the owner would know.",
      });
    });

    it("refuses claims on returned items (409) and hides non-public items (404)", async () => {
      const returned = await api()
        .post("/api/items/leather-wallet/claims")
        .send(validClaim)
        .expect(409);
      expect(returned.body.error.code).toBe("CONFLICT");

      await api().post("/api/items/fringed-scarf-review/claims").send(validClaim).expect(404);
      await api().post("/api/items/nope/claims").send(validClaim).expect(404);
    });
  });

  // ----- lost items ---------------------------------------------------------

  describe("POST /api/lost-items", () => {
    it("stores a lost-item report and returns a summary without contact details", async () => {
      const response = await api()
        .post("/api/lost-items")
        .send({
          name: "Green insulated water bottle",
          category: "Other",
          description: "Green bottle with a carabiner",
          location: "Westside Community Pool",
          reporterName: "Lee Park",
          email: "lee@example.com",
          phone: "+1 555 000 1111",
        })
        .expect(201);
      expect(response.body.data).toEqual({
        id: expect.any(String),
        name: "Green insulated water bottle",
        category: "Other",
        location: "Westside Community Pool",
        reportedDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      });
    });
  });

  // ----- admin items --------------------------------------------------------

  describe("admin items", () => {
    it("lists every report with reporter contact, newest submission first", async () => {
      const response = await asAdmin(api().get("/api/admin/items")).expect(200);
      expect(response.body.total).toBeGreaterThanOrEqual(11);
      expect(response.body.data[0]).toMatchObject({
        reviewStatus: expect.any(String),
        submittedAt: expect.any(String),
        reporter: {
          name: expect.any(String),
          email: expect.any(String),
          phone: expect.any(String),
        },
      });
      const dates: string[] = response.body.data.map((i: { submittedAt: string }) => i.submittedAt);
      expect([...dates].sort().reverse()).toEqual(dates);
    });

    it("filters by reviewStatus and q over reporter name", async () => {
      const pending = await asAdmin(
        api().get("/api/admin/items").query({ reviewStatus: "Pending review" }),
      ).expect(200);
      expect(
        pending.body.data.every(
          (i: { reviewStatus: string }) => i.reviewStatus === "Pending review",
        ),
      ).toBe(true);

      const byReporter = await asAdmin(
        api().get("/api/admin/items").query({ q: "morgan ellis" }),
      ).expect(200);
      expect(byReporter.body.data.map((i: { name: string }) => i.name)).toEqual([
        "Silver wristwatch",
      ]);
    });

    it("follows the review status transition table", async () => {
      const pendingId = slugId("fringed-scarf-review");
      const rejectedId = slugId("canvas-tote-review");
      const approvedId = slugId("black-sunglasses");
      const returnedId = slugId("leather-wallet");

      // RETURNED is only reachable through /return
      const viaPatch = await asAdmin(
        api().patch(`/api/admin/items/${approvedId}/status`).send({ reviewStatus: "Returned" }),
      ).expect(409);
      expect(viaPatch.body.error.message).toMatch(/return action/);

      // APPROVED -> REJECTED is not allowed
      await asAdmin(
        api().patch(`/api/admin/items/${approvedId}/status`).send({ reviewStatus: "Rejected" }),
      ).expect(409);

      // RETURNED -> anything is not allowed
      await asAdmin(
        api().patch(`/api/admin/items/${returnedId}/status`).send({ reviewStatus: "Approved" }),
      ).expect(409);

      // REJECTED -> APPROVED is allowed and the item becomes public
      const reapproved = await asAdmin(
        api().patch(`/api/admin/items/${rejectedId}/status`).send({ reviewStatus: "Approved" }),
      ).expect(200);
      expect(reapproved.body.data.reviewStatus).toBe("Approved");
      await api().get(`/api/items/${rejectedId}`).expect(200);

      // PENDING -> REJECTED is allowed
      const rejected = await asAdmin(
        api().patch(`/api/admin/items/${pendingId}/status`).send({ reviewStatus: "Rejected" }),
      ).expect(200);
      expect(rejected.body.data.reviewStatus).toBe("Rejected");

      // invalid label is a validation error
      const invalid = await asAdmin(
        api().patch(`/api/admin/items/${pendingId}/status`).send({ reviewStatus: "Lost" }),
      ).expect(400);
      expect(invalid.body.error.fields.reviewStatus).toBeDefined();
    });

    it("returns 404 for an unknown report", async () => {
      await asAdmin(api().get("/api/admin/items/nope")).expect(404);
      await asAdmin(
        api().patch("/api/admin/items/nope/status").send({ reviewStatus: "Approved" }),
      ).expect(404);
    });
  });

  // ----- admin claims -------------------------------------------------------

  describe("admin claims", () => {
    it("lists claims with their item and filters by status and q", async () => {
      const all = await asAdmin(api().get("/api/admin/claims")).expect(200);
      expect(all.body.total).toBeGreaterThanOrEqual(5);
      expect(all.body.data[0]).toMatchObject({
        claimant: {
          name: expect.any(String),
          email: expect.any(String),
          phone: expect.any(String),
        },
        ownershipProof: expect.any(String),
        item: { name: expect.any(String), reviewStatus: expect.any(String) },
      });

      const approved = await asAdmin(
        api().get("/api/admin/claims").query({ status: "Approved" }),
      ).expect(200);
      expect(approved.body.data.map((c: { id: string }) => c.id)).toEqual(["claim-keys-03"]);

      const byItem = await asAdmin(api().get("/api/admin/claims").query({ q: "camera" })).expect(
        200,
      );
      expect(byItem.body.data.map((c: { id: string }) => c.id)).toEqual(["claim-camera-04"]);
    });

    it("approving a claim rejects the other pending claims on the same item and emails the claimant", async () => {
      // second pending claim on the silver watch
      const rival = await api()
        .post("/api/items/silver-watch/claims")
        .send({ ...validClaim, name: "Someone Else", email: "else@example.com" })
        .expect(201);

      sentMail.length = 0;
      const approved = await asAdmin(
        api().patch("/api/admin/claims/claim-watch-01/status").send({ status: "Approved" }),
      ).expect(200);
      expect(approved.body.data.status).toBe("Approved");
      expect(approved.body.data.item.id).toBe(slugId("silver-watch"));

      const rivalAfter = await prisma.claim.findUnique({ where: { id: rival.body.data.id } });
      expect(rivalAfter?.status).toBe("REJECTED");

      expect(sentMail).toHaveLength(1);
      expect(sentMail[0].to).toBe("robin@example.com");
      expect(sentMail[0].subject).toMatch(/Good news/);

      // already reviewed -> 409
      const again = await asAdmin(
        api().patch("/api/admin/claims/claim-watch-01/status").send({ status: "Rejected" }),
      ).expect(409);
      expect(again.body.error.code).toBe("CONFLICT");
    });

    it("rejecting a claim emails the claimant", async () => {
      sentMail.length = 0;
      const rejected = await asAdmin(
        api().patch("/api/admin/claims/claim-bag-02/status").send({ status: "Rejected" }),
      ).expect(200);
      expect(rejected.body.data.status).toBe("Rejected");
      expect(sentMail[0]?.to).toBe("devon@example.com");
    });

    it("validates the status body and 404s unknown claims", async () => {
      const invalid = await asAdmin(
        api().patch("/api/admin/claims/claim-camera-04/status").send({ status: "Pending" }),
      ).expect(400);
      expect(invalid.body.error.fields.status).toBeDefined();
      await asAdmin(api().get("/api/admin/claims/nope")).expect(404);
    });
  });

  // ----- return flow --------------------------------------------------------

  describe("POST /api/admin/items/:id/return", () => {
    it("marks an approved item returned, sets Reunited, and emails the approved claimant", async () => {
      sentMail.length = 0;
      const response = await asAdmin(api().post("/api/admin/items/silver-watch/return")).expect(
        200,
      );
      expect(response.body.data).toMatchObject({ reviewStatus: "Returned", status: "Reunited" });

      expect(sentMail).toHaveLength(1);
      expect(sentMail[0].to).toBe("robin@example.com");

      // still public, shown as reunited, and no longer claimable
      const publicItem = await api().get("/api/items/silver-watch").expect(200);
      expect(publicItem.body.data.status).toBe("Reunited");
      await api().post("/api/items/silver-watch/claims").send(validClaim).expect(409);

      // cannot be returned twice
      await asAdmin(api().post("/api/admin/items/silver-watch/return")).expect(409);
    });

    it("refuses to return a non-approved item", async () => {
      const response = await asAdmin(
        api().post(`/api/admin/items/${slugId("fringed-scarf-review")}/return`),
      ).expect(409);
      expect(response.body.error.message).toMatch(/Only approved items/);
    });
  });

  // ----- files (private bucket proxy) --------------------------------------

  describe("GET /api/files", () => {
    it("streams item images publicly with long cache headers", async () => {
      const response = await api().get("/api/files/items/uploaded.jpg").expect(200);
      expect(response.headers["content-type"]).toContain("image/jpeg");
      expect(response.headers["cache-control"]).toContain("immutable");
      expect(response.body.toString()).toBe("fake-bytes");
    });

    it("404s unknown or unsafe keys", async () => {
      await api().get("/api/files/items/missing.jpg").expect(404);
      await api().get("/api/files/items/..%2Fclaims%2Fproof.png").expect(404);
    });

    it("keeps claim evidence admin-only", async () => {
      await api().get("/api/files/claims/proof.png").expect(401);
      const response = await asAdmin(api().get("/api/files/claims/proof.png")).expect(200);
      expect(response.headers["cache-control"]).toContain("no-store");
    });
  });

  // ----- stats --------------------------------------------------------------

  describe("GET /api/admin/stats", () => {
    it("matches the AdminOverview tiles and recent tables", async () => {
      const response = await asAdmin(api().get("/api/admin/stats")).expect(200);
      const stats = response.body.data;

      expect(stats.totalItems).toBe(await prisma.foundItem.count());
      expect(stats.pendingClaims).toBe(await prisma.claim.count({ where: { status: "PENDING" } }));
      expect(stats.approvedClaims).toBe(
        await prisma.claim.count({ where: { status: "APPROVED" } }),
      );
      expect(stats.itemsReturned).toBe(2); // leather wallet + silver watch
      expect(stats.recentItems).toHaveLength(4);
      expect(stats.recentClaims).toHaveLength(4);
      expect(stats.recentItems[0].reporter).toBeDefined();
      expect(stats.recentClaims[0].item.name).toBeDefined();
    });

    it("is admin only", async () => {
      await api().get("/api/admin/stats").expect(401);
    });
  });
});
