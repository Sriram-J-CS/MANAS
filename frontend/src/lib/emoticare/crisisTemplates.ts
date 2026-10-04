/**
 * Pre-approved crisis intervention templates across all 8 supported Indian languages.
 * When safety_flag is triggered, NO LLM FREESTYLE is permitted.
 * Includes official verified Tele-MANAS (14416 / 1800-891-4416) and National Emergency (112) helplines.
 */

import type { SupportedLanguage } from './types';

export interface CrisisTemplate {
  id: string;
  displayText: string;
  speechText: string;
  emergencyNumber: string;
  serviceName: string;
}

export const CRISIS_TEMPLATES: Record<SupportedLanguage, CrisisTemplate[]> = {
  'en-IN': [
    {
      id: 'en_crisis_1',
      displayText: 'I hear how unbearable this pain feels right now, but please know you are not alone. You matter deeply, and immediate caring support is here for you 24/7. Please dial Tele-MANAS at 14416 or call 112 immediately.',
      speechText: 'I hear how unbearable this pain feels right now, but please know you are not alone. You matter deeply, and caring support is here for you right now. Please dial Tele-MANAS at one four four one six or call one one two immediately.',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS Toll-Free National Helpline'
    },
    {
      id: 'en_crisis_2',
      displayText: 'I am right here with you. When thoughts feel too heavy to carry alone, please reach out to someone who can hold space with you. Tele-MANAS is free, confidential, and available right now at 14416.',
      speechText: 'I am right here with you. When thoughts feel too heavy to carry alone, please reach out to someone who can listen with you. Tele-MANAS is free and confidential at one four four one six.',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS 24/7 Support'
    },
    {
      id: 'en_crisis_3',
      displayText: 'Your life has immense value, even when darkness makes it impossible to see. Please pause and connect with trained counselors who genuinely care at Tele-MANAS on 14416 or call 112.',
      speechText: 'Your life has immense value, even when darkness makes it impossible to see. Please pause and connect with trained counselors at Tele-MANAS on one four four one six or call one one two.',
      emergencyNumber: '14416',
      serviceName: 'Kiran / Tele-MANAS Mental Health Support'
    },
    {
      id: 'en_crisis_4',
      displayText: 'You do not have to walk through this storm alone. Please stay safe with me and call Tele-MANAS toll-free at 14416 or call 112. People who care are waiting to speak with you.',
      speechText: 'You do not have to walk through this storm alone. Please stay safe with me and call Tele-MANAS toll-free at one four four one six or call one one two.',
      emergencyNumber: '14416',
      serviceName: 'National Emergency Response'
    }
  ],

  'hi-IN': [
    {
      id: 'hi_crisis_1',
      displayText: 'मुझे महसूस हो रहा है कि आप इस समय बहुत गहरे दर्द में हैं, लेकिन आप बिल्कुल अकेले नहीं हैं। आपकी ज़िंदगी बहुत कीमती है। कृपया तुरंत Tele-MANAS हेल्पलाइन 14416 पर कॉल करें या 112 डायल करें।',
      speechText: 'मुझे महसूस हो रहा है कि आप इस समय बहुत गहरे दर्द में हैं, लेकिन आप बिल्कुल अकेले नहीं हैं। आपकी ज़िंदगी बहुत कीमती है। कृपया तुरंत टेली-मानस हेल्पलाइन एक चार चार एक छह पर कॉल करें या एक एक दो डायल करें।',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS राष्ट्रीय मानसिक स्वास्थ्य हेल्पलाइन'
    },
    {
      id: 'hi_crisis_2',
      displayText: 'मैं आपके साथ हूँ। जब दिल और दिमाग बहुत भारी हो जाए, तो किसी अपने या काउंसलर से बात करना बहुत ज़रूरी है। Tele-MANAS पर 14416 पर बात करें, यह सेवा 24 घंटे बिल्कुल मुफ्त और सुरक्षित है।',
      speechText: 'मैं आपके साथ हूँ। जब दिल और दिमाग बहुत भारी हो जाए, तो बात करना बहुत ज़रूरी है। टेली-मानस पर एक चार चार एक छह पर बात करें, यह सेवा बिल्कुल मुफ्त और सुरक्षित है।',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS 24/7 निःशुल्क सेवा'
    },
    {
      id: 'hi_crisis_3',
      displayText: 'कृपया कोई भी गलत कदम मत उठाइए। यह मुश्किल वक्त बीत जाएगा और सहायता उपलब्ध है। अभी 14416 पर फोन करके सहायता प्राप्त करें या नज़दीकी अस्पताल / 112 से संपर्क करें।',
      speechText: 'कृपया कोई भी गलत कदम मत उठाइए। यह मुश्किल वक्त बीत जाएगा। अभी एक चार चार एक छह पर फोन करके सहायता प्राप्त करें या एक एक दो से संपर्क करें।',
      emergencyNumber: '14416',
      serviceName: 'राष्ट्रीय आपातकालीन सेवा 112'
    }
  ],

  'ta-IN': [
    {
      id: 'ta_crisis_1',
      displayText: 'நீங்கள் அனுபவிக்கும் வலி எவ்வளவு கடுமையானது என்பதை நான் உணர்கிறேன், ஆனால் நீங்கள் ஒருபோதும் தனிமையில் இல்லை. உங்கள் உயிர் மிக மதிப்புமிக்கது. தயவுசெய்து உடனடியாக Tele-MANAS உதவி எண் 14416 அல்லது 112 ஐ அழையுங்கள்.',
      speechText: 'நீங்கள் அனுபவிக்கும் வலி எவ்வளவு கடுமையானது என்பதை நான் உணர்கிறேன், ஆனால் நீங்கள் ஒருபோதும் தனிமையில் இல்லை. உங்கள் உயிர் மிக மதிப்புமிக்கது. தயவுசெய்து உடனடியாக டெலி-மானஸ் உதவி எண் ஒன்று நான்கு நான்கு ஒன்று ஆறு அல்லது ஒன்று ஒன்று இரண்டு ஐ அழையுங்கள்.',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS இலவச 24/7 உதவி மையம்'
    },
    {
      id: 'ta_crisis_2',
      displayText: 'நான் உங்களுடன் இருக்கிறேன். சுமை தாங்க முடியாததாகத் தோன்றும் போது, தயவுசெய்து உதவி கேட்க தயங்காதீர்கள். Tele-MANAS 14416 எண்ணில் உளவியல் ஆலோசகர்கள் உங்களுடன் பேச தயாராக உள்ளனர்.',
      speechText: 'நான் உங்களுடன் இருக்கிறேன். சுமை தாங்க முடியாததாகத் தோன்றும் போது, தயவுசெய்து உதவி கேட்க தயங்காதீர்கள். டெலி-மானஸ் ஒன்று நான்கு நான்கு ஒன்று ஆறு எண்ணில் ஆலோசகர்கள் பேச தயாராக உள்ளனர்.',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS தமிழக அரசு மற்றும் தேசிய உதவி'
    },
    {
      id: 'ta_crisis_3',
      displayText: 'தயவுசெய்து எந்த விபரீத முடிவும் எடுக்காதீர்கள். இந்த இருள் நீங்கி நல்ல விடியல் வரும். உடனே 14416 அல்லது சிநேகா உதவி எண் 044-24640050 அல்லது 112 அழையுங்கள்.',
      speechText: 'தயவுசெய்து எந்த விபரீத முடிவும் எடுக்காதீர்கள். உடனே ஒன்று நான்கு நான்கு ஒன்று ஆறு அல்லது ஒன்று ஒன்று இரண்டு எண்ணை அழையுங்கள்.',
      emergencyNumber: '14416',
      serviceName: 'சினேகா & Tele-MANAS'
    }
  ],

  'te-IN': [
    {
      id: 'te_crisis_1',
      displayText: 'మీరు పడుతున్న బాధ ఎంత తీవ్రమైనదో నేను అర్థం చేసుకోగలను, కానీ మీరు ఒంటరిగా లేరు. మీ ప్రాణం ఎంతో విలువైంది. దయచేసి వెంటనే Tele-MANAS హెల్ప్‌లైన్ 14416 లేదా 112 కు కాల్ చేయండి.',
      speechText: 'మీరు పడుతున్న బాధ ఎంత తీవ్రమైనదో నేను అర్థం చేసుకోగలను, కానీ మీరు ఒంటరిగా లేరు. మీ ప్రాణం ఎంతో విలువైంది. దయచేసి వెంటనే టెలి-మానస్ హెల్ప్‌లైన్ ఒకటి నాలుగు నాలుగు ఒకటి ఆరు లేదా ఒకటి ఒకటి రెండు కు కాల్ చేయండి.',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS జాతీయ హెల్ప్‌లైన్'
    },
    {
      id: 'te_crisis_2',
      displayText: 'నేను మీతోనే ఉన్నాను. సమస్యలు ఎంత భారంగా అనిపించినా ఆందోళన చెందకండి. నిపుణులతో మాట్లాడటానికి 14416 కి కాల్ చేయండి, ఇది 24 గంటలు ఉచితం మరియు గోప్యమైనది.',
      speechText: 'నేను మీతోనే ఉన్నాను. నిపుణులతో మాట్లాడటానికి ఒకటి నాలుగు నాలుగు ఒకటి ఆరు కి కాల్ చేయండి, ఇది ఉచితం మరియు గోప్యమైనది.',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS ఉచిత కౌన్సెలింగ్'
    },
    {
      id: 'te_crisis_3',
      displayText: 'దయచేసి ఎలాంటి తొందరపాటు నిర్ణయం తీసుకోకండి. మీకు అండగా ఉండటానికి మేము ఉన్నాము. వెంటనే 14416 లేదా 112 కు డయల్ చేయండి.',
      speechText: 'దయచేసి ఎలాంటి తొందరపాటు నిర్ణయం తీసుకోకండి. వెంటనే ఒకటి నాలుగు నాలుగు ఒకటి ఆరు లేదా ఒకటి ఒకటి రెండు కు డయల్ చేయండి.',
      emergencyNumber: '14416',
      serviceName: 'ఎమర్జెన్సీ రెస్పాన్స్ 112'
    }
  ],

  'ml-IN': [
    {
      id: 'ml_crisis_1',
      displayText: 'നിങ്ങൾ അനുഭവിക്കുന്ന മാനസിക വിഷമം എനിക്ക് മനസ്സിലാകുന്നുണ്ട്, എന്നാൽ നിങ്ങൾ ഒട്ടും തനിച്ചല്ല. നിങ്ങളുടെ ജീവിതം വളരെ വിലപ്പെട്ടതാണ്. ദയവായി ഉടൻ തന്നെ Tele-MANAS ഹെൽപ്പ് ലൈൻ നമ്പറായ 14416 ലേക്കോ 112 ലേക്കോ വിളിക്കൂ.',
      speechText: 'നിങ്ങൾ അനുഭവിക്കുന്ന മാനസിക വിഷമം എനിക്ക് മനസ്സിലാകുന്നുണ്ട്, എന്നാൽ നിങ്ങൾ ഒട്ടും തനിച്ചല്ല. നിങ്ങളുടെ ജീവിതം വളരെ വിലപ്പെട്ടതാണ്. ദയവായി ഉടൻ തന്നെ ടെലി-മാനസ് ഹെൽപ്പ് ലൈൻ നമ്പറായ ഒന്ന് നാല് നാല് ഒന്ന് ആറ് ലേക്കോ ഒന്ന് ഒന്ന് രണ്ട് ലേക്കോ വിളിക്കൂ.',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS സൗജന്യ ഹെൽപ്പ്‌ലൈൻ'
    },
    {
      id: 'ml_crisis_2',
      displayText: 'ഞാൻ നിങ്ങളുടെ കൂടെയുണ്ട്. വിഷമങ്ങൾ ഒറ്റയ്ക്ക് സഹിക്കാൻ ശ്രമിക്കരുത്. 14416 ലേക്ക് വിളിച്ച് മനസ്സ് തുറന്ന് സംസാരിക്കൂ, ഇത് തികച്ചും സൗജന്യവും രഹസ്യവുമായിരിക്കും.',
      speechText: 'ഞാൻ നിങ്ങളുടെ കൂടെയുണ്ട്. വിഷമങ്ങൾ ഒറ്റയ്ക്ക് സഹിക്കാൻ ശ്രമിക്കരുത്. ഒന്ന് നാല് നാല് ഒന്ന് ആറ് ലേക്ക് വിളിച്ച് മനസ്സ് തുറന്ന് സംസാരിക്കൂ.',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS 24 മണിക്കൂർ സേവനം'
    },
    {
      id: 'ml_crisis_3',
      displayText: 'ദയവായി ഒരു തെറ്റായ തീരുമാനവും എടുക്കരുത്. നിങ്ങളെ സഹായിക്കാൻ കൗൺസിലർമാർ തയ്യാറാണ്. ഇപ്പോൾ തന്നെ 14416 അല്ലെങ്കിൽ ദിശ 1056 വിളിക്കൂ.',
      speechText: 'ദയവായി ഒരു തെറ്റായ തീരുമാനവും എടുക്കരുത്. ഇപ്പോൾ തന്നെ ഒന്ന് നാല് നാല് ഒന്ന് ആറ് അല്ലെങ്കിൽ ഒന്ന് പൂജ്യം അഞ്ച് ആറ് വിളിക്കൂ.',
      emergencyNumber: '14416',
      serviceName: 'ദിശ & Tele-MANAS'
    }
  ],

  'kn-IN': [
    {
      id: 'kn_crisis_1',
      displayText: 'ನೀವು ಅನುಭವಿಸುತ್ತಿರುವ ನೋವು ಎಷ್ಟು ತೀವ್ರವಾಗಿದೆ ಎಂದು ನನಗೆ ಅರ್ಥವಾಗುತ್ತದೆ, ಆದರೆ ನೀವು ಒಬ್ಬಂಟಿಯಾಗಿಲ್ಲ. ನಿಮ್ಮ ಜೀವನ ಅತ್ಯಂತ ಅಮೂಲ್ಯ. ದಯವಿಟ್ಟು ತಕ್ಷಣ Tele-MANAS ಸಹಾಯವಾಣಿ 14416 ಅಥವಾ 112 ಗೆ ಕರೆ ಮಾಡಿ.',
      speechText: 'ನೀವು ಅನುಭವಿಸುತ್ತಿರುವ ನೋವು ಎಷ್ಟು ತೀವ್ರವಾಗಿದೆ ಎಂದು ನನಗೆ ಅರ್ಥವಾಗುತ್ತದೆ, ಆದರೆ ನೀವು ಒಬ್ಬಂಟಿಯಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ತಕ್ಷಣ ಟೆಲಿ-ಮಾನಸ್ ಸಹಾಯವಾಣಿ ಒಂದು ನಾಲ್ಕು ನಾಲ್ಕು ಒಂದು ಆರು ಅಥವಾ ಒಂದು ಒಂದು ಎರಡು ಗೆ ಕರೆ ಮಾಡಿ.',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS ರಾಷ್ಟ್ರೀಯ ಸಹಾಯವಾಣಿ'
    },
    {
      id: 'kn_crisis_2',
      displayText: 'ನಾನು ನಿಮ್ಮ ಜೊತೆಗಿದ್ದೇನೆ. ಸಮಸ್ಯೆಗಳು ಅತಿಯಾದಾಗ ಸಹಾಯ ಕೇಳಲು ಹಿಂಜರಿಯಬೇಡಿ. Tele-MANAS ನ 14416 ಗೆ ಕರೆ ಮಾಡಿ, ಇದು ದಿನದ 24 ಗಂಟೆಯೂ ಸಂಪೂರ್ಣ ಉಚಿತ ಮತ್ತು ಗೌಪ್ಯವಾಗಿದೆ.',
      speechText: 'ನಾನು ನಿಮ್ಮ ಜೊತೆಗಿದ್ದೇನೆ. ಟೆಲಿ-ಮಾನಸ್ ನ ಒಂದು ನಾಲ್ಕು ನಾಲ್ಕು ಒಂದು ಆರು ಗೆ ಕರೆ ಮಾಡಿ, ಇದು ಸಂಪೂರ್ಣ ಉಚಿತ ಮತ್ತು ಗೌಪ್ಯವಾಗಿದೆ.',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS 24/7 ನೆರವು'
    },
    {
      id: 'kn_crisis_3',
      displayText: 'ದಯವಿಟ್ಟು ಯಾವುದೇ ಆತುರದ ನಿರ್ಧಾರ ತೆಗೆದುಕೊಳ್ಳಬೇಡಿ. ಈ ಕಷ್ಟದ ಸಮಯ ಖಂಡಿತ ಬದಲಾಗುತ್ತದೆ. ತಕ್ಷಣ 14416 ಅಥವಾ 112 ಗೆ ಕರೆ ಮಾಡಿ.',
      speechText: 'ದಯವಿಟ್ಟು ಯಾವುದೇ ಆತುರದ ನಿರ್ಧಾರ ತೆಗೆದುಕೊಳ್ಳಬೇಡಿ. ತಕ್ಷಣ ಒಂದು ನಾಲ್ಕು ನಾಲ್ಕು ಒಂದು ಆರು ಅಥವಾ ಒಂದು ಒಂದು ಎರಡು ಗೆ ಕರೆ ಮಾಡಿ.',
      emergencyNumber: '14416',
      serviceName: 'ಆರಕ್ಷಕ ಮತ್ತು ತುರ್ತು ನೆರವು 112'
    }
  ],

  'bn-IN': [
    {
      id: 'bn_crisis_1',
      displayText: 'আমি বুঝতে পারছি আপনি কতটা কষ্টের মধ্যে দিয়ে যাচ্ছেন, কিন্তু আপনি একা নন। আপনার জীবন অত্যন্ত মূল্যবান। অনুগ্রহ করে এখনই Tele-MANAS হেল্পলাইন 14416 বা 112 নম্বরে কল করুন।',
      speechText: 'আমি বুঝতে পারছি আপনি কতটা কষ্টের মধ্যে দিয়ে যাচ্ছেন, কিন্তু আপনি একা নন। আপনার জীবন অত্যন্ত মূল্যবান। অনুগ্রহ করে এখনই টেলি-মানস হেল্পলাইন এক চার চার এক ছয় বা এক এক দুই নম্বরে কল করুন।',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS জাতীয় হেল্পলাইন'
    },
    {
      id: 'bn_crisis_2',
      displayText: 'আমি আপনার পাশেই আছি। যখন একা সবটা সহ্য করা অসম্ভব মনে হয়, তখন কথা বলা দরকার। 14416 নম্বরে অভিজ্ঞ কাউন্সেলরদের সাথে কথা বলুন, এটি ২৪ ঘণ্টা সম্পূর্ণ বিনামূল্যে পাওয়া যায়।',
      speechText: 'আমি আপনার পাশেই আছি। এক চার চার এক ছয় নম্বরে কাউন্সেলরদের সাথে কথা বলুন, এটি সম্পূর্ণ বিনামূল্যে পাওয়া যায়।',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS ২৪ ঘণ্টা সেবা'
    },
    {
      id: 'bn_crisis_3',
      displayText: 'দয়া করে কোনো চরম সিদ্ধান্ত নেবেন না। সাহায্য সব সময় আছে। এখনই 14416 বা 112 নম্বরে ডায়াল করে কথা বলুন।',
      speechText: 'দয়া করে কোনো চরম সিদ্ধান্ত নেবেন না। এখনই এক চার চার এক ছয় বা এক এক দুই নম্বরে ডায়াল করে কথা বলুন।',
      emergencyNumber: '14416',
      serviceName: 'জরুরি সেবা 112'
    }
  ],

  'mr-IN': [
    {
      id: 'mr_crisis_1',
      displayText: 'तुम्ही किती मोठ्या वेदनेतून जात आहात हे मी समजू शकतो, पण तुम्ही एकटे नाही आहात. तुमचं आयुष्य अनमोल आहे. कृपया लगेच Tele-MANAS हेल्पलाइन 14416 किंवा 112 वर संपर्क साधा.',
      speechText: 'तुम्ही किती मोठ्या वेदनेतून जात आहात हे मी समजू शकतो, पण तुम्ही एकटे नाही आहात. तुमचं आयुष्य अनमोल आहे. कृपया लगेच टेली-मानस हेल्पलाइन एक चार चार एक सहा किंवा एक एक दोन वर संपर्क साधा.',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS राष्ट्रीय हेल्पलाइन'
    },
    {
      id: 'mr_crisis_2',
      displayText: 'मी तुमच्या सोबत आहे. जेव्हा त्रास खूप जास्त वाटतो, तेव्हा मदत मागणे गरजेचे आहे. Tele-MANAS 14416 वर बोला, ही सेवा २४ तास मोफत आणि पूर्णपणे गोपनीय आहे.',
      speechText: 'मी तुमच्या सोबत आहे. टेली-मानस एक चार चार एक सहा वर बोला, ही सेवा मोफत आणि गोपनीय आहे.',
      emergencyNumber: '14416',
      serviceName: 'Tele-MANAS २४/७ मोफत समुपदेशन'
    },
    {
      id: 'mr_crisis_3',
      displayText: 'कृपया कोणताही टोकाचा निर्णय घेऊ नका. हे कठीण दिवस नक्की बदलतील. लगेच 14416 किंवा 112 वर फोन करा.',
      speechText: 'कृपया कोणताही टोकाचा निर्णय घेऊ नका. लगेच एक चार चार एक सहा किंवा एक एक दोन वर फोन करा.',
      emergencyNumber: '14416',
      serviceName: 'आपत्कालीन प्रतिसाद 112'
    }
  ]
};

export function getCrisisTemplate(language: SupportedLanguage, seedIndex: number = 0): CrisisTemplate {
  const templates = CRISIS_TEMPLATES[language] || CRISIS_TEMPLATES['en-IN'];
  const index = Math.abs(seedIndex) % templates.length;
  return templates[index];
}
