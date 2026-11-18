const SUPPORTED_LOCALES = ["en", "hi", "es", "fr", "ar"];

const LANGUAGE_NAMES = {
  en: "English",
  hi: "हिन्दी",
  es: "Español",
  fr: "Français",
  ar: "العربية",
};

const MESSAGES = {
  en: {
    greeting:
      "Hello{name}! I'm the MediQueue assistant. I can help with appointments, live queue status, clinic information and visit preparation. What would you like to do?",
    help:
      "I can help you:\n• Book, reschedule or cancel an appointment\n• Check your live token and wait time\n• Join the walk-in queue remotely\n• Answer clinic questions (hours, fees, insurance, directions)\n• Prepare for your visit or complete a pre-visit intake\n• Connect you with a receptionist\n\nWhat would you like to do?",
    fallback:
      "I'm not sure I understood that. Could you rephrase it? You can also say “help” to see what I can do.",
    authRequired:
      "I can share or change personal and medical information only after you sign in. Please sign in, then come back and I'll help right away.",
    authRequiredShort:
      "Please sign in first so I can access your appointments or queue securely.",
    disclaimer:
      "This assistant gives general information only. It is not a substitute for a doctor's advice, diagnosis or treatment.",
    emergency:
      "This may be a medical emergency. Please call 112 or your local emergency number now, or go to the nearest emergency department. Do not wait for an appointment. I cannot provide emergency care through chat.",
    consentAsk:
      "Before we discuss symptoms, I need your consent to store this information securely so clinic staff can help you. Do you consent?",
    consentDeclined:
      "No problem. I won't store symptom details. You can still ask about clinic hours, fees, doctors or appointments.",
    consentThanks: "Thank you. Your consent is recorded. You can ask me to delete your chat data at any time from your profile.",
    notAvailable:
      "I don't have that information in MediQueue's clinic data, so I won't guess. Please contact reception on +1 555 0100 or ask to speak with a team member.",
    thanks: "You're welcome. Is there anything else I can help with?",
    bye: "Take care. You can reopen this chat any time you need help.",
    restart: "Okay, let's start again. What would you like to do?",
    languagePrompt: "Which language would you prefer? English, हिन्दी, Español, Français or العربية.",
    languageChanged: "Great — I'll continue in {language}.",
    handoffRequested:
      "I've sent this conversation to our reception team with the context so far. Someone will reply here as soon as they can. You can keep typing in the meantime.",
    handoffAlready:
      "A team member has already been asked to join. They can see the conversation context and will reply here.",
    handoffUnavailable:
      "I couldn't reach the reception team just now. Please call +1 555 0100 or try again in a few minutes.",
    feedbackThanks: "Thanks for the feedback — it helps us improve.",
    errorGeneric:
      "Sorry, something went wrong on my side. Please try again, or ask to speak with a receptionist.",
    selectNumber: "Please reply with the number of your choice.",
    noInput: "Please type a message so I can help.",
    tooLong: "That message is too long. Please keep it under 1,500 characters.",
    sessionRateLimited:
      "We've exchanged a lot of messages. To protect the service, please wait a few minutes or ask for a receptionist.",
    confirmYes: "Yes, confirm",
    confirmNo: "No, cancel",
    sugBook: "Book an appointment",
    sugQueue: "My queue status",
    sugWalkin: "Join walk-in queue",
    sugFaq: "Clinic information",
    sugHours: "Clinic hours",
    sugDoctors: "Find a doctor",
    sugHandoff: "Talk to a person",
    sugMyAppointments: "My appointments",
    sugIntake: "Pre-visit intake",
    sugLanguage: "Change language",
    sugYes: "Yes",
    sugNo: "No",
    sugChange: "Change details",
    sugRestart: "Start over",
    sugSignIn: "Sign in",
    bookAskDepartment:
      "Let's book an appointment. Which department would you like? You can reply with a name, or say “help me choose”.",
    bookAskDoctor:
      "Which doctor would you like in {department}? Reply with a number.",
    bookAskDate:
      "Which date works for you? You can say “today”, “tomorrow”, a weekday, or type a date like 2026-11-05.",
    bookAskSlot:
      "These times are available on {date} with {doctor}. Reply with a number.",
    bookAskPriority:
      "Is this visit for a senior citizen, someone who is pregnant, or a standard visit?",
    bookAskReason:
      "Briefly, what is the reason for your visit? For example: “recurring headaches for a week”.",
    bookSummary:
      "Please check your booking:\n\n• Doctor: {doctor}\n• Department: {department}\n• Date: {date}\n• Time: {time}\n• Priority: {priority}\n• Reason: {reason}\n\nShall I confirm this appointment?",
    bookConfirm: "Please reply “yes” to confirm or “no” to cancel.",
    bookConfirmed:
      "Your appointment is confirmed.\n\n• {doctor} ({department})\n• {date} at {time}\n• Booking reference: {id}\n\nA confirmation notification has been sent. Please arrive 15 minutes early and bring a photo ID.",
    bookNoDoctors:
      "I couldn't find an available doctor in that department. Would you like to try another department?",
    bookNoSlots:
      "There are no open slots for that date. Would you like to try another date?",
    bookInvalidDate:
      "I couldn't read that date. Please use a date like 2026-11-05, or say “today” or “tomorrow”.",
    bookInvalidChoice: "That choice wasn't on the list. Please reply with one of the numbers shown.",
    bookInvalidSlot:
      "That time isn't available. Please pick one of the times listed, or say “change date”.",
    bookFailed:
      "I couldn't complete the booking: {error}. Nothing has been charged. Would you like to try again?",
    bookChange:
      "Of course. You can say “change doctor”, “change date”, “change time” or “change reason”.",
    bookCancelled: "Okay, I've cancelled this booking request. Nothing was saved.",
    priorityNormal: "Standard visit",
    prioritySenior: "Senior citizen",
    priorityPregnant: "Pregnant",
    priorityEmergency: "Emergency (staff review required)",
    rescheduleNoAppointments:
      "I couldn't find an upcoming appointment to reschedule. You can book a new appointment instead.",
    rescheduleChoose:
      "Which appointment would you like to move? Reply with a number.",
    rescheduleAskDate:
      "What new date would you like for your appointment with {doctor}?",
    rescheduleAskSlot:
      "These times are available with {doctor} on {date}. Reply with a number.",
    rescheduleSummary:
      "Please confirm the new appointment details:\n\n• Doctor: {doctor}\n• From: {oldDate} at {oldTime}\n• To: {date} at {time}\n\nShall I reschedule it?",
    rescheduleConfirm: "Please reply “yes” to reschedule or “no” to keep the current appointment.",
    rescheduled:
      "Your appointment has been moved to {date} at {time} with {doctor}. A notification has been sent.",
    rescheduleFailed: "I couldn't reschedule this appointment: {error}.",
    cancelChoose: "Which appointment would you like to cancel? Reply with a number.",
    cancelSummary:
      "Please confirm: cancel your appointment with {doctor} on {date} at {time}?\n\nThis cannot be undone from chat.",
    cancelConfirm: "Please reply “yes” to cancel or “no” to keep it.",
    cancelled: "Your appointment with {doctor} on {date} at {time} has been cancelled. A notification has been sent.",
    cancelFailed: "I couldn't cancel this appointment: {error}.",
    queueNone:
      "You don't have an active queue token today. If you have an appointment today, you can check in from your dashboard or ask me to check you in.",
    queueStatus:
      "Your live queue status:\n\n• Doctor: {doctor}\n• Token: #{token}\n• Now serving: {current}\n• Your position: {position}\n• Estimated wait: about {wait} minutes\n• Status: {status}\n\nI'll send a “your turn is near” alert automatically.",
    queueTurn:
      "It's your turn now. Token #{token} — please go to {doctor}'s room.",
    queueCheckInAsk: "You have an appointment today with {doctor}. Would you like me to check you in and give you a token?",
    queueCheckedIn:
      "You're checked in. Your token is #{token}. There are {ahead} patient(s) ahead of you, with an estimated wait of about {wait} minutes.",
    walkinAskDepartment:
      "You can join today's walk-in queue remotely. Which department do you need?",
    walkinAskDoctor:
      "Which doctor would you like to join? Reply with a number. Priority will be reviewed by reception.",
    walkinConfirm:
      "Please confirm your walk-in request:\n\n• Doctor: {doctor}\n• Department: {department}\n• Priority suggested: {priority} (pending staff confirmation)\n\nShall I add you to today's queue?",
    walkinJoined:
      "You've joined today's walk-in queue. Your token is #{token}. Position: {position}, estimated wait: about {wait} minutes. I'll alert you when your turn is near.",
    walkinExisting:
      "You're already in today's queue for {doctor} with token #{token}. Position: {position}, estimated wait: about {wait} minutes.",
    walkinFailed: "I couldn't add you to the walk-in queue: {error}.",
    appointmentsHeader: "Here are your upcoming appointments:",
    appointmentsNone:
      "You don't have any upcoming appointments. Would you like to book one?",
    appointmentLine: "{number}. {doctor} — {date} at {time} ({status})",
    historyHeader: "Your recent visits:",
    historyNone: "You don't have any completed visits on record yet.",
    historyLine: "{number}. {date} — {doctor}: {diagnosis}",
    preferencesSaved: "Your chat preferences have been saved.",
    remindAskType:
      "What kind of reminder would you like: a medication reminder or a follow-up reminder?",
    remindAskWhat:
      "What should I remind you about? For a medication, include the name and dose exactly as prescribed.",
    remindAskWhen:
      "When should I remind you? You can say “tomorrow at 9am”, or type a date and time.",
    reminderCreated:
      "Reminder set for {when}. I'll send it by {channel}. I can only remind you about what you or your doctor specified — I can't advise on medicines or doses.",
    reminderSafety:
      "I can't recommend medicines or doses. I can only remind you about something your doctor already prescribed.",
    reminderNone: "You don't have any scheduled reminders.",
    reminderHeader: "Your scheduled reminders:",
    reminderLine: "{number}. {title} — {when} ({status})",
    triageAskSymptom:
      "I can help you find the right department. This is not a diagnosis. What is your main symptom today? Please describe it in your own words.",
    triageAskDuration: "How long have you had this symptom? For example: 2 days or 3 weeks.",
    triageAskSeverity:
      "On a scale of 1 to 10, how severe is it right now? (1 = mild, 10 = severe)",
    triageResult:
      "Thank you. Based on what you've described, the most relevant department is {department}. A suggested queue priority is {priority}; reception will confirm it. {disclaimer}",
    triageBookPrompt: "Would you like me to show available doctors and book an appointment in {department}?",
    intakeAskReason: "Let's complete a short pre-visit intake. What is the main reason for your visit?",
    intakeAskSymptoms: "What symptoms are you having, and how long have they been present?",
    intakeAskDuration: "How long have you had these symptoms?",
    intakeAskMeds: "What medications are you currently taking? Reply “none” if you don't take any.",
    intakeAskAllergies: "Do you have any allergies? Reply “none” if you don't.",
    intakeSaved:
      "Thank you. I've saved your pre-visit summary. Your doctor will see it before the appointment. You can update it any time by saying “pre-visit intake”.",
    intakeSafety:
      "Please don't include sensitive payment details. This summary is encrypted and shared only with your care team.",
    doctorAvailability:
      "Available doctors{department}:\n{list}\n\nWould you like to see time slots for one of them?",
    departmentList:
      "Our departments are:\n{list}\n\nWhich one would you like?",
    specialtySuggestion:
      "For those symptoms, {department} is the most relevant department. Would you like to book there?",
    outpatientFallback:
      "If you're not sure which department to choose, tell me your main symptom and I can suggest one.",
  },
  hi: {
    greeting:
      "नमस्ते{name}! मैं मेडीक्यू सहायक हूँ। मैं अपॉइंटमेंट, लाइव क्यू स्थिति, क्लिनिक जानकारी और विज़िट की तैयारी में मदद कर सकता हूँ। आप क्या करना चाहेंगे?",
    help:
      "मैं इन चीज़ों में मदद कर सकता हूँ:\n• अपॉइंटमेंट बुक, बदलें या रद्द करें\n• लाइव टोकन और प्रतीक्षा समय देखें\n• वॉक-इन क्यू में दूर से शामिल हों\n• क्लिनिक के सवाल (समय, शुल्क, बीमा, रास्ता)\n• विज़िट की तैयारी या प्री-विज़िट फॉर्म\n• रिसेप्शनिस्ट से बात करें\n\nआप क्या करना चाहेंगे?",
    fallback:
      "मुझे समझ नहीं आया। कृपया दूसरे शब्दों में बताएं। आप “मदद” भी लिख सकते हैं।",
    authRequired:
      "व्यक्तिगत या चिकित्सा जानकारी साझा करने या बदलने के लिए कृपया पहले साइन इन करें। साइन इन करने के बाद मैं तुरंत मदद करूँगा।",
    authRequiredShort:
      "आपके अपॉइंटमेंट या क्यू देखने के लिए कृपया पहले साइन इन करें।",
    disclaimer:
      "यह सहायक केवल सामान्य जानकारी देता है। यह डॉक्टर की सलाह, निदान या इलाज का विकल्प नहीं है।",
    emergency:
      "यह आपातकाल हो सकता है। कृपया अभी 112 या अपने स्थानीय आपातकालीन नंबर पर कॉल करें, या निकटतम आपातकालीन विभाग जाएँ। अपॉइंटमेंट का इंतज़ार न करें। मैं चैट से आपातकालीन देखभाल नहीं दे सकता।",
    consentAsk:
      "लक्षणों पर बात करने से पहले, मुझे आपकी सहमति चाहिए ताकि यह जानकारी सुरक्षित रूप से संग्रहित हो सके और क्लिनिक स्टाफ मदद कर सके। क्या आप सहमत हैं?",
    consentDeclined:
      "कोई बात नहीं। मैं लक्षणों की जानकारी संग्रहित नहीं करूँगा। आप क्लिनिक समय, शुल्क, डॉक्टर या अपॉइंटमेंट के बारे में पूछ सकते हैं।",
    consentThanks: "धन्यवाद। आपकी सहमति दर्ज हो गई है। आप कभी भी प्रोफ़ाइल से चैट डेटा हटाने के लिए कह सकते हैं।",
    notAvailable:
      "यह जानकारी मेडीक्यू के क्लिनिक डेटा में नहीं है, इसलिए मैं अनुमान नहीं लगाऊँगा। कृपया रिसेप्शन पर +1 555 0100 पर संपर्क करें।",
    thanks: "आपका स्वागत है। क्या मैं कुछ और मदद कर सकता हूँ?",
    bye: "अपना ध्यान रखें। जब भी ज़रूरत हो यह चैट फिर खोल सकते हैं।",
    restart: "ठीक है, फिर से शुरू करते हैं। आप क्या करना चाहेंगे?",
    languagePrompt: "आप कौन सी भाषा चाहेंगे? English, हिन्दी, Español, Français या العربية।",
    languageChanged: "ठीक है — मैं {language} में जारी रखूँगा।",
    handoffRequested:
      "मैंने यह बातचीत अब तक की जानकारी के साथ रिसेप्शन टीम को भेज दी है। वे जल्द ही यहाँ जवाब देंगे। तब तक आप लिख सकते हैं।",
    handoffAlready: "टीम के सदस्य से पहले ही अनुरोध किया जा चुका है। वे बातचीत देख सकते हैं और यहाँ जवाब देंगे।",
    handoffUnavailable:
      "मैं अभी रिसेप्शन टीम से संपर्क नहीं कर सका। कृपया +1 555 0100 पर कॉल करें या कुछ मिनट बाद फिर कोशिश करें।",
    feedbackThanks: "प्रतिक्रिया के लिए धन्यवाद — इससे हमें सुधार करने में मदद मिलती है।",
    errorGeneric: "क्षमा करें, मेरी ओर से कुछ गड़बड़ हुई। कृपया फिर कोशिश करें या रिसेप्शनिस्ट से बात करें।",
    selectNumber: "कृपया अपनी पसंद का नंबर लिखें।",
    noInput: "कृपया कुछ लिखें ताकि मैं मदद कर सकूँ।",
    tooLong: "संदेश बहुत लंबा है। कृपया 1,500 अक्षरों से कम रखें।",
    sessionRateLimited: "बहुत सारे संदेश हो गए हैं। कृपया कुछ मिनट रुकें या रिसेप्शनिस्ट से बात करें।",
    confirmYes: "हाँ, पुष्टि करें",
    confirmNo: "नहीं, रद्द करें",
    sugBook: "अपॉइंटमेंट बुक करें",
    sugQueue: "मेरी क्यू स्थिति",
    sugWalkin: "वॉक-इन क्यू में जुड़ें",
    sugFaq: "क्लिनिक जानकारी",
    sugHours: "क्लिनिक समय",
    sugDoctors: "डॉक्टर खोजें",
    sugHandoff: "किसी व्यक्ति से बात करें",
    sugMyAppointments: "मेरे अपॉइंटमेंट",
    sugIntake: "प्री-विज़िट फॉर्म",
    sugLanguage: "भाषा बदलें",
    sugYes: "हाँ",
    sugNo: "नहीं",
    sugChange: "विवरण बदलें",
    sugRestart: "फिर से शुरू करें",
    sugSignIn: "साइन इन करें",
    bookAskDepartment: "अपॉइंटमेंट बुक करते हैं। आप कौन सा विभाग चाहेंगे? नाम लिखें या “मुझे चुनने में मदद करें” कहें।",
    bookAskDoctor: "{department} में आप कौन से डॉक्टर चाहेंगे? नंबर लिखें।",
    bookAskDate: "आपके लिए कौन सी तारीख ठीक है? “आज”, “कल”, कोई दिन, या 2026-11-05 जैसी तारीख लिखें।",
    bookAskSlot: "{date} को {doctor} के साथ ये समय उपलब्ध हैं। नंबर लिखें।",
    bookAskPriority: "क्या यह विज़िट वरिष्ठ नागरिक, गर्भवती महिला, या सामान्य है?",
    bookAskReason: "विज़िट का कारण संक्षेप में बताएं। जैसे: “एक हफ्ते से सिरदर्द”।",
    bookSummary:
      "कृपया अपनी बुकिंग जाँचें:\n\n• डॉक्टर: {doctor}\n• विभाग: {department}\n• तारीख: {date}\n• समय: {time}\n• प्राथमिकता: {priority}\n• कारण: {reason}\n\nक्या मैं यह अपॉइंटमेंट पुष्टि करूँ?",
    bookConfirm: "पुष्टि के लिए “हाँ” और रद्द करने के लिए “नहीं” लिखें।",
    bookConfirmed:
      "आपका अपॉइंटमेंट पुष्टि हो गया है।\n\n• {doctor} ({department})\n• {date} को {time}\n• बुकिंग संदर्भ: {id}\n\nपुष्टि सूचना भेज दी गई है। कृपया 15 मिनट पहले आएँ और फोटो आईडी लाएँ।",
    bookNoDoctors: "उस विभाग में कोई उपलब्ध डॉक्टर नहीं मिला। क्या आप दूसरा विभाग चुनना चाहेंगे?",
    bookNoSlots: "उस तारीख के लिए कोई स्लॉट नहीं है। क्या आप दूसरी तारीख चुनना चाहेंगे?",
    bookInvalidDate: "मैं तारीख नहीं समझ सका। 2026-11-05 जैसी तारीख लिखें, या “आज”/“कल” कहें।",
    bookInvalidChoice: "यह विकल्प सूची में नहीं था। कृपया दिखाए गए नंबरों में से एक लिखें।",
    bookInvalidSlot: "यह समय उपलब्ध नहीं है। सूची में से समय चुनें, या “तारीख बदलें” कहें।",
    bookFailed: "बुकिंग पूरी नहीं हो सकी: {error}। कोई शुल्क नहीं लिया गया। क्या आप फिर कोशिश करेंगे?",
    bookChange: "ज़रूर। आप “डॉक्टर बदलें”, “तारीख बदलें”, “समय बदलें” या “कारण बदलें” कह सकते हैं।",
    bookCancelled: "ठीक है, यह बुकिंग अनुरोध रद्द कर दिया। कुछ भी सहेजा नहीं गया।",
    priorityNormal: "सामान्य विज़िट",
    prioritySenior: "वरिष्ठ नागरिक",
    priorityPregnant: "गर्भवती",
    priorityEmergency: "आपातकाल (स्टाफ समीक्षा आवश्यक)",
    rescheduleNoAppointments: "बदलने के लिए कोई आगामी अपॉइंटमेंट नहीं मिला। आप नया अपॉइंटमेंट बुक कर सकते हैं।",
    rescheduleChoose: "आप कौन सा अपॉइंटमेंट बदलना चाहेंगे? नंबर लिखें।",
    rescheduleAskDate: "{doctor} के साथ अपॉइंटमेंट के लिए नई तारीख क्या होगी?",
    rescheduleAskSlot: "{date} को {doctor} के साथ ये समय उपलब्ध हैं। नंबर लिखें।",
    rescheduleSummary:
      "कृपया नए अपॉइंटमेंट की पुष्टि करें:\n\n• डॉक्टर: {doctor}\n• पहले: {oldDate} को {oldTime}\n• अब: {date} को {time}\n\nक्या मैं इसे बदल दूँ?",
    rescheduleConfirm: "बदलने के लिए “हाँ” या वर्तमान रखने के लिए “नहीं” लिखें।",
    rescheduled: "आपका अपॉइंटमेंट {doctor} के साथ {date} को {time} पर बदल दिया गया है। सूचना भेज दी गई है।",
    rescheduleFailed: "अपॉइंटमेंट नहीं बदल सका: {error}।",
    cancelChoose: "आप कौन सा अपॉइंटमेंट रद्द करना चाहेंगे? नंबर लिखें।",
    cancelSummary: "कृपया पुष्टि करें: {doctor} के साथ {date} को {time} का अपॉइंटमेंट रद्द करें?\n\nचैट से इसे वापस नहीं लाया जा सकता।",
    cancelConfirm: "रद्द करने के लिए “हाँ” या रखने के लिए “नहीं” लिखें।",
    cancelled: "{doctor} के साथ {date} को {time} का अपॉइंटमेंट रद्द कर दिया गया है। सूचना भेज दी गई है।",
    cancelFailed: "अपॉइंटमेंट रद्द नहीं कर सका: {error}।",
    queueNone:
      "आज आपका कोई सक्रिय क्यू टोकन नहीं है। आज अपॉइंटमेंट है तो डैशबोर्ड से चेक-इन करें या मुझसे चेक-इन करने को कहें।",
    queueStatus:
      "आपकी लाइव क्यू स्थिति:\n\n• डॉक्टर: {doctor}\n• टोकन: #{token}\n• अभी सेवा में: {current}\n• आपकी स्थिति: {position}\n• अनुमानित प्रतीक्षा: लगभग {wait} मिनट\n• स्थिति: {status}\n\nजब आपकी बारी नज़दीक होगी मैं अपने आप सूचित करूँगा।",
    queueTurn: "अब आपकी बारी है। टोकन #{token} — कृपया {doctor} के कमरे में जाएँ।",
    queueCheckInAsk: "आज {doctor} के साथ आपका अपॉइंटमेंट है। क्या मैं चेक-इन करके टोकन दे दूँ?",
    queueCheckedIn: "आप चेक-इन हो गए हैं। आपका टोकन #{token} है। आपसे आगे {ahead} मरीज़ हैं, अनुमानित प्रतीक्षा लगभग {wait} मिनट।",
    walkinAskDepartment: "आप आज की वॉक-इन क्यू में दूर से जुड़ सकते हैं। आपको कौन सा विभाग चाहिए?",
    walkinAskDoctor: "आप किस डॉक्टर की क्यू में जुड़ना चाहेंगे? नंबर लिखें। प्राथमिकता रिसेप्शन देखेगा।",
    walkinConfirm:
      "कृपया वॉक-इन अनुरोध की पुष्टि करें:\n\n• डॉक्टर: {doctor}\n• विभाग: {department}\n• सुझाई गई प्राथमिकता: {priority} (स्टाफ पुष्टि लंबित)\n\nक्या मैं आपको आज की क्यू में जोड़ दूँ?",
    walkinJoined:
      "आप आज की वॉक-इन क्यू में शामिल हो गए हैं। टोकन #{token}। स्थिति: {position}, अनुमानित प्रतीक्षा: लगभग {wait} मिनट। बारी नज़दीक होने पर सूचित करूँगा।",
    walkinExisting: "आप पहले से {doctor} की आज की क्यू में टोकन #{token} के साथ हैं। स्थिति: {position}, अनुमानित प्रतीक्षा: लगभग {wait} मिनट।",
    walkinFailed: "आपको वॉक-इन क्यू में नहीं जोड़ सका: {error}।",
    appointmentsHeader: "आपके आगामी अपॉइंटमेंट:",
    appointmentsNone: "आपका कोई आगामी अपॉइंटमेंट नहीं है। क्या आप बुक करना चाहेंगे?",
    appointmentLine: "{number}. {doctor} — {date} को {time} ({status})",
    historyHeader: "आपकी हाल की विज़िट:",
    historyNone: "अभी कोई पूर्ण विज़िट दर्ज नहीं है।",
    historyLine: "{number}. {date} — {doctor}: {diagnosis}",
    preferencesSaved: "आपकी चैट प्राथमिकताएँ सहेज दी गई हैं।",
    remindAskType: "आप किस प्रकार का रिमाइंडर चाहेंगे: दवा या फॉलो-अप?",
    remindAskWhat: "मैं आपको किस बारे में याद दिलाऊँ? दवा के लिए नाम और डोज़ वैसे ही लिखें जैसे डॉक्टर ने बताया।",
    remindAskWhen: "मैं कब याद दिलाऊँ? “कल सुबह 9 बजे” कहें, या तारीख और समय लिखें।",
    reminderCreated: "{when} के लिए रिमाइंडर सेट है। मैं {channel} पर भेजूँगा। मैं केवल आपके या डॉक्टर के बताए अनुसार याद दिला सकता हूँ — दवा या डोज़ की सलाह नहीं दे सकता।",
    reminderSafety: "मैं दवाइयाँ या डोज़ नहीं बता सकता। मैं केवल डॉक्टर द्वारा पहले से बताई गई चीज़ की याद दिला सकता हूँ।",
    reminderNone: "आपका कोई निर्धारित रिमाइंडर नहीं है।",
    reminderHeader: "आपके निर्धारित रिमाइंडर:",
    reminderLine: "{number}. {title} — {when} ({status})",
    triageAskSymptom:
      "मैं सही विभाग खोजने में मदद कर सकता हूँ। यह निदान नहीं है। आज आपका मुख्य लक्षण क्या है? अपने शब्दों में बताएं।",
    triageAskDuration: "यह लक्षण कितने समय से है? जैसे: 2 दिन या 3 हफ्ते।",
    triageAskSeverity: "1 से 10 में अभी कितना गंभीर है? (1 = हल्का, 10 = गंभीर)",
    triageResult:
      "धन्यवाद। आपके बताए अनुसार सबसे उपयुक्त विभाग {department} है। सुझाई गई क्यू प्राथमिकता {priority} है; रिसेप्शन इसे पुष्टि करेगा। {disclaimer}",
    triageBookPrompt: "क्या मैं {department} में उपलब्ध डॉक्टर दिखाकर अपॉइंटमेंट बुक करूँ?",
    intakeAskReason: "चलिए छोटा प्री-विज़िट फॉर्म पूरा करें। विज़िट का मुख्य कारण क्या है?",
    intakeAskSymptoms: "आपको क्या लक्षण हैं और कब से हैं?",
    intakeAskDuration: "ये लक्षण कितने समय से हैं?",
    intakeAskMeds: "आप अभी कौन सी दवाइयाँ ले रहे हैं? कोई नहीं तो “नहीं” लिखें।",
    intakeAskAllergies: "क्या आपको कोई एलर्जी है? नहीं तो “नहीं” लिखें।",
    intakeSaved:
      "धन्यवाद। मैंने आपका प्री-विज़िट सारांश सहेज दिया है। डॉक्टर इसे अपॉइंटमेंट से पहले देखेंगे। “प्री-विज़िट फॉर्म” कहकर कभी भी अपडेट कर सकते हैं।",
    intakeSafety:
      "कृपया भुगतान की संवेदनशील जानकारी न डालें। यह सारांश एन्क्रिप्टेड है और केवल आपकी देखभाल टीम के साथ साझा होता है।",
    doctorAvailability: "उपलब्ध डॉक्टर{department}:\n{list}\n\nक्या आप किसी के समय देखना चाहेंगे?",
    departmentList: "हमारे विभाग हैं:\n{list}\n\nआप कौन सा चाहेंगे?",
    specialtySuggestion: "इन लक्षणों के लिए {department} सबसे उपयुक्त विभाग है। क्या आप वहाँ बुक करना चाहेंगे?",
    outpatientFallback: "अगर विभाग तय नहीं है, तो अपना मुख्य लक्षण बताएं और मैं सुझाव दूँगा।",
  },
};

