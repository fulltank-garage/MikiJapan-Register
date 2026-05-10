# MikiJapan Register

หน้า Register สร้างด้วย Vite, React, TypeScript, Tailwind CSS และเตรียม axios service สำหรับเชื่อมต่อ API

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS ผ่าน `@tailwindcss/vite`
- Axios สำหรับเรียก API

## Run

Use Node.js 24.x.

```bash
npm install
npm run dev
```

## API Config

สร้างไฟล์ `.env` จาก `.env.example` แล้วแก้ base URL ให้ตรงกับ backend:

```bash
VITE_API_BASE_URL=http://localhost:8080/api
VITE_LIFF_ID=2010003223-vUJl2NkR
```

Register endpoint ที่ต่อกับ router ของ `MikiJapan-Api`:

```ts
POST /auth/register
```

เมื่อรวมกับ `VITE_API_BASE_URL` แล้ว endpoint จริงคือ:

```text
POST /api/auth/register
```

Payload ที่หน้า Register ส่งเป็น `multipart/form-data`:

```ts
{
  firstName: string
  lastName: string
  nickname: string
  phone: string
  citizenId: string
  shopPageUrl: string
  storefrontImage: File
  lineUserId?: string
  lineIdToken?: string
  lineDisplayName?: string
  linePictureUrl?: string
}
```

สำหรับ production บน LIFF ให้ตั้ง `VITE_LIFF_ID` และตั้ง `VITE_API_BASE_URL` เป็น URL ของ API ที่ deploy แล้ว เช่น `https://your-api-domain.com/api` ถ้า production ไม่ได้ตั้ง `VITE_API_BASE_URL` ระบบจะไม่ fallback ไป localhost เพื่อกัน deploy ผิด environment
