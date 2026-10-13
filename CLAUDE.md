# LostNFind Backend

REST API for the LostNFind frontend that lives in the sibling folder `../Lost-FInd` (Next.js 16, React 19, TypeScript). The frontend is already a complete UI prototype with mock data. This backend replaces that mock data and the stubbed form submits. It is a NestJS application. Read this file fully before writing code. When something here conflicts with the frontend, the frontend's types and status strings win, because the UI is already built around them.

## Stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Runtime | Node.js 20+, TypeScript (strict) | Nest CLI (`@nestjs/cli`) for scaffolding, dev and build |
| Framework | NestJS 11 on the Express adapter (`@nestjs/platform-express`) | One feature module per resource under `src/modules/`. Do not swap to Fastify; Multer and Supertest assume Express |
| Config | `@nestjs/config` | `ConfigModule.forRoot({ isGlobal: true, validate })` where `validate` is the Zod env schema in `src/config/env.ts` |
| Database | PostgreSQL on Neon, project `cold-dawn-28701403`, branch `production` | `neon link` writes `DATABASE_URL` into `.env.local`. Any Postgres works for tests |
| ORM | Prisma 6 | Schema in `prisma/schema.prisma`, migrations committed under `prisma/migrations/`. Exposed to Nest through a global `PrismaModule` / `PrismaService` |
| Validation | Zod via a custom `ZodValidationPipe` | Schemas mirror the frontend's `validate()` rules exactly (see Validation). Do not use `class-validator` / `class-transformer`; one validation library only |
| Auth | `@nestjs/jwt` (access token, `JWT_EXPIRES_IN_SECONDS`, default 7 days) in `Authorization: Bearer`, `JwtAuthGuard` + `RolesGuard` | Admin only. The public site has no login |
| Passwords | bcrypt | Admin accounts are seeded, there is no public sign-up |
| Uploads | `FileInterceptor` (Multer, memory) then Neon Object Storage through `@aws-sdk/client-s3` | Private bucket `files` declared in `neon.ts`. Objects are served by `GET /api/files/<folder>/<name>`; the record stores that URL. Frontend already limits to `image/*` and 8 MB |
| Email | Nodemailer (SMTP) wrapped in a `MailerService` | Claim approved / rejected and item returned notifications. Without `SMTP_HOST` mail is logged, not sent |
| Lint | ESLint 9 + typescript-eslint | Same style as the frontend: double quotes, semicolons, 2 spaces |
| Tests | Jest + Supertest (Nest defaults) | Unit tests next to services (`*.spec.ts`), e2e tests under `test/` booting the real `AppModule`. Every route gets at least one happy-path and one validation e2e test. Tests run against a separate `DATABASE_URL_TEST` database |

Port `4000` in dev. CORS must allow `http://localhost:3000` (the Next.js dev server). `setupApp()` in `src/setup-app.ts` sets `app.setGlobalPrefix("api")`, `app.enableCors({ origin: CORS_ORIGIN })`, and registers the global `HttpExceptionFilter`; `main.ts` and the e2e tests both call it so they never drift.

## Current state

All routes in the API section are implemented and covered by three e2e suites: `test/frontend-flows.e2e-spec.ts` (55 cases written screen by screen from the frontend: every page, modal, button and validation sentence), `test/api.e2e-spec.ts` (26 route-level cases) and `test/app.e2e-spec.ts` (7 no-DB smoke cases). The first migration is committed under `prisma/migrations/20261011161343_init/` and is applied and seeded on the Neon `production` branch. Image upload to the Neon bucket and read-back through `/api/files` were verified against the real bucket.

Running the DB-backed tests needs a Postgres reachable through `DATABASE_URL_TEST`; the suite skips itself when the variable is missing. Any Postgres works, for example:

```
docker run -d --name lostnfind-test-pg -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=lostnfind_test -p 5433:5432 postgres:16-alpine
DATABASE_URL=postgresql://test:test@127.0.0.1:5433/lostnfind_test npx prisma migrate deploy
DATABASE_URL_TEST=postgresql://test:test@127.0.0.1:5433/lostnfind_test npm run test:e2e
```