// Spanish, French and Arabic core templates. Missing keys fall back to English.
MESSAGES.es = {
  greeting:
    "¡Hola{name}! Soy el asistente de MediQueue. Puedo ayudar con citas, estado de la cola, información de la clínica y preparación de la visita. ¿Qué deseas hacer?",
  help:
    "Puedo ayudarte a:\n• Reservar, reprogramar o cancelar una cita\n• Consultar tu turno y tiempo de espera\n• Unirte a la cola sin cita\n• Responder dudas (horario, tarifas, seguro, ubicación)\n• Preparar tu visita o completar el formulario previo\n• Hablar con recepción\n\n¿Qué deseas hacer?",
  fallback:
    "No estoy seguro de haber entendido. ¿Puedes reformularlo? También puedes escribir “ayuda”.",
  authRequired:
    "Solo puedo compartir o cambiar información personal y médica después de que inicies sesión. Inicia sesión y volveré a ayudarte de inmediato.",
  authRequiredShort:
    "Inicia sesión para acceder a tus citas o a tu turno de forma segura.",
  disclaimer:
    "Este asistente solo ofrece información general. No sustituye el consejo, diagnóstico ni tratamiento de un médico.",
  emergency:
    "Esto puede ser una emergencia médica. Llama ahora al 112 o a tu número de emergencias local, o acude al servicio de urgencias más cercano. No esperes una cita. No puedo atender emergencias por chat.",
  consentAsk:
    "Antes de hablar de tus síntomas, necesito tu consentimiento para guardar esta información de forma segura y que el personal pueda ayudarte. ¿Aceptas?",
  consentDeclined:
    "Entendido. No guardaré detalles de tus síntomas. Aun así puedes preguntar por horarios, tarifas, médicos o citas.",
  consentThanks: "Gracias. Tu consentimiento está registrado. Puedes pedir que eliminemos tus datos de chat desde tu perfil.",
  notAvailable:
    "No tengo esa información en los datos de MediQueue, así que no voy a adivinar. Contacta a recepción al +1 555 0100.",
  thanks: "De nada. ¿Hay algo más en lo que pueda ayudarte?",
  bye: "Cuídate. Puedes volver a abrir este chat cuando necesites ayuda.",
  restart: "De acuerdo, empecemos de nuevo. ¿Qué deseas hacer?",
  languagePrompt: "¿Qué idioma prefieres? English, हिन्दी, Español, Français o العربية.",
  languageChanged: "Perfecto, continuaré en {language}.",
  handoffRequested:
    "He enviado esta conversación al equipo de recepción con el contexto. Alguien responderá aquí lo antes posible. Mientras tanto puedes seguir escribiendo.",
  handoffAlready: "Ya se solicitó a un miembro del equipo. Puede ver el contexto y responderá aquí.",
  handoffUnavailable: "No pude contactar a recepción. Llama al +1 555 0100 o inténtalo en unos minutos.",
  feedbackThanks: "Gracias por tu comentario; nos ayuda a mejorar.",
  errorGeneric: "Lo siento, algo falló de mi lado. Inténtalo de nuevo o pide hablar con recepción.",
  selectNumber: "Responde con el número de tu elección.",
  noInput: "Escribe un mensaje para que pueda ayudarte.",
  tooLong: "El mensaje es demasiado largo. Usa menos de 1.500 caracteres.",
  sessionRateLimited: "Hemos intercambiado muchos mensajes. Espera unos minutos o pide hablar con recepción.",
  confirmYes: "Sí, confirmar",
  confirmNo: "No, cancelar",
  sugBook: "Reservar una cita",
  sugQueue: "Mi turno en la cola",
  sugWalkin: "Unirme sin cita",
  sugFaq: "Información de la clínica",
  sugHours: "Horario",
  sugDoctors: "Buscar un médico",
  sugHandoff: "Hablar con una persona",
  sugMyAppointments: "Mis citas",
  sugIntake: "Formulario previo",
  sugLanguage: "Cambiar idioma",
  sugYes: "Sí",
  sugNo: "No",
  sugChange: "Cambiar datos",
  sugRestart: "Empezar de nuevo",
  sugSignIn: "Iniciar sesión",
  bookAskDepartment:
    "Vamos a reservar. ¿Qué departamento prefieres? Escribe un nombre o di “ayúdame a elegir”.",
  bookAskDoctor: "¿Qué médico prefieres en {department}? Responde con un número.",
  bookAskDate: "¿Qué fecha te viene bien? Puedes decir “hoy”, “mañana”, un día de la semana o una fecha como 2026-11-05.",
  bookAskSlot: "Estos horarios están disponibles el {date} con {doctor}. Responde con un número.",
  bookAskPriority: "¿La visita es para una persona mayor, una persona embarazada o es una visita normal?",
  bookAskReason: "¿Cuál es el motivo de la visita? Por ejemplo: “dolores de cabeza desde hace una semana”.",
  bookSummary:
    "Revisa tu reserva:\n\n• Médico: {doctor}\n• Departamento: {department}\n• Fecha: {date}\n• Hora: {time}\n• Prioridad: {priority}\n• Motivo: {reason}\n\n¿Confirmo esta cita?",
  bookConfirm: "Responde “sí” para confirmar o “no” para cancelar.",
  bookConfirmed:
    "Tu cita está confirmada.\n\n• {doctor} ({department})\n• {date} a las {time}\n• Referencia: {id}\n\nEnviamos una notificación. Llega 15 minutos antes con una identificación con foto.",
  bookNoDoctors: "No encontré médicos disponibles en ese departamento. ¿Quieres probar otro?",
  bookNoSlots: "No hay horarios disponibles para esa fecha. ¿Quieres probar otra fecha?",
  bookInvalidDate: "No entendí la fecha. Usa 2026-11-05, o di “hoy” o “mañana”.",
  bookInvalidChoice: "Esa opción no estaba en la lista. Responde con uno de los números mostrados.",
  bookInvalidSlot: "Ese horario no está disponible. Elige uno de la lista o di “cambiar fecha”.",
  bookFailed: "No pude completar la reserva: {error}. No se cobró nada. ¿Quieres intentarlo otra vez?",
  bookChange: "Claro. Puedes decir “cambiar médico”, “cambiar fecha”, “cambiar hora” o “cambiar motivo”.",
  bookCancelled: "De acuerdo, cancelé esta solicitud. No se guardó nada.",
  priorityNormal: "Visita normal",
  prioritySenior: "Persona mayor",
  priorityPregnant: "Embarazo",
  priorityEmergency: "Emergencia (revisión del personal)",
  rescheduleNoAppointments: "No encontré una cita próxima para cambiar. Puedes reservar una nueva.",
  rescheduleChoose: "¿Qué cita quieres mover? Responde con un número.",
  rescheduleAskDate: "¿Qué nueva fecha quieres para tu cita con {doctor}?",
  rescheduleAskSlot: "Estos horarios están disponibles con {doctor} el {date}. Responde con un número.",
  rescheduleSummary:
    "Confirma los nuevos datos:\n\n• Médico: {doctor}\n• Antes: {oldDate} a las {oldTime}\n• Ahora: {date} a las {time}\n\n¿Reprogramo la cita?",
  rescheduleConfirm: "Responde “sí” para reprogramar o “no” para mantenerla.",
  rescheduled: "Tu cita con {doctor} se movió al {date} a las {time}. Enviamos una notificación.",
  rescheduleFailed: "No pude reprogramar la cita: {error}.",
  cancelChoose: "¿Qué cita quieres cancelar? Responde con un número.",
  cancelSummary: "Confirma: ¿cancelar tu cita con {doctor} el {date} a las {time}?\n\nNo se puede deshacer desde el chat.",
  cancelConfirm: "Responde “sí” para cancelar o “no” para mantenerla.",
  cancelled: "Tu cita con {doctor} el {date} a las {time} fue cancelada. Enviamos una notificación.",
  cancelFailed: "No pude cancelar la cita: {error}.",
  queueNone:
    "No tienes un turno activo hoy. Si tienes cita hoy, puedes registrarte desde tu panel o pedirme que lo haga.",
  queueStatus:
    "Tu estado en la cola:\n\n• Médico: {doctor}\n• Turno: #{token}\n• Atendiendo ahora: {current}\n• Tu posición: {position}\n• Espera estimada: unos {wait} minutos\n• Estado: {status}\n\nTe avisaré automáticamente cuando se acerque tu turno.",
  queueTurn: "Es tu turno. Turno #{token}: acude al consultorio de {doctor}.",
  queueCheckInAsk: "Hoy tienes cita con {doctor}. ¿Quieres que te registre y te dé un turno?",
  queueCheckedIn: "Estás registrado. Tu turno es #{token}. Hay {ahead} paciente(s) antes, con una espera de unos {wait} minutos.",
  walkinAskDepartment: "Puedes unirte hoy a la cola sin cita de forma remota. ¿Qué departamento necesitas?",
  walkinAskDoctor: "¿A qué médico quieres unirte? Responde con un número. Recepción revisará la prioridad.",
  walkinConfirm:
    "Confirma tu solicitud sin cita:\n\n• Médico: {doctor}\n• Departamento: {department}\n• Prioridad sugerida: {priority} (pendiente de confirmación)\n\n¿Te agrego a la cola de hoy?",
  walkinJoined:
    "Te uniste a la cola sin cita de hoy. Turno #{token}. Posición: {position}, espera estimada: unos {wait} minutos. Te avisaré cuando se acerque tu turno.",
  walkinExisting: "Ya estás en la cola de hoy para {doctor} con el turno #{token}. Posición: {position}, espera: unos {wait} minutos.",
  walkinFailed: "No pude agregarte a la cola: {error}.",
  appointmentsHeader: "Tus próximas citas:",
  appointmentsNone: "No tienes citas próximas. ¿Quieres reservar una?",
  appointmentLine: "{number}. {doctor} — {date} a las {time} ({status})",
  historyHeader: "Tus visitas recientes:",
  historyNone: "Todavía no tienes visitas completadas.",
  historyLine: "{number}. {date} — {doctor}: {diagnosis}",
  preferencesSaved: "Tus preferencias de chat se guardaron.",
  remindAskType: "¿Qué tipo de recordatorio quieres: medicamento o seguimiento?",
  remindAskWhat: "¿Sobre qué te recuerdo? Para un medicamento, incluye nombre y dosis tal como los recetó el médico.",
  remindAskWhen: "¿Cuándo te recuerdo? Di “mañana a las 9” o escribe fecha y hora.",
  reminderCreated:
    "Recordatorio para {when}. Lo enviaré por {channel}. Solo recuerdo lo que tú o tu médico indicaron; no puedo aconsejar sobre medicamentos o dosis.",
  reminderSafety: "No puedo recomendar medicamentos ni dosis. Solo recuerdo algo ya recetado por tu médico.",
  reminderNone: "No tienes recordatorios programados.",
  reminderHeader: "Tus recordatorios programados:",
  reminderLine: "{number}. {title} — {when} ({status})",
  triageAskSymptom:
    "Puedo ayudarte a encontrar el departamento adecuado. Esto no es un diagnóstico. ¿Cuál es tu síntoma principal hoy? Descríbelo con tus palabras.",
  triageAskDuration: "¿Desde cuándo tienes este síntoma? Por ejemplo: 2 días o 3 semanas.",
  triageAskSeverity: "En una escala del 1 al 10, ¿qué tan grave es ahora? (1 = leve, 10 = grave)",
  triageResult:
    "Gracias. Según lo que describes, el departamento más adecuado es {department}. La prioridad sugerida es {priority}; recepción la confirmará. {disclaimer}",
  triageBookPrompt: "¿Quieres que muestre médicos disponibles y reserve una cita en {department}?",
  intakeAskReason: "Completemos un formulario breve. ¿Cuál es el motivo principal de tu visita?",
  intakeAskSymptoms: "¿Qué síntomas tienes y desde cuándo?",
  intakeAskDuration: "¿Desde cuándo tienes estos síntomas?",
  intakeAskMeds: "¿Qué medicamentos tomas actualmente? Responde “ninguno” si no tomas.",
  intakeAskAllergies: "¿Tienes alguna alergia? Responde “ninguna” si no.",
  intakeSaved:
    "Gracias. Guardé tu resumen previo. Tu médico lo verá antes de la cita. Puedes actualizarlo diciendo “formulario previo”.",
  intakeSafety:
    "No incluyas datos de pago sensibles. Este resumen está cifrado y solo lo ve tu equipo de atención.",
  doctorAvailability: "Médicos disponibles{department}:\n{list}\n\n¿Quieres ver horarios de alguno?",
  departmentList: "Nuestros departamentos son:\n{list}\n\n¿Cuál prefieres?",
  specialtySuggestion: "Para esos síntomas, {department} es el departamento más adecuado. ¿Quieres reservar allí?",
  outpatientFallback: "Si no sabes qué departamento elegir, dime tu síntoma principal y te sugiero uno.",
};

