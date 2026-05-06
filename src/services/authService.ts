import { api } from '../lib/api'

export type RegisterPayload = {
  firstName: string
  lastName: string
  nickname: string
  phone: string
  citizenId: string
  shopPageUrl: string
}

export type RegisterResponse = {
  message?: string
  id?: string
  data?: unknown
}

export const registerUser = async (payload: RegisterPayload) => {
  const { data } = await api.post<RegisterResponse>('/auth/register', payload)

  return data
}
