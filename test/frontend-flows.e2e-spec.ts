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
 * Test cases written from the frontend, screen by screen. Each `describe` is a
 * page or modal in ../Lost-FInd, each `it` is one thing a person does there,
 * and the request is shaped exactly the way that component will send it
 * (same field names, same query params, same labels, same order of actions).
 *
 * Runs against DATABASE_URL_TEST (skipped without it). Mail and storage are stubbed.
 */
const describeDb = process.env.DATABASE_URL_TEST ? describe : describe.skip;

const ADMIN_EMAIL = "admin@test.local";
const ADMIN_PASSWORD = "test-password-123";
const UPLOADED_ITEM_IMAGE = "http://localhost:4000/api/files/items/report.jpg";
const UPLOADED_CLAIM_IMAGE = "http://localhost:4000/api/files/claims/proof.jpg";

/** Exactly the keys of the frontend `FoundItem` type, sorted. */
const PUBLIC_ITEM_KEYS = [
  "category",
  "description",
  "foundDate",
  "id",
  "image",
  "location",
  "name",
  "status",
];
/** Exactly the keys of the frontend `AdminFoundItem` type, sorted. */
const ADMIN_ITEM_KEYS = [...PUBLIC_ITEM_KEYS, "reporter", "reviewStatus", "submittedAt"].sort();
/** Frontend `ClaimRequest` keys plus the embedded `item`, sorted (supportingImage only when set). */
const ADMIN_CLAIM_KEYS = [
  "claimant",
  "id",
  "item",
  "itemId",
  "lostItemDescription",
  "ownershipProof",
  "status",
  "submittedAt",
];

const reportForm = {
  name: "Blue water bottle",
  category: "Other",
  description: "Steel bottle with a dented lid, held at reception",
  location: "Central Station, platform 2",
  foundDate: "2026-10-09",
  reporterName: "Pat Doe",
  email: "Pat.Doe@Example.com",
  phone: "+1 555 012 3456",
  whatsapp: "",
};

const claimForm = {
  name: "Robin Harper",
  email: "robin@example.com",
  phone: "+1 202 555 0121",
  description: "Silver watch with a navy dial",
  proof: "Initials R.H. inside the clasp",
};

