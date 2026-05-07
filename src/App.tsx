import axios from 'axios'
import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useState } from 'react'
import mikiJapanLogo from './assets/miki-japan-logo.jpg'
import { getLineIdentity, isLiffLoginRedirectError } from './lib/liff'
import { registerUser, type RegisterPayload } from './services/authService'

type RegisterForm = Omit<RegisterPayload, 'storefrontImage'> & {
  storefrontImage: File | null
}
type FieldErrors = Partial<Record<keyof RegisterForm, string>>
type SubmitStatus = 'idle' | 'loading' | 'success' | 'error'

type ApiErrorData = {
  message?: string
}

const initialForm: RegisterForm = {
  firstName: '',
  lastName: '',
  nickname: '',
  phone: '',
  citizenId: '',
  shopPageUrl: '',
  storefrontImage: null,
}

const maxImageSize = 5 * 1024 * 1024

const getInputClass = (hasError?: boolean) =>
  [
    'mt-1.5 h-12 w-full rounded-xl border bg-[var(--color-surface)] px-4 text-base text-[var(--color-text)]',
    'outline-none transition placeholder:text-[color:var(--color-muted)]/55',
    'focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[color:var(--color-primary)]/15',
    hasError ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]',
  ].join(' ')

const isValidUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const onlyDigits = (value: string) => value.replace(/\D/g, '')

const validateForm = (form: RegisterForm) => {
  const errors: FieldErrors = {}
  const phonePattern = /^\d{9,10}$/
  const citizenIdPattern = /^\d{13}$/

  if (!form.firstName.trim()) {
    errors.firstName = 'กรุณากรอกชื่อ'
  }

  if (!form.lastName.trim()) {
    errors.lastName = 'กรุณากรอกนามสกุล'
  }

  if (!form.nickname.trim()) {
    errors.nickname = 'กรุณากรอกชื่อเล่น'
  }

  if (!phonePattern.test(form.phone.trim())) {
    errors.phone = 'กรุณากรอกเบอร์โทรศัพท์ 9-10 หลัก'
  }

  if (!citizenIdPattern.test(form.citizenId.trim())) {
    errors.citizenId = 'กรุณากรอกเลขบัตรประชาชน 13 หลัก'
  }

  if (!isValidUrl(form.shopPageUrl.trim())) {
    errors.shopPageUrl = 'กรุณากรอกลิงก์ร้าน/เพจให้ถูกต้อง'
  }

  if (!form.storefrontImage) {
    errors.storefrontImage = 'กรุณาอัปโหลดรูปหน้าร้าน'
  } else if (!form.storefrontImage.type.startsWith('image/')) {
    errors.storefrontImage = 'ไฟล์ต้องเป็นรูปภาพเท่านั้น'
  } else if (form.storefrontImage.size > maxImageSize) {
    errors.storefrontImage = 'รูปภาพต้องมีขนาดไม่เกิน 5MB'
  }

  return errors
}

