import axios from 'axios'
import type { ChangeEvent, FormEvent } from 'react'
import { useCallback, useEffect, useState } from 'react'
import mikiJapanLogo from './assets/miki-japan-logo.jpg'
import {
  getLineIdentity,
  isLiffLoginRedirectError,
  closeLiffWindowOrOpenProfile,
  refreshLineLogin,
} from './lib/liff'
import {
  getRegisteredMember,
  registerUser,
  type RegisterPayload,
} from './services/authService'

type RegisterForm = Omit<RegisterPayload, 'storefrontImage'> & {
  storefrontImage: File | null
}
type FieldErrors = Partial<Record<keyof RegisterForm, string>>
type SubmitStatus = 'checking' | 'idle' | 'loading' | 'success' | 'error'
type NoticeTone = 'info' | 'success' | 'error'

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

const maxImageSize = 2 * 1024 * 1024
const imageCompressionMaxDimension = 1600
const imageCompressionMinQuality = 0.62

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
const removeDigits = (value: string) => value.replace(/[0-9๐-๙]/g, '')

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  return `${Math.max(1, Math.round(bytes / 1024))}KB`
}

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('บีบอัดรูปภาพไม่สำเร็จ กรุณาเลือกรูปใหม่อีกครั้ง'))
          return
        }

        resolve(blob)
      },
      type,
      quality,
    )
  })