describeDb("Frontend flows (e2e, database)", () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let seeded: SeedResult;
  let token: string;
  const sentMail: MailMessage[] = [];
  const stored = new Map<string, Buffer>();

  const api = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) => req.set("Authorization", `Bearer ${token}`);
  const idOf = (slug: string) => {
    const id = seeded.itemIdBySlug.get(slug);
    if (!id) throw new Error(`missing seeded item ${slug}`);
    return id;
  };
  const names = (items: { name: string }[]) => items.map((item) => item.name);

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
        uploadImage: (file: { buffer: Buffer }, folder: "items" | "claims") => {
          const url = folder === "items" ? UPLOADED_ITEM_IMAGE : UPLOADED_CLAIM_IMAGE;
          stored.set(url.split("/api/files/")[1], file.buffer);
          return Promise.resolve(url);
        },
        getObject: (key: string) => {
          const bytes = stored.get(key);
          return Promise.resolve(
            bytes
              ? {
                  body: Readable.from([bytes]),
                  contentType: "image/jpeg",
                  contentLength: bytes.length,
                }
              : null,
          );
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    setupApp(app, { corsOrigin: "http://localhost:3000" });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
  });

  // =========================================================================
  // Public site
  // =========================================================================

  describe("Home page (HomeExperience)", () => {
    it("'Recently found items' shows the 3 newest public items in the FoundItem shape", async () => {
      const response = await api().get("/api/items").query({ limit: 3 }).expect(200);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.total).toBe(9);
      expect(names(response.body.data)).toEqual([
        "Silver wristwatch",
        "Olive canvas backpack",
        "Wireless headphones",
      ]);
      for (const item of response.body.data) {
        expect(Object.keys(item).sort()).toEqual(PUBLIC_ITEM_KEYS);
        expect(["Waiting for owner", "Reunited"]).toContain(item.status);
      }
    });

    it("hero search box submits to /found-items?q=... and the browser forwards q", async () => {
      const response = await api().get("/api/items").query({ q: "blue backpack" }).expect(200);
      expect(response.body.total).toBe(0); // no item contains the whole phrase
      const single = await api().get("/api/items").query({ q: "backpack" }).expect(200);
      expect(names(single.body.data)).toEqual(["Olive canvas backpack"]);
    });

    it("category chips link to /found-items?category=<URL-encoded label>", async () => {
      const response = await api()
        .get(`/api/items?category=${encodeURIComponent("Bags & wallets")}`)
        .expect(200);
      expect(response.body.total).toBe(2);
      expect(
        response.body.data.every((i: { category: string }) => i.category === "Bags & wallets"),
      ).toBe(true);
    });
  });

  describe("Found items page (FoundItemsBrowser)", () => {
    it("default view: 'All items', newest first, counts every public item", async () => {
      const response = await api().get("/api/items").expect(200);
      expect(response.body.total).toBe(9);
      const dates: string[] = response.body.data.map((i: { foundDate: string }) => i.foundDate);
      expect([...dates].sort().reverse()).toEqual(dates);
      expect(names(response.body.data)).not.toContain("Cream scarf with fringe"); // Pending review
      expect(names(response.body.data)).not.toContain("Canvas tote bag"); // Rejected
    });

    it("search matches name, location, category label and description, case-insensitively", async () => {
      const byName = await api().get("/api/items").query({ q: "WRISTWATCH" }).expect(200);
      expect(names(byName.body.data)).toEqual(["Silver wristwatch"]);

      const byLocation = await api().get("/api/items").query({ q: "library" }).expect(200);
      expect(names(byLocation.body.data)).toEqual(["Wireless headphones"]);

      const byCategory = await api().get("/api/items").query({ q: "accessor" }).expect(200);
      expect(names(byCategory.body.data).sort()).toEqual([
        "Black frame sunglasses",
        "Silver wristwatch",
      ]);

      const byDescription = await api().get("/api/items").query({ q: "memory card" }).expect(200);
      expect(names(byDescription.body.data)).toEqual(["Compact digital camera"]);
    });

    it("category row + 'Name: A to Z' sort", async () => {
      const response = await api()
        .get("/api/items")
        .query({ category: "Clothing", sort: "name" })
        .expect(200);
      expect(names(response.body.data)).toEqual(["Blue running shoes", "Cream knit scarf"]);
    });

    it("'Oldest first' sort", async () => {
      const response = await api().get("/api/items").query({ sort: "oldest" }).expect(200);
      expect(names(response.body.data)[0]).toBe("Cream knit scarf");
    });

    it("the 'All items' chip means no category filter", async () => {
      const response = await api().get("/api/items").query({ category: "All items" }).expect(200);
      expect(response.body.total).toBe(9);
    });

    it("no match returns an empty list so the UI shows 'No finds just yet'", async () => {
      const response = await api().get("/api/items").query({ q: "zzzz-nothing" }).expect(200);
      expect(response.body).toEqual({ data: [], total: 0 });
    });

    it("a category the UI does not know is a validation error", async () => {
      const response = await api().get("/api/items").query({ category: "Spaceships" }).expect(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
      expect(response.body.error.fields.category).toBeDefined();
    });
  });

  describe("Item details modal (ItemDetailsModal)", () => {
    it("opens an item by the id from the card", async () => {
      const response = await api()
        .get(`/api/items/${idOf("silver-watch")}`)
        .expect(200);
      expect(Object.keys(response.body.data).sort()).toEqual(PUBLIC_ITEM_KEYS);
      expect(response.body.data).toMatchObject({
        name: "Silver wristwatch",
        status: "Waiting for owner",
        foundDate: "2026-10-08",
      });
    });

    it("a reunited item reads 'Reunited' so the modal hides 'This is mine'", async () => {
      const response = await api()
        .get(`/api/items/${idOf("leather-wallet")}`)
        .expect(200);
      expect(response.body.data.status).toBe("Reunited");
    });

    it("never exposes reporter contact or review status", async () => {
      const response = await api()
        .get(`/api/items/${idOf("silver-watch")}`)
        .expect(200);
      expect(JSON.stringify(response.body)).not.toMatch(
        /morgan@example\.com|reviewStatus|reporter/,
      );
    });
  });

  describe("Claim modal (ClaimItemForm)", () => {
    it("'Submit claim' sends the five form fields plus the optional supporting image", async () => {
      sentMail.length = 0;
      const req = api().post(`/api/items/${idOf("wireless-headphones")}/claims`);
      for (const [key, value] of Object.entries(claimForm)) req.field(key, value);
      req.attach("supportingImage", Buffer.from("proof-bytes"), {
        filename: "proof.jpg",
        contentType: "image/jpeg",
      });
      const response = await req.expect(201);

      // the success panel only needs to know it went through
      expect(response.body.data).toEqual({ id: expect.any(String), status: "Pending" });

      const claim = await prisma.claim.findUnique({ where: { id: response.body.data.id } });
      expect(claim).toMatchObject({
        claimantName: "Robin Harper",
        claimantEmail: "robin@example.com",
        lostItemDescription: claimForm.description,
        ownershipProof: claimForm.proof,
        supportingImage: UPLOADED_CLAIM_IMAGE,
        status: "PENDING",
      });

      // admin is told about it
      expect(sentMail).toHaveLength(1);
      expect(sentMail[0].to).toBe("ops@test.local");
      expect(sentMail[0].subject).toBe('New claim for "Wireless headphones"');
    });

    it("an empty form returns every required sentence keyed like the form state", async () => {
      const response = await api()
        .post(`/api/items/${idOf("wireless-headphones")}/claims`)
        .send({})
        .expect(400);
      expect(response.body.error.fields).toEqual({
        name: "Enter your full name.",
        email: "Enter your email address.",
        phone: "Enter a phone or WhatsApp number.",
        description: "Describe the item you lost.",
        proof: "Share a detail only the owner would know.",
      });
    });

    it("bad email and bad phone use the form's own sentences", async () => {
      const response = await api()
        .post(`/api/items/${idOf("wireless-headphones")}/claims`)
        .send({ ...claimForm, email: "robin@", phone: "12345" })
        .expect(400);
      expect(response.body.error.fields).toEqual({
        email: "Enter a valid email address.",
        phone: "Enter a valid phone number.",
      });
    });

    it("the supporting image must be an image under 8 MB", async () => {
      const req = api().post(`/api/items/${idOf("wireless-headphones")}/claims`);
      for (const [key, value] of Object.entries(claimForm)) req.field(key, value);
      req.attach("supportingImage", Buffer.from("%PDF-1.4"), {
        filename: "proof.pdf",
        contentType: "application/pdf",
      });
      const response = await req.expect(400);
      expect(response.body.error.fields).toEqual({
        supportingImage: "Choose an image file to continue.",
      });
    });

    it("a reunited item cannot be claimed (the UI hides the button; the API agrees)", async () => {
      const response = await api()
        .post(`/api/items/${idOf("leather-wallet")}/claims`)
        .send(claimForm)
        .expect(409);
      expect(response.body.error.message).toBe(
        "This item has already been reunited with its owner.",
      );
    });

    it("a report the public cannot see cannot be claimed either", async () => {
      await api()
        .post(`/api/items/${idOf("fringed-scarf-review")}/claims`)
        .send(claimForm)
        .expect(404);
      await api().post("/api/items/not-a-real-id/claims").send(claimForm).expect(404);
    });
  });

  describe("Report an item modal (ReportItemForm)", () => {
    let reportId: string;

    it("'Continue' sends the form as multipart and the item lands in Pending review", async () => {
      const req = api().post("/api/items");
      for (const [key, value] of Object.entries(reportForm)) req.field(key, value);
      req.attach("image", Buffer.from("report-bytes"), {
        filename: "bottle.jpg",
        contentType: "image/jpeg",
      });
      const response = await req.expect(201);

      expect(Object.keys(response.body.data).sort()).toEqual(PUBLIC_ITEM_KEYS);
      expect(response.body.data).toMatchObject({
        name: "Blue water bottle",
        category: "Other",
        location: reportForm.location,
        foundDate: "2026-10-09",
        image: UPLOADED_ITEM_IMAGE,
        status: "Waiting for owner",
      });
      reportId = response.body.data.id;

      const stored = await prisma.foundItem.findUnique({ where: { id: reportId } });
      expect(stored).toMatchObject({
        reviewStatus: "PENDING_REVIEW",
        reporterName: "Pat Doe",
        reporterEmail: "pat.doe@example.com",
        reporterPhone: "+1 555 012 3456",
        reporterWhatsapp: null,
      });
      expect(stored?.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("the uploaded photo is served back through /api/files for the item card", async () => {
      const response = await api().get("/api/files/items/report.jpg").expect(200);
      expect(response.headers["content-type"]).toContain("image/jpeg");
      expect(response.body.toString()).toBe("report-bytes");
    });

    it("a new report is not on the public site until an admin approves it", async () => {
      await api().get(`/api/items/${reportId}`).expect(404);
      const list = await api().get("/api/items").query({ q: "water bottle" }).expect(200);
      expect(list.body.total).toBe(0);
    });

    it("an empty form returns every required sentence (WhatsApp is optional)", async () => {
      const response = await api().post("/api/items").send({}).expect(400);
      expect(response.body.error.fields).toEqual({
        name: "Add a name for the item.",
        category: "Choose a category.",
        description: "Add a few identifying details.",
        location: "Add where it was found.",
        foundDate: "Choose the date it was found.",
        reporterName: "Enter your full name.",
        email: "Enter your email address.",
        phone: "Enter a phone number.",
      });
    });

    it("whitespace-only fields count as empty, like the form's trim()", async () => {
      const response = await api()
        .post("/api/items")
        .send({ ...reportForm, name: "   ", description: "\n", whatsapp: "   " })
        .expect(400);
      expect(response.body.error.fields).toEqual({
        name: "Add a name for the item.",
        description: "Add a few identifying details.",
      });
    });

    it("future date, bad email, bad phone and bad WhatsApp use the form's sentences", async () => {
      const response = await api()
        .post("/api/items")
        .send({
          ...reportForm,
          foundDate: "2999-12-31",
          email: "pat@nowhere",
          phone: "12",
          whatsapp: "abc",
        })
        .expect(400);
      expect(response.body.error.fields).toEqual({
        foundDate: "The date found cannot be in the future.",
        email: "Enter a valid email address.",
        phone: "Enter a valid phone number.",
        whatsapp: "Enter a valid WhatsApp number.",
      });
    });

    it("an optional WhatsApp number is kept for the admin", async () => {
      const response = await api()
        .post("/api/items")
        .send({ ...reportForm, name: "Second bottle", whatsapp: "+44 7700 900123" })
        .expect(201);
      const stored = await prisma.foundItem.findUnique({ where: { id: response.body.data.id } });
      expect(stored?.reporterWhatsapp).toBe("+44 7700 900123");
    });

    it("the ImageUploader rules are enforced server-side too: image/* and 8 MB", async () => {
      const notImage = api().post("/api/items");
      for (const [key, value] of Object.entries(reportForm)) notImage.field(key, value);
      notImage.attach("image", Buffer.from("plain text"), {
        filename: "notes.txt",
        contentType: "text/plain",
      });
      const first = await notImage.expect(400);
      expect(first.body.error.fields).toEqual({ image: "Choose an image file to continue." });

      const tooBig = api().post("/api/items");
      for (const [key, value] of Object.entries(reportForm)) tooBig.field(key, value);
      tooBig.attach("image", Buffer.alloc(8 * 1024 * 1024 + 1), {
        filename: "huge.png",
        contentType: "image/png",
      });
      const second = await tooBig.expect(400);
      expect(second.body.error.fields).toEqual({ image: "Images must be smaller than 8 MB." });
    });
  });

  // =========================================================================
  // Admin workspace
  // =========================================================================

  describe("Admin login page and route guard", () => {
    it("signing in with the seeded admin returns a token and the user for the avatar", async () => {
      const response = await api()
        .post("/api/auth/login")
        .send({ email: ADMIN_EMAIL.toUpperCase(), password: ADMIN_PASSWORD })
        .expect(200);
      expect(response.body.data.token).toEqual(expect.any(String));
      expect(response.body.data.user).toEqual({
        id: expect.any(String),
        name: "LostNFind Admin",
        email: ADMIN_EMAIL,
        role: "ADMIN",
      });
      token = response.body.data.token;
    });

    it("a wrong password is refused with one sentence the form can show", async () => {
      const response = await api()
        .post("/api/auth/login")
        .send({ email: ADMIN_EMAIL, password: "nope-nope-nope" })
        .expect(401);
      expect(response.body.error).toEqual({
        code: "UNAUTHORIZED",
        message: "Incorrect email or password.",
      });
    });

    it("an empty login form returns field sentences", async () => {
      const response = await api().post("/api/auth/login").send({}).expect(400);
      expect(response.body.error.fields).toEqual({
        email: "Enter your email address.",
        password: "Enter your password.",
      });
    });

    it("the admin layout can check the session with /me and redirect on 401", async () => {
      const ok = await asAdmin(api().get("/api/auth/me")).expect(200);
      expect(ok.body.data.email).toBe(ADMIN_EMAIL);
      await api().get("/api/auth/me").expect(401);
      await api().get("/api/auth/me").set("Authorization", "Bearer broken.token").expect(401);
      await api().get("/api/auth/me").set("Authorization", `Token ${token}`).expect(401);
    });

    it("every admin page is locked without a token", async () => {
      for (const path of ["/api/admin/items", "/api/admin/claims", "/api/admin/stats"]) {
        const response = await api().get(path).expect(401);
        expect(response.body.error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("Overview page (AdminOverview + sidebar badge)", () => {
    it("one call fills the four tiles and both recent tables", async () => {
      const response = await asAdmin(api().get("/api/admin/stats")).expect(200);
      const stats = response.body.data;
      expect(stats.totalItems).toBe(await prisma.foundItem.count());
      expect(stats.pendingClaims).toBe(await prisma.claim.count({ where: { status: "PENDING" } }));
      expect(stats.approvedClaims).toBe(
        await prisma.claim.count({ where: { status: "APPROVED" } }),
      );
      expect(stats.itemsReturned).toBe(
        await prisma.foundItem.count({ where: { reviewStatus: "RETURNED" } }),
      );

      // "Recent found-item reports": 4 rows, newest submitted first, thumb + category + status
      expect(stats.recentItems).toHaveLength(4);
      for (const item of stats.recentItems) {
        expect(Object.keys(item).sort()).toEqual(ADMIN_ITEM_KEYS);
      }
      const submitted: string[] = stats.recentItems.map(
        (i: { submittedAt: string }) => i.submittedAt,
      );
      expect([...submitted].sort().reverse()).toEqual(submitted);

      // "Recent claim requests": claimant, date, found item name, status
      expect(stats.recentClaims).toHaveLength(4);
      expect(stats.recentClaims[0]).toMatchObject({
        claimant: { name: expect.any(String) },
        submittedAt: expect.any(String),
        item: { name: expect.any(String) },
        status: expect.any(String),
      });
    });
  });

  describe("Found Items page (AdminFoundItems)", () => {
    it("the table lists every report with 'Reported by …', newest submission first", async () => {
      const response = await asAdmin(api().get("/api/admin/items")).expect(200);
      expect(response.body.total).toBe(await prisma.foundItem.count());
      for (const item of response.body.data) {
        expect(Object.keys(item).sort()).toEqual(ADMIN_ITEM_KEYS);
        expect(item.reporter).toMatchObject({
          name: expect.any(String),
          email: expect.any(String),
          phone: expect.any(String),
        });
      }
      const submitted: string[] = response.body.data.map(
        (i: { submittedAt: string }) => i.submittedAt,
      );
      expect([...submitted].sort().reverse()).toEqual(submitted);
    });

    it("the search box matches name, category, location and reporter name", async () => {
      const byReporter = await asAdmin(api().get("/api/admin/items").query({ q: "morgan" })).expect(
        200,
      );
      expect(names(byReporter.body.data).sort()).toEqual([
        "Canvas tote bag", // Drew Morgan
        "Silver wristwatch", // Morgan Ellis
        "Wireless headphones", // Taylor Morgan
      ]);
      const byCategory = await asAdmin(api().get("/api/admin/items").query({ q: "keys" })).expect(
        200,
      );
      expect(names(byCategory.body.data)).toEqual(["Brass keyring with two keys"]);
    });

    it("the two selects filter, and their 'All …' first options mean no filter", async () => {
      const all = await asAdmin(
        api()
          .get("/api/admin/items")
          .query({ category: "All categories", reviewStatus: "All statuses" }),
      ).expect(200);
      expect(all.body.total).toBe(await prisma.foundItem.count());

      const pending = await asAdmin(
        api().get("/api/admin/items").query({ reviewStatus: "Pending review" }),
      ).expect(200);
      expect(names(pending.body.data).sort()).toEqual([
        "Blue water bottle",
        "Cream scarf with fringe",
        "Second bottle",
      ]);

      const rejectedBags = await asAdmin(
        api()
          .get("/api/admin/items")
          .query({ category: "Bags & wallets", reviewStatus: "Rejected" }),
      ).expect(200);
      expect(names(rejectedBags.body.data)).toEqual(["Canvas tote bag"]);
    });

    it("'View' opens the report with reporter email and phone links", async () => {
      const response = await asAdmin(api().get(`/api/admin/items/${idOf("silver-watch")}`)).expect(
        200,
      );
      expect(response.body.data).toMatchObject({
        name: "Silver wristwatch",
        reviewStatus: "Approved",
        submittedAt: "2026-10-08",
        reporter: { name: "Morgan Ellis", email: "morgan@example.com", phone: "+1 202-555-0101" },
      });
    });

    it("Pending review -> 'Approve report' publishes it; the item appears on the public site", async () => {
      const pending = await prisma.foundItem.findFirstOrThrow({
        where: { name: "Blue water bottle" },
      });
      const response = await asAdmin(
        api().patch(`/api/admin/items/${pending.id}/status`).send({ reviewStatus: "Approved" }),
      ).expect(200);
      expect(response.body.data.reviewStatus).toBe("Approved");
      expect(response.body.data.status).toBe("Waiting for owner");

      const nowPublic = await api().get(`/api/items/${pending.id}`).expect(200);
      expect(nowPublic.body.data.image).toBe(UPLOADED_ITEM_IMAGE);
    });

    it("Pending review -> 'Reject report', then Rejected -> 'Approve report'", async () => {
      const id = idOf("fringed-scarf-review");
      const rejected = await asAdmin(
        api().patch(`/api/admin/items/${id}/status`).send({ reviewStatus: "Rejected" }),
      ).expect(200);
      expect(rejected.body.data.reviewStatus).toBe("Rejected");
      await api().get(`/api/items/${id}`).expect(404);

      const approved = await asAdmin(
        api().patch(`/api/admin/items/${id}/status`).send({ reviewStatus: "Approved" }),
      ).expect(200);
      expect(approved.body.data.reviewStatus).toBe("Approved");
      await api().get(`/api/items/${id}`).expect(200);
    });

    it("Approved -> 'Mark returned' sets Returned + Reunited, closes pending claims, emails the approved claimant", async () => {
      // keyring has an approved claim (claim-keys-03); add a late pending claim too
      const late = await api()
        .post(`/api/items/${idOf("keyring")}/claims`)
        .send({ ...claimForm, name: "Late Claimant", email: "late@example.com" })
        .expect(201);

      sentMail.length = 0;
      const response = await asAdmin(
        api().post(`/api/admin/items/${idOf("keyring")}/return`),
      ).expect(200);
      expect(response.body.data).toMatchObject({ reviewStatus: "Returned", status: "Reunited" });

      expect(sentMail).toHaveLength(1);
      expect(sentMail[0].to).toBe("emery@example.com");
      expect(sentMail[0].subject).toBe('"Brass keyring with two keys" is back with you');

      const lateAfter = await prisma.claim.findUnique({ where: { id: late.body.data.id } });
      expect(lateAfter?.status).toBe("REJECTED");

      const publicView = await api()
        .get(`/api/items/${idOf("keyring")}`)
        .expect(200);
      expect(publicView.body.data.status).toBe("Reunited");
    });

    it("buttons the page never shows are refused with 409 and a sentence", async () => {
      const approvedId = idOf("black-sunglasses");
      const returnedId = idOf("keyring");

      const viaPatch = await asAdmin(
        api().patch(`/api/admin/items/${approvedId}/status`).send({ reviewStatus: "Returned" }),
      ).expect(409);
      expect(viaPatch.body.error.message).toBe(
        "Use the return action to mark an item as returned.",
      );

      const rejectApproved = await asAdmin(
        api().patch(`/api/admin/items/${approvedId}/status`).send({ reviewStatus: "Rejected" }),
      ).expect(409);
      expect(rejectApproved.body.error.message).toBe(
        "An approved report can only be marked as returned.",
      );

      const touchReturned = await asAdmin(
        api().patch(`/api/admin/items/${returnedId}/status`).send({ reviewStatus: "Approved" }),
      ).expect(409);
      expect(touchReturned.body.error.message).toBe(
        "This item has already been returned and can no longer be changed.",
      );

      await asAdmin(api().post(`/api/admin/items/${returnedId}/return`)).expect(409);
      const pendingReturn = await asAdmin(
        api().post(`/api/admin/items/${idOf("canvas-tote-review")}/return`),
      ).expect(409);
      expect(pendingReturn.body.error.message).toBe(
        "Only approved items can be marked as returned.",
      );
    });
  });

  describe("Claims page (AdminClaims + AdminClaimDetails)", () => {
    it("the table shows claimant, found item (with thumb), date and status, newest first", async () => {
      const response = await asAdmin(api().get("/api/admin/claims")).expect(200);
      expect(response.body.total).toBe(await prisma.claim.count());
      for (const claim of response.body.data) {
        const keys = Object.keys(claim)
          .filter((k) => k !== "supportingImage")
          .sort();
        expect(keys).toEqual(ADMIN_CLAIM_KEYS);
        expect(claim.item).toEqual({
          id: expect.any(String),
          name: expect.any(String),
          category: expect.any(String),
          location: expect.any(String),
          image: expect.anything(),
          reviewStatus: expect.any(String),
        });
      }
      const submitted: string[] = response.body.data.map(
        (c: { submittedAt: string }) => c.submittedAt,
      );
      expect([...submitted].sort().reverse()).toEqual(submitted);
    });

    it("the status tabs filter, 'All' shows everything, and the Pending badge count matches", async () => {
      const all = await asAdmin(api().get("/api/admin/claims").query({ status: "All" })).expect(
        200,
      );
      expect(all.body.total).toBe(await prisma.claim.count());

      const pending = await asAdmin(
        api().get("/api/admin/claims").query({ status: "Pending" }),
      ).expect(200);
      expect(pending.body.total).toBe(await prisma.claim.count({ where: { status: "PENDING" } }));
      const stats = await asAdmin(api().get("/api/admin/stats")).expect(200);
      expect(stats.body.data.pendingClaims).toBe(pending.body.total);

      const approved = await asAdmin(
        api().get("/api/admin/claims").query({ status: "Approved" }),
      ).expect(200);
      expect(approved.body.data.map((c: { id: string }) => c.id)).toEqual(["claim-keys-03"]);
    });

    it("the search box matches claimant name or email and item name or location", async () => {
      const byEmail = await asAdmin(api().get("/api/admin/claims").query({ q: "devon@" })).expect(
        200,
      );
      expect(byEmail.body.data.map((c: { id: string }) => c.id)).toEqual(["claim-bag-02"]);
      const byLocation = await asAdmin(
        api().get("/api/admin/claims").query({ q: "gallery" }),
      ).expect(200);
      expect(byLocation.body.data.map((c: { id: string }) => c.id)).toEqual(["claim-camera-04"]);
    });

    it("'Review' opens the claim with contact, what they lost, proof, and the supporting image", async () => {
      const withImage = await prisma.claim.findFirstOrThrow({
        where: { supportingImage: { not: null } },
      });
      const response = await asAdmin(api().get(`/api/admin/claims/${withImage.id}`)).expect(200);
      expect(response.body.data).toMatchObject({
        claimant: { name: "Robin Harper", email: "robin@example.com", phone: "+1 202 555 0121" },
        lostItemDescription: claimForm.description,
        ownershipProof: claimForm.proof,
        supportingImage: UPLOADED_CLAIM_IMAGE,
        status: "Pending",
        item: { name: "Wireless headphones", reviewStatus: "Approved" },
      });

      // the image itself is admin-only
      await api().get("/api/files/claims/proof.jpg").expect(401);
      const file = await asAdmin(api().get("/api/files/claims/proof.jpg")).expect(200);
      expect(file.body.toString()).toBe("proof-bytes");
    });

    it("'Approve claim' approves one, rejects the other pending claims on that item, emails the claimant", async () => {
      const rival = await api()
        .post(`/api/items/${idOf("silver-watch")}/claims`)
        .send({ ...claimForm, name: "Someone Else", email: "else@example.com" })
        .expect(201);

      sentMail.length = 0;
      const response = await asAdmin(
        api().patch("/api/admin/claims/claim-watch-01/status").send({ status: "Approved" }),
      ).expect(200);
      expect(response.body.data.status).toBe("Approved");
      expect(response.body.data.item.reviewStatus).toBe("Approved"); // item unchanged until return

      const rivalAfter = await prisma.claim.findUnique({ where: { id: rival.body.data.id } });
      expect(rivalAfter?.status).toBe("REJECTED");
      expect(sentMail).toHaveLength(2);
      expect(sentMail[0]).toMatchObject({
        to: "robin@example.com",
        subject: 'Good news about "Silver wristwatch"',
      });
      expect(sentMail[0].text).toContain("+1 202-555-0101"); // finder's phone for the owner
      expect(sentMail[1]).toMatchObject({ to: "morgan@example.com" });
      expect(sentMail[1].text).toContain("Robin Harper"); // owner's name for the finder
    });

    it("'Reject claim' emails the claimant and is final", async () => {
      sentMail.length = 0;
      const response = await asAdmin(
        api().patch("/api/admin/claims/claim-bag-02/status").send({ status: "Rejected" }),
      ).expect(200);
      expect(response.body.data.status).toBe("Rejected");
      expect(sentMail[0]).toMatchObject({ to: "devon@example.com" });

      const again = await asAdmin(
        api().patch("/api/admin/claims/claim-bag-02/status").send({ status: "Approved" }),
      ).expect(409);
      expect(again.body.error.message).toBe("This claim has already been reviewed.");
    });

    it("'Mark item returned' inside the claim modal (claim Approved, item not Returned)", async () => {
      sentMail.length = 0;
      const response = await asAdmin(
        api().post(`/api/admin/items/${idOf("silver-watch")}/return`),
      ).expect(200);
      expect(response.body.data).toMatchObject({ reviewStatus: "Returned", status: "Reunited" });
      expect(sentMail[0]).toMatchObject({ to: "robin@example.com" });

      // reopening the claim now shows item.reviewStatus Returned, so the modal hides the button
      const claim = await asAdmin(api().get("/api/admin/claims/claim-watch-01")).expect(200);
      expect(claim.body.data.item.reviewStatus).toBe("Returned");
    });

    it("claims of a returned item can no longer be changed", async () => {
      // simulate a claim that slipped through as pending on a returned item
      await prisma.claim.update({ where: { id: "claim-watch-01" }, data: { status: "PENDING" } });
      const response = await asAdmin(
        api().patch("/api/admin/claims/claim-watch-01/status").send({ status: "Approved" }),
      ).expect(409);
      expect(response.body.error.message).toMatch(/already been returned/);
      await prisma.claim.update({ where: { id: "claim-watch-01" }, data: { status: "APPROVED" } });
    });

    it("the status body only accepts the two buttons the modal shows", async () => {
      const response = await asAdmin(
        api().patch("/api/admin/claims/claim-camera-04/status").send({ status: "Pending" }),
      ).expect(400);
      expect(response.body.error.fields.status).toBe("Choose a valid claim status.");
    });
  });

  describe("Settings page (AdminSettings)", () => {
    it("has no backend: preferences stay in the browser, nothing to call", () => {
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // Not in the UI yet
  // =========================================================================

  describe("Future 'I lost something' form", () => {
    it("stores the report and answers with a summary that has no contact details", async () => {
      const response = await api()
        .post("/api/lost-items")
        .send({
          name: "Green insulated water bottle",
          category: "Other",
          description: "Green bottle with a carabiner on the lid",
          location: "Westside Community Pool",
          reporterName: "Lee Park",
          email: "lee@example.com",
          phone: "+1 555 000 1111",
        })
        .expect(201);
      expect(Object.keys(response.body.data).sort()).toEqual([
        "category",
        "id",
        "location",
        "name",
        "reportedDate",
      ]);
    });
  });
});
