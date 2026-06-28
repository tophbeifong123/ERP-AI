# 06. Authentication & Authorization

> เอกสารนี้อธิบายกลไก Authentication (JWT + Refresh Token) และ Authorization (Owner Guard)

---

## 1. ภาพรวม

ระบบมี 2 ประเภท authentication:

1. **User Authentication** — JWT access token + refresh token (สำหรับ user ทั่วไป)
2. **Internal Authentication** — Shared secret ใน header (สำหรับ AI services เรียก callback)

---

## 2. User Authentication

### 2.1 Flow

```
┌──────────┐                                  ┌──────────┐
│ Frontend │                                  │ Backend  │
│          │  POST /auth/login                │          │
│          │ ────────────────────────────────▶ │          │
│          │                                  │ verify   │
│          │  { accessToken, refreshToken }   │ password │
│          │ ◀──────────────────────────────── │          │
│          │                                  │          │
│          │  GET /businesses                  │          │
│          │  Authorization: Bearer xxx        │          │
│          │ ────────────────────────────────▶ │          │
│          │                                  │ verify   │
│          │  { businesses: [...] }            │ JWT      │
│          │ ◀──────────────────────────────── │          │
│          │                                  │          │
│          │  (15 นาทีผ่านไป)                  │          │
│          │  GET /businesses                  │          │
│          │  Authorization: Bearer xxx        │          │
│          │ ────────────────────────────────▶ │          │
│          │  401 unauthorized                 │          │
│          │ ◀──────────────────────────────── │          │
│          │                                  │          │
│          │  POST /auth/refresh               │          │
│          │  { refreshToken }                 │          │
│          │ ────────────────────────────────▶ │ verify   │
│          │  { accessToken: yyy }             │ refresh  │
│          │ ◀──────────────────────────────── │          │
│          │                                  │          │
│          │  GET /businesses                  │          │
│          │  Authorization: Bearer yyy        │          │
│          │ ────────────────────────────────▶ │          │
│          │  { businesses: [...] }            │          │
│          │ ◀──────────────────────────────── │          │
└──────────┘                                  └──────────┘
```

### 2.2 Access Token (JWT)

**Format:** `Authorization: Bearer <jwt>`

