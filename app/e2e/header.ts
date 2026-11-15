// The header's action bar (Find the best site, Site details, Points of interest, Flight plan, Help) folds behind one
// "Menu" button at 640 px and below (App.tsx). A test that presses one of those buttons at any width goes through here.
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
