import liff from '@line/liff'

export type LineIdentity = {
  lineUserId?: string
  lineIdToken?: string
  lineDisplayName?: string
  linePictureUrl?: string
}

let liffInitPromise: Promise<void> | undefined

const getLiffId = () => import.meta.env.VITE_LIFF_ID?.trim()

const initLiff = async () => {
  const liffId = getLiffId()

  if (!liffId || typeof window === 'undefined') {
    return false
  }

  liffInitPromise ??= liff.init({ liffId })
  await liffInitPromise

  return true
}

export const getLineIdentity = async (): Promise<LineIdentity | null> => {
  const isLiffEnabled = await initLiff()

  if (!isLiffEnabled) {
    return {}
  }

  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href })
    return null
  }

  const idToken = liff.getIDToken() ?? undefined
  let profile: Awaited<ReturnType<typeof liff.getProfile>> | undefined

  try {
    profile = await liff.getProfile()
  } catch {
    profile = undefined
  }

  return {
    lineUserId: profile?.userId,
    lineIdToken: idToken,
    lineDisplayName: profile?.displayName,
    linePictureUrl: profile?.pictureUrl,
  }
}