**Payload:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "iat": 1719423600,
  "exp": 1719424500
}
```

**TTL:** 15 นาที (900 วินาที)

**Algorithm:** HS256 (HMAC-SHA256)
**Secret:** `JWT_ACCESS_SECRET` (env)

**Verification:** `JwtAuthGuard` ใน Backend ตรวจ signature + expiration

### 2.3 Refresh Token (Opaque)

**Format:** Random 32-byte string (base64url encoded) — **ไม่ใช่ JWT**

**Storage:**
- **Client:** httpOnly cookie (ปลอดภัยกว่า localStorage)
- **Server:** `refresh_tokens.token_hash` (sha256 ของ token)

**TTL:** 7 วัน

**Rotation:** ทุกครั้งที่ใช้ refresh token จะ:
1. Mark token เก่าเป็น `revoked_at = now()`
2. สร้าง token ใหม่
3. เก็บ `replaced_by_id` เพื่อ chain

**Logout:** Mark current refresh token เป็น revoked (access token หมดอายุเองใน 15 นาที)

### 2.4 Endpoints

| Endpoint | ใช้ตอน |
|---|---|
| `POST /auth/register` | สมัคร |
| `POST /auth/login` | login |
| `POST /auth/refresh` | auto refresh |
| `POST /auth/logout` | logout |
| `POST /auth/forgot-password` | ลืมรหัส |
| `POST /auth/reset-password` | ตั้งรหัสใหม่ |
| `POST /auth/verify-email` | ยืนยันอีเมล |
| `POST /auth/change-password` | เปลี่ยนรหัส (ต้อง login) |

---

## 3. Internal Authentication (AI Services)

### 3.1 Purpose

AI services (Decision / Caption / Media) เรียก callback ไปที่ `/internal/ai/*` ต้องมี shared secret

### 3.2 Header

```
X-Internal-Token: <shared secret>
```

**Secret:** `INTERNAL_API_KEY` (env) — ตั้งค่าเดียวกันทั้ง Backend และ AI services

### 3.3 Guard

```typescript
@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const token = req.headers['x-internal-token'];
    if (token !== process.env.INTERNAL_API_KEY) {
      throw new UnauthorizedException('invalid internal token');
    }
    return true;
  }
}
```

### 3.4 Endpoints ที่ใช้ Internal Token

- `POST /internal/ai/decide/callback`
- `POST /internal/ai/caption/callback`
- `POST /internal/ai/image/callback`
- `POST /internal/ai/short_video/callback`

### 3.5 Endpoints ที่ **ไม่ต้อง** ใช้ Token (Public)

- `POST /auth/*`
- `GET /health`
- (Dev only) `POST /internal/test/*`

---

## 4. Authorization (Owner Guard)

### 4.1 Purpose

ตรวจสอบว่า user ที่ login เป็น **เจ้าของ** resource ที่กำลังเข้าถึง

### 4.2 Examples

| Resource | Check |
|---|---|
| `GET /businesses/:id` | `business.owner_id = currentUser.id` |
| `POST /businesses/:id/services` | `business.owner_id = currentUser.id` |
| `POST /posts/:id/approve` | `post.business.owner_id = currentUser.id` |
| `DELETE /facebook/pages/:id` | `page.business.owner_id = currentUser.id` |

### 4.3 Guard Implementation

```typescript
@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;  // set by JwtAuthGuard
    const resourceType = this.reflector.get('resourceType', context.getHandler());
    const resourceId = req.params.id;

    // Load resource and check ownership
    const ownerId = await this.getOwnerId(resourceType, resourceId);
    if (ownerId !== user.id) {
      throw new ForbiddenException('not owner');
    }
    return true;
  }
}
```

### 4.4 Email Verification Guard

`EmailVerifiedGuard` ตรวจว่า `user.email_verified_at` ไม่เป็น null:

- ถ้า user login แล้วแต่ยังไม่ verify → 403 `email_not_verified`
- ใช้กับทุก endpoint ยกเว้น `/auth/*`

---

## 5. Password Hashing

**Algorithm:** argon2id (OWASP recommended)

```typescript
import * as argon2 from 'argon2';

const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,   // 64 MB
  timeCost: 3,
  parallelism: 1,
});

const isValid = await argon2.verify(hash, password);
```

**Requirements:**
- ≥ 8 ตัวอักษร
- (Phase 4) ≥ 1 ตัวพิมพ์ใหญ่, ≥ 1 ตัวเลข

---

## 6. Email Verification Flow

### 6.1 Register

1. INSERT user (email_verified_at = NULL)
2. สร้าง verification token (UUID + hash เก็บ DB, TTL 24h)
3. ส่ง email `verify-email` พร้อม link
4. INSERT notification (type = 'verify_email', channel = 'email')

### 6.2 Click link

1. User เปิด link `https://app/verify-email?token=xxx`
2. Frontend เรียก `POST /auth/verify-email { token }`
3. Backend: verify token, UPDATE `email_verified_at = now()`
4. ตอบ 200 OK

### 6.3 Token ใหม่

ถ้า token หมดอายุ → user ขอใหม่ผ่าน `POST /auth/resend-verification` (optional endpoint)

---

## 7. Password Reset Flow

### 6.1 Forgot

1. `POST /auth/forgot-password { email }`
2. ถ้า email มีอยู่ → สร้าง reset token (TTL 1h), ส่ง email
3. **ตอบ 200 เสมอ** (ไม่เปิดเผยว่า email มีหรือไม่)

### 6.2 Reset

1. `POST /auth/reset-password { token, newPassword }`
2. Verify token
3. UPDATE password_hash
4. **Revoke refresh tokens ทั้งหมด** (force re-login ทุก device)
5. ตอบ 200

---

## 8. Security Best Practices

- ✅ ใช้ HTTPS เสมอ (mandatory ใน prod)
- ✅ เก็บ secrets ใน env (ไม่ commit)
- ✅ Hash tokens ก่อนเก็บ (sha256)
- ✅ Token TTL สั้น (access 15 นาที, refresh 7 วัน)
- ✅ Rotation chain ตรวจสอบ token reuse → ถ้า reuse → revoke chain ทั้งหมด
- ✅ Rate limit: login 5 attempts / 15 นาที / IP
- ✅ CORS whitelist (เฉพาะ frontend domain)
- ❌ ไม่ log password
- ❌ ไม่ return password_hash ใน API response
- ❌ ไม่ใช้ JWT blacklist (stateless — ใช้ TTL สั้นแทน)

---

## 9. Token Revocation

ใน MVP, **ไม่มี JWT blacklist** (stateless):
- Access token หมดอายุเองใน 15 นาที
- Logout → revoke refresh token เท่านั้น
- ถ้า access token ถูกขโมย → ผู้โจมตีมีเวลาใช้ ≤ 15 นาที

**Phase 4 (optional):** เพิ่ม Redis-based JWT blacklist สำหรับ forced logout

---

## 10. อ่านเพิ่มเติม

- [`02-DATA-MODEL.md`](./02-DATA-MODEL.md) — schema `users`, `refresh_tokens`, etc.
- [`contracts/AI-DECISION.md`](./contracts/AI-DECISION.md) — Internal token header
- [`01-OVERVIEW.md`](./01-OVERVIEW.md) — flow หลัก

อัปเดตล่าสุด: 2026-06-27
