import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Navigate, Outlet, useNavigate } from 'react-router-dom'
import { adminClient, admin } from './client'
import { useLanguage } from '../i18n/useLanguage'
import { errorMessage } from './api'
type AuthState = {
  loading: boolean
  owner: boolean
  recovery: boolean
  error: string
}
const AuthContext = createContext<AuthState>({
  loading: true,
  owner: false,
  recovery: false,
  error: '',
})
export function AdminAuth({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: !!adminClient,
    owner: false,
    recovery: false,
    error: '',
  })
  useEffect(() => {
    if (!adminClient) return
    let active = true,
      version = 0
    const check = async (hasSession: boolean, recovery = false) => {
      const current = ++version
      if (!hasSession) {
        if (active)
          setState({ loading: false, owner: false, recovery: false, error: '' })
        return
      }
      if (active)
        setState((previous) => ({
          ...previous,
          loading: !previous.owner,
          recovery: previous.recovery || recovery,
        }))
      const { data, error } = await admin().rpc('is_collection_owner', {})
      if (active && current === version)
        setState((previous) => ({
          loading: false,
          owner: data === true && !error,
          recovery: previous.recovery || recovery,
          error: error
            ? errorMessage(error)
            : data
              ? ''
              : 'Administrator access required.',
        }))
    }
    adminClient.auth.getSession().then(({ data, error }) => {
      if (error && active)
        setState({
          loading: false,
          owner: false,
          recovery: false,
          error: error.message,
        })
      else if (version === 0) void check(!!data.session)
    })
    const { data } = adminClient.auth.onAuthStateChange((event, session) => {
      // Run outside the auth callback to avoid waiting on its internal lock.
      setTimeout(() => {
        if (active) void check(!!session, event === 'PASSWORD_RECOVERY')
      }, 0)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
export function AdminGuard() {
  const state = useContext(AuthContext),
    { t } = useLanguage()
  if (state.loading)
    return (
      <div className="container admin-page" role="status">
        {t('Checking administrator access…')}
      </div>
    )
  return state.owner && !state.recovery ? (
    <Outlet />
  ) : (
    <Navigate to="/admin/login" replace />
  )
}
export function Login() {
  const state = useContext(AuthContext),
    { t } = useLanguage(),
    navigate = useNavigate()
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false)
  if (state.owner && !state.recovery) return <Navigate to="/admin" replace />
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      if (state.recovery) {
        const { error } = await admin().auth.updateUser({ password })
        if (error) throw error
        await admin().auth.signOut()
        setPassword('')
        setMessage('Password updated. Sign in with your new password.')
      } else {
        const { error } = await admin().auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        navigate('/admin')
      }
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  const recover = async () => {
    if (!email) {
      setMessage('Enter your email address first.')
      return
    }
    setBusy(true)
    try {
      const { error } = await admin().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/login`,
      })
      if (error) throw error
      setMessage(
        'If this account exists, a password recovery link has been sent.',
      )
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="container admin-page">
      <h1>
        {t(state.recovery ? 'Set a new password' : 'Administrator login')}
      </h1>
      {!adminClient ? (
        <p role="status">
          {t('Administration requires a connected Supabase project.')}
        </p>
      ) : (
        <form className="admin-form admin-login" onSubmit={submit}>
          <fieldset disabled={busy || state.loading}>
            {!state.recovery && (
              <label>
                {t('Email address')}
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            <label>
              {t('Password')}
              <input
                type="password"
                autoComplete={
                  state.recovery ? 'new-password' : 'current-password'
                }
                minLength={state.recovery ? 12 : 1}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="button" type="submit">
              {t(
                busy
                  ? 'Please wait…'
                  : state.recovery
                    ? 'Update password'
                    : 'Log in',
              )}
            </button>
            {!state.recovery && (
              <button
                type="button"
                className="text-link"
                onClick={() => void recover()}
              >
                {t('Forgot password?')}
              </button>
            )}
            {!state.recovery && state.error && (
              <button type="button" onClick={() => void admin().auth.signOut()}>
                {t('Log out')}
              </button>
            )}
          </fieldset>
          {(message || state.error) && (
            <p role="status">{t(message || state.error)}</p>
          )}
        </form>
      )}
    </section>
  )
}
