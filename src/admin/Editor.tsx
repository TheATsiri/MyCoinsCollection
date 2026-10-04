import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLanguage } from '../i18n/useLanguage'
import { imageUrl } from '../lib/supabase'
import type { Coin, Json } from '../types/coin'
import {
  cleanupPhotos,
  releaseUncommittedPhotos,
  errorMessage,
  loadAdminCoin,
  retrieveInformation,
  saveCoin,
  uploadPhoto,
} from './api'
import type { ImportResult, SaveRequest } from './api'
const fields = [
  ['name', 'Coin name'],
  ['issuing_authority', 'Issuing authority'],
  ['year', 'Year'],
  ['denomination', 'Denomination'],
  ['denomination_value', 'Denomination value'],
  ['denomination_unit', 'Currency unit'],
  ['metal', 'Metal'],
  ['weight_g', 'Weight (g)'],
  ['diameter_mm', 'Diameter (mm)'],
  ['mint', 'Mint'],
  ['mint_mark', 'Mint mark'],
  ['ruler', 'Ruler'],
  ['historical_period', 'Historical period'],
  ['grade', 'Grade'],
  ['grading_system', 'Grading system'],
  ['measurement_source', 'Measurement source'],
  ['obverse_description', 'Obverse description'],
  ['reverse_description', 'Reverse description'],
  ['historical_notes', 'Historical notes'],
  ['catalogued_at', 'Catalogued date'],
] as const
const numbers = new Set([
  'year',
  'denomination_value',
  'weight_g',
  'diameter_mm',
])
function PhotoPreview({
  file,
  path,
  label,
}: {
  file?: File
  path?: string
  label: string
}) {
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    if (!file || !image.current) return
    const url = URL.createObjectURL(file)
    image.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  return file || path ? (
    <img
      ref={image}
      className="admin-photo-preview"
      src={file ? undefined : imageUrl(path!)}
      alt={label}
    />
  ) : null
}
export default function Editor() {
  const { id } = useParams(),
    { t } = useLanguage()
  const query = useQuery({
    queryKey: ['admin-coin', id],
    queryFn: () => loadAdminCoin(id!),
    enabled: !!id,
    refetchOnWindowFocus: false,
  })
  if (id && query.isPending)
    return (
      <section className="container admin-page" role="status">
        {t('Please wait…')}
      </section>
    )
  if (query.error)
    return (
      <section className="container admin-page" role="alert">
        {errorMessage(query.error)}{' '}
        <Link to="/admin">{t('Back to administration')}</Link>
      </section>
    )
  return <CoinForm key={id ?? 'new'} existing={query.data} />
}
function CoinForm({ existing }: { existing?: Coin }) {
  const { t } = useLanguage(),
    navigate = useNavigate(),
    queryClient = useQueryClient()
  const pendingKey = `coin-admin-pending:${existing?.id ?? 'new'}`
  const [restored] = useState<SaveRequest | null>(() => {
    try {
      const saved = sessionStorage.getItem(pendingKey)
      if (!saved) return null
      const request = JSON.parse(saved) as SaveRequest
      return request.submission &&
        request.coin?.id &&
        Array.isArray(request.images) &&
        Array.isArray(request.references)
        ? request
        : null
    } catch {
      return null
    }
  })
  const coinId = useRef(
    String(restored?.coin.id ?? existing?.id ?? crypto.randomUUID()),
  )
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map(([key]) => [
        key,
        String(restored?.coin[key] ?? existing?.[key] ?? ''),
      ]),
    ),
  )
  const [references, setReferences] = useState<SaveRequest['references']>(
    () =>
      restored?.references ??
      (existing?.coin_references.length
        ? existing.coin_references.map(
            ({ catalogue, reference_number, edition, source_url }) => ({
              catalogue,
              reference_number,
              edition,
              source_url,
            }),
          )
        : [
            {
              catalogue: 'Website',
              reference_number: '',
              edition: null,
              source_url: '',
            },
          ]),
  )
  const [attributes, setAttributes] = useState(
    JSON.stringify(
      restored?.coin.extra_attributes ?? existing?.extra_attributes ?? {},
      null,
      2,
    ),
  )
  const [published, setPublished] = useState(
    Boolean(restored?.coin.is_published ?? existing?.is_published ?? true),
  )
  const [files, setFiles] = useState<
    Partial<Record<'obverse' | 'reverse', File>>
  >({})
  const [suggestions, setSuggestions] = useState<ImportResult | null>(null)
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('')
  const [pending, setPending] = useState<SaveRequest | null>(restored)
  const uploaded = useRef(new Map<File, SaveRequest['images'][number]>())
  const locked = busy || !!pending
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  const changeReference = (
    index: number,
    key: keyof SaveRequest['references'][number],
    value: string,
  ) =>
    setReferences((previous) =>
      previous.map((reference, i) =>
        i === index
          ? {
              ...reference,
              [key]:
                key === 'catalogue' || key === 'reference_number'
                  ? value
                  : value || null,
            }
          : reference,
      ),
    )
  const retrieve = async () => {
    setBusy(true)
    setMessage('')
    setSuggestions(null)
    try {
      setSuggestions(await retrieveInformation(references[0]?.source_url ?? ''))
    } catch (error) {
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    let request = pending
    try {
      if (!request) {
        const extra = JSON.parse(attributes) as Json
        if (!extra || typeof extra !== 'object' || Array.isArray(extra))
          throw new Error('Extra attributes must be a JSON object.')
        for (const reference of references) {
          if (reference.source_url) {
            const url = new URL(reference.source_url)
            if (!['http:', 'https:'].includes(url.protocol))
              throw new Error('Enter a public HTTP or HTTPS reference URL.')
          }
        }
        const images: SaveRequest['images'] = (existing?.coin_images ?? []).map(
          ({
            side,
            image_path,
            thumbnail_path,
            alt_text,
            credit,
            display_order,
          }) => ({
            side,
            image_path,
            thumbnail_path,
            alt_text,
            credit,
            display_order,
          }),
        )
        for (const side of ['obverse', 'reverse'] as const) {
          const file = files[side]
          if (
            !file &&
            !existing &&
            !images.some((image) => image.side === side)
          )
            throw new Error('Both coin photographs are required.')
          if (file) {
            let image = uploaded.current.get(file)
            if (!image) {
              image = await uploadPhoto(coinId.current, side, file, values.name)
              uploaded.current.set(file, image)
            }
            const previous = images.findIndex((item) => item.side === side)
            if (previous >= 0) images.splice(previous, 1)
            images.push(image)
          }
        }
        const coin: Record<string, Json> = {
          id: coinId.current,
          slug: existing?.slug ?? `coin-${coinId.current}`,
          expected_updated_at: existing?.updated_at ?? null,
          extra_attributes: extra,
          is_published: published,
        }
        for (const [key] of fields)
          coin[key] = values[key].trim()
            ? numbers.has(key)
              ? Number(values[key])
              : values[key].trim()
            : null
        request = { submission: crypto.randomUUID(), coin, images, references }
        try {
          sessionStorage.setItem(pendingKey, JSON.stringify(request))
        } catch {
          /* In-memory retry remains available when storage is disabled. */
        }
        setPending(request)
      }
      await saveCoin(request)
      try {
        sessionStorage.removeItem(pendingKey)
      } catch {
        /* Storage may be disabled. */
      }
      setPending(null)
      let cleanupWarning = false
      try {
        cleanupWarning = (await cleanupPhotos()) > 0
      } catch {
        cleanupWarning = true
      }
      await queryClient.invalidateQueries()
      navigate(`/admin?saved=1${cleanupWarning ? '&cleanup=1' : ''}`)
    } catch (error) {
      // Database rejections are definitive; transport failures keep the identical request for a safe retry.
      const definitive =
        typeof error === 'object' &&
        error &&
        'code' in error &&
        /^[0-9A-Z]{5}$/.test(String(error.code))
      if (definitive) {
        try {
          sessionStorage.removeItem(pendingKey)
        } catch {
          /* Storage may be disabled. */
        }
        setPending(null)
      }
      if (!request || definitive) {
        const paths = [...uploaded.current.values()].flatMap((image) => [
          image.image_path,
          ...(image.thumbnail_path ? [image.thumbnail_path] : []),
        ])
        await releaseUncommittedPhotos(paths).catch(() => undefined)
        uploaded.current.clear()
      }
      setMessage(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="container admin-page">
      <Link to="/admin">{t('Back to administration')}</Link>
      <h1>{t(existing ? 'Edit coin' : 'Add coin')}</h1>
      <form className="admin-form" onSubmit={submit}>
        <fieldset disabled={locked}>
          <legend>{t('References')}</legend>
          {references.map((reference, index) => (
            <div className="admin-reference" key={index}>
              <label>
                {t('Reference URL')}
                <input
                  type="url"
                  required={index === 0}
                  value={reference.source_url ?? ''}
                  onChange={(e) =>
                    changeReference(index, 'source_url', e.target.value)
                  }
                />
              </label>
              <label>
                {t('Catalogue')}
                <input
                  required
                  value={reference.catalogue}
                  onChange={(e) =>
                    changeReference(index, 'catalogue', e.target.value)
                  }
                />
              </label>
              <label>
                {t('Reference number')}
                <input
                  value={reference.reference_number}
                  onChange={(e) =>
                    changeReference(index, 'reference_number', e.target.value)
                  }
                />
              </label>
              <label>
                {t('Edition')}
                <input
                  value={reference.edition ?? ''}
                  onChange={(e) =>
                    changeReference(index, 'edition', e.target.value)
                  }
                />
              </label>
              {index > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setReferences((previous) =>
                      previous.filter((_, i) => i !== index),
                    )
                  }
                >
                  {t('Remove reference')}
                </button>
              )}
            </div>
          ))}
          <div className="admin-actions">
            <button type="button" onClick={() => void retrieve()}>
              {t('Retrieve information')}
            </button>
            <button
              type="button"
              onClick={() =>
                setReferences((previous) => [
                  ...previous,
                  {
                    catalogue: 'Website',
                    reference_number: '',
                    edition: null,
                    source_url: '',
                  },
                ])
              }
            >
              {t('Add reference')}
            </button>
          </div>
          <p>
            {t(
              'Review imported information before saving. Unknown details can be entered manually.',
            )}
          </p>
          {suggestions && (
            <div className="admin-import" role="status">
              <h2>{t('Imported suggestions')}</h2>
              <a
                href={suggestions.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {suggestions.source_url}
              </a>
              {suggestions.warnings.map((warning, index) => (
                <p key={index}>{t(warning)}</p>
              ))}
              {Object.entries(suggestions.fields).map(([key, value]) => (
                <div key={key}>
                  <strong>
                    {t(fields.find(([field]) => field === key)?.[1] ?? key)}
                  </strong>
                  : {String(value)}{' '}
                  <button
                    type="button"
                    onClick={() =>
                      setValues((previous) => ({
                        ...previous,
                        [key]: String(value),
                      }))
                    }
                  >
                    {t('Use this value')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </fieldset>
        <fieldset disabled={locked}>
          <legend>{t('Coin details')}</legend>
          <div className="admin-grid">
            {fields.map(([key, label]) => (
              <label
                key={key}
                className={
                  key.endsWith('description') || key === 'historical_notes'
                    ? 'admin-wide'
                    : ''
                }
              >
                {t(label)}
                {key.endsWith('description') || key === 'historical_notes' ? (
                  <textarea
                    rows={4}
                    value={values[key]}
                    onChange={(e) =>
                      setValues((previous) => ({
                        ...previous,
                        [key]: e.target.value,
                      }))
                    }
                  />
                ) : (
                  <input
                    type={
                      numbers.has(key)
                        ? 'number'
                        : key === 'catalogued_at'
                          ? 'date'
                          : 'text'
                    }
                    step={key === 'year' ? 1 : 'any'}
                    min={
                      key === 'year'
                        ? 1
                        : ['weight_g', 'diameter_mm'].includes(key)
                          ? 0.0001
                          : key === 'denomination_value'
                            ? 0
                            : undefined
                    }
                    max={key === 'year' ? 9999 : undefined}
                    maxLength={
                      ['name', 'issuing_authority'].includes(key)
                        ? 200
                        : undefined
                    }
                    required={['name', 'issuing_authority'].includes(key)}
                    value={values[key]}
                    onChange={(e) =>
                      setValues((previous) => ({
                        ...previous,
                        [key]: e.target.value,
                      }))
                    }
                  />
                )}
              </label>
            ))}
            <label className="admin-wide">
              {t('Extra attributes (JSON)')}
              <textarea
                rows={4}
                value={attributes}
                onChange={(e) => setAttributes(e.target.value)}
              />
            </label>
          </div>
        </fieldset>
        <fieldset disabled={locked}>
          <legend>{t('Photographs')}</legend>
          <div className="admin-grid">
            {(['obverse', 'reverse'] as const).map((side) => (
              <label key={side}>
                {t(side)}
                <PhotoPreview
                  file={files[side]}
                  path={
                    pending?.images.find((image) => image.side === side)
                      ?.image_path ??
                    existing?.coin_images.find((image) => image.side === side)
                      ?.image_path
                  }
                  label={t(side)}
                />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required={!existing && !pending}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    setFiles((previous) => ({ ...previous, [side]: file }))
                  }}
                />
              </label>
            ))}
          </div>
          <p>
            {t(
              'JPEG, PNG or WebP, up to 20 MB per photograph. Photographs remain public by URL when a coin is hidden.',
            )}
          </p>
        </fieldset>
        <fieldset disabled={locked}>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
            />
            {t('Published')}
          </label>
        </fieldset>
        {message && <p role="alert">{t(message)}</p>}
        {pending && !busy && (
          <p role="status">
            {t(
              'Save confirmation was not received. Retry the same save before leaving this page.',
            )}
          </p>
        )}
        <button className="button" disabled={busy} type="submit">
          {t(
            busy
              ? 'Please wait…'
              : pending
                ? 'Retry save'
                : existing
                  ? 'Save changes'
                  : 'Add to My Coins Collection',
          )}
        </button>
      </form>
    </section>
  )
}
