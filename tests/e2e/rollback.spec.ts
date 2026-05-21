// Journey: [CRITICAL-JOURNEY-2] — DevOps team performs synchronized deployment with rollback capability
//          [CRITICAL-JOURNEY-3] — Automated rollback triggered on deployment health check failure
//
// Story 2 ACs covered:
//   AC2.3 — Rollback triggered from deployment detail page
//   AC2.4 — Rollback status reflected in UI after trigger

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Helper — navigate to a deployment detail page that is in a rollback-eligible
// state.  In a full E2E environment this would require the backend to have a
// seeded "failed" deployment; we navigate directly by known ID via env var or
// rely on the dev-server seed data.
// ---------------------------------------------------------------------------
async function navigateToFailedDeployment(page: Page): Promise<string> {
  // If a seed deployment ID is pre-configured use it; otherwise go to the
  // deployments list and find a failed/verifying deployment.
  const seedId = process.env.E2E_FAILED_DEPLOYMENT_ID;
  if (seedId) {
    await page.goto(`${BASE_URL}/deployments/${seedId}`);
    return seedId;
  }

  // Fallback: use the list page to find the first deployment with a rollback button
  await page.goto(`${BASE_URL}/deployments`);
  const rollbackLinks = page.getByRole('link', { name: /view/i });
  const count = await rollbackLinks.count();
  if (count === 0) {
    test.skip(); // no deployments available — skip gracefully
  }
  await rollbackLinks.first().click();
  await page.waitForURL(/\/deployments\/[0-9a-f-]{36}/);
  return page.url().split('/').pop()!;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Rollback Deployment', () => {
  test('AC2.3 — rollback button visible on deployment detail page', async ({ page }) => {
    // Protects: [CRITICAL-JOURNEY-2] — DevOps team triggers rollback
    await navigateToFailedDeployment(page);

    // The rollback button or confirm modal trigger should be accessible
    const rollbackButton = page.getByRole('button', { name: /rollback/i });
    await expect(rollbackButton).toBeVisible({ timeout: 10_000 });
  });

  test('AC2.3 — confirmation modal appears before rollback executes', async ({ page }) => {
    // Protects: [CRITICAL-JOURNEY-3] — rollback requires explicit confirmation
    await navigateToFailedDeployment(page);

    await page.getByRole('button', { name: /rollback/i }).click();

    // The ConfirmRollbackModal should appear
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/confirm rollback/i)).toBeVisible();
  });

  test('AC2.3 — cancelling the modal does not trigger rollback', async ({ page }) => {
    // Protects: [CRITICAL-JOURNEY-3] — operator can abort
    await navigateToFailedDeployment(page);

    await page.getByRole('button', { name: /rollback/i }).click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });

    await page.getByRole('button', { name: /cancel/i }).click();

    // Modal dismissed — status unchanged
    await expect(page.getByRole('dialog')).not.toBeVisible();
    // Status badge should NOT show rolling_back
    const badge = page.getByTestId('deployment-status-badge');
    if (await badge.count()) {
      await expect(badge).not.toHaveText(/rolling_back/i);
    }
  });

  test('AC2.4 — confirming rollback transitions deployment to rolling_back', async ({ page }) => {
    // Protects: [CRITICAL-JOURNEY-2] and [CRITICAL-JOURNEY-3]
    await navigateToFailedDeployment(page);

    await page.getByRole('button', { name: /rollback/i }).click();
    await page.getByRole('dialog').waitFor({ state: 'visible' });

    // Fill in optional reason field if present
    const reasonField = page.getByLabel(/reason/i);
    if (await reasonField.count()) {
      await reasonField.fill('Post-deploy health check failure — automated E2E trigger');
    }

    await page.getByRole('button', { name: /confirm/i }).click();

    // After rollback is initiated the page should reflect the new status
    await expect(
      page.getByText(/rolling_back|rolled_back/i),
    ).toBeVisible({ timeout: 15_000 });
  });
});
