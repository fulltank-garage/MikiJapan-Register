import liff from '@line/liff'

export type LineIdentity = {
  lineUserId?: string
  lineIdToken?: string
  lineDisplayName?: string
  linePictureUrl?: string
}

class LiffLoginRedirectError extends Error {
  constructor() {
    super('Redirecting to LINE login')
    this.name = 'LiffLoginRedirectError'
  }
}

let initPromise: Promise<void> | null = null

const getLiffId = () => import.meta.env.VITE_LIFF_ID?.trim()

const initLiff = async () => {
  const liffId = getLiffId()
  if (!liffId) {
    return false
  }

  if (!initPromise) {
    initPromise = liff.init({ liffId }).catch((error) => {
      initPromise = null
      throw error
    })
  }

  await initPromise
  return true
}

export const getLineIdentity = async (): Promise<LineIdentity> => {
  const isReady = await initLiff()
  if (!isReady) {
    return {}
  }

  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href })
    throw new LiffLoginRedirectError()
  }

  const [profile, lineIdToken] = await Promise.all([
    liff.getProfile(),
    Promise.resolve(liff.getIDToken()),
  ])

  return {
    lineUserId: profile.userId,
    lineIdToken: lineIdToken ?? undefined,
    lineDisplayName: profile.displayName,
    linePictureUrl: profile.pictureUrl,
  }
}

export const isLiffLoginRedirectError = (error: unknown) =>
  error instanceof LiffLoginRedirectError
