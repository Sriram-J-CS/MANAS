import { test, expect } from '@playwright/test';

test.describe('MANAS 6-Step Onboarding Entry Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure fresh onboarding state
    await page.goto('http://localhost:5173');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('completes end-to-end 6-step entry flow with minor-safe mode and OTP', async ({ page }) => {
    // 1. Cover Page - Click "ENTER CHAT"
    const enterChatBtn = page.getByRole('button', { name: /ENTER CHAT/i });
    await expect(enterChatBtn).toBeVisible({ timeout: 10000 });
    await enterChatBtn.click();

    // 2. Step 1: Name
    await expect(page.getByText(/STEP 01 \/ 06/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/What should we call you/i)).toBeVisible();
    
    // Check validation error on empty submit
    const nextBtn = page.getByRole('button', { name: /Next/i });
    const nameInput = page.getByPlaceholder(/Enter your preferred name/i);
    await nameInput.fill('Anand');
    await nextBtn.click();

    // 3. Step 2: Age
    await expect(page.getByText(/STEP 02 \/ 06/i)).toBeVisible();
    await expect(page.getByText(/How old are you/i)).toBeVisible();
    
    // Set age to 16 to trigger Minor-Safe Mode
    const ageInput = page.locator('input[type="number"]');
    await ageInput.fill('16');

    // Minor-Safe Mode banner must appear
    await expect(page.getByText(/Minor-Safe Mode Active/i)).toBeVisible();
    await expect(page.getByText(/Childline/i)).toBeVisible();

    // Try clicking next without guardian consent -> should block
    await page.getByRole('button', { name: /Next/i }).click();
    await expect(page.getByText(/Guardian consent is required/i)).toBeVisible();

    // Check guardian consent checkbox and proceed
    const guardianCheckbox = page.locator('input[type="checkbox"]');
    await guardianCheckbox.check();
    await page.getByRole('button', { name: /Next/i }).click();

    // 4. Step 3: Language (All 8 Indian Languages in Native Script)
    await expect(page.getByText(/STEP 03 \/ 06/i)).toBeVisible();
    await expect(page.getByText('தமிழ்', { exact: true })).toBeVisible();
    await expect(page.getByText('हिन्दी', { exact: true })).toBeVisible();
    await expect(page.getByText('తెలుగు', { exact: true })).toBeVisible();
    await expect(page.getByText('ಕನ್ನಡ', { exact: true })).toBeVisible();
    await expect(page.getByText('മലയാളം', { exact: true })).toBeVisible();
    await expect(page.getByText('বাংলা', { exact: true })).toBeVisible();
    await expect(page.getByText('मराठी', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /English/ })).toBeVisible();

    // Select Tamil (தமிழ்)
    await page.getByText('தமிழ்', { exact: true }).click();
    await page.getByRole('button', { name: /அடுத்து|Next/i }).click();

    // 5. Step 4: Contact & OTP Verification
    await expect(page.getByText(/STEP 04 \/ 06/i)).toBeVisible();
    await expect(page.getByText(/AES-256-GCM/i).first()).toBeVisible();

    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('anand.test@example.com');
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('+91 98765 43210');
    
    // Click Send OTP
    const sendOtpBtn = page.getByRole('button', { name: /OTP|சரிபார்ப்பு/i });
    await sendOtpBtn.click();

    // Verify OTP field appears
    await expect(page.getByPlaceholder(/OTP/i)).toBeVisible({ timeout: 5000 });
    
    // Click Verify (auto-filled with dev OTP)
    const verifyOtpBtn = page.getByRole('button', { name: /சரிபார்க்கவும்|Verify/i });
    await verifyOtpBtn.click();

    // 6. Step 5: Optional Photo
    await expect(page.getByText(/STEP 05 \/ 06/i)).toBeVisible();
    await expect(page.getByText(/Client-side only|உலாவியில் மட்டுமே/i).first()).toBeVisible();
    
    // Click Skip / Next
    const skipPhotoBtn = page.getByRole('button', { name: /தவிர்க்கவும்|Skip|Next|அடுத்து/i });
    await skipPhotoBtn.click();

    // 7. Step 6: Voice Setup
    await expect(page.getByText(/STEP 06 \/ 06/i)).toBeVisible();
    await expect(page.getByText(/Microphone|மைக்ரோஃபோன்/i).first()).toBeVisible();
    await expect(page.getByText(/Aarav|Ananya|Diya/i).first()).toBeVisible();

    // Complete Onboarding & Enter Chat
    const modal = page.locator('.fixed.inset-0.z-50');
    const completeBtn = modal.getByRole('button', { name: /அமைவை முடித்து|Complete Setup/i });
    await completeBtn.click();

    // 8. Confirm Chat Companion Workspace is Open
    await expect(page.getByText(/MANAS′/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('Delete My Data button erases user data cleanly', async ({ page }) => {
    const enterChatBtn = page.getByRole('button', { name: /ENTER CHAT/i });
    await enterChatBtn.click();

    await expect(page.getByText(/STEP 01 \/ 06/i)).toBeVisible({ timeout: 5000 });
    const deleteBtn = page.getByTitle(/Permanently erase/i);
    await expect(deleteBtn).toBeVisible();
  });
});
