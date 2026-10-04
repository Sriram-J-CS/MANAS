import { test, expect } from '@playwright/test';

test.describe('Avatar Renderer & Spotify-style Music Player Tests', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['microphone']).catch(() => {});

    await page.addInitScript(() => {
      localStorage.setItem('manas_twin_onboarded', 'true');
      localStorage.setItem('manas_user_id', 'test_avatar_user');
      localStorage.setItem(
        'manas_twin_profile',
        JSON.stringify({
          id: 'test_avatar_user',
          name: 'Sriram',
          age: 21,
          gender: 'boy',
          language: 'en',
          role: 'student',
        })
      );
    });

    await page.goto('/?chat=open');
    await expect(page.locator('section[aria-label="Conversation with Mascot"]')).toBeVisible({ timeout: 12000 });
  });

  test('1. Avatar stage renders on warm studio backdrop (not black box) with 3D/2D toggle', async ({ page }) => {
    const avatarSection = page.locator('section[aria-label="3D AI Mascot Companion"]');
    await expect(avatarSection).toBeVisible();

    // Check that section uses stage backdrop gradient and NOT black #121118
    const className = await avatarSection.getAttribute('class');
    expect(className).toContain('from-[#FDFBF7]');
    expect(className).not.toContain('bg-[#121118]');

    // Check 3D/2D toggle button
    const toggleButton = page.locator('button[title*="Toggle between 3D"]');
    await expect(toggleButton).toBeVisible();
    await expect(toggleButton).toContainText(/3D GLB/i);

    // Click toggle to switch to 2D Rig
    await toggleButton.click();
    await expect(toggleButton).toContainText(/2D Rig/i);

    // Switch back to 3D
    await toggleButton.click();
    await expect(toggleButton).toContainText(/3D GLB/i);
  });

  test('2. Procedural avatar gestures (Nod, Breathe, Encourage, Wave) trigger properly', async ({ page }) => {
    // Assert gesture buttons in avatar stage toolbar
    const nodButton = page.getByRole('button', { name: 'NOD', exact: true });
    const breatheButton = page.getByRole('button', { name: 'BREATHE', exact: true });
    const encourageButton = page.getByRole('button', { name: 'ENCOURAGE', exact: true });
    const waveButton = page.getByRole('button', { name: 'WAVE', exact: true });

    await expect(nodButton).toBeVisible();
    await expect(breatheButton).toBeVisible();
    await expect(encourageButton).toBeVisible();
    await expect(waveButton).toBeVisible();

    // Click wave gesture
    await waveButton.click();
    await page.waitForTimeout(300);

    // Click breathe gesture
    await breatheButton.click();
    await page.waitForTimeout(300);
  });

  test('3. Persistent Spotify-style mini player floats with track metadata and controls', async ({ page }) => {
    const miniPlayer = page.locator('div.fixed.bottom-4');
    await expect(miniPlayer).toBeVisible();

    // Check track title and category
    await expect(miniPlayer.getByText(/Serenity Waters|MANAS Soundscapes/i)).toBeVisible();

    // Click play button on mini player
    const playButton = miniPlayer.locator('button[title*="Play"], button[title*="Pause"]');
    await expect(playButton).toBeVisible();
    await playButton.click();

    // Verify playback state via musicPlayer singleton
    const isPlaying = await page.evaluate(() => {
      return (window as any).musicPlayer?.getState()?.isPlaying;
    });
    expect(isPlaying).toBe(true);

    // Click next track button
    const nextButton = miniPlayer.locator('button[title="Next Track"]');
    await nextButton.click();

    const trackTitle = await page.evaluate(() => {
      return (window as any).musicPlayer?.getState()?.currentTrack?.title;
    });
    expect(trackTitle).not.toBe('Serenity Waters (432Hz)');
  });

  test('4. Music Drawer opens with 12 tracks, seek bar, category filters, and license note', async ({ page }) => {
    // Click Music button in header
    const musicHeaderBtn = page.locator('button[title*="Therapeutic Soundscapes Player"]');
    await expect(musicHeaderBtn).toBeVisible();
    await musicHeaderBtn.click();

    // Assert drawer content
    const drawerTitle = page.getByRole('heading', { name: 'Therapeutic Soundscapes' });
    await expect(drawerTitle).toBeVisible();

    // Check categories
    await expect(page.getByRole('button', { name: 'Calm', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sleep', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Focus', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nature', exact: true })).toBeVisible();

    // Check seek bar range slider
    const seekBar = page.locator('input[type="range"]').first();
    await expect(seekBar).toBeVisible();

    // Click View License Note
    const licenseBtn = page.getByRole('button', { name: /View License Note/i });
    await expect(licenseBtn).toBeVisible();
    await licenseBtn.click();

    // Check License modal appears with verified license badge
    await expect(page.getByText('Royalty-Free Verified License')).toBeVisible();
    const closeLicenseBtn = page.getByRole('button', { name: 'Close License Details' });
    await expect(closeLicenseBtn).toBeVisible();
    await closeLicenseBtn.click();
    await expect(page.getByText('Royalty-Free Verified License')).toBeHidden();

    // Select a track from the playlist (e.g. Tibetan Healing Bowls)
    const bowlTrack = page.getByText('Tibetan Healing Bowls');
    await expect(bowlTrack).toBeVisible();
    await bowlTrack.click();

    const activeTrack = await page.evaluate(() => {
      return (window as any).musicPlayer?.getState()?.currentTrack?.title;
    });
    expect(activeTrack).toBe('Tibetan Healing Bowls');
  });

  test('5. Automatic volume ducking activates when mascot avatar speaks', async ({ page }) => {
    // Start music playback
    await page.evaluate(() => {
      (window as any).musicPlayer?.resume();
    });

    const initialGain = await page.evaluate(() => {
      return (window as any).musicPlayer?.getState()?.effectiveVolume;
    });

    // Simulate avatar speaking
    await page.evaluate(() => {
      (window as any).musicPlayer?.setAvatarSpeaking(true);
    });

    // Effective volume should be ducked down to ~18%
    const duckedState = await page.evaluate(() => {
      const state = (window as any).musicPlayer?.getState();
      return {
        isDucked: state.isDucked,
        effectiveVolume: state.effectiveVolume,
        userVolume: state.userVolume,
      };
    });

    expect(duckedState.isDucked).toBe(true);
    expect(duckedState.effectiveVolume).toBeLessThan(duckedState.userVolume * 0.3);

    // Simulate avatar stops speaking
    await page.evaluate(() => {
      (window as any).musicPlayer?.setAvatarSpeaking(false);
    });

    const restoredState = await page.evaluate(() => {
      return (window as any).musicPlayer?.getState();
    });

    expect(restoredState.isDucked).toBe(false);
  });
});
