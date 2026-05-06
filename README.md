# MikiJapan Register

หน้า Register สร้างด้วย Vite, React, TypeScript, Tailwind CSS และเตรียม axios service สำหรับเชื่อมต่อ API

## Tech Stack

- Vite + React + TypeScript
- Tailwind CSS ผ่าน `@tailwindcss/vite`
- Axios สำหรับเรียก API

## Run

```bash
npm install
npm run dev
```

## API Config

สร้างไฟล์ `.env` จาก `.env.example` แล้วแก้ base URL ให้ตรงกับ backend:

```bash
VITE_API_BASE_URL=http://localhost:8080/api
```

Register endpoint ที่เตรียมไว้:

```ts
POST /auth/register
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
}
```
