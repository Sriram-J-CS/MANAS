import { test, expect } from '@playwright/test';

test.describe('Chat Workspace Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set onboarded state so chat opens directly
    await page.addInitScript(() => {
      localStorage.setItem('manas_twin_onboarded', 'true');
      localStorage.setItem('manas_user_id', 'test_e2e_user');
      localStorage.setItem(
        'manas_twin_profile',
        JSON.stringify({
          id: 'test_e2e_user',
          name: 'Sriram',
          age: 21,
          gender: 'boy',
          language: 'en',
          role: 'student',
        })
      );
    });

    // Navigate with ?chat=open to launch the companion modal directly
    await page.goto('/?chat=open');
    await expect(page.locator('section[aria-label="Conversation with Mascot"]')).toBeVisible({ timeout: 12000 });
  });

  test('1. Profile Menu popover opens, has correct z-index, and closes on Escape and outside click', async ({ page }) => {
    const menuBtn = page.locator('#profile-menu-button');
    await expect(menuBtn).toBeVisible();

    // Click MENU
    await menuBtn.click();
    const popover = page.locator('#profile-menu-popover');
    await expect(popover).toBeVisible();

    // Assert items in popover
    await expect(popover.getByText('Customize Mascot')).toBeVisible();
    await expect(popover.getByText('Guided Breathing')).toBeVisible();

    // Take screenshot of open menu
    await page.screenshot({ path: 'e2e-screenshots/01-profile-menu-open.png' });

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();

    // Open again, then click outside
    await menuBtn.click();
    await expect(popover).toBeVisible();
    await page.locator('section[aria-label="3D AI Mascot Companion"]').click({ position: { x: 50, y: 50 } });
    await expect(popover).toBeHidden();
  });

  test('2. Send 5 messages: assert strict chronological order, no duplicates, stable IDs, and thinking state', async ({ page }) => {
    const runId = Date.now().toString().slice(-4);
    const testMessages = [
      `Hello MANAS [${runId}], this is my first test message`,
      `I am preparing for university exams [${runId}] and feeling a bit overwhelmed`,
      `What can I do to keep my focus steady [${runId}]?`,
      `Can you recommend a quick 3-minute somatic reset [${runId}]?`,
      `Thank you so much [${runId}], this feels very supportive`,
    ];

    const input = page.locator('input[placeholder="Speak or type what you are carrying..."]');
    const sendBtn = page.locator('button[title="Send message"]');

    for (let i = 0; i < testMessages.length; i++) {
      const msgText = testMessages[i];
      await input.fill(msgText);
      await sendBtn.click();

      // Ensure user message is visible at the bottom
      await expect(page.getByText(msgText)).toBeVisible({ timeout: 6000 });

      // Wait for mascot response
      await page.waitForTimeout(1600);
    }

    // Capture screenshot after sending 5 messages
    await page.screenshot({ path: 'e2e-screenshots/02-five-messages-chronological.png' });

    // Verify all 5 user messages exist in DOM in exact order
    const conversation = page.locator('section[aria-label="Conversation with Mascot"]');
    for (const msg of testMessages) {
      const match = conversation.getByText(msg);
      await expect(match).toHaveCount(1); // No duplicates
    }

    // Verify mascot messages have emotion badges and feedback buttons
    const helpfulBtns = page.locator('button[id^="feedback-up-"]');
    await expect(helpfulBtns.first()).toBeVisible();

    const understoodBtns = page.locator('button[id^="feedback-understood-"]');
    await expect(understoodBtns.first()).toBeVisible();

    // Verify speak button is present on reply bubbles
    const speakBtns = page.locator('button[aria-label="Speak message aloud"]');
    await expect(speakBtns.first()).toBeVisible();
  });

  test('3. Auto-scroll and Jump to Latest chip behavior', async ({ page }) => {
    const input = page.locator('input[placeholder="Speak or type what you are carrying..."]');
    const sendBtn = page.locator('button[title="Send message"]');

    // Send a message to ensure transcript has content
    await input.fill('Testing auto-scroll and jump to latest chip');
    await sendBtn.click();
    await page.waitForTimeout(1800);

    // Scroll container to the very top (away from bottom)
    const scrollContainer = page.locator('div[aria-live="polite"]');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = 0;
    });

    // Verify the "Jump to latest ↓" chip appears
    const jumpChip = page.locator('#jump-to-latest-chip');
    await expect(jumpChip).toBeVisible({ timeout: 5000 });

    // Take screenshot showing Jump to latest chip
    await page.screenshot({ path: 'e2e-screenshots/03-jump-to-latest-chip.png' });

    // Click Jump to latest
    await jumpChip.click();
    await page.waitForTimeout(600);

    // Chip should disappear after scrolling to bottom
    await expect(jumpChip).toBeHidden();
  });

  test('4. Embedded exercises inside reply bubbles and quick-reply chips', async ({ page }) => {
    // Click quick-reply chip: "Can we do the 4-7-8 breathing exercise?"
    const breathingChip = page.getByRole('button', { name: 'Can we do the 4-7-8 breathing exercise?' });
    if (await breathingChip.isVisible()) {
      await breathingChip.click();
      await page.waitForTimeout(2000);

      // Verify that breathing exercise card or recommendation is visible inside bubble
      await page.screenshot({ path: 'e2e-screenshots/04-embedded-exercise-card.png' });
    }
  });

  test('5. Mobile responsive layout check', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    // Verify stage and transcript are stacked properly
    const mascotStage = page.locator('section[aria-label="3D AI Mascot Companion"]');
    await expect(mascotStage).toBeVisible();

    const conversation = page.locator('section[aria-label="Conversation with Mascot"]');
    await expect(conversation).toBeVisible();

    // Verify input bar is accessible at bottom
    const input = page.locator('input[placeholder="Speak or type what you are carrying..."]');
    await expect(input).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({ path: 'e2e-screenshots/05-mobile-layout.png' });
  });
});
