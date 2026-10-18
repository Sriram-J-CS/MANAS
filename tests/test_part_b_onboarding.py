import pytest
import re
from pathlib import Path

def test_onboarding_modal_removes_contact_step_when_signed_in():
    file_path = Path("frontend/src/components/OnboardingModal.tsx")
    assert file_path.exists(), "OnboardingModal.tsx must exist"
    content = file_path.read_text(encoding="utf-8")

    # 1. Total steps check
    assert "const totalSteps = isSignedIn ? 5 : 6;" in content

    # 2. Step counter check
    assert "STEP 0{step} / 0{totalSteps}" in content

    # 3. Progress bar uses totalSteps
    assert "((step - 1) / totalSteps) * 100" in content
    assert "(step / totalSteps) * 100" in content

    # 4. Contact step conditionally rendered only when !isSignedIn
    assert "!isSignedIn && step === 4" in content

    # 5. Photo step rendered on step 4 for signed in, step 5 for non-signed-in
    assert "((!isSignedIn && step === 5) || (isSignedIn && step === 4))" in content

    # 6. Voice step rendered on step 5 for signed in, step 6 for non-signed-in
    assert "((!isSignedIn && step === 6) || (isSignedIn && step === 5))" in content

    # 7. Verified phone/email extracted from session and saved in profile
    assert "finalPhone" in content
    assert "finalEmail" in content
    assert "sessionUser?.phone" in content
    assert "sessionUser?.email" in content

    # 8. Skip for now handles signed in transitions (1->2->3->4[photo]->5[voice]->finish)
    assert "if (isSignedIn) {" in content

if __name__ == "__main__":
    test_onboarding_modal_removes_contact_step_when_signed_in()
    print("ALL PART B TESTS PASSED")
