import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { it, expect } from 'vitest'
import CoinCard from '../src/components/CoinCard'
import { demoCoins } from '../src/features/coins/demo'
it('switches the displayed coin side independently of navigation', async () => {
  render(
    <MemoryRouter>
      <CoinCard coin={demoCoins[0]} />
    </MemoryRouter>,
  )
  await userEvent.click(screen.getByRole('button', { name: /Show reverse/ }))
  expect(screen.getByText('reverse')).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: /European connections/ }),
  ).toHaveAttribute('href', '/coins/european-connections')
})
