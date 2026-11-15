// The header's action bar (Find the best site, Site details, Points of interest, Flight plan, Help) folds behind one
// "Menu" button at 640 px and below (App.tsx). A test that presses one of those buttons at any width goes through here.
import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

/** The action-bar button `testId`, with the phone Menu opened first when the button is folded away. */
export async function headerAction(page: Page, testId: string): Promise<Locator> {
  const button = page.getByTestId(testId)
  if (!(await button.isVisible())) {
    const menu = page.getByTestId('menu-open')
    if (await menu.isVisible()) {
      if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click()
    }
  }
  return button
}

/** Opens every folded section of the Site details tab (Fold.tsx: Stations, Power, Site potential, NASA tools, Export,
 *  Horizon), as Full data does, once the drawer is there. */
export async function openDrawerFolds(page: Page): Promise<void> {
  const drawer = page.getByTestId('drawer')
  await expect(drawer).toBeVisible({ timeout: 60_000 })
  await drawer.locator('details.drawer-fold').first().waitFor({ timeout: 60_000 })
  await drawer.locator('details.drawer-fold').evaluateAll((ds) => ds.forEach((d) => ((d as HTMLDetailsElement).open = true)))
}

/** Opens a folded section (aria-expanded false) by its toggle `testId` inside `scope`: the mission menu's Science
 *  goal, Your points and Ground stations, the search's Filters. Already open: left as it is. */
export async function openFold(scope: Locator, testId: string): Promise<void> {
  const toggle = scope.getByTestId(testId)
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
}
