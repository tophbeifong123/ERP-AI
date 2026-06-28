# 07. Observability (การสังเกตการณ์ระบบ)

> เอกสารนี้อธิบาย Logging, Health Check, Bull Board, และ Request Tracing

---

## 1. ภาพรวม

ใน MVP มี observability ขั้นพื้นฐาน:
- **Structured logging** (pino) — JSON format
- **Request ID** — ติดตาม request ข้าม services
- **`/health` endpoint** — ตรวจสอบ DB, Redis, S3
- **Bull Board** — ดู queue (dev only)

---

## 2. Structured Logging (pino)

### 2.1 Format

ทุก log line เป็น **JSON** เพื่อให้ parse ง่าย (ELK, Datadog, Loki)

```json
{
  "level": "info",
  "time": 1719423600000,
  "reqId": "8a1f3b2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "userId": "user-uuid",
  "msg": "post created",
  "postId": "post-uuid",
  "status": "generating"
}
```

### 2.2 Levels

| Level | ใช้ตอน |
|---|---|
| `trace` | debug ละเอียดมาก (ไม่ใช้ใน prod) |
| `debug` | debug ปกติ (dev only) |
| `info` | เหตุการณ์ปกติ (request, job done, etc.) |
| `warn` | มีปัญหาแต่ไม่ critical (retry, deprecated API) |
| `error` | error ที่ต้องตามแก้ |
| `fatal` | error ร้ายแรง (service crash) |

### 2.3 Log Points (ที่ต้อง log)

**ทุก HTTP request:**
```typescript
this.logger.info({
  reqId,
  method: req.method,
  path: req.path,
  statusCode: res.statusCode,
  durationMs: ...,
  userId: req.user?.id,
}, 'request completed');
```

**Cron jobs:**
```typescript
this.logger.info({ cron: 'daily-decide', count: 47, durationMs: 1234 },
  'daily-decide completed');
```

**AI callbacks:**
```typescript
this.logger.info({ reqId, jobId, postId, type: 'caption' },
  'ai caption callback received');
```

**Errors:**
```typescript
this.logger.error({ err, reqId, context: '...', stack: err.stack },
  'something went wrong');
```

**ห้าม log:**
- ❌ Password
- ❌ Access token / refresh token
- ❌ Facebook access_token (แม้แต่ encrypted version)
- ❌ Email verification token / reset token
- ❌ Internal API key

### 2.4 Configuration

```typescript
// src/main.ts
import pino from 'pino';
import pinoHttp from 'pino-http';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
});

app.use(pinoHttp({ logger }));
```

---

## 3. Request ID

### 3.1 Purpose

ติดตาม request ข้าม services + log ทุก line ที่เกี่ยวข้อง

### 3.2 Implementation

**Middleware: สร้างหรือรับ request ID**

```typescript
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const reqId = req.headers['x-request-id'] || randomUUID();
    req.reqId = reqId;
    res.setHeader('X-Request-Id', reqId);
    return next.handle();
  }
}
```

**ทุก log line ต้องมี `reqId`:**

```typescript
this.logger.info({ reqId: req.reqId, userId }, 'login successful');
```

**AI callbacks ต้อง forward `reqId`:**
- Backend ส่ง `X-Request-Id` ใน request ไป AI
- AI ต้องส่งกลับใน callback header (เพื่อตาม trace ได้)

---

## 4. Health Check

### 4.1 Endpoint

```
GET /health
```

**Public** (ไม่ต้อง auth)

### 4.2 Response (200)

```json
{
  "status": "ok",
  "db": "ok",
  "redis": "ok",
  "storage": "ok",
  "version": "1.0.0",
  "uptime": 3600
}
```

### 4.3 Response (503)

```json
{
  "status": "degraded",
  "db": "ok",
  "redis": "error",
  "storage": "ok",
  "errors": {
    "redis": "Connection refused"
  }
}
```

### 4.4 Implementation

```typescript
@Controller('health')
export class HealthController {
  constructor(
    private db: DataSource,
    private redis: Redis,
    private s3: S3Client,
  ) {}

  @Get()
  async check() {
    const checks = await Promise.allSettled([
      this.checkDb(),
      this.checkRedis(),
      this.checkStorage(),
    ]);

    const result = { status: 'ok', db: 'ok', redis: 'ok', storage: 'ok' };
    let hasError = false;

    if (checks[0].status === 'rejected') {
      result.db = 'error';
      hasError = true;
    }
    // ... redis, storage

    if (hasError) {
      result.status = 'degraded';
      throw new ServiceUnavailableException(result);
    }
    return result;
  }

  private async checkDb() {
    await this.db.query('SELECT 1');
  }

  private async checkRedis() {
    await this.redis.ping();
  }

  private async checkStorage() {
    await this.s3.send(new HeadBucketCommand({ Bucket: 'posts' }));
  }
}
```

---

## 5. Bull Board (Queue UI)

### 5.1 Purpose

ดู jobs ที่ค้าง / fail ใน queue (พัฒนาและ debug)

### 5.2 Endpoint

```
GET /admin/queues
```

**Dev only** (ปิดใน prod)

### 5.3 Auth

- ใน dev: ไม่ต้อง auth
- ใน prod: ต้องมี basic auth หรือ JWT (TBD)

### 5.4 แสดงอะไร

- Queues: caption, image, short_video, email, dispatch, retry
- Counts: waiting, active, completed, failed
- Job details: payload, result, stack trace (สำหรับ failed)
- Actions: retry, remove

---

## 6. Error Tracking (Phase 4)

ใน MVP ไม่มี Sentry / Rollbar integration — log เป็นหลัก

**Phase 4 จะเพิ่ม:**
- Sentry SDK
- Capture unhandled exceptions
- Capture 5xx errors
- Source maps (สำหรับ debug stack trace ใน prod)

---

## 7. Metrics (Phase 4)

ใน MVP ไม่มี metrics export

**Phase 4 จะเพิ่ม:**
- Prometheus `/metrics` endpoint
- Key metrics:
  - HTTP request duration (histogram)
  - Queue size (gauge)
  - AI job success/fail rate
  - Post published per day
  - User signups per day
  - Email send rate

---

## 8. Log Aggregation

ใน MVP log เขียนลง **stdout** (container-friendly)

**Production setup (ตัวอย่าง):**
- Docker → log driver ส่งไป Loki/ELK
- หรือใช้ CloudWatch / Stackdriver

---

## 9. อ่านเพิ่มเติม

- [`01-OVERVIEW.md`](./01-OVERVIEW.md) — architecture
- [`02-DATA-MODEL.md`](./02-DATA-MODEL.md) — schema

อัปเดตล่าสุด: 2026-06-27
