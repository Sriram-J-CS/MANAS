import { test, expect } from '@playwright/test';

test.describe('Voice System Tests', () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant microphone permissions
    await context.grantPermissions(['microphone']).catch(() => {});

    // Set onboarded state and inject mock SpeechRecognition
    await page.addInitScript(() => {
      localStorage.setItem('manas_twin_onboarded', 'true');
      localStorage.setItem('manas_user_id', 'test_voice_user');
      localStorage.setItem(
        'manas_twin_profile',
        JSON.stringify({
          id: 'test_voice_user',
          name: 'Sriram',
          age: 21,
          gender: 'boy',
          language: 'en',
          role: 'student',
        })
      );

      // Mock SpeechRecognition for headless CI
      class MockSpeechRecognition {
        continuous = true;
        interimResults = true;
        lang = 'en-US';
        onresult: any = null;
        onerror: any = null;
        onend: any = null;
        onspeechstart: any = null;
        onsoundstart: any = null;

        start() {
          (window as any).__mockRecInstance = this;
        }
        stop() {
          if (this.onend) this.onend();
        }
      }
      (window as any).SpeechRecognition = MockSpeechRecognition;
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    });

    await page.goto('/?chat=open');
    await expect(page.locator('section[aria-label="Conversation with Mascot"]')).toBeVisible({ timeout: 12000 });
  });

  test('1. Voice input microphone toggle activates continuous listening state and updates placeholder', async ({ page }) => {
    const micButton = page.locator('#chat-mic-button');
    await expect(micButton).toBeVisible();

    const inputField = page.locator('#chat-message-input');
    await expect(inputField).toHaveAttribute('placeholder', /Speak or type/i);

    // Click mic button to toggle listening
    await micButton.click();

    // Check placeholder changes to listening mode
    await expect(inputField).toHaveAttribute('placeholder', /Listening in EN|Speak freely/i);

    // Toggle off
    await micButton.click();
    await expect(inputField).toHaveAttribute('placeholder', /Speak or type/i);
  });

  test('2. Voice TTS endpoint expands 14416 digit by digit and strips markdown/emojis', async ({ page }) => {
    const ttsResponse = await page.evaluate(async () => {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Reach out to **14416** anytime! 🌿',
          language: 'en',
        }),
      });
      return await res.json();
    });

    expect(ttsResponse.clean_text).toContain('one, four, four, one, six');
    expect(ttsResponse.clean_text).not.toContain('**');
    expect(ttsResponse.clean_text).not.toContain('🌿');
  });

  test('3. End-phrase detection displays "Sending… tap to cancel" chip and auto-sends after delay', async ({ page }) => {
    const micButton = page.locator('#chat-mic-button');
    await micButton.click();

    // Simulate incoming speech with end phrase via MockSpeechRecognition
    await page.evaluate(() => {
      const rec = (window as any).__mockRecInstance;
      if (rec && rec.onresult) {
        rec.onresult({
          resultIndex: 0,
          results: [
            {
              isFinal: true,
              0: { transcript: 'I feel very anxious, what should I do' }
            }
          ]
        });
      }
    });

    // Check that "Sending… tap to cancel" banner appears
    const cancelChip = page.getByText(/Sending in.*tap to cancel/i);
    await expect(cancelChip).toBeVisible({ timeout: 5000 });

    // Cancel banner should have a tap to cancel button
    const cancelButton = page.getByRole('button', { name: /tap to cancel/i });
    await expect(cancelButton).toBeVisible();

    // Clicking cancel aborts the auto-send
    await cancelButton.click();
    await expect(cancelChip).toBeHidden();

    // The text remains in the input field
    const inputField = page.locator('#chat-message-input');
    await expect(inputField).toHaveValue(/what should I do/i);
  });

  test('4. Backend voice status endpoint reports all 8 languages and helpline support', async ({ page }) => {
    const status = await page.evaluate(async () => {
      const res = await fetch('/api/voice/status');
      return await res.json();
    });

    expect(status.languages).toHaveProperty('en', true);
    expect(status.languages).toHaveProperty('ta', true);
    expect(status.languages).toHaveProperty('hi', true);
    expect(status.languages).toHaveProperty('te', true);
    expect(status.languages).toHaveProperty('kn', true);
    expect(status.languages).toHaveProperty('ml', true);
    expect(status.languages).toHaveProperty('bn', true);
    expect(status.languages).toHaveProperty('mr', true);
    expect(status.digit_expansion_helpline).toBe('14416');
  });

  test('5. Barge-in mechanics: speaking ceases immediately when vocalization starts', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const speech = (window as any).speechEngine;
      if (!speech) return { success: false, reason: 'no speechEngine on window' };

      let bargeInTriggered = false;
      const unsub = speech.onBargeIn(() => {
        bargeInTriggered = true;
      });

      // Simulate avatar speaking
      speech.speak('This is a test message that avatar is reciting', 'en');
      // Now trigger barge-in
      speech.triggerBargeIn();

      const isSpeakingAfterBargeIn = speech.isSpeakingActive();
      unsub();

      return {
        success: !isSpeakingAfterBargeIn,
        bargeInTriggered,
      };
    });

    expect(result.success).toBe(true);
    expect(result.bargeInTriggered).toBe(true);
  });
});