Next: wire the frontend (see Frontend integration checklist), then the matching feature (see Planned next step).

## Folder layout (create as you go, keep this shape)

```
backend/
  prisma/
    schema.prisma
    migrations/
    seed.ts                         # admin user + the frontend's mock items and claims
    seed-data.ts                    # copied from the frontend mock files
  src/
    main.ts                         # NestFactory.create(AppModule), setupApp(), listen
    setup-app.ts                    # global prefix, CORS, HttpExceptionFilter; shared by main.ts and e2e tests
    app.module.ts                   # imports ConfigModule, PrismaModule, and every feature module
    app.controller.ts               # GET /api/health
    config/
      env.ts                        # Zod schema for process.env + validate() for ConfigModule
    common/
      errors/app.exception.ts       # AppException extends HttpException, carries code + fields
      filters/http-exception.filter.ts  # formats every error as { error: { code, message, fields } }
      pipes/zod-validation.pipe.ts  # ZodValidationPipe(schema) -> 400 VALIDATION_ERROR with fields map
      pipes/image-file.pipe.ts      # mimetype image/*, size <= 8 MB, otherwise 400 fields.image
      guards/jwt-auth.guard.ts
      guards/roles.guard.ts
      decorators/roles.decorator.ts
      decorators/current-user.decorator.ts
      types/auth.ts                 # JwtPayload, AuthUser, AuthenticatedRequest
      lib/format.ts                 # date, email, phone helpers copied from the frontend
      lib/mappers.ts                # toPublicItem, toAdminItem, toAdminClaim, enum <-> string maps
    prisma/
      prisma.module.ts              # @Global()
      prisma.service.ts             # extends PrismaClient, connects in onModuleInit
    integrations/
      storage/                      # storage.module.ts, storage.service.ts (S3 client for the Neon bucket)
      mailer/                       # mailer.module.ts, mailer.service.ts
    modules/
      auth/                         # auth.module.ts, auth.controller.ts, auth.service.ts, auth.schemas.ts
      items/                        # items.module.ts, items.controller.ts (public), admin-items.controller.ts, items.service.ts, items.schemas.ts
      claims/                       # claims.module.ts, claims.controller.ts (public), admin-claims.controller.ts, claims.service.ts, claims.schemas.ts
      lost-items/                   # lost-items.module.ts, lost-items.controller.ts, lost-items.service.ts, lost-items.schemas.ts
      stats/                        # stats.module.ts, stats.controller.ts, stats.service.ts
      files/                        # files.module.ts, files.controller.ts (streams bucket objects)
  neon.ts                           # Neon branch policy: the private "files" bucket
  .neon                             # written by `neon link` (git-ignored)
  .env.local                        # written by `neon link`: DATABASE_URL, AWS_* (git-ignored)
  test/
    setup-env.ts                    # fake env so AppModule boots without .env; DATABASE_URL_TEST when present
    app.e2e-spec.ts                 # no-DB smoke tests (PrismaService stubbed): health, 401, 404, validation envelope
    items.e2e-spec.ts, claims.e2e-spec.ts, auth.e2e-spec.ts, admin.e2e-spec.ts   # DB-backed, to add
    jest-e2e.json
  .env.example
  nest-cli.json
  package.json
  tsconfig.json
  tsconfig.build.json
```

Route prefixes come from the controllers: public controllers use `@Controller("items")`, `@Controller("items/:id/claims")`, `@Controller("lost-items")`; admin controllers use `@Controller("admin/items")`, `@Controller("admin/claims")`, `@Controller("admin/stats")`; auth uses `@Controller("auth")`. Combined with the global `api` prefix these produce exactly the paths in the API section. Admin controllers are decorated at class level with `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles("ADMIN")`.

## Domain model (mirror of `../Lost-FInd/src/types/item.ts`)

