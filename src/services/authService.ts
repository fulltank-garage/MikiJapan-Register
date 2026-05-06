import { api } from '../lib/api'

export type RegisterPayload = {
  firstName: string
  lastName: string
  nickname: string
  phone: string
  citizenId: string
  shopPageUrl: string
  storefrontImage: File
}

export type RegisterResponse = {
  message?: string
  id?: string
  data?: unknown
}

export const registerUser = async (payload: RegisterPayload) => {
  const formData = new FormData()

  formData.append('firstName', payload.firstName)
  formData.append('lastName', payload.lastName)
  formData.append('nickname', payload.nickname)
  formData.append('phone', payload.phone)
  formData.append('citizenId', payload.citizenId)
  formData.append('shopPageUrl', payload.shopPageUrl)
  formData.append('storefrontImage', payload.storefrontImage)

  const { data } = await api.post<RegisterResponse>(
    '/auth/register',
    formData,
  )

  return data
}