const createCompressedImageFile = async (file: File) => {
  if (!file.type.startsWith('image/')) {
    return file
  }

  const imageUrl = URL.createObjectURL(file)
  const image = new Image()
  image.decoding = 'async'
  image.src = imageUrl

  try {
    await image.decode()
  } catch {
    URL.revokeObjectURL(imageUrl)
    throw new Error('ไม่สามารถอ่านรูปภาพนี้ได้ กรุณาเลือกรูปใหม่อีกครั้ง')
  }

  let scale = Math.min(
    1,
    imageCompressionMaxDimension /
      Math.max(image.naturalWidth, image.naturalHeight),
  )
  let width = Math.max(1, Math.round(image.naturalWidth * scale))
  let height = Math.max(1, Math.round(image.naturalHeight * scale))
  let canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    URL.revokeObjectURL(imageUrl)
    throw new Error('ไม่สามารถบีบอัดรูปภาพนี้ได้ กรุณาเลือกรูปใหม่อีกครั้ง')
  }

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)

  let quality = 0.86
  let blob = await canvasToBlob(canvas, 'image/jpeg', quality)

  while (blob.size > maxImageSize && quality > imageCompressionMinQuality) {
    quality = Math.max(imageCompressionMinQuality, quality - 0.08)
    blob = await canvasToBlob(canvas, 'image/jpeg', quality)
  }

  while (blob.size > maxImageSize && width > 640 && height > 640) {
    scale = Math.sqrt(maxImageSize / blob.size) * 0.9
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const smallerContext = canvas.getContext('2d')
    if (!smallerContext) {
      URL.revokeObjectURL(imageUrl)
      throw new Error('ไม่สามารถบีบอัดรูปภาพนี้ได้ กรุณาเลือกรูปใหม่อีกครั้ง')
    }
    smallerContext.fillStyle = '#ffffff'
    smallerContext.fillRect(0, 0, width, height)
    smallerContext.drawImage(image, 0, 0, width, height)
    blob = await canvasToBlob(canvas, 'image/jpeg', imageCompressionMinQuality)
  }

  URL.revokeObjectURL(imageUrl)

  if (blob.size > maxImageSize) {
    throw new Error('รูปภาพนี้ใหญ่เกินไป กรุณาเลือกรูปที่ชัดเจนและมีขนาดเล็กลง')
  }

  const filename = file.name.replace(/\.[^.]+$/, '') || 'storefront'
  return new File([blob], `${filename}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

const validateForm = (form: RegisterForm) => {
  const errors: FieldErrors = {}
  const phonePattern = /^\d{10}$/
  const citizenIdPattern = /^\d{13}$/
  const digitPattern = /[0-9๐-๙]/

  if (!form.firstName.trim()) {
    errors.firstName = 'กรุณากรอกชื่อ'
  } else if (digitPattern.test(form.firstName)) {
    errors.firstName = 'ชื่อจริงต้องไม่มีตัวเลข'
  }

  if (!form.lastName.trim()) {
    errors.lastName = 'กรุณากรอกนามสกุล'
  } else if (digitPattern.test(form.lastName)) {
    errors.lastName = 'นามสกุลต้องไม่มีตัวเลข'
  }

  if (!form.nickname.trim()) {
    errors.nickname = 'กรุณากรอกชื่อเล่น'
  }

  if (!phonePattern.test(form.phone.trim())) {
    errors.phone = 'กรุณากรอกเบอร์โทรศัพท์ 10 หลัก'
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
  }

  return errors
}

const getFormErrorNotice = (errors: FieldErrors) => {
  const labels: Partial<Record<keyof RegisterForm, string>> = {
    firstName: 'ชื่อ',
    lastName: 'นามสกุล',
    nickname: 'ชื่อเล่น',
    phone: 'เบอร์โทร',
    citizenId: 'เลขบัตรประชาชน',
    shopPageUrl: 'ลิงก์ร้าน/เพจ',
    storefrontImage: 'รูปหน้าร้าน',
  }
  const invalidFields = Object.keys(errors)
    .map((key) => labels[key as keyof RegisterForm])
    .filter(Boolean)

  return invalidFields.length > 0
    ? `กรุณาแก้ไขข้อมูล: ${invalidFields.join(', ')}`
    : 'กรุณาตรวจสอบข้อมูลในฟอร์มอีกครั้ง'
}

const getApiErrorMessage = (error: unknown) => {
  if (axios.isAxiosError<ApiErrorData>(error)) {
    const responseMessage = error.response?.data?.message

    if (error.response?.status === 409) {
      return 'บัญชี LINE นี้มีข้อมูลการสมัครอยู่แล้ว กรุณารอตรวจสอบข้อมูลจากร้าน'
    }

    if (
      !responseMessage ||
      /api|endpoint|base url|database|idtoken/i.test(responseMessage)
    ) {
      return 'ไม่สามารถส่งข้อมูลสมัครได้ กรุณาลองใหม่อีกครั้ง'
    }

    return responseMessage
  }

  if (error instanceof Error && error.message) {
    if (/api|endpoint|base url|database|idtoken/i.test(error.message)) {
      return 'ไม่สามารถส่งข้อมูลสมัครได้ กรุณาลองใหม่อีกครั้ง'
    }

    return error.message
  }

  return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
}

const isLineIdTokenExpiredError = (error: unknown) => {
  if (!axios.isAxiosError<ApiErrorData>(error)) {
    return false
  }

  return (
    error.response?.data?.message?.toLowerCase().includes('idtoken expired') ??
    false
  )
}

const isMissingMemberError = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 404

const hasLineIdentity = (lineIdentity: Awaited<ReturnType<typeof getLineIdentity>>) =>
  Boolean(lineIdentity.lineUserId || lineIdentity.lineIdToken)

function App() {
  const [form, setForm] = useState<RegisterForm>(initialForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [status, setStatus] = useState<SubmitStatus>('checking')
  const [notice, setNotice] = useState('')
  const [noticeTone, setNoticeTone] = useState<NoticeTone>('info')
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [fileInputKey, setFileInputKey] = useState(0)
  const [shouldWatchApplication, setShouldWatchApplication] = useState(false)

  const checkApplicationStatus = useCallback(async () => {
    try {
      const lineIdentity = await getLineIdentity()
      if (!hasLineIdentity(lineIdentity)) {
        setShouldWatchApplication(false)
        setStatus('idle')
        setNotice('')
        return
      }

      const member = await getRegisteredMember(lineIdentity)

      if (member.status === 'approved') {
        await closeLiffWindowOrOpenProfile()
        return
      }

      if (member.status === 'rejected') {
        setShouldWatchApplication(false)
        setStatus('error')
        setNoticeTone('error')
        setNotice('ข้อมูลไม่ผ่านเกณฑ์ที่ร้านกำหนด กรุณาติดต่อร้านผ่านแชท LINE')
        return
      }

      setShouldWatchApplication(true)
      setStatus('success')
      setNoticeTone('success')
      setNotice('สมัครสำเร็จ กรุณารอตรวจสอบข้อมูลสักครู่')
    } catch (error) {
      if (isLiffLoginRedirectError(error)) {
        return
      }

      if (isLineIdTokenExpiredError(error)) {
        await refreshLineLogin()
        return
      }

      if (isMissingMemberError(error)) {
        setShouldWatchApplication(false)
        setStatus('idle')
        setNotice('')
        return
      }

      setShouldWatchApplication(false)
      setStatus('error')
      setNoticeTone('error')
      setNotice(getApiErrorMessage(error))
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(checkApplicationStatus)
  }, [checkApplicationStatus])

  useEffect(() => {
    if (!shouldWatchApplication) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      void checkApplicationStatus()
    }, 10000)

    return () => window.clearInterval(intervalId)
  }, [checkApplicationStatus, shouldWatchApplication])

  useEffect(
    () => () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
      }
    },
    [imagePreviewUrl],
  )

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.type === 'file') {
      const file = event.target.files?.[0] ?? null
      const previousPreviewUrl = imagePreviewUrl

      if (!file) {
        setForm((current) => ({
          ...current,
          storefrontImage: null,
        }))
        setImagePreviewUrl('')
        if (previousPreviewUrl) {
          URL.revokeObjectURL(previousPreviewUrl)
        }
        return
      }

      if (!file.type.startsWith('image/')) {
        setForm((current) => ({
          ...current,
          storefrontImage: file,
        }))
        setImagePreviewUrl('')
        setErrors((current) => ({
          ...current,
          storefrontImage: 'ไฟล์ต้องเป็นรูปภาพเท่านั้น',
        }))
        setNoticeTone('error')
        setNotice('กรุณาแก้ไขข้อมูล: รูปหน้าร้าน')
        setStatus('error')
        if (previousPreviewUrl) {
          URL.revokeObjectURL(previousPreviewUrl)
        }
        return
      }

      try {
        setNoticeTone('info')
        setNotice(
          file.size > maxImageSize
            ? `กำลังบีบอัดรูปจาก ${formatFileSize(file.size)} ให้เหมาะกับระบบ`
            : '',
        )
        setStatus('idle')
        const nextFile = await createCompressedImageFile(file)
        const nextPreviewUrl = URL.createObjectURL(nextFile)

        setForm((current) => ({
          ...current,
          storefrontImage: nextFile,
        }))
        setImagePreviewUrl(nextPreviewUrl)
        setErrors((current) => ({
          ...current,
          storefrontImage: undefined,
        }))
        setNoticeTone('success')
        setNotice(
          file.size > maxImageSize
            ? `บีบอัดรูปเรียบร้อย เหลือ ${formatFileSize(nextFile.size)}`
            : '',
        )
        setStatus('idle')
        if (previousPreviewUrl) {
          URL.revokeObjectURL(previousPreviewUrl)
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'บีบอัดรูปภาพไม่สำเร็จ กรุณาเลือกรูปใหม่อีกครั้ง'

        setForm((current) => ({
          ...current,
          storefrontImage: null,
        }))
        setImagePreviewUrl('')
        setErrors((current) => ({
          ...current,
          storefrontImage: message,
        }))
        setNoticeTone('error')
        setNotice('กรุณาแก้ไขข้อมูล: รูปหน้าร้าน')
        setStatus('error')
        setFileInputKey((current) => current + 1)
        if (previousPreviewUrl) {
          URL.revokeObjectURL(previousPreviewUrl)
        }
      }
      return
    }

    const field = event.target.name as keyof RegisterForm
    const value =
      field === 'phone' || field === 'citizenId'
        ? onlyDigits(event.target.value)
        : field === 'firstName' || field === 'lastName'
          ? removeDigits(event.target.value)
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
      setNoticeTone('error')
      setNotice(getFormErrorNotice(nextErrors))
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
      setNoticeTone('success')
      setNotice('สมัครสำเร็จ กรุณารอตรวจสอบข้อมูลสักครู่')
      setShouldWatchApplication(true)
      void Promise.resolve().then(checkApplicationStatus)
      setForm(initialForm)
      setImagePreviewUrl('')
      setFileInputKey((current) => current + 1)
    } catch (error) {
      if (isLiffLoginRedirectError(error)) {
        return
      }

      if (isLineIdTokenExpiredError(error)) {
        setNoticeTone('info')
        setNotice('เซสชัน LINE หมดอายุ กำลังเปิด LIFF ใหม่อีกครั้ง')
        await refreshLineLogin()
        return
      }

      setStatus('error')
      setNoticeTone('error')
      setNotice(getApiErrorMessage(error))
    }
  }

  const isSubmitting = status === 'loading'
  const isCheckingApplication = status === 'checking'
  const isWaitingForReview = status === 'success' && shouldWatchApplication
  const isRejectedApplication =
    status === 'error' && notice.includes('ไม่ผ่านเกณฑ์')

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

        {isCheckingApplication ? (
          <LoadingStatusScreen />
        ) : isWaitingForReview ? (
          <ReviewStatusScreen
            description="ขณะนี้ข้อมูลของคุณอยู่ระหว่างการตรวจสอบจากร้าน"
            eyebrow="ส่งข้อมูลแล้ว"
            tone="success"
            title="ส่งข้อมูลการสมัครเป็น Member เรียบร้อยแล้ว!"
          />
        ) : isRejectedApplication ? (
          <ReviewStatusScreen
            description="ข้อมูลของคุณไม่ผ่านเกณฑ์ที่ร้านกำหนด กรุณาติดต่อร้านผ่านแชท LINE เพื่อสอบถามรายละเอียดเพิ่มเติม"
            eyebrow="ตรวจสอบแล้ว"
            tone="error"
            title="ข้อมูลการสมัครไม่ผ่านเกณฑ์"
          />
        ) : (
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
                    aria-invalid={Boolean(errors.firstName)}
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
                    aria-invalid={Boolean(errors.lastName)}
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
                  aria-invalid={Boolean(errors.nickname)}
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
                  aria-invalid={Boolean(errors.phone)}
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
                  aria-invalid={Boolean(errors.citizenId)}
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
                  aria-invalid={Boolean(errors.shopPageUrl)}
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
                    'mt-1.5 overflow-hidden rounded-2xl border bg-[var(--color-surface)] transition',
                    errors.storefrontImage
                      ? 'border-[var(--color-error)] ring-4 ring-[color:var(--color-error)]/15'
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
                    aria-invalid={Boolean(errors.storefrontImage)}
                    accept="image/*"
                    className="block w-full cursor-pointer border-t border-[var(--color-border)] bg-[var(--color-surface-strong)] px-3 py-3 text-sm text-[var(--color-text)] file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--color-primary)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                    key={fileInputKey}
                    name="storefrontImage"
                    onChange={handleChange}
                    type="file"
                  />
                </div>
                <span className="mt-1 block text-center text-xs leading-5 text-[var(--color-muted)]">
                  เลือกจากแกลลอรีหรือถ่ายรูปใหม่ได้ ระบบจะบีบอัดรูปให้อัตโนมัติก่อนส่ง
                </span>
                {errors.storefrontImage ? (
                  <span className="mt-1 block text-center text-xs leading-5 text-[var(--color-error)]">
                    {errors.storefrontImage}
                  </span>
                ) : null}
              </label>
            </form>
          </section>
        )}

        {notice && !isWaitingForReview && !isRejectedApplication ? (
          <div
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+86px)] z-30 px-4"
            role="status"
          >
            <div
              className={[
                'mx-auto max-w-md rounded-2xl px-4 py-3 text-sm font-medium leading-6 shadow-lg ring-1',
                noticeTone === 'success'
                  ? 'bg-[var(--color-primary-dark)] text-white ring-[color:var(--color-primary)]/30'
                  : noticeTone === 'info'
                    ? 'bg-[var(--color-surface)] text-[var(--color-primary-dark)] ring-[color:var(--color-primary)]/25'
                    : 'bg-[var(--color-error)] text-white ring-[color:var(--color-error)]/30',
              ].join(' ')}
            >
              {notice}
            </div>
          </div>
        ) : null}

        {!isCheckingApplication && !isWaitingForReview && !isRejectedApplication ? (
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
        ) : null}
      </div>
    </main>
  )
}

function LoadingStatusScreen() {
  const [progress, setProgress] = useState(8)

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setProgress((current) => {
        if (current >= 94) {
          return current
        }

        return Math.min(current + 7, 94)
      })
    }, 180)

    return () => window.clearInterval(intervalId)
  }, [])

  return (
    <section className="flex flex-1 items-center px-4 py-8">
      <div className="w-full rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8 text-center shadow-sm">
        <div className="mx-auto flex max-w-xs items-center gap-3">
          <div
            className="h-3 flex-1 overflow-hidden rounded-full bg-[color:var(--color-primary)]/15"
            aria-label={`กำลังโหลด ${progress}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progress}
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-[var(--color-primary)] shadow-sm transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="min-w-12 text-right text-sm font-semibold tabular-nums text-[var(--color-primary-dark)]">
            {progress}%
          </span>
        </div>

        <p className="mt-5 text-base font-semibold leading-7 text-[var(--color-text)]">
          กำลังตรวจสอบสถานะการสมัคร
        </p>
      </div>
    </section>
  )
}