Keep every enum value as the exact string the frontend uses. The frontend renders these strings directly and derives CSS classes from them (`StatusBadge`). Prisma enums cannot contain spaces, so the database stores an identifier and the API layer maps it to the frontend string in `src/common/lib/mappers.ts`. Never send the enum identifier to the frontend.

| Prisma enum | DB value | API / frontend string |
| --- | --- | --- |
| `ItemCategory` | `ELECTRONICS`, `BAGS_WALLETS`, `CLOTHING`, `ACCESSORIES`, `KEYS`, `DOCUMENTS`, `OTHER` | `"Electronics"`, `"Bags & wallets"`, `"Clothing"`, `"Accessories"`, `"Keys"`, `"Documents"`, `"Other"` |
| `ItemStatus` | `WAITING_FOR_OWNER`, `REUNITED` | `"Waiting for owner"`, `"Reunited"` |
| `ReviewStatus` | `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `RETURNED` | `"Pending review"`, `"Approved"`, `"Rejected"`, `"Returned"` |
| `ClaimStatus` | `PENDING`, `APPROVED`, `REJECTED` | `"Pending"`, `"Approved"`, `"Rejected"` |

### `prisma/schema.prisma` (target shape)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role          { ADMIN }
enum ItemCategory  { ELECTRONICS BAGS_WALLETS CLOTHING ACCESSORIES KEYS DOCUMENTS OTHER }
enum ItemStatus    { WAITING_FOR_OWNER REUNITED }
enum ReviewStatus  { PENDING_REVIEW APPROVED REJECTED RETURNED }
enum ClaimStatus   { PENDING APPROVED REJECTED }

model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  role         Role     @default(ADMIN)
  createdAt    DateTime @default(now())
}

model FoundItem {
  id            String       @id @default(cuid())
  slug          String?      @unique          // keeps the frontend mock ids ("silver-watch") recognisable after seeding
  name          String
  category      ItemCategory
  description   String
  location      String
  foundDate     String                        // "YYYY-MM-DD", see Dates
  image         String?
  status        ItemStatus   @default(WAITING_FOR_OWNER)
  reviewStatus  ReviewStatus @default(PENDING_REVIEW)
  submittedAt   String                        // "YYYY-MM-DD"
  reporterName  String
  reporterEmail String
  reporterPhone String
  reporterWhatsapp String?
  claims        Claim[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@index([reviewStatus, submittedAt])
  @@index([category])
}

model Claim {
  id                  String      @id @default(cuid())
  itemId              String
  item                FoundItem   @relation(fields: [itemId], references: [id], onDelete: Cascade)
  claimantName        String
  claimantEmail       String
  claimantPhone       String
  lostItemDescription String
  ownershipProof      String
  supportingImage     String?
  status              ClaimStatus @default(PENDING)
  submittedAt         String                  // "YYYY-MM-DD"
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt

  @@index([itemId, status])
}

model LostItem {
  id            String       @id @default(cuid())
  name          String
  category      ItemCategory
  description   String
  location      String
  reportedDate  String                        // "YYYY-MM-DD"
  reporterName  String
  reporterEmail String
  reporterPhone String
  createdAt     DateTime     @default(now())
}
```

`LostItem` has no UI in the frontend yet (the type and mock data exist). Keep the model so the "I lost something" flow and the matching feature can be added later.

### API shapes (what the mappers produce)

- `toPublicItem(item)` → `{ id, name, category, description, location, foundDate, image, status }`. This is exactly the frontend `FoundItem` type. No reporter fields, no `reviewStatus`.
- `toAdminItem(item)` → public shape plus `{ submittedAt, reviewStatus, reporter: { name, email, phone, whatsapp? } }`. This is the frontend `AdminFoundItem` type.
- `toAdminClaim(claim)` → `{ id, itemId, claimant: { name, email, phone }, lostItemDescription, ownershipProof, supportingImage?, submittedAt, status, item: { id, name, category, location, image, reviewStatus } }`.

