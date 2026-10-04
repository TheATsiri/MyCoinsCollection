import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminAuth, AdminGuard, Login } from '../src/admin/Auth'
import Editor from '../src/admin/Editor'
import LanguageProvider from '../src/i18n/LanguageProvider'
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  rpc: vi.fn(),
  login: vi.fn(),
  reset: vi.fn(),
  update: vi.fn(),
  logout: vi.fn(),
  authChanged: undefined as
    undefined | ((event: string, session: unknown) => void),
  retrieve: vi.fn(),
  save: vi.fn(),
  upload: vi.fn(),
  cleanup: vi.fn(),
}))
vi.mock('../src/admin/client', () => {
  const client = {
    rpc: mocks.rpc,
    auth: {
      getSession: mocks.session,
      signInWithPassword: mocks.login,
      resetPasswordForEmail: mocks.reset,
      updateUser: mocks.update,
      signOut: mocks.logout,
      onAuthStateChange: (callback: typeof mocks.authChanged) => {
        mocks.authChanged = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
  }
  return { adminClient: client, admin: () => client }
})
vi.mock('../src/admin/api', async (original) => ({
  ...(await original<typeof import('../src/admin/api')>()),
  retrieveInformation: mocks.retrieve,
  saveCoin: mocks.save,
  uploadPhoto: mocks.upload,
  cleanupPhotos: mocks.cleanup,
}))
afterEach(cleanup)
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  mocks.authChanged = undefined
  mocks.session.mockResolvedValue({ data: { session: null }, error: null })
  mocks.rpc.mockResolvedValue({ data: true, error: null })
  mocks.login.mockResolvedValue({ error: null })
  mocks.reset.mockResolvedValue({ error: null })
  mocks.update.mockResolvedValue({ error: null })
  mocks.logout.mockResolvedValue({ error: null })
  mocks.cleanup.mockResolvedValue(0)
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:preview'),
      revokeObjectURL: vi.fn(),
    }),
  )
})
function auth(initial = '/admin') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <LanguageProvider>
        <AdminAuth>
          <Routes>
            <Route path="/admin/login" element={<Login />} />
            <Route element={<AdminGuard />}>
              <Route path="/admin" element={<h1>Owner dashboard</h1>} />
            </Route>
          </Routes>
        </AdminAuth>
      </LanguageProvider>
    </MemoryRouter>,
  )
}
describe('administrator access', () => {
  it('redirects anonymous access to login', async () => {
    auth()
    expect(
      await screen.findByRole('heading', { name: 'Administrator login' }),
    ).toBeVisible()
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('restores an owner session', async () => {
    mocks.session.mockResolvedValue({
      data: { session: { user: { id: 'owner' } } },
      error: null,
    })
    auth()
    expect(
      await screen.findByRole('heading', { name: 'Owner dashboard' }),
    ).toBeVisible()
  })
  it('rejects an authenticated non-owner', async () => {
    mocks.session.mockResolvedValue({
      data: { session: { user: { id: 'other' } } },
      error: null,
    })
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    auth()
    expect(
      await screen.findByText('Administrator access required.'),
    ).toBeVisible()
    expect(screen.queryByText('Owner dashboard')).toBeNull()
  })
  it('submits login and recovery to Supabase', async () => {
    const user = userEvent.setup()
    auth('/admin/login')
    await user.type(
      await screen.findByLabelText('Email address'),
      'owner@example.com',
    )
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }))
    expect(mocks.reset).toHaveBeenCalledWith('owner@example.com', {
      redirectTo: expect.stringContaining('/admin/login'),
    })
    await user.type(screen.getByLabelText('Password'), 'test-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(mocks.login).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'test-password',
    })
  })
  it('handles password recovery and signs out after changing the password', async () => {
    const user = userEvent.setup()
    auth('/admin/login')
    await screen.findByLabelText('Password')
    act(() =>
      mocks.authChanged?.('PASSWORD_RECOVERY', { user: { id: 'owner' } }),
    )
    await screen.findByRole('heading', { name: 'Set a new password' })
    await user.type(screen.getByLabelText('Password'), 'new-long-password')
    await user.click(screen.getByRole('button', { name: 'Update password' }))
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        password: 'new-long-password',
      }),
    )
    expect(mocks.logout).toHaveBeenCalled()
  })
})
function editor() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/coins/new']}>
        <LanguageProvider>
          <Routes>
            <Route path="/admin/coins/new" element={<Editor />} />
            <Route path="/admin" element={<h1>Saved dashboard</h1>} />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
describe('coin editor', () => {
  it('requires explicit application of imported suggestions', async () => {
    const user = userEvent.setup()
    mocks.retrieve.mockResolvedValue({
      fields: { name: 'Imported coin' },
      source_url: 'https://example.com/coin',
      warnings: [],
    })
    editor()
    await user.type(screen.getByLabelText('Coin name'), 'My name')
    await user.type(
      screen.getByLabelText('Reference URL'),
      'https://example.com/coin',
    )
    await user.click(
      screen.getByRole('button', { name: 'Retrieve information' }),
    )
    await screen.findByText('Imported coin', { exact: false })
    expect(screen.getByLabelText('Coin name')).toHaveValue('My name')
    await user.click(screen.getByRole('button', { name: 'Use this value' }))
    expect(screen.getByLabelText('Coin name')).toHaveValue('Imported coin')
  })
  it('preserves an identical submission and uploads after an ambiguous failure', async () => {
    const user = userEvent.setup()
    mocks.save
      .mockRejectedValueOnce(new TypeError('Connection lost'))
      .mockResolvedValueOnce('saved')
    mocks.upload.mockImplementation(async (_id, side) => ({
      side,
      image_path: `${side}.webp`,
      thumbnail_path: null,
      alt_text: side,
      credit: null,
      display_order: 0,
    }))
    editor()
    await user.type(screen.getByLabelText('Coin name'), 'Test coin')
    await user.type(screen.getByLabelText('Issuing authority'), 'Greece')
    await user.type(
      screen.getByLabelText('Reference URL'),
      'https://example.com/coin',
    )
    await user.upload(
      screen.getByLabelText('obverse'),
      new File(['front'], 'front.jpg', { type: 'image/jpeg' }),
    )
    await user.upload(
      screen.getByLabelText('reverse'),
      new File(['back'], 'back.jpg', { type: 'image/jpeg' }),
    )
    // jsdom does not recognise userEvent's FileList for native required-file validation.
    fireEvent.submit(document.querySelector('form')!)
    await screen.findByRole('button', { name: 'Retry save' })
    expect(screen.getByLabelText('Coin name')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Retry save' }))
    await screen.findByRole('heading', { name: 'Saved dashboard' })
    expect(mocks.save.mock.calls[1][0]).toBe(mocks.save.mock.calls[0][0])
    expect(mocks.upload).toHaveBeenCalledTimes(2)
  })
})
