'use client'

import { useState, useEffect, useActionState } from 'react'
import { loginAction } from './actions'
import Link from 'next/link'
import { Flame } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, formAction, pending] = useActionState(loginAction, null)

  useEffect(() => {
    if (state && 'success' in state) {
      window.location.href = '/home'
    }
  }, [state])

  const error = state && 'error' in state ? state.error : null

  return (
    <div className="flex flex-col flex-1 items-center justify-center px-6 gap-8">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)' }}
        >
          <Flame size={28} style={{ color: 'var(--gold)' }} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
          Level Up!
        </h1>
        <p className="text-sm" style={{ color: 'var(--text2)' }}>Sign in to continue your streak</p>
      </div>

      <form action={formAction} className="w-full flex flex-col gap-3">
        <input
          type="email"
          name="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)', color: 'var(--text)' }}
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: 'var(--surface)', border: '0.5px solid var(--border2)', color: 'var(--text)' }}
        />

        {error && (
          <p className="text-sm px-1" style={{ color: '#F0997B' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full py-3 rounded-xl text-sm font-medium transition-opacity"
          style={{ background: 'var(--gold)', color: '#1a0f00', opacity: pending ? 0.6 : 1 }}
        >
          {pending ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="text-sm" style={{ color: 'var(--text2)' }}>
        No account?{' '}
        <Link href="/auth/signup" className="underline" style={{ color: 'var(--text)' }}>
          Sign up
        </Link>
      </p>
    </div>
  )
}