### Dates

`foundDate`, `submittedAt`, `reportedDate` are stored as `YYYY-MM-DD` strings on purpose. The frontend's `formatDate()` appends `T12:00:00Z` and formats in UTC, so keep them as plain date strings, not `DateTime`. Only `createdAt` / `updatedAt` are real timestamps.

## API

All responses are JSON. Success: `{ "data": ... }`. List responses: `{ "data": [...], "total": n }`. Errors: `{ "error": { "code": "VALIDATION_ERROR" | "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN" | "CONFLICT" | "INTERNAL", "message": string, "fields"?: { [field]: string } } }`. The `fields` map uses the same keys as the frontend form state so errors can be shown inline (`name`, `category`, `description`, `location`, `foundDate`, `reporterName`, `email`, `phone`, `whatsapp` for reports; `name`, `email`, `phone`, `description`, `proof` for claims).

### Public (no auth)

| Method | Path | Frontend caller | Behaviour |
| --- | --- | --- | --- |
| GET | `/api/items` | `FoundItemsBrowser`, `HomeExperience` | Only `reviewStatus` in `APPROVED` or `RETURNED`. Query: `q` (case-insensitive substring over name, location, category, description), `category` (frontend string, exact or omitted), `sort` = `newest` (default) / `oldest` / `name`, `limit` (default 50). Returns `toPublicItem`. |
| GET | `/api/items/:id` | `ItemDetailsModal` | Same shape and visibility rule as the list |
| POST | `/api/items` | `ReportItemForm` | `multipart/form-data`. Fields: `name, category, description, location, foundDate, reporterName, email, phone, whatsapp?, image?`. Creates with `reviewStatus: PENDING_REVIEW`. Returns `201` with the public shape. |
| POST | `/api/items/:id/claims` | `ClaimItemForm` | `multipart/form-data`. Fields: `name, email, phone, description, proof, supportingImage?`. Item must be `APPROVED` and `WAITING_FOR_OWNER`. Returns `201 { data: { id, status } }`. Sends admin a "new claim" email. |
| POST | `/api/lost-items` | future "I lost something" form | Same validation style. Returns `201`. |
| GET | `/api/files/items/:name` | `<img src>` on every item | Streams an item image from the private bucket. Public, long cache. |
| GET | `/api/files/claims/:name` | `AdminClaimDetails` | Streams claim evidence. Bearer token required. |

### Auth

| Method | Path | Behaviour |
| --- | --- | --- |
| POST | `/api/auth/login` | `{ email, password }` → `{ data: { token, user: { id, name, email, role } } }` |
| GET | `/api/auth/me` | Requires Bearer token. Returns the user |

### Admin (Bearer token, role `ADMIN`)

These map one-to-one onto `AdminDataProvider`'s state and setters in `../Lost-FInd/src/components/admin/admin-data-provider.tsx`.

