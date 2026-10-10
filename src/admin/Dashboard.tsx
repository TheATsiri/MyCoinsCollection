import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '../i18n/useLanguage'
import { admin } from './client'
import {
  cleanupPhotos,
  deleteCoin,
  errorMessage,
  listAdminCoins,
  setPublished,
} from './api'
import type { Coin } from '../types/coin'
export default function Dashboard() {
  const { t } = useLanguage(),
    client = useQueryClient(),
    navigate = useNavigate()
  const [params] = useSearchParams()
  const [search, setSearch] = useState(''),
    [message, setMessage] = useState(
      params.has('cleanup')
        ? 'Some photographs could not be removed. Use Retry photograph cleanup.'
        : params.has('saved')
          ? 'Changes saved.'
          : '',
    ),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState<Coin | null>(null)
  useEffect(() => {
    let active = true
    cleanupPhotos()
      .then((failed) => {
        if (active && failed)
          setMessage(
            'Some photographs could not be removed. Use Retry photograph cleanup.',
          )
      })
      .catch(() => {
        if (active)
          setMessage(
            'Some photographs could not be removed. Use Retry photograph cleanup.',
          )
      })
    return () => {
      active = false
    }
  }, [])
  const coins = useQuery({ queryKey: ['admin-coins'], queryFn: listAdminCoins })
  const perform = async (operation: () => Promise<unknown>) => {
    setBusy(true)
    setMessage('')
    try {
      await operation()
      setDeleting(null)
      const failed = await cleanupPhotos()
      setMessage(
        failed
          ? 'Some photographs could not be removed. Use Retry photograph cleanup.'
          : 'Changes saved.',
      )
      await client.invalidateQueries()
    } catch (error) {
      setMessage(errorMessage(error))
      await client.invalidateQueries({ queryKey: ['admin-coins'] })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="container admin-page">
      <div className="admin-toolbar">
        <h1>{t('Administration')}</h1>
        <Link className="button" to="/admin/reviews">
          {t('Review moderation')}
        </Link>
        <Link className="button" to="/admin/coins/new">
          {t('Add coin')}
        </Link>
        <button
          disabled={busy}
          onClick={() =>
            void perform(async () => {
              const { error } = await admin().auth.signOut()
              if (error) throw error
              for (const key of Object.keys(sessionStorage))
                if (key.startsWith('coin-admin-pending:'))
                  sessionStorage.removeItem(key)
              client.removeQueries({ queryKey: ['admin-coins'] })
              client.removeQueries({ queryKey: ['admin-coin'] })
              client.removeQueries({ queryKey: ['admin-reviews'] })
              navigate('/admin/login')
            })
          }
        >
          {t('Log out')}
        </button>
      </div>
      <label>
        {t('Search coins')}
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <button
        className="text-link"
        disabled={busy}
        onClick={() => void perform(async () => undefined)}
      >
        {t('Retry photograph cleanup')}
      </button>
      {(message || coins.error) && (
        <p role="status">{t(message || errorMessage(coins.error))}</p>
      )}
      {coins.isPending && <p role="status">{t('Please wait…')}</p>}
      <div className="admin-coin-list">
        {coins.data
          ?.filter((coin) =>
            `${coin.name} ${coin.issuing_authority} ${coin.year ?? ''}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((coin) => (
            <article key={coin.id}>
              <div>
                <h2>{coin.name}</h2>
                <p>
                  {coin.issuing_authority} · {coin.year ?? t('UNDATED')} ·{' '}
                  {t(coin.is_published ? 'Published' : 'Hidden')}
                </p>
              </div>
              <div className="admin-actions">
                <Link to={`/admin/coins/${coin.id}/edit`}>{t('Edit')}</Link>
                <button
                  disabled={busy}
                  onClick={() =>
                    void perform(() =>
                      setPublished(coin.id, !coin.is_published),
                    )
                  }
                >
                  {t(coin.is_published ? 'Hide' : 'Publish')}
                </button>
                <button disabled={busy} onClick={() => setDeleting(coin)}>
                  {t('Delete')}
                </button>
              </div>
            </article>
          ))}
      </div>
      {deleting && (
        <div className="admin-confirm" role="alert">
          <p>
            {t('Permanently delete {name} and its photographs?', {
              name: deleting.name,
            })}
          </p>
          <button
            disabled={busy}
            onClick={() => void perform(() => deleteCoin(deleting.id))}
          >
            {t('Confirm deletion')}
          </button>
          <button disabled={busy} onClick={() => setDeleting(null)}>
            {t('Cancel')}
          </button>
        </div>
      )}
    </section>
  )
}