function ReviewStatusScreen({
  description,
  eyebrow,
  title,
  tone,
}: {
  description: string
  eyebrow: string
  title: string
  tone: 'success' | 'error'
}) {
  const isSuccess = tone === 'success'

  return (
    <section className="flex flex-1 items-center px-4 py-8">
      <div className="w-full rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-8 text-center shadow-sm">
        <div
          className={[
            'mx-auto grid size-20 place-items-center rounded-full text-4xl font-semibold text-white shadow-sm',
            isSuccess ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-error)]',
          ].join(' ')}
          aria-hidden="true"
        >
          {isSuccess ? '✓' : '!'}
        </div>

        <p className="mt-6 text-sm font-semibold text-[var(--color-muted)]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-semibold leading-snug text-[var(--color-text)]">
          {title}
        </h2>
        <p className="mt-4 text-base leading-7 text-[var(--color-muted)]">
          {description}
        </p>

        {!isSuccess ? (
          <div className="mt-6 rounded-2xl bg-[#f7e2dc] px-4 py-3 text-sm font-medium leading-6 text-[var(--color-error)]">
            หากต้องการส่งข้อมูลใหม่ กรุณาติดต่อร้านเพื่อเปิดสิทธิ์สมัครอีกครั้ง
          </div>
        ) : null}
      </div>
    </section>
  )
}

export default App