| Method | Path | Replaces | Behaviour |
| --- | --- | --- | --- |
| GET | `/api/admin/items` | `foundItems` state | `toAdminItem` shape. Query: `q` (name, category, location, reporterName), `category`, `reviewStatus` (frontend strings; the UI's "All categories" / "All statuses" labels mean no filter). Sorted by `submittedAt` desc. |
| GET | `/api/admin/items/:id` | `AdminItemDetails` | Full shape |
| PATCH | `/api/admin/items/:id/status` | `setItemStatus` | Body `{ reviewStatus }` (frontend string). Must follow the transition table below. |
| POST | `/api/admin/items/:id/return` | `markItemReturned` | Sets `reviewStatus: RETURNED` and `status: REUNITED` in one transaction. Emails the approved claimant if one exists. |
| GET | `/api/admin/claims` | `claims` state | `toAdminClaim` shape. Query: `q` (claimant name/email, item name/location), `status`. Sorted by `submittedAt` desc. |
| GET | `/api/admin/claims/:id` | `AdminClaimDetails` | Full claim with item |
| PATCH | `/api/admin/claims/:id/status` | `setClaimStatus` | Body `{ status }`. Only from `PENDING`. Approving one claim auto-rejects the other pending claims on the same item (single transaction), then emails the claimant (with the finder's contact) and the finder (with the claimant's contact). Rejecting emails the claimant. |
| GET | `/api/admin/stats` | `AdminOverview` | `{ totalItems, pendingClaims, approvedClaims, itemsReturned, recentItems: [4], recentClaims: [4] }` |

### Status transitions (enforce in services, return `409 CONFLICT` otherwise)

```
FoundItem.reviewStatus
  PENDING_REVIEW -> APPROVED | REJECTED
  REJECTED       -> APPROVED
  APPROVED       -> RETURNED      (via /return, also sets status = REUNITED and rejects remaining PENDING claims)
  RETURNED       -> (none)

Claim.status
  PENDING  -> APPROVED | REJECTED   (409 if the item is already RETURNED)
  APPROVED -> (none)   item can then be returned via /api/admin/items/:id/return
  REJECTED -> (none)
```

## Validation (copy the frontend rules, do not loosen them)

From `../Lost-FInd/src/lib/format.ts` and the two forms:

- Email: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` on the trimmed value.
- Phone / WhatsApp: strip non-digits, length 7 to 15.
- `foundDate`: `YYYY-MM-DD`, not after today (compare as strings against today's UTC date).
- `category`: must be one of the seven frontend strings; map to the enum after validation.
- All text fields trimmed, required ones non-empty.
- Images: mimetype starts with `image/`, size ≤ 8 MB, otherwise `400` with `fields.image`.

Error messages should be the same sentences the frontend already shows (for example `"Enter a valid email address."`, `"The date found cannot be in the future."`) so the UI can display server errors without a mapping layer.

## Privacy rules (non-negotiable)

- Public routes never return reporter fields, `reviewStatus`, or any claim data. Use `toPublicItem()` and nothing else.
- Claim details (ownership proof, claimant contact) are admin-only.
- Do not log request bodies that contain contact details.

## Environment

`.env.example` must list every variable. `src/config/env.ts` exports the Zod schema and a `validate(config)` function passed to `ConfigModule.forRoot`, so Nest refuses to boot with a clear message if any are missing. Read values through `ConfigService<Env, true>`, never `process.env` directly.

```
NODE_ENV=development
PORT=4000
APP_URL=http://localhost:4000            # file URLs are APP_URL/api/files/<key>
STORAGE_BUCKET=files                     # bucket name from neon.ts
DATABASE_URL_TEST=                       # separate DB for e2e tests; they wipe it
JWT_SECRET=
JWT_EXPIRES_IN_SECONDS=604800
CORS_ORIGIN=http://localhost:3000
SMTP_HOST=                               # optional in dev
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM="LostNFind <no-reply@lostnfind.local>"
ADMIN_EMAIL=
SEED_ADMIN_EMAIL=admin@lostnfind.local
SEED_ADMIN_PASSWORD=
```

`.env.local` is written by the Neon CLI and holds `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION`. Nest loads `.env` then `.env.local`; the `db:*` scripts load both through `dotenv-cli` because the Prisma CLI only reads `.env` on its own.

Setup: `npx neon@latest login`, then `npx neon@latest link --project-id cold-dawn-28701403 --branch production -y` (writes `.neon` and `.env.local`), then `npx neon@latest deploy` (applies `neon.ts`). Never commit `.env`, `.env.local` or `.neon`.

## Scripts

```
npm run start:dev        # nest start --watch
npm run build            # prisma generate && nest build
npm start                # node dist/main
npm run db:migrate       # prisma migrate dev        (local, creates a migration)
npm run db:deploy        # prisma migrate deploy     (CI / production)
npm run db:studio        # prisma studio
npm run db:seed          # ts-node prisma/seed.ts    (admin user + mock data from the frontend)
npm run db:status        # prisma migrate status
# db:* scripts run through `dotenv -e .env -e .env.local --` so Prisma sees the Neon DATABASE_URL
npm run lint
npm test                 # jest (unit)
npm run test:e2e         # jest --config test/jest-e2e.json
```

`package.json` must include `"prisma": { "seed": "ts-node prisma/seed.ts" }` so `prisma migrate reset` re-seeds automatically.

The seed must import the same records that live in `../Lost-FInd/src/data/found-items.ts` and `admin-mock.ts` (copy them into `prisma/seed-data.ts`, store the frontend id in `slug`, map category/status strings to enums). Use `upsert` on `slug` so the seed is re-runnable.

## Frontend integration checklist

When wiring the frontend, change only these places in `../Lost-FInd`:

1. `src/components/forms/report-item-form.tsx` and `claim-item-form.tsx`: replace the `setTimeout(700)` in `handleSubmit` with a `fetch` to the POST routes above, map `error.fields` into `setErrors`.
2. `src/components/routes/found-items-browser.tsx` and `home-experience.tsx`: fetch `/api/items` instead of importing `foundItems`.
3. `src/components/admin/admin-data-provider.tsx`: seed state from `/api/admin/items` and `/api/admin/claims`, make each setter call its PATCH/POST route and then update local state from the response.
4. Add a login page under `src/app/admin/login/` and a check in `src/app/admin/layout.tsx` (or `middleware.ts`) that redirects when there is no token.
5. Add `NEXT_PUBLIC_API_URL=http://localhost:4000` to the frontend `.env.local`.

Keep the frontend's UX unchanged: same field names, same error sentences, same status strings.

## Conventions

- Controllers do no business logic: decorate, validate through pipes, call one service method, return `{ data }`. Services do no HTTP (no `Request`, `Response`, or Nest `HttpException` imports; they throw `AppException` only). Prisma calls live only in services.
- One `PrismaService` from `src/prisma/prisma.service.ts`, provided by the global `PrismaModule`; never instantiate `PrismaClient` elsewhere. Inject it through the constructor.
- Every feature is a Nest module under `src/modules/`. A module exports its service only when another module needs it (for example `ItemsModule` exports `ItemsService` for `ClaimsModule` and `StatsModule`).
- Multi-step writes (approve claim + reject siblings, return item + notify) use `this.prisma.$transaction`.
- Every request body and query is validated with `@Body(new ZodValidationPipe(schema))` or `@Query(new ZodValidationPipe(schema))` using a schema from the module's `*.schemas.ts`. Multipart routes use `@UseInterceptors(FileInterceptor("image"))` (or `"supportingImage"`) plus `@UploadedFile(ImageFilePipe)`; the text fields still go through the Zod pipe.
- Never throw raw `Error` or bare `HttpException` from services or controllers; throw `AppException(code, status, message, fields?)`. The global `HttpExceptionFilter` formats it, and also maps Nest's own exceptions (`NotFoundException`, `UnauthorizedException`, `ForbiddenException`) and Prisma `P2025` (record not found) to the error envelope with the matching `code`. Unknown errors become `500 INTERNAL` with a generic message.
- Guards: `JwtAuthGuard` verifies the Bearer token with `JwtService` and sets `request.user`; `RolesGuard` reads `@Roles()` metadata through `Reflector`. Public controllers carry no guards.
- Keep `main.ts` free of logic: build the app, apply the global prefix, CORS and filter, then listen on `PORT`.
- Schema changes always go through `prisma migrate dev`, never `db push`, so migrations stay in git.
- Commit messages: imperative, one line, e.g. `Add claim status transition guard`.

## Planned next step (FYP differentiator)

After the routes above work, add `POST /api/match` (or a scheduled job) that scores each `LostItem` against `APPROVED` found items by category, date proximity, location text similarity and description similarity, and emails the lost-item reporter when a score passes a threshold. Postgres `pg_trgm` is enough for text similarity at this scale; enable it in a migration when the feature starts. Do not build it before the core routes are done.
