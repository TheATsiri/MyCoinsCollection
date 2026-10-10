export function validateReview(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Invalid request')
  const body = input as Record<string, unknown>
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (
    typeof body.coin_id !== 'string' ||
    !uuid.test(body.coin_id) ||
    typeof body.submission_id !== 'string' ||
    !uuid.test(body.submission_id)
  )
    throw new Error('Invalid coin or submission identifier')
  if (
    !Number.isInteger(body.rating) ||
    Number(body.rating) < 1 ||
    Number(body.rating) > 5
  )
    throw new Error('Choose a rating from 1 to 5')
  if (
    typeof body.display_name !== 'string' ||
    !body.display_name.trim() ||
    [...body.display_name.trim()].length > 100 ||
    [...body.display_name].some(
      (char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127,
    )
  )
    throw new Error('Enter a display name (1–100 characters)')
  if (
    typeof body.review_text !== 'string' ||
    [...body.review_text].length > 2000
  )
    throw new Error('Review must not exceed 2,000 characters')
  if (
    body.website !== '' ||
    typeof body.token !== 'string' ||
    !body.token ||
    body.token.length > 2048
  )
    throw new Error('Complete the verification and try again')
  return {
    coin_id: body.coin_id,
    submission_id: body.submission_id,
    display_name: body.display_name.trim(),
    rating: Number(body.rating),
    review_text: body.review_text.trim(),
    token: body.token,
  }
}
