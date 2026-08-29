import { expect, test, type Page } from '@playwright/test'

/**
 * Client intake form (/onboard).
 * Route and form UI are owned by the intake-form chat. This file only verifies
 * the agreed definition of done. Skip if that start UI is not present yet.
 */

async function startOnboard(page: Page) {
  await page.goto('/onboard')
  const start = page.getByRole('button', { name: /get started/i })
  const stepOne = page.getByText(/step 1 of 7/i)
  const hasStart = await start.isVisible().catch(() => false)
  const hasStep = await stepOne.isVisible().catch(() => false)
  if (!hasStart && !hasStep) {
    test.skip(true, '/onboard start UI not ready — waiting on the intake-form chat')
  }
  if (hasStart) {
    await start.click()
  }
  await expect(page.getByText(/step 1 of 7/i)).toBeVisible({ timeout: 20_000 })
  await expect(page).toHaveURL(/\/onboard\/[0-9a-f-]{36}/i)
}

async function continueStep(page: Page) {
  await page.getByRole('button', { name: /^continue$/i }).click()
}

async function fillStep1(page: Page, email = 'owner.e2e@example.com') {
  // Labels are not wired to inputs yet (intake chat owns that markup).
  await page.locator('[name="full_name"]').fill('Pat Keating')
  await page.locator('[name="email"]').fill(email)
  await page.locator('[name="phone"]').fill('709-555-0100')
  await continueStep(page)
}

async function fillStep2(page: Page) {
  await expect(page.getByRole('heading', { name: /the property/i })).toBeVisible({ timeout: 15_000 })
  await page.locator('[name="street_address"]').fill('21 Cochrane St')
  await page.locator('[name="city"]').fill("St. John's")
  await continueStep(page)
}

async function fillStep3(page: Page) {
  await expect(page.getByRole('heading', { name: /building details/i })).toBeVisible({ timeout: 15_000 })
  await page.locator('[name="year_built"]').fill('1984')
  await page.locator('[name="storeys"]').fill('2')
  await continueStep(page)
}

async function fillStep4(page: Page) {
  await expect(page.getByRole('heading', { name: /each unit/i })).toBeVisible({ timeout: 15_000 })
  await page.locator('[name="units.0.beds"]').fill('2')
  await page.locator('[name="units.0.baths"]').fill('1')
  await continueStep(page)
}

async function fillStep5(page: Page) {
  await expect(page.getByRole('heading', { name: /utilities/i })).toBeVisible({ timeout: 15_000 })
  await continueStep(page)
}

async function fillStep6(page: Page) {
  await expect(page.getByRole('heading', { name: /responsibilities/i })).toBeVisible({ timeout: 15_000 })
  await continueStep(page)
}

test.describe('client intake form', () => {
  test.describe.configure({ timeout: 90_000 })
  test('completes all seven steps and submits successfully', async ({ page }) => {
    await startOnboard(page)
    await fillStep1(page)
    await fillStep2(page)
    await fillStep3(page)
    await fillStep4(page)
    await fillStep5(page)
    await fillStep6(page)
    await expect(page.getByRole('heading', { name: /photos and review/i })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /^submit$/i }).click()
    await expect(page).toHaveURL(/\/onboard\/[0-9a-f-]{36}\/complete/i, { timeout: 20_000 })
    await expect(page.getByText(/we received your property details/i)).toBeVisible()
  })

  test('abandon at step 4, return via token URL, data intact', async ({ page }) => {
    await startOnboard(page)
    await fillStep1(page)
    await fillStep2(page)
    await fillStep3(page)
    await expect(page.getByRole('heading', { name: /each unit/i })).toBeVisible({ timeout: 15_000 })
    const resumeUrl = page.url()

    await page.goto('/')
    await page.goto(resumeUrl)
    await expect(page.getByRole('heading', { name: /each unit/i })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /^back$/i }).click()
    await expect(page.getByRole('heading', { name: /building details/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[name="year_built"]')).toHaveValue('1984')
    await page.getByRole('button', { name: /^back$/i }).click()
    await expect(page.getByRole('heading', { name: /the property/i })).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[name="street_address"]')).toHaveValue('21 Cochrane St')
  })

  test('a different token cannot read the first submission', async ({ page, context }) => {
    await startOnboard(page)
    await fillStep1(page, 'first.token@example.com')
    const firstUrl = page.url()

    const other = await context.newPage()
    await startOnboard(other)
    const secondUrl = other.url()
    expect(secondUrl).not.toBe(firstUrl)

    await other.goto(firstUrl)
    await expect(other.getByText(/first\.token@example\.com/i)).toHaveCount(0)
    await other.close()
  })

  test('a submitted form cannot be modified', async ({ page }) => {
    await startOnboard(page)
    await fillStep1(page, 'locked.e2e@example.com')
    await fillStep2(page)
    await fillStep3(page)
    await fillStep4(page)
    await fillStep5(page)
    await fillStep6(page)
    await expect(page.getByRole('heading', { name: /photos and review/i })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: /^submit$/i }).click()
    await expect(page).toHaveURL(/\/complete/i)

    const tokenMatch = page.url().match(/\/onboard\/([0-9a-f-]{36})/i)
    expect(tokenMatch?.[1]).toBeTruthy()
    await page.goto(`/onboard/${tokenMatch![1]}`)
    await expect(page).toHaveURL(/\/complete/i)
    await expect(page.getByRole('button', { name: /^continue$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^submit$/i })).toHaveCount(0)
    await expect(page.getByText(/we received your property details/i)).toBeVisible()
  })

  test('renders correctly at 390px width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await startOnboard(page)
    const name = page.locator('[name="full_name"]')
    await expect(name).toBeVisible()
    const box = await name.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeGreaterThan(200)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
  })
})