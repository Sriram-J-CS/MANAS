export type SupportedLanguage = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml' | 'bn' | 'mr';

export interface LanguageInfo {
  code: SupportedLanguage;
  nativeName: string;
  englishName: string;
  description: string;
  speechVoiceLang: string;
}

export interface MentalHealthGlossaryTerm {
  term: string;
  translation: string;
  definition: string;
  vernacularContext: string;
}

export interface ChatPromptExample {
  userMessage: string;
  recommendedReply: string;
  strategyUsed: string;
}

export interface ExerciseGuide {
  title: string;
  description: string;
  steps: string[];
}

export interface LocaleContent {
  common: {
    back: string;
    next: string;
    skip: string;
    continue: string;
    complete: string;
    deleteData: string;
    cancel: string;
    confirm: string;
    loading: string;
    verified: string;
    error: string;
  };
  steps: {
    name: {
      title: string;
      subtitle: string;
      mascotGuide: string;
      placeholder: string;
      helpText: string;
    };
    age: {
      title: string;
      subtitle: string;
      mascotGuide: string;
      minorSafeActive: string;
      minorSafeDesc: string;
      guardianConsentCheckbox: string;
      guardianConsentRequired: string;
      ageHelperText: string;
    };
    language: {
      title: string;
      subtitle: string;
      mascotGuide: string;
    };
    contact: {
      title: string;
      subtitle: string;
      mascotGuide: string;
      emailLabel: string;
      phoneLabel: string;
      consentCheckbox: string;
      consentDetails: string;
      sendOtp: string;
      resendOtp: string;
      otpPlaceholder: string;
      verifyOtp: string;
      otpVerifiedSuccess: string;
      encryptionNotice: string;
      neverSentToLlm: string;
    };
    photo: {
      title: string;
      subtitle: string;
      mascotGuide: string;
      uploadButton: string;
      cameraButton: string;
      takePhoto: string;
      retake: string;
      clientSideNotice: string;
      skipNotice: string;
    };
    voice: {
      title: string;
      subtitle: string;
      mascotGuide: string;
      micTestButton: string;
      micTesting: string;
      micGranted: string;
      voiceSelectLabel: string;
      playPreview: string;
      finishButton: string;
    };
  };
  crisis: {
    teleManasLabel: string;
    teleManasNumber: string;
    teleManasDesc: string;
    emergencyLabel: string;
    emergencyNumber: string;
    childlineLabel: string;
    childlineNumber: string;
    childlineDesc: string;
    crisisWarning: string;
  };
  exercises: {
    boxBreathing: ExerciseGuide;
    grounding54321: ExerciseGuide;
    progressiveRelaxation: ExerciseGuide;
  };
  glossary: MentalHealthGlossaryTerm[];
  chatExamples: ChatPromptExample[];
}