MESSAGES.fr = {
  greeting:
    "Bonjour{name} ! Je suis l'assistant MediQueue. Je peux aider pour les rendez-vous, la file d'attente, les informations de la clinique et la préparation de la visite. Que souhaitez-vous faire ?",
  help:
    "Je peux vous aider à :\n• Prendre, déplacer ou annuler un rendez-vous\n• Voir votre ticket et votre temps d'attente\n• Rejoindre la file sans rendez-vous\n• Répondre aux questions (horaires, tarifs, assurance, accès)\n• Préparer votre visite ou remplir le formulaire préalable\n• Parler à la réception\n\nQue souhaitez-vous faire ?",
  fallback:
    "Je ne suis pas sûr d'avoir compris. Pouvez-vous reformuler ? Vous pouvez aussi écrire « aide ».",
  authRequired:
    "Je ne peux partager ou modifier des informations personnelles et médicales qu'après votre connexion. Connectez-vous, puis revenez : je vous aiderai tout de suite.",
  authRequiredShort:
    "Connectez-vous pour accéder à vos rendez-vous ou à votre ticket en toute sécurité.",
  disclaimer:
    "Cet assistant fournit des informations générales. Il ne remplace pas les conseils, le diagnostic ou le traitement d'un médecin.",
  emergency:
    "Il peut s'agir d'une urgence médicale. Appelez immédiatement le 112 ou votre numéro d'urgence local, ou rendez-vous aux urgences les plus proches. N'attendez pas un rendez-vous. Je ne peux pas prendre en charge une urgence par chat.",
  consentAsk:
    "Avant de parler de vos symptômes, j'ai besoin de votre consentement pour conserver ces informations de façon sécurisée afin que l'équipe puisse vous aider. Acceptez-vous ?",
  consentDeclined:
    "Très bien. Je ne conserverai pas les détails des symptômes. Vous pouvez toujours poser des questions sur les horaires, tarifs, médecins ou rendez-vous.",
  consentThanks: "Merci. Votre consentement est enregistré. Vous pouvez demander la suppression de vos données de chat depuis votre profil.",
  notAvailable:
    "Je n'ai pas cette information dans les données MediQueue, je ne vais donc pas deviner. Contactez la réception au +1 555 0100.",
  thanks: "Avec plaisir. Puis-je vous aider pour autre chose ?",
  bye: "Prenez soin de vous. Vous pouvez rouvrir ce chat à tout moment.",
  restart: "D'accord, recommençons. Que souhaitez-vous faire ?",
  languagePrompt: "Quelle langue préférez-vous ? English, हिन्दी, Español, Français ou العربية.",
  languageChanged: "Très bien, je continue en {language}.",
  handoffRequested:
    "J'ai transmis cette conversation à la réception avec le contexte. Quelqu'un répondra ici dès que possible. Vous pouvez continuer à écrire en attendant.",
  handoffAlready: "Un membre de l'équipe a déjà été sollicité. Il voit le contexte et répondra ici.",
  handoffUnavailable: "Je n'ai pas pu joindre la réception. Appelez le +1 555 0100 ou réessayez dans quelques minutes.",
  feedbackThanks: "Merci pour votre retour, cela nous aide à nous améliorer.",
  errorGeneric: "Désolé, une erreur s'est produite. Réessayez ou demandez à parler à la réception.",
  selectNumber: "Répondez avec le numéro de votre choix.",
  noInput: "Écrivez un message pour que je puisse vous aider.",
  tooLong: "Le message est trop long. Limitez-vous à 1 500 caractères.",
  sessionRateLimited: "Nous avons beaucoup échangé. Patientez quelques minutes ou demandez la réception.",
  confirmYes: "Oui, confirmer",
  confirmNo: "Non, annuler",
  sugBook: "Prendre un rendez-vous",
  sugQueue: "Mon ticket",
  sugWalkin: "File sans rendez-vous",
  sugFaq: "Informations clinique",
  sugHours: "Horaires",
  sugDoctors: "Trouver un médecin",
  sugHandoff: "Parler à quelqu'un",
  sugMyAppointments: "Mes rendez-vous",
  sugIntake: "Formulaire préalable",
  sugLanguage: "Changer de langue",
  sugYes: "Oui",
  sugNo: "Non",
  sugChange: "Modifier",
  sugRestart: "Recommencer",
  sugSignIn: "Se connecter",
  bookAskDepartment:
    "Prenons un rendez-vous. Quel service souhaitez-vous ? Écrivez un nom ou dites « aidez-moi à choisir ».",
  bookAskDoctor: "Quel médecin souhaitez-vous en {department} ? Répondez avec un numéro.",
  bookAskDate: "Quelle date vous convient ? Dites « aujourd'hui », « demain », un jour de la semaine ou une date comme 2026-11-05.",
  bookAskSlot: "Ces horaires sont disponibles le {date} avec {doctor}. Répondez avec un numéro.",
  bookAskPriority: "Cette visite concerne-t-elle une personne âgée, une personne enceinte, ou est-ce une visite standard ?",
  bookAskReason: "Quel est le motif de votre visite ? Par exemple : « maux de tête depuis une semaine ».",
  bookSummary:
    "Vérifiez votre réservation :\n\n• Médecin : {doctor}\n• Service : {department}\n• Date : {date}\n• Heure : {time}\n• Priorité : {priority}\n• Motif : {reason}\n\nPuis-je confirmer ce rendez-vous ?",
  bookConfirm: "Répondez « oui » pour confirmer ou « non » pour annuler.",
  bookConfirmed:
    "Votre rendez-vous est confirmé.\n\n• {doctor} ({department})\n• {date} à {time}\n• Référence : {id}\n\nUne notification a été envoyée. Arrivez 15 minutes avant avec une pièce d'identité.",
  bookNoDoctors: "Je n'ai pas trouvé de médecin disponible dans ce service. Voulez-vous en essayer un autre ?",
  bookNoSlots: "Aucun créneau n'est disponible à cette date. Voulez-vous essayer une autre date ?",
  bookInvalidDate: "Je n'ai pas compris la date. Utilisez 2026-11-05, ou dites « aujourd'hui » ou « demain ».",
  bookInvalidChoice: "Ce choix ne figurait pas dans la liste. Répondez avec l'un des numéros affichés.",
  bookInvalidSlot: "Cet horaire n'est pas disponible. Choisissez un horaire listé ou dites « changer la date ».",
  bookFailed: "Je n'ai pas pu finaliser la réservation : {error}. Rien n'a été facturé. Réessayer ?",
  bookChange: "Bien sûr. Vous pouvez dire « changer de médecin », « changer la date », « changer l'heure » ou « changer le motif ».",
  bookCancelled: "D'accord, j'ai annulé cette demande. Rien n'a été enregistré.",
  priorityNormal: "Visite standard",
  prioritySenior: "Personne âgée",
  priorityPregnant: "Grossesse",
  priorityEmergency: "Urgence (revue du personnel)",
  rescheduleNoAppointments: "Je n'ai pas trouvé de rendez-vous à venir à déplacer. Vous pouvez en prendre un nouveau.",
  rescheduleChoose: "Quel rendez-vous souhaitez-vous déplacer ? Répondez avec un numéro.",
  rescheduleAskDate: "Quelle nouvelle date souhaitez-vous pour votre rendez-vous avec {doctor} ?",
  rescheduleAskSlot: "Ces horaires sont disponibles avec {doctor} le {date}. Répondez avec un numéro.",
  rescheduleSummary:
    "Confirmez les nouvelles informations :\n\n• Médecin : {doctor}\n• Avant : {oldDate} à {oldTime}\n• Après : {date} à {time}\n\nPuis-je déplacer le rendez-vous ?",
  rescheduleConfirm: "Répondez « oui » pour déplacer ou « non » pour conserver.",
  rescheduled: "Votre rendez-vous avec {doctor} est déplacé au {date} à {time}. Une notification a été envoyée.",
  rescheduleFailed: "Je n'ai pas pu déplacer le rendez-vous : {error}.",
  cancelChoose: "Quel rendez-vous souhaitez-vous annuler ? Répondez avec un numéro.",
  cancelSummary: "Confirmez : annuler votre rendez-vous avec {doctor} le {date} à {time} ?\n\nCette action est irréversible depuis le chat.",
  cancelConfirm: "Répondez « oui » pour annuler ou « non » pour conserver.",
  cancelled: "Votre rendez-vous avec {doctor} le {date} à {time} a été annulé. Une notification a été envoyée.",
  cancelFailed: "Je n'ai pas pu annuler le rendez-vous : {error}.",
  queueNone:
    "Vous n'avez pas de ticket actif aujourd'hui. Si vous avez un rendez-vous aujourd'hui, enregistrez-vous depuis votre tableau de bord ou demandez-moi.",
  queueStatus:
    "Votre file d'attente :\n\n• Médecin : {doctor}\n• Ticket : #{token}\n• En cours : {current}\n• Votre position : {position}\n• Attente estimée : environ {wait} minutes\n• Statut : {status}\n\nJe vous préviendrai automatiquement quand votre tour approche.",
  queueTurn: "C'est votre tour. Ticket #{token} : rendez-vous au cabinet de {doctor}.",
  queueCheckInAsk: "Vous avez un rendez-vous aujourd'hui avec {doctor}. Voulez-vous que je vous enregistre et vous donne un ticket ?",
  queueCheckedIn: "Vous êtes enregistré. Votre ticket est #{token}. {ahead} patient(s) avant vous, attente d'environ {wait} minutes.",
  walkinAskDepartment: "Vous pouvez rejoindre la file sans rendez-vous à distance. Quel service vous faut-il ?",
  walkinAskDoctor: "À quel médecin souhaitez-vous vous joindre ? Répondez avec un numéro. La réception vérifiera la priorité.",
  walkinConfirm:
    "Confirmez votre demande sans rendez-vous :\n\n• Médecin : {doctor}\n• Service : {department}\n• Priorité suggérée : {priority} (à confirmer)\n\nPuis-je vous ajouter à la file d'aujourd'hui ?",
  walkinJoined:
    "Vous avez rejoint la file sans rendez-vous. Ticket #{token}. Position : {position}, attente : environ {wait} minutes. Je vous préviendrai quand votre tour approche.",
  walkinExisting: "Vous êtes déjà dans la file de {doctor} aujourd'hui avec le ticket #{token}. Position : {position}, attente : environ {wait} minutes.",
  walkinFailed: "Je n'ai pas pu vous ajouter à la file : {error}.",
  appointmentsHeader: "Vos prochains rendez-vous :",
  appointmentsNone: "Vous n'avez pas de rendez-vous à venir. Voulez-vous en prendre un ?",
  appointmentLine: "{number}. {doctor} — {date} à {time} ({status})",
  historyHeader: "Vos visites récentes :",
  historyNone: "Vous n'avez pas encore de visite terminée.",
  historyLine: "{number}. {date} — {doctor} : {diagnosis}",
  preferencesSaved: "Vos préférences de chat sont enregistrées.",
  remindAskType: "Quel type de rappel souhaitez-vous : médicament ou suivi ?",
  remindAskWhat: "À propos de quoi dois-je vous rappeler ? Pour un médicament, indiquez le nom et la dose prescrits.",
  remindAskWhen: "Quand dois-je vous rappeler ? Dites « demain à 9h » ou écrivez une date et une heure.",
  reminderCreated:
    "Rappel prévu pour {when}. Je l'enverrai par {channel}. Je rappelle uniquement ce que vous ou votre médecin avez indiqué ; je ne conseille pas les médicaments ou les doses.",
  reminderSafety: "Je ne peux pas recommander de médicaments ou de doses. Je rappelle seulement ce qui a déjà été prescrit.",
  reminderNone: "Vous n'avez aucun rappel programmé.",
  reminderHeader: "Vos rappels programmés :",
  reminderLine: "{number}. {title} — {when} ({status})",
  triageAskSymptom:
    "Je peux vous aider à trouver le bon service. Ce n'est pas un diagnostic. Quel est votre symptôme principal aujourd'hui ? Décrivez-le avec vos mots.",
  triageAskDuration: "Depuis combien de temps avez-vous ce symptôme ? Par exemple : 2 jours ou 3 semaines.",
  triageAskSeverity: "Sur une échelle de 1 à 10, quelle est sa gravité maintenant ? (1 = léger, 10 = sévère)",
  triageResult:
    "Merci. D'après votre description, le service le plus adapté est {department}. La priorité suggérée est {priority} ; la réception la confirmera. {disclaimer}",
  triageBookPrompt: "Voulez-vous que je montre les médecins disponibles et prenne rendez-vous en {department} ?",
  intakeAskReason: "Faisons un court formulaire préalable. Quel est le motif principal de votre visite ?",
  intakeAskSymptoms: "Quels symptômes avez-vous et depuis quand ?",
  intakeAskDuration: "Depuis combien de temps avez-vous ces symptômes ?",
  intakeAskMeds: "Quels médicaments prenez-vous actuellement ? Répondez « aucun » si non.",
  intakeAskAllergies: "Avez-vous des allergies ? Répondez « aucune » si non.",
  intakeSaved:
    "Merci. J'ai enregistré votre résumé préalable. Votre médecin le verra avant le rendez-vous. Vous pouvez le mettre à jour en disant « formulaire préalable ».",
  intakeSafety:
    "N'indiquez pas de données de paiement sensibles. Ce résumé est chiffré et partagé uniquement avec votre équipe soignante.",
  doctorAvailability: "Médecins disponibles{department} :\n{list}\n\nVoulez-vous voir les horaires de l'un d'eux ?",
  departmentList: "Nos services sont :\n{list}\n\nLequel souhaitez-vous ?",
  specialtySuggestion: "Pour ces symptômes, {department} est le service le plus adapté. Voulez-vous y prendre rendez-vous ?",
  outpatientFallback: "Si vous ne savez pas quel service choisir, indiquez votre symptôme principal et je vous suggérerai.",
};

