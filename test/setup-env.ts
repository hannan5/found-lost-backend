// Runs before every e2e file. Provides a complete, fake environment so
// AppModule boots without a .env file. Tests that need a real database read
// DATABASE_URL_TEST from the real environment and skip when it is missing.

process.env.NODE_ENV = "test";
process.env.APP_URL ??= "http://localhost:4000";
process.env.DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? "postgresql://test:test@localhost:5432/lostnfind_test";
process.env.AWS_ACCESS_KEY_ID ??= "test";
process.env.AWS_SECRET_ACCESS_KEY ??= "test";
process.env.AWS_ENDPOINT_URL_S3 ??= "http://localhost:9000";
process.env.AWS_REGION ??= "us-east-2";
process.env.STORAGE_BUCKET ??= "files";
process.env.JWT_SECRET ??= "test-secret-that-is-long-enough";
process.env.JWT_EXPIRES_IN_SECONDS ??= "3600";
process.env.CORS_ORIGIN ??= "http://localhost:3000";
process.env.SMTP_HOST ??= "localhost";
process.env.SMTP_PORT ??= "1025";
process.env.MAIL_FROM ??= "LostNFind <no-reply@lostnfind.local>";
process.env.ADMIN_EMAIL ??= "admin@lostnfind.local";
