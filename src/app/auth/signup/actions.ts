'use server'

import { createClient } from '@/lib/supabase/server'

export type SignupState = { error: string } | { success: true } | null

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const username = (formData.get('username') as string).trim()
  if (username.length < 2) return { error: 'Username must be at least 2 characters.' }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.signUp({
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      options: { data: { username } },
    })
    if (error) return { error: error.message }
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sign up failed.' }
  }
}