MESSAGES.ar = {
  greeting:
    "مرحبًا{name}! أنا مساعد MediQueue. يمكنني المساعدة في المواعيد وحالة الطابور ومعلومات العيادة والتحضير للزيارة. ماذا تريد أن تفعل؟",
  help:
    "يمكنني مساعدتك في:\n• حجز أو تعديل أو إلغاء موعد\n• معرفة رقمك ووقت الانتظار\n• الانضمام إلى طابور الزيارة بدون موعد\n• الإجابة عن الأسئلة (الدوام، الرسوم، التأمين، الموقع)\n• التحضير للزيارة أو تعبئة النموذج المسبق\n• التحدث مع موظف الاستقبال\n\nماذا تريد أن تفعل؟",
  fallback:
    "لم أفهم ذلك تمامًا. هل يمكنك إعادة صياغته؟ يمكنك أيضًا كتابة «مساعدة».",
  authRequired:
    "لا يمكنني مشاركة أو تغيير المعلومات الشخصية والطبية إلا بعد تسجيل الدخول. سجّل الدخول ثم عد وسأساعدك فورًا.",
  authRequiredShort:
    "يرجى تسجيل الدخول للوصول إلى مواعيدك أو طابورك بشكل آمن.",
  disclaimer:
    "يقدم هذا المساعد معلومات عامة فقط، وهو ليس بديلاً عن نصيحة الطبيب أو تشخيصه أو علاجه.",
  emergency:
    "قد تكون هذه حالة طارئة. اتصل الآن بالرقم 112 أو برقم الطوارئ المحلي، أو اذهب إلى أقرب قسم طوارئ. لا تنتظر موعدًا. لا يمكنني تقديم رعاية طارئة عبر المحادثة.",
  consentAsk:
    "قبل الحديث عن الأعراض، أحتاج إلى موافقتك على تخزين هذه المعلومات بشكل آمن ليتمكن طاقم العيادة من مساعدتك. هل توافق؟",
  consentDeclined:
    "لا مشكلة. لن أخزّن تفاصيل الأعراض. يمكنك السؤال عن الدوام أو الرسوم أو الأطباء أو المواعيد.",
  consentThanks: "شكرًا. تم تسجيل موافقتك. يمكنك طلب حذف بيانات المحادثة من ملفك في أي وقت.",
  notAvailable:
    "لا توجد هذه المعلومات في بيانات MediQueue، لذلك لن أخمّن. يرجى التواصل مع الاستقبال على +1 555 0100.",
  thanks: "على الرحب والسعة. هل هناك شيء آخر يمكنني المساعدة فيه؟",
  bye: "اعتنِ بنفسك. يمكنك إعادة فتح المحادثة وقتما تحتاج.",
  restart: "حسنًا، لنبدأ من جديد. ماذا تريد أن تفعل؟",
  languagePrompt: "أي لغة تفضل؟ English, हिन्दी, Español, Français أو العربية.",
  languageChanged: "حسنًا، سأكمل باللغة {language}.",
  handoffRequested:
    "أرسلت هذه المحادثة إلى فريق الاستقبال مع السياق. سيرد أحدهم هنا في أقرب وقت. يمكنك متابعة الكتابة في الأثناء.",
  handoffAlready: "تم طلب أحد أعضاء الفريق بالفعل. يمكنه رؤية السياق وسيرد هنا.",
  handoffUnavailable: "لم أتمكن من الوصول إلى الاستقبال. اتصل على +1 555 0100 أو حاول بعد بضع دقائق.",
  feedbackThanks: "شكرًا على ملاحظاتك، فهي تساعدنا على التحسن.",
  errorGeneric: "عذرًا، حدث خطأ من جهتي. حاول مرة أخرى أو اطلب التحدث مع الاستقبال.",
  selectNumber: "يرجى الرد برقم اختيارك.",
  noInput: "اكتب رسالة حتى أتمكن من المساعدة.",
  tooLong: "الرسالة طويلة جدًا. يرجى إبقاؤها أقل من 1500 حرف.",
  sessionRateLimited: "تبادلنا رسائل كثيرة. انتظر بضع دقائق أو اطلب الاستقبال.",
  confirmYes: "نعم، تأكيد",
  confirmNo: "لا، إلغاء",
  sugBook: "حجز موعد",
  sugQueue: "حالة طابوري",
  sugWalkin: "الانضمام بدون موعد",
  sugFaq: "معلومات العيادة",
  sugHours: "ساعات الدوام",
  sugDoctors: "البحث عن طبيب",
  sugHandoff: "التحدث مع شخص",
  sugMyAppointments: "مواعيدي",
  sugIntake: "النموذج المسبق",
  sugLanguage: "تغيير اللغة",
  sugYes: "نعم",
  sugNo: "لا",
  sugChange: "تغيير التفاصيل",
  sugRestart: "البدء من جديد",
  sugSignIn: "تسجيل الدخول",
  bookAskDepartment: "لنحجز موعدًا. أي قسم تريد؟ اكتب الاسم أو قل «ساعدني في الاختيار».",
  bookAskDoctor: "أي طبيب تريد في {department}؟ ارد بالرقم.",
  bookAskDate: "أي تاريخ يناسبك؟ يمكنك قول «اليوم» أو «غدًا» أو يوم من الأسبوع أو كتابة تاريخ مثل 2026-11-05.",
  bookAskSlot: "هذه الأوقات متاحة في {date} مع {doctor}. ارد بالرقم.",
  bookAskPriority: "هل الزيارة لكبير في السن أو لشخص حامل أو زيارة عادية؟",
  bookAskReason: "ما سبب الزيارة باختصار؟ مثال: «صداع متكرر منذ أسبوع».",
  bookSummary:
    "يرجى مراجعة الحجز:\n\n• الطبيب: {doctor}\n• القسم: {department}\n• التاريخ: {date}\n• الوقت: {time}\n• الأولوية: {priority}\n• السبب: {reason}\n\nهل أؤكد هذا الموعد؟",
  bookConfirm: "ارد بـ «نعم» للتأكيد أو «لا» للإلغاء.",
  bookConfirmed:
    "تم تأكيد موعدك.\n\n• {doctor} ({department})\n• {date} الساعة {time}\n• رقم الحجز: {id}\n\nتم إرسال إشعار. يرجى الحضور قبل 15 دقيقة مع هوية مصورة.",
  bookNoDoctors: "لم أجد طبيبًا متاحًا في هذا القسم. هل تريد تجربة قسم آخر؟",
  bookNoSlots: "لا توجد أوقات متاحة في ذلك التاريخ. هل تريد تجربة تاريخ آخر؟",
  bookInvalidDate: "لم أفهم التاريخ. استخدم 2026-11-05 أو قل «اليوم» أو «غدًا».",
  bookInvalidChoice: "هذا الخيار ليس في القائمة. ارد بأحد الأرقام المعروضة.",
  bookInvalidSlot: "هذا الوقت غير متاح. اختر وقتًا من القائمة أو قل «تغيير التاريخ».",
  bookFailed: "لم أتمكن من إكمال الحجز: {error}. لم يتم خصم أي مبلغ. هل تريد المحاولة؟",
  bookChange: "بالطبع. يمكنك قول «تغيير الطبيب» أو «تغيير التاريخ» أو «تغيير الوقت» أو «تغيير السبب».",
  bookCancelled: "حسنًا، ألغيت طلب الحجز. لم يتم حفظ أي شيء.",
  priorityNormal: "زيارة عادية",
  prioritySenior: "كبير في السن",
  priorityPregnant: "حامل",
  priorityEmergency: "طارئ (مراجعة الموظفين)",
  rescheduleNoAppointments: "لم أجد موعدًا قادمًا لتعديله. يمكنك حجز موعد جديد.",
  rescheduleChoose: "أي موعد تريد نقله؟ ارد بالرقم.",
  rescheduleAskDate: "ما التاريخ الجديد الذي تريده لموعدك مع {doctor}؟",
  rescheduleAskSlot: "هذه الأوقات متاحة مع {doctor} في {date}. ارد بالرقم.",
  rescheduleSummary:
    "يرجى تأكيد تفاصيل الموعد الجديد:\n\n• الطبيب: {doctor}\n• من: {oldDate} الساعة {oldTime}\n• إلى: {date} الساعة {time}\n\nهل أعدل الموعد؟",
  rescheduleConfirm: "ارد بـ «نعم» للتعديل أو «لا» للإبقاء.",
  rescheduled: "تم نقل موعدك مع {doctor} إلى {date} الساعة {time}. تم إرسال إشعار.",
  rescheduleFailed: "لم أتمكن من تعديل الموعد: {error}.",
  cancelChoose: "أي موعد تريد إلغاءه؟ ارد بالرقم.",
  cancelSummary: "يرجى التأكيد: إلغاء موعدك مع {doctor} في {date} الساعة {time}؟\n\nلا يمكن التراجع من المحادثة.",
  cancelConfirm: "ارد بـ «نعم» للإلغاء أو «لا» للإبقاء.",
  cancelled: "تم إلغاء موعدك مع {doctor} في {date} الساعة {time}. تم إرسال إشعار.",
  cancelFailed: "لم أتمكن من إلغاء الموعد: {error}.",
  queueNone:
    "ليس لديك رقم طابور نشط اليوم. إذا كان لديك موعد اليوم، يمكنك تسجيل الحضور من لوحتك أو اطلب مني ذلك.",
  queueStatus:
    "حالة طابورك:\n\n• الطبيب: {doctor}\n• الرقم: #{token}\n• يُخدم الآن: {current}\n• موقعك: {position}\n• الانتظار المتوقع: حوالي {wait} دقيقة\n• الحالة: {status}\n\nسأرسل تنبيهًا تلقائيًا عندما يقترب دورك.",
  queueTurn: "حان دورك. الرقم #{token} — يرجى التوجه إلى غرفة {doctor}.",
  queueCheckInAsk: "لديك موعد اليوم مع {doctor}. هل تريد أن أسجل حضورك وأعطيك رقمًا؟",
  queueCheckedIn: "تم تسجيل حضورك. رقمك #{token}. أمامك {ahead} مريض، والانتظار حوالي {wait} دقيقة.",
  walkinAskDepartment: "يمكنك الانضمام إلى طابور اليوم بدون موعد عن بُعد. أي قسم تحتاج؟",
  walkinAskDoctor: "أي طبيب تريد الانضمام إليه؟ ارد بالرقم. سيراجع الاستقبال الأولوية.",
  walkinConfirm:
    "يرجى تأكيد طلب الزيارة بدون موعد:\n\n• الطبيب: {doctor}\n• القسم: {department}\n• الأولوية المقترحة: {priority} (بانتظار تأكيد الموظفين)\n\nهل أضيفك إلى طابور اليوم؟",
  walkinJoined:
    "انضممت إلى طابور اليوم. رقمك #{token}. موقعك: {position}، الانتظار حوالي {wait} دقيقة. سأنبهك عندما يقترب دورك.",
  walkinExisting: "أنت بالفعل في طابور {doctor} اليوم برقم #{token}. موقعك: {position}، الانتظار حوالي {wait} دقيقة.",
  walkinFailed: "لم أتمكن من إضافتك إلى الطابور: {error}.",
  appointmentsHeader: "مواعيدك القادمة:",
  appointmentsNone: "ليس لديك مواعيد قادمة. هل تريد حجز موعد؟",
  appointmentLine: "{number}. {doctor} — {date} الساعة {time} ({status})",
  historyHeader: "زياراتك الأخيرة:",
  historyNone: "لا توجد زيارات مكتملة بعد.",
  historyLine: "{number}. {date} — {doctor}: {diagnosis}",
  preferencesSaved: "تم حفظ تفضيلات المحادثة.",
  remindAskType: "أي نوع من التذكير تريد: دواء أم متابعة؟",
  remindAskWhat: "بماذا أذكرك؟ للدواء، اذكر الاسم والجرعة كما وصفها الطبيب.",
  remindAskWhen: "متى أذكرك؟ قل «غدًا الساعة 9» أو اكتب التاريخ والوقت.",
  reminderCreated:
    "تم ضبط التذكير في {when}. سأرسله عبر {channel}. أذكّرك فقط بما حددته أنت أو طبيبك؛ ولا أقدم نصيحة عن الأدوية أو الجرعات.",
  reminderSafety: "لا يمكنني التوصية بأدوية أو جرعات. أذكّرك فقط بما وصفه طبيبك مسبقًا.",
  reminderNone: "ليس لديك تذكيرات مجدولة.",
  reminderHeader: "تذكيراتك المجدولة:",
  reminderLine: "{number}. {title} — {when} ({status})",
  triageAskSymptom:
    "يمكنني مساعدتك في إيجاد القسم المناسب. هذا ليس تشخيصًا. ما عرضك الرئيسي اليوم؟ صفه بكلماتك.",
  triageAskDuration: "منذ متى لديك هذا العرض؟ مثلًا: يومان أو ثلاثة أسابيع.",
  triageAskSeverity: "على مقياس من 1 إلى 10، ما مدى شدته الآن؟ (1 = خفيف، 10 = شديد)",
  triageResult:
    "شكرًا. بناءً على وصفك، القسم الأنسب هو {department}. الأولوية المقترحة هي {priority} وسيؤكدها الاستقبال. {disclaimer}",
  triageBookPrompt: "هل تريد أن أعرض الأطباء المتاحين وأحجز موعدًا في {department}؟",
  intakeAskReason: "لنكمل نموذجًا مسبقًا قصيرًا. ما السبب الرئيسي للزيارة؟",
  intakeAskSymptoms: "ما الأعراض التي لديك ومنذ متى؟",
  intakeAskDuration: "منذ متى لديك هذه الأعراض؟",
  intakeAskMeds: "ما الأدوية التي تتناولها حاليًا؟ ارد بـ «لا شيء» إن لم تتناول أيًا.",
  intakeAskAllergies: "هل لديك أي حساسية؟ ارد بـ «لا» إن لم تكن لديك.",
  intakeSaved:
    "شكرًا. حفظت ملخصك المسبق. سيراه طبيبك قبل الموعد. يمكنك تحديثه بقول «النموذج المسبق».",
  intakeSafety:
    "يرجى عدم إدراج بيانات دفع حساسة. هذا الملخص مشفر ويُشارك فقط مع فريق رعايتك.",
  doctorAvailability: "الأطباء المتاحون{department}:\n{list}\n\nهل تريد رؤية أوقات أحدهم؟",
  departmentList: "أقسامنا هي:\n{list}\n\nأيها تريد؟",
  specialtySuggestion: "لهذه الأعراض، {department} هو القسم الأنسب. هل تريد الحجز هناك؟",
  outpatientFallback: "إذا لم تكن متأكدًا من القسم، أخبرني بعرضك الرئيسي وسأقترح قسمًا.",
};

function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : "en";
}

function t(locale, key, vars = {}) {
  const lang = normalizeLocale(locale);
  const template = MESSAGES[lang]?.[key] ?? MESSAGES.en[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) =>
    vars[name] === undefined || vars[name] === null ? "" : String(vars[name])
  );
}

function detectLocale(text = "") {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  const lower = String(text).toLowerCase();
  if (/\b(hola|gracias|cita|médico|medico|horario|seguro)\b/.test(lower)) return "es";
  if (/\b(bonjour|merci|rendez-vous|médecin|medecin|horaire|assurance)\b/.test(lower)) return "fr";
  if (/\b(namaste|namaskar|dhanyavad|shukriya|kitne|kab|kahan|dard|bukhar|khansi|sir|pet)\b/.test(lower)) return "hi";
  return "en";
}

function languageName(locale) {
  return LANGUAGE_NAMES[normalizeLocale(locale)];
}

module.exports = {
  SUPPORTED_LOCALES,
  LANGUAGE_NAMES,
  MESSAGES,
  normalizeLocale,
  t,
  detectLocale,
  languageName,
};
