import axios from 'axios'
import type { ChangeEvent, FormEvent } from 'react'
import { useState } from 'react'
import { registerUser, type RegisterPayload } from './services/authService'

type RegisterForm = RegisterPayload
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
}

const getInputClass = (hasError?: boolean) =>
  [
    'mt-1.5 h-12 w-full rounded-md border bg-[var(--color-surface)] px-4 text-base text-[var(--color-text)]',
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

const validateForm = (form: RegisterForm) => {
  const errors: FieldErrors = {}
  const phonePattern = /^[0-9+\-\s()]{7,}$/
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
    errors.phone = 'กรุณากรอกเบอร์โทรศัพท์อย่างน้อย 7 หลัก'
  }

  if (!citizenIdPattern.test(form.citizenId.trim())) {
    errors.citizenId = 'กรุณากรอกเลขบัตรประชาชน 13 หลัก'
  }

  if (!isValidUrl(form.shopPageUrl.trim())) {
    errors.shopPageUrl = 'กรุณากรอกลิงก์ร้าน/เพจให้ถูกต้อง'
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

  return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
}

function App() {
  const [form, setForm] = useState<RegisterForm>(initialForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [notice, setNotice] = useState('')

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof RegisterForm

    setForm((current) => ({
      ...current,
      [field]: event.target.value,
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

    const payload: RegisterPayload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      nickname: form.nickname.trim(),
      phone: form.phone.trim(),
      citizenId: form.citizenId.trim(),
      shopPageUrl: form.shopPageUrl.trim(),
    }

    try {
      setStatus('loading')
      setNotice('')
      const response = await registerUser(payload)

      setStatus('success')
      setNotice(response.message ?? 'ส่งข้อมูลสมัครสำเร็จ')
      setForm(initialForm)
    } catch (error) {
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
            <div className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface-strong)] text-lg font-semibold text-[var(--color-primary-dark)] shadow-sm">
              み
            </div>
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
            <p className="text-sm font-semibold uppercase text-[var(--color-primary)]">
              Register
            </p>
            <p className="mt-2 text-[15px] leading-6 text-[var(--color-muted)]">
              กรอกข้อมูลผู้สมัครและลิงก์ร้านหรือเพจสำหรับติดต่อกลับ
            </p>
          </div>

          {notice ? (
            <div
              className={[
                'mb-4 rounded-md border px-4 py-3 text-sm leading-6',
                status === 'success'
                  ? 'border-[color:var(--color-primary)]/25 bg-[var(--color-surface-strong)] text-[var(--color-primary-dark)]'
                  : 'border-[color:var(--color-error)]/25 bg-[#fff1eb] text-[var(--color-error)]',
              ].join(' ')}
              role="status"
            >
              {notice}
            </div>
          ) : null}

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
                inputMode="tel"
                name="phone"
                onChange={handleChange}
                placeholder="0812345678"
                type="tel"
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
                placeholder="เลข 13 หลัก"
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
          </form>
        </section>

        <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-[color:var(--color-surface)]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
          <div className="mx-auto max-w-md">
            <button
              className="flex h-12 w-full items-center justify-center rounded-md bg-[var(--color-primary)] px-5 text-base font-semibold text-white shadow-sm transition active:scale-[0.99] active:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:bg-[#c8b29d]"
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
