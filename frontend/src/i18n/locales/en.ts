import type { LocaleContent } from '../types';

export const enLocale: LocaleContent = {
  common: {
    back: 'Back',
    next: 'Next',
    skip: 'Skip for now',
    continue: 'Continue',
    complete: 'Enter Chat with MANAS',
    deleteData: 'Delete My Data',
    cancel: 'Cancel',
    confirm: 'Confirm',
    loading: 'Loading...',
    verified: 'Verified',
    error: 'An error occurred'
  },
  steps: {
    name: {
      title: 'What should we call you?',
      subtitle: 'A first name, a comforting nickname, or an alias you feel safe with.',
      mascotGuide: 'Hello! I am MANAS. What should I call you as we begin our journey together?',
      placeholder: 'Enter your preferred name...',
      helpText: 'You do not need to use your legal name. Pick whatever feels comfortable.'
    },
    age: {
      title: 'How old are you?',
      subtitle: 'Helps us tailor our vocabulary, coping strategies, and safety protocols.',
      mascotGuide: 'Sharing your age helps me understand your world and ensures your safety.',
      minorSafeActive: 'Minor-Safe Mode Active',
      minorSafeDesc: 'Because you are under 18, we activate additional privacy safeguards and prioritize teen emergency support.',
      guardianConsentCheckbox: 'I confirm that a parent or legal guardian has permitted me to use MANAS.',
      guardianConsentRequired: 'Guardian consent is required for users under 18.',
      ageHelperText: 'Ages under 18 automatically activate minor protections.'
    },
    language: {
      title: 'Choose your preferred language',
      subtitle: 'Speak in your mother tongue or switch between languages whenever you wish.',
      mascotGuide: 'Which language feels most comforting to you? I speak all 8 major Indian languages.'
    },
    contact: {
      title: 'Contact & Safety Verification',
      subtitle: 'Encrypted with AES-256-GCM. Used strictly for safety follow-up and emergency care.',
      mascotGuide: 'Your contact details are encrypted and kept safe. They are never sent to conversational AI.',
      emailLabel: 'Email Address',
      phoneLabel: 'Mobile Phone (+91)',
      consentCheckbox: 'I consent to the secure, encrypted storage of my contact details for safety check-ins and emergency helpline referrals.',
      consentDetails: 'Under the DPDP Act 2023, your data is AES-256-GCM encrypted server-side with zero plaintext access. You can permanently delete your data at any time.',
      sendOtp: 'Send Verification OTP',
      resendOtp: 'Resend Code',
      otpPlaceholder: 'Enter 6-digit OTP',
      verifyOtp: 'Verify Code',
      otpVerifiedSuccess: 'Contact verified successfully!',
      encryptionNotice: 'AES-256-GCM Server-side Keyed Encryption with HMAC-SHA256 indexing',
      neverSentToLlm: 'Guaranteed: Contact info and original media are strictly isolated from the AI chat model.'
    },
    photo: {
      title: 'Choose Your Visual Companion (Optional)',
      subtitle: 'Upload a picture, capture a photo, or choose an avatar.',
      mascotGuide: 'Would you like to personalize your avatar? You can upload a photo or skip this step.',
      uploadButton: 'Upload Image',
      cameraButton: 'Open Camera',
      takePhoto: 'Take Photo',
      retake: 'Retake',
      clientSideNotice: 'Client-side only: Photos are kept strictly in your local browser and never sent to external LLMs.',
      skipNotice: 'You can skip this step anytime and use our default soothing avatar.'
    },
    voice: {
      title: 'Voice & Audio Setup (Optional)',
      subtitle: 'Test your microphone and pick a soothing voice for audio narration.',
      mascotGuide: 'Let us make sure we can talk comfortably. Test your mic and pick a voice you find relaxing.',
      micTestButton: 'Test Microphone',
      micTesting: 'Listening for audio...',
      micGranted: 'Microphone Connected & Verified!',
      voiceSelectLabel: 'Companion Voice Timbre',
      playPreview: 'Listen to Voice Sample',
      finishButton: 'Complete Setup & Enter Chat'
    }
  },
  crisis: {
    teleManasLabel: 'Tele-MANAS National Helpline',
    teleManasNumber: '14416',
    teleManasDesc: '24/7 Free, confidential government tele-mental health support across 20+ Indian languages (Toll-Free: 1800-891-4416).',
    emergencyLabel: 'National Emergency Services',
    emergencyNumber: '112',
    childlineLabel: 'Childline India (Under 18)',
    childlineNumber: '1098',
    childlineDesc: '24/7 Dedicated toll-free emergency helpline for children and adolescents.',
    crisisWarning: 'If you are experiencing severe distress or thoughts of self-harm, please connect with a live counselor immediately.'
  },
  exercises: {
    boxBreathing: {
      title: 'Box Breathing (Sama Vritti)',
      description: 'A scientifically validated calming practice to regulate the autonomic nervous system.',
      steps: [
        'Inhale slowly through your nose for 4 seconds.',
        'Hold your breath gently for 4 seconds.',
        'Exhale smoothly through your mouth for 4 seconds.',
        'Pause and hold empty for 4 seconds.',
        'Repeat this cycle 4 times.'
      ]
    },
    grounding54321: {
      title: '5-4-3-2-1 Sensory Grounding',
      description: 'Reconnect with your physical surroundings during moments of anxiety or overwhelm.',
      steps: [
        'Acknowledge 5 things you can see around you.',
        'Acknowledge 4 things you can physically touch or feel.',
        'Acknowledge 3 things you can hear right now.',
        'Acknowledge 2 things you can smell.',
        'Acknowledge 1 thing you can taste or one deep mindful breath.'
      ]
    },
    progressiveRelaxation: {
      title: 'Progressive Muscle Relaxation',
      description: 'Systematically release physical tension stored in the body from stress.',
      steps: [
        'Tense the muscles in your toes and feet tightly for 5 seconds.',
        'Release suddenly and notice the sensation of warm relaxation.',
        'Move upwards to your calves, thighs, stomach, shoulders, and jaw.',
        'Finish with a long, unhurried exhale.'
      ]
    }
  },
  glossary: [
    {
      term: 'Anxiety',
      translation: 'Anxiety',
      definition: 'A state of persistent apprehension, worry, or physical restlessness about uncertain future events.',
      vernacularContext: 'Often described as racing thoughts, chest tightness, or anticipation of disaster.'
    },
    {
      term: 'Depression',
      translation: 'Depression',
      definition: 'A persistent feeling of sadness, emptiness, loss of interest, and decreased energy affecting daily life.',
      vernacularContext: 'Felt as emotional numbness, fatigue, and heaviness where even simple tasks feel overwhelming.'
    },
    {
      term: 'Overwhelm',
      translation: 'Overwhelm',
      definition: 'The cognitive and emotional state of feeling buried under more demands than one can process.',
      vernacularContext: 'Common during academic exam seasons, family conflict, or workplace burnout.'
    },
    {
      term: 'Coping Mechanism',
      translation: 'Coping Mechanism',
      definition: 'Adaptive cognitive or behavioral techniques used to navigate stress, grief, or emotional turmoil.',
      vernacularContext: 'Practices like deep breathing, journaling, grounding, or talking with trusted allies.'
    },
    {
      term: 'Cognitive Reframing',
      translation: 'Cognitive Reframing',
      definition: 'A core CBT practice of identifying distorted thought patterns and viewing situations from a balanced perspective.',
      vernacularContext: 'Shifting from "I failed this exam, my life is over" to "I struggled on this test, but it does not define my future."'
    }
  ],
  chatExamples: [
    {
      userMessage: 'I feel like a complete failure because I did not clear the cutoff marks.',
      recommendedReply: 'I hear how painful this cutoff result is, especially after putting so much of your energy into preparing. It is completely natural to feel crushed right now. But falling short of a test score does not make you a failure as a human being. Would you like to untangle what feels heaviest right now, or take things one quiet step at a time?',
      strategyUsed: 'validate_and_reframe'
    },
    {
      userMessage: 'Can you give me 3 practical things I can do tonight to manage my sleep schedule?',
      recommendedReply: 'Here are 3 concrete, gentle adjustments for tonight: 1) Dim bright lights and place your phone outside arm reach 30 minutes before bed. 2) Write down tomorrow morning top two tasks on paper so your mind does not hold onto them. 3) Keep your room slightly cooler and take 5 slow, unforced belly breaths in bed.',
      strategyUsed: 'small_action_step'
    },
    {
      userMessage: 'Everything feels completely meaningless and I feel like disappearing.',
      recommendedReply: 'I hear how unbearable this weight is right now, and I care deeply about your safety. You do not have to carry this alone. Please reach out right now to Tele-MANAS at 14416 (toll-free 24/7) or call 112. There are compassionate counselors ready to listen and support you through tonight.',
      strategyUsed: 'crisis_intervention'
    }
  ]
};