const getApiErrorMessage = (error: unknown) => {
  if (axios.isAxiosError<ApiErrorData>(error)) {
    return (
      error.response?.data?.message ??
      'ไม่สามารถส่งข้อมูลสมัครได้ ตรวจสอบ API base URL และ endpoint อีกครั้ง'
    )
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
}

function App() {
  const [form, setForm] = useState<RegisterForm>(initialForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [notice, setNotice] = useState('')
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)

  useEffect(() => {
    getLineIdentity().catch((error) => {
      if (isLiffLoginRedirectError(error)) {
        return
      }

      setStatus('error')
      setNotice(getApiErrorMessage(error))
    })
  }, [])

  useEffect(
    () => () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    },
    [imagePreviewUrl],
  )

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.type === 'file') {
      const file = event.target.files?.[0] ?? null
      const nextPreviewUrl = file ? URL.createObjectURL(file) : ''

      setForm((current) => ({
        ...current,
        storefrontImage: file,
      }))
      setImagePreviewUrl(nextPreviewUrl)
      setErrors((current) => ({
        ...current,
        storefrontImage: undefined,
      }))
      setNotice('')
      setStatus('idle')
      return
    }

    const field = event.target.name as keyof RegisterForm
    const value =
      field === 'phone' || field === 'citizenId'
        ? onlyDigits(event.target.value)
        : event.target.value

    setForm((current) => ({
      ...current,
      [field]: value,
    }))
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }))
    setNotice('')
    setStatus('idle')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors = validateForm(form)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      setStatus('error')
      setNotice('กรุณาตรวจสอบข้อมูลในฟอร์มอีกครั้ง')
      return
    }

    try {
      setStatus('loading')
      setNotice('')
      const lineIdentity = await getLineIdentity()
      const payload: RegisterPayload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        nickname: form.nickname.trim(),
        phone: onlyDigits(form.phone),
        citizenId: onlyDigits(form.citizenId),
        shopPageUrl: form.shopPageUrl.trim(),
        storefrontImage: form.storefrontImage as File,
        ...lineIdentity,
      }
      await registerUser(payload)

      setStatus('success')
      setNotice('สมัครสำเร็จ กรุณารอตรวจสอบข้อมูลสักครู่')
      setForm(initialForm)
      setImagePreviewUrl('')
      setFileInputKey((current) => current + 1)
    } catch (error) {
      if (isLiffLoginRedirectError(error)) {
        return
      }

      setStatus('error')
      setNotice(getApiErrorMessage(error))
    }
  }

  const isSubmitting = status === 'loading'

  return (
    <main className="min-h-dvh bg-[var(--color-bg)] text-[var(--color-text)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[color:var(--color-surface)]/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur">
          <div className="flex items-center gap-3">
            <img
              alt="Miki Japan"
              className="size-10 shrink-0 rounded-full border border-[var(--color-border)] object-cover shadow-sm"
              height="40"
              src={mikiJapanLogo}
              width="40"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-muted)]">
                Miki Japan
              </p>
              <h1 className="truncate text-lg font-semibold text-[var(--color-text)]">
                สมัครลงทะเบียน
              </h1>
            </div>
          </div>
        </header>

        <section className="flex-1 px-4 py-5">
          <div className="mb-5">
            <p className="text-[15px] leading-6 text-[var(--color-muted)]">
              กรอกข้อมูลผู้สมัคร ลิงก์ร้านหรือเพจ และรูปหน้าร้านสำหรับติดต่อกลับ
            </p>
          </div>

          <form
            className="space-y-4 pb-[calc(env(safe-area-inset-bottom)+96px)]"
            id="register-form"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-[var(--color-text)]">
                ชื่อ
                <input
                  autoComplete="given-name"
                  className={getInputClass(Boolean(errors.firstName))}
                  name="firstName"
                  onChange={handleChange}
                  placeholder="ชื่อจริง"
                  type="text"
                  value={form.firstName}
                />
                {errors.firstName ? (
                  <span className="mt-1 block text-xs leading-5 text-[var(--color-error)]">
                    {errors.firstName}
                  </span>
                ) : null}
              </label>

              <label className="block text-sm font-medium text-[var(--color-text)]">
                นามสกุล
                <input
                  autoComplete="family-name"
                  className={getInputClass(Boolean(errors.lastName))}
                  name="lastName"
                  onChange={handleChange}
                  placeholder="นามสกุล"
                  type="text"
                  value={form.lastName}
                />
                {errors.lastName ? (
                  <span className="mt-1 block text-xs leading-5 text-[var(--color-error)]">
                    {errors.lastName}
                  </span>
                ) : null}
              </label>
            </div>

            <label className="block text-sm font-medium text-[var(--color-text)]">
              ชื่อเล่น
              <input
                autoComplete="nickname"
                className={getInputClass(Boolean(errors.nickname))}
                name="nickname"
                onChange={handleChange}
                placeholder="ชื่อเล่น"
                type="text"
                value={form.nickname}
              />
              {errors.nickname ? (
                <span className="mt-1 block text-xs leading-5 text-[var(--color-error)]">
                  {errors.nickname}
                </span>
              ) : null}
            </label>

            <label className="block text-sm font-medium text-[var(--color-text)]">
              เบอร์โทร
              <input
                autoComplete="tel"
                className={getInputClass(Boolean(errors.phone))}
                inputMode="numeric"
                maxLength={10}
                name="phone"
                onChange={handleChange}
                placeholder="0812345678"
                pattern="[0-9]*"
                type="text"
                value={form.phone}
              />
              {errors.phone ? (
                <span className="mt-1 block text-xs leading-5 text-[var(--color-error)]">
                  {errors.phone}
                </span>
              ) : null}
            </label>

            <label className="block text-sm font-medium text-[var(--color-text)]">
              เลขบัตรประชาชน
              <input
                autoComplete="off"
                className={getInputClass(Boolean(errors.citizenId))}
                inputMode="numeric"
                maxLength={13}
                name="citizenId"
                onChange={handleChange}
                pattern="[0-9]*"
                placeholder="เลข 13 หลัก"
                type="text"
                value={form.citizenId}
              />
              {errors.citizenId ? (
                <span className="mt-1 block text-xs leading-5 text-[var(--color-error)]">
                  {errors.citizenId}
                </span>
              ) : null}
            </label>

            <label className="block text-sm font-medium text-[var(--color-text)]">
              ลิงก์ร้าน/เพจ
              <input
                autoComplete="url"
                className={getInputClass(Boolean(errors.shopPageUrl))}
                name="shopPageUrl"
                onChange={handleChange}
                placeholder="https://facebook.com/your-page"
                type="url"
                value={form.shopPageUrl}
              />
              {errors.shopPageUrl ? (
                <span className="mt-1 block text-xs leading-5 text-[var(--color-error)]">
                  {errors.shopPageUrl}
                </span>
              ) : null}
            </label>

            <label className="block text-sm font-medium text-[var(--color-text)]">
              รูปหน้าร้าน
              <div
                className={[
                  'mt-1.5 overflow-hidden rounded-2xl border bg-[var(--color-surface)]',
                  errors.storefrontImage
                    ? 'border-[var(--color-error)]'
                    : 'border-[var(--color-border)]',
                ].join(' ')}
              >
                {imagePreviewUrl ? (
                  <img
                    alt="ตัวอย่างรูปหน้าร้าน"
                    className="aspect-[4/3] w-full object-cover"
                    src={imagePreviewUrl}
                  />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center px-4 text-center text-sm leading-6 text-[var(--color-muted)]">
                    แตะเพื่อเลือกรูปหน้าร้านจากแกลลอรีหรือถ่ายใหม่
                  </div>
                )}
                <input
                  accept="image/*"
                  className="block w-full cursor-pointer border-t border-[var(--color-border)] bg-[var(--color-surface-strong)] px-3 py-3 text-sm text-[var(--color-text)] file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                  key={fileInputKey}
                  name="storefrontImage"
                  onChange={handleChange}
                  type="file"
                />
              </div>
              <span className="mt-1 block text-center text-xs leading-5 text-[var(--color-muted)]">
                เลือกจากแกลลอรีหรือถ่ายรูปใหม่ได้ รองรับไฟล์รูปภาพไม่เกิน 5MB
              </span>
              {errors.storefrontImage ? (
                <span className="mt-1 block text-center text-xs leading-5 text-[var(--color-error)]">
                  {errors.storefrontImage}
                </span>
              ) : null}
            </label>
          </form>
        </section>

        {notice ? (
          <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+86px)] z-30 px-4"
            role="status"
          >
            <div
              className={[
                'mx-auto max-w-md rounded-2xl px-4 py-3 text-sm font-medium leading-6 shadow-lg ring-1',
                status === 'success'
                  ? 'bg-[var(--color-primary-dark)] text-white ring-[color:var(--color-primary)]/30'
                  : 'bg-[var(--color-error)] text-white ring-[color:var(--color-error)]/30',
              ].join(' ')}
            >
              {notice}
            </div>
          </div>
        ) : null}

        <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[color:var(--color-surface)]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
          <div className="mx-auto max-w-md">
            <button
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-[var(--color-primary)] px-5 text-base font-semibold text-white shadow-sm transition active:scale-[0.99] active:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:bg-[#c8b29d]"
              disabled={isSubmitting}
              form="register-form"
              type="submit"
            >
              {isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งข้อมูลสมัคร'}
            </button>
          </div>
        </footer>
      </div>
    </main>
  )
}

export default App
