const bcrypt = require("bcryptjs");
const Department = require("../models/Department");
const User = require("../models/User");
const DoctorProfile = require("../models/DoctorProfile");
const ClinicInfo = require("../models/ClinicInfo");

const DEPARTMENTS = [
  {
    name: "General Medicine",
    description: "Primary care, general checkups and common illnesses.",
    location: "Ground floor - Block A",
  },
  {
    name: "Cardiology",
    description: "Heart and cardiovascular care.",
    location: "First floor - Block B",
  },
  {
    name: "Pediatrics",
    description: "Healthcare for infants, children and adolescents.",
    location: "Ground floor - Block C",
  },
  {
    name: "Dermatology",
    description: "Skin, hair and nail conditions.",
    location: "Second floor - Block A",
  },
  {
    name: "Orthopedics",
    description: "Bones, joints, muscles and sports injuries.",
    location: "First floor - Block C",
  },
  {
    name: "Gynecology",
    description: "Women's health, pregnancy and reproductive care.",
    location: "Second floor - Block B",
  },
];

const WEEKDAY_AVAILABILITY = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
].map((day) => ({ day, startTime: "09:00", endTime: "13:00" }));

const CLINIC_INFO = [
  {
    key: "hours",
    category: "hours",
    title: "Clinic hours",
    content:
      "MediQueue City Hospital is open Monday to Saturday from 8:00 AM to 8:00 PM, and Sunday from 9:00 AM to 2:00 PM for urgent appointments. The reception desk opens 30 minutes before the clinic. Online booking, queue tracking and the chat assistant are available 24/7.",
    keywords: ["hours", "timings", "open", "close", "sunday", "weekend", "visiting"],
    translations: {
      hi: {
        title: "क्लिनिक का समय",
        content:
          "मेडीक्यू सिटी अस्पताल सोमवार से शनिवार सुबह 8:00 से रात 8:00 बजे तक खुला है, और रविवार को आपात अपॉइंटमेंट के लिए सुबह 9:00 से दोपहर 2:00 बजे तक। रिसेप्शन क्लिनिक खुलने से 30 मिनट पहले खुलता है। ऑनलाइन बुकिंग, कतार ट्रैकिंग और चैट सहायक 24/7 उपलब्ध हैं।",
      },
      es: {
        title: "Horario de la clínica",
        content:
          "El Hospital MediQueue City abre de lunes a sábado de 8:00 a 20:00 y los domingos de 9:00 a 14:00 para citas urgentes. Recepción abre 30 minutos antes. La reserva en línea, el seguimiento de turnos y el asistente de chat están disponibles 24/7.",
      },
      fr: {
        title: "Horaires de la clinique",
        content:
          "L'hôpital MediQueue City est ouvert du lundi au samedi de 8h00 à 20h00, et le dimanche de 9h00 à 14h00 pour les rendez-vous urgents. L'accueil ouvre 30 minutes avant. La réservation en ligne, le suivi de file et l'assistant sont disponibles 24h/24.",
      },
      ar: {
        title: "ساعات العيادة",
        content:
          "مستشفى ميديكيو سيتي مفتوح من الاثنين إلى السبت من 8:00 صباحًا حتى 8:00 مساءً، ويوم الأحد من 9:00 صباحًا حتى 2:00 ظهرًا للمواعيد العاجلة. يفتح الاستقبال قبل 30 دقيقة. الحجز عبر الإنترنت ومتابعة الدور والمساعد متاحون على مدار الساعة.",
      },
    },
  },
  {
    key: "location",
    category: "location",
    title: "Clinic address",
    content:
      "MediQueue City Hospital is at 12 Lake View Road, near Central Park, Bengaluru 560001. The main entrance faces the park; the pharmacy and laboratory are on the ground floor of Block A.",
    keywords: ["address", "location", "where", "road", "bengaluru", "entrance"],
    translations: {
      hi: {
        title: "क्लिनिक का पता",
        content:
          "मेडीक्यू सिटी अस्पताल, 12 लेक व्यू रोड, सेंट्रल पार्क के पास, बेंगलुरु 560001 में है। मुख्य प्रवेश द्वार पार्क की ओर है; फार्मेसी और प्रयोगशाला ब्लॉक A की भूतल पर हैं।",
      },
      es: {
        title: "Dirección de la clínica",
        content:
          "El Hospital MediQueue City está en 12 Lake View Road, junto a Central Park, Bengaluru 560001. La entrada principal da al parque; la farmacia y el laboratorio están en la planta baja del Bloque A.",
      },
      fr: {
        title: "Adresse de la clinique",
        content:
          "L'hôpital MediQueue City se trouve au 12 Lake View Road, près de Central Park, Bengaluru 560001. L'entrée principale donne sur le parc ; la pharmacie et le laboratoire sont au rez-de-chaussée du bâtiment A.",
      },
      ar: {
        title: "عنوان العيادة",
        content:
          "يقع مستشفى ميديكيو سيتي في 12 شارع ليك فيو، بالقرب من سنترال بارك، بنغالورو 560001. المدخل الرئيسي يواجه الحديقة، والصيدلية والمختبر في الطابق الأرضي من المبنى A.",
      },
    },
  },
  {
    key: "directions",
    category: "directions",
    title: "Getting here",
    content:
      "By metro: Central Park station on the Green Line, Exit 2, then a 6-minute walk. By bus: routes 21, 45 and 108 stop at Lake View Road. By car: use Gate 2 on Lake View Road for drop-off; valet is available from 8:00 AM. Accessible parking is next to Gate 2.",
    keywords: ["directions", "how to get", "metro", "bus", "route", "reach", "gate"],
    translations: {
      hi: {
        title: "यहाँ कैसे पहुँचें",
        content:
          "मेट्रो से: ग्रीन लाइन पर सेंट्रल पार्क स्टेशन, गेट 2, फिर 6 मिनट पैदल। बस से: रूट 21, 45 और 108 लेक व्यू रोड पर रुकते हैं। कार से: लेक व्यू रोड पर गेट 2 से उतरें; वैले सुबह 8:00 से उपलब्ध है। सुलभ पार्किंग गेट 2 के पास है।",
      },
      es: {
        title: "Cómo llegar",
        content:
          "En metro: estación Central Park de la Línea Verde, salida 2, luego 6 minutos a pie. En autobús: rutas 21, 45 y 108 paran en Lake View Road. En coche: use la Puerta 2 para dejar pasajeros; servicio de valet desde las 8:00. El estacionamiento accesible está junto a la Puerta 2.",
      },
      fr: {
        title: "Comment venir",
        content:
          "En métro : station Central Park, ligne verte, sortie 2, puis 6 minutes à pied. En bus : lignes 21, 45 et 108, arrêt Lake View Road. En voiture : utilisez la porte 2 pour déposer ; voiturier dès 8h00. Le parking accessible est près de la porte 2.",
      },
      ar: {
        title: "كيفية الوصول",
        content:
          "بالمترو: محطة سنترال بارك على الخط الأخضر، المخرج 2، ثم 6 دقائق سيرًا. بالحافلة: الخطوط 21 و45 و108 تتوقف في شارع ليك فيو. بالسيارة: استخدم البوابة 2 لإنزال الركاب، خدمة صف السيارات من الساعة 8:00. مواقف ذوي الاحتياجات بجوار البوابة 2.",
      },
    },
  },
  {
    key: "parking",
    category: "parking",
    title: "Parking",
    content:
      "Patient parking is in the basement of Block B, open 7:30 AM to 9:00 PM. The first 2 hours are free with a validated appointment or queue token. Accessible bays are next to the Gate 2 lift and are free for the whole visit.",
    keywords: ["parking", "car", "basement", "valet", "free parking"],
    translations: {
      hi: {
        title: "पार्किंग",
        content:
          "मरीज़ों के लिए पार्किंग ब्लॉक B के बेसमेंट में है, सुबह 7:30 से रात 9:00 बजे तक खुली। वैध अपॉइंटमेंट या कतार टोकन के साथ पहले 2 घंटे निःशुल्क। सुलभ पार्किंग गेट 2 लिफ्ट के पास है और पूरी विज़िट के दौरान निःशुल्क है।",
      },
      es: {
        title: "Estacionamiento",
        content:
          "El estacionamiento para pacientes está en el sótano del Bloque B, de 7:30 a 21:00. Las primeras 2 horas son gratis con una cita o turno validado. Las plazas accesibles están junto al ascensor de la Puerta 2 y son gratuitas durante toda la visita.",
      },
      fr: {
        title: "Stationnement",
        content:
          "Le parking des patients se trouve au sous-sol du bâtiment B, ouvert de 7h30 à 21h00. Les 2 premières heures sont gratuites avec un rendez-vous ou un ticket validé. Les places accessibles sont près de l'ascenseur de la porte 2 et gratuites pendant la visite.",
      },
      ar: {
        title: "مواقف السيارات",
        content:
          "مواقف المرضى في القبو بالمبنى B، مفتوحة من 7:30 صباحًا حتى 9:00 مساءً. أول ساعتين مجانًا مع موعد أو تذكرة دور مختومة. مواقف ذوي الاحتياجات بجوار مصعد البوابة 2 ومجانية طوال الزيارة.",
      },
    },
  },
  {
    key: "fees",
    category: "fees",
    title: "Consultation fees",
    content:
      "Consultation fees are shown on each doctor's profile before you book. General Medicine starts at INR 400, specialists start at INR 600, and follow-up visits within 14 days are billed at 50%. Payment is accepted at reception by cash, card or UPI after the visit. Chat can quote the exact fee for a doctor but cannot take payment.",
    keywords: ["fees", "cost", "price", "charges", "consultation fee", "payment", "upi"],
    translations: {
      hi: {
        title: "परामर्श शुल्क",
        content:
          "बुकिंग से पहले हर डॉक्टर की प्रोफ़ाइल पर परामर्श शुल्क दिखता है। जनरल मेडिसिन INR 400 से शुरू, विशेषज्ञ INR 600 से शुरू, और 14 दिनों के भीतर फॉलो-अप 50% पर। भुगतान विज़िट के बाद रिसेप्शन पर नकद, कार्ड या UPI से। चैट सटीक शुल्क बता सकता है लेकिन भुगतान नहीं ले सकता।",
      },
      es: {
        title: "Tarifas de consulta",
        content:
          "Las tarifas aparecen en el perfil de cada médico antes de reservar. Medicina General desde INR 400, especialistas desde INR 600, y las revisiones dentro de 14 días al 50%. El pago se realiza en recepción con efectivo, tarjeta o UPI después de la visita. El chat puede indicar la tarifa exacta pero no cobra.",
      },
      fr: {
        title: "Tarifs de consultation",
        content:
          "Les tarifs sont affichés sur le profil de chaque médecin avant la réservation. Médecine générale à partir de 400 INR, spécialistes à partir de 600 INR, et les suivis sous 14 jours à 50 %. Le paiement se fait à l'accueil en espèces, carte ou UPI après la visite. Le chat peut indiquer le tarif exact mais ne prend pas de paiement.",
      },
      ar: {
        title: "رسوم الاستشارة",
        content:
          "تظهر رسوم الاستشارة في ملف كل طبيب قبل الحجز. الطب العام يبدأ من 400 روبية، والأطباء المتخصصون من 600 روبية، ومتابعة خلال 14 يومًا بنصف السعر. الدفع في الاستقبال نقدًا أو بالبطاقة أو UPI بعد الزيارة. يمكن للمحادثة ذكر الرسوم بدقة لكنها لا تحصّل المدفوعات.",
      },
    },
  },
  {
    key: "insurance",
    category: "insurance",
    title: "Insurance and cashless claims",
    content:
      "MediQueue supports cashless treatment with Star Health, HDFC Ergo, ICICI Lombard and government Ayushman Bharat schemes. Bring your policy card and a photo ID. Cashless approval usually takes 30 to 60 minutes. Chat cannot confirm coverage; reception can verify your policy before the visit.",
    keywords: ["insurance", "cashless", "mediclaim", "coverage", "policy", "ayushman"],
    translations: {
      hi: {
        title: "बीमा और कैशलेस दावे",
        content:
          "मेडीक्यू स्टार हेल्थ, HDFC एर्गो, ICICI लोम्बार्ड और सरकारी आयुष्मान भारत योजनाओं के साथ कैशलेस उपचार का समर्थन करता है। अपना पॉलिसी कार्ड और फोटो आईडी लाएँ। कैशलेस स्वीकृति में आमतौर पर 30 से 60 मिनट लगते हैं। चैट कवरेज की पुष्टि नहीं कर सकता; रिसेप्शन विज़िट से पहले पॉलिसी जाँच सकता है।",
      },
      es: {
        title: "Seguros y reembolsos",
        content:
          "MediQueue acepta tratamiento sin pago con Star Health, HDFC Ergo, ICICI Lombard y el programa gubernamental Ayushman Bharat. Traiga su tarjeta de póliza y una identificación con foto. La aprobación suele tardar de 30 a 60 minutos. El chat no puede confirmar la cobertura; recepción puede verificarla antes de la visita.",
      },
      fr: {
        title: "Assurance et tiers payant",
        content:
          "MediQueue accepte le tiers payant avec Star Health, HDFC Ergo, ICICI Lombard et le programme Ayushman Bharat. Apportez votre carte de police et une pièce d'identité avec photo. L'accord prend généralement 30 à 60 minutes. Le chat ne peut pas confirmer la couverture ; l'accueil peut vérifier votre police avant la visite.",
      },
      ar: {
        title: "التأمين والمطالبات",
        content:
          "يدعم ميديكيو العلاج بدون دفع نقدي مع Star Health وHDFC Ergo وICICI Lombard وبرنامج أيوشمان بهارات الحكومي. أحضر بطاقة التأمين وهوية بالصورة. تستغرق الموافقة عادة من 30 إلى 60 دقيقة. لا تستطيع المحادثة تأكيد التغطية، لكن الاستقبال يمكنه التحقق منها قبل الزيارة.",
      },
    },
  },
  {
    key: "documents",
    category: "documents",
    title: "What to bring",
    content:
      "Please bring a government photo ID, your appointment or token confirmation, your insurance card if you have one, a list of medicines you take, and any recent test reports related to this visit. For a child, bring the child's ID and the guardian's ID.",
    keywords: ["documents", "bring", "id", "proof", "insurance card", "reports"],
    translations: {
      hi: {
        title: "क्या लाना है",
        content:
          "कृपया सरकारी फोटो आईडी, अपॉइंटमेंट या टोकन पुष्टि, बीमा कार्ड (यदि हो), आप द्वारा ली जाने वाली दवाओं की सूची, और इस विज़िट से जुड़ी हाल की जाँच रिपोर्ट लाएँ। बच्चे के लिए बच्चे की आईडी और अभिभावक की आईडी लाएँ।",
      },
      es: {
        title: "Qué traer",
        content:
          "Traiga una identificación oficial con foto, la confirmación de su cita o turno, su tarjeta de seguro si tiene, una lista de los medicamentos que toma y los análisis recientes relacionados con esta visita. Para un niño, traiga la identificación del niño y del tutor.",
      },
      fr: {
        title: "À apporter",
        content:
          "Apportez une pièce d'identité officielle avec photo, la confirmation de rendez-vous ou de ticket, votre carte d'assurance le cas échéant, la liste de vos médicaments et vos analyses récentes liées à cette visite. Pour un enfant, apportez sa pièce d'identité et celle du tuteur.",
      },
      ar: {
        title: "ما يجب إحضاره",
        content:
          "يرجى إحضار هوية حكومية بالصورة، وتأكيد الموعد أو تذكرة الدور، وبطاقة التأمين إن وجدت، وقائمة الأدوية التي تتناولها، وأحدث نتائج التحاليل المتعلقة بهذه الزيارة. للطفل، أحضر هوية الطفل وهوية المرافق.",
      },
    },
  },
  {
    key: "preparation",
    category: "preparation",
    title: "Preparing for your visit",
    content:
      "Arrive 10 minutes before your appointment so reception can check you in. For most consultations, eat and drink normally. If your doctor ordered fasting blood tests, do not eat for 8 to 12 hours and drink only water. For imaging studies, follow the specific instructions given by the radiology team. If you are unsure, ask the clinic before your visit.",
    keywords: ["prepare", "preparation", "fasting", "empty stomach", "blood test", "arrive"],
    translations: {
      hi: {
        title: "विज़िट की तैयारी",
        content:
          "रिसेप्शन पर चेक-इन के लिए अपॉइंटमेंट से 10 मिनट पहले पहुँचें। अधिकांश परामर्शों के लिए सामान्य रूप से खाएँ-पिएँ। यदि डॉक्टर ने खाली पेट ब्लड टेस्ट कहा है, तो 8 से 12 घंटे कुछ न खाएँ और केवल पानी पिएँ। इमेजिंग के लिए रेडियोलॉजी टीम के निर्देश मानें। यदि संदेह हो तो विज़िट से पहले क्लिनिक से पूछें।",
      },
      es: {
        title: "Prepararse para la visita",
        content:
          "Llegue 10 minutos antes para que recepción lo registre. Para la mayoría de consultas, coma y beba con normalidad. Si su médico pidió análisis en ayunas, no coma durante 8 a 12 horas y beba solo agua. Para imágenes, siga las instrucciones del equipo de radiología. Si tiene dudas, pregunte a la clínica antes de la visita.",
      },
      fr: {
        title: "Préparer votre visite",
        content:
          "Arrivez 10 minutes avant le rendez-vous pour l'enregistrement à l'accueil. Pour la plupart des consultations, mangez et buvez normalement. Si votre médecin a demandé une prise de sang à jeun, ne mangez pas pendant 8 à 12 heures et buvez uniquement de l'eau. Pour l'imagerie, suivez les consignes de la radiologie. En cas de doute, demandez à la clinique avant la visite.",
      },
      ar: {
        title: "التحضير للزيارة",
        content:
          "احضر قبل الموعد بعشر دقائق لتسجيل الدخول في الاستقبال. لمعظم الاستشارات تناول الطعام والشراب بشكل طبيعي. إذا طلب الطبيب تحليل دم صائم، فلا تأكل لمدة 8 إلى 12 ساعة واشرب الماء فقط. لفحوصات التصوير اتبع تعليمات قسم الأشعة. إذا لم تكن متأكدًا فاسأل العيادة قبل الزيارة.",
      },
    },
  },
  {
    key: "app-help",
    category: "app",
    title: "Using the app and website",
    content:
      "You can book, reschedule or cancel appointments, join the queue, see live queue status and chat with us from the website or mobile app. Sign in with the email and password you used during registration. To reset a password, use 'Forgot password' on the login page and follow the emailed link. Payments are handled at the clinic; the app does not store card details.",
    keywords: ["app", "website", "login", "password", "register", "payment", "reset"],
    translations: {
      hi: {
        title: "ऐप और वेबसाइट का उपयोग",
        content:
          "आप वेबसाइट या मोबाइल ऐप से अपॉइंटमेंट बुक, बदल या रद्द कर सकते हैं, कतार में शामिल हो सकते हैं, लाइव स्थिति देख सकते हैं और हमसे चैट कर सकते हैं। उसी ईमेल और पासवर्ड से साइन इन करें जो पंजीकरण के समय था। पासवर्ड रीसेट के लिए लॉगिन पेज पर 'पासवर्ड भूल गए' चुनें और ईमेल लिंक का पालन करें। भुगतान क्लिनिक में होता है; ऐप कार्ड विवरण संग्रहीत नहीं करता।",
      },
      es: {
        title: "Uso de la app y el sitio web",
        content:
          "Puede reservar, cambiar o cancelar citas, unirse a la cola, ver el estado en vivo y chatear desde el sitio web o la app móvil. Inicie sesión con el correo y la contraseña del registro. Para restablecer la contraseña, use 'Olvidé mi contraseña' e siga el enlace del correo. Los pagos se realizan en la clínica; la app no guarda datos de tarjetas.",
      },
      fr: {
        title: "Utiliser l'application et le site",
        content:
          "Vous pouvez réserver, modifier ou annuler des rendez-vous, rejoindre la file, voir l'état en direct et discuter depuis le site ou l'application. Connectez-vous avec l'e-mail et le mot de passe de l'inscription. Pour réinitialiser le mot de passe, utilisez « Mot de passe oublié » et suivez le lien reçu par e-mail. Les paiements se font à la clinique ; l'application ne stocke pas les données de carte.",
      },
      ar: {
        title: "استخدام التطبيق والموقع",
        content:
          "يمكنك حجز المواعيد أو تغييرها أو إلغاءها، والانضمام إلى قائمة الانتظار، ومتابعة الحالة مباشرة، والدردشة معنا من الموقع أو التطبيق. سجّل الدخول بالبريد وكلمة المرور المستخدمة عند التسجيل. لإعادة تعيين كلمة المرور استخدم خيار 'نسيت كلمة المرور' واتبع الرابط في البريد. تتم المدفوعات في العيادة ولا يحفظ التطبيق بيانات البطاقات.",
      },
    },
  },
  {
    key: "cancellation",
    category: "policy",
    title: "Cancellation and reschedule policy",
    content:
      "You can cancel or reschedule online up to 2 hours before the appointment without a fee. Later cancellations and no-shows may be charged 25% of the consultation fee. If the clinic cancels or reschedules, you are not charged. The chat assistant always asks you to confirm before it changes or cancels an appointment.",
    keywords: ["cancel", "cancellation", "reschedule", "no-show", "policy", "late"],
    translations: {
      hi: {
        title: "रद्दीकरण और पुनर्निर्धारण नीति",
        content:
          "आप बिना शुल्क अपॉइंटमेंट से 2 घंटे पहले तक ऑनलाइन रद्द या पुनर्निर्धारित कर सकते हैं। बाद के रद्दीकरण और अनुपस्थिति पर परामर्श शुल्क का 25% लग सकता है। यदि क्लिनिक रद्द या बदलता है तो कोई शुल्क नहीं। चैट सहायक अपॉइंटमेंट बदलने या रद्द करने से पहले हमेशा पुष्टि माँगता है।",
      },
      es: {
        title: "Política de cancelación y cambio",
        content:
          "Puede cancelar o cambiar en línea hasta 2 horas antes sin cargo. Las cancelaciones posteriores y las ausencias pueden cobrarse al 25% de la tarifa. Si la clínica cancela o cambia, no se cobra. El asistente siempre pide confirmación antes de cambiar o cancelar una cita.",
      },
      fr: {
        title: "Politique d'annulation et de report",
        content:
          "Vous pouvez annuler ou reporter en ligne jusqu'à 2 heures avant le rendez-vous sans frais. Les annulations plus tardives et les absences peuvent être facturées à 25 % du tarif. Si la clinique annule ou reporte, rien n'est facturé. L'assistant demande toujours confirmation avant de modifier ou d'annuler un rendez-vous.",
      },
      ar: {
        title: "سياسة الإلغاء وإعادة الجدولة",
        content:
          "يمكنك الإلغاء أو إعادة الجدولة عبر الإنترنت حتى ساعتين قبل الموعد دون رسوم. قد تُفرض رسوم بنسبة 25% من قيمة الاستشارة عند الإلغاء المتأخر أو عدم الحضور. إذا ألغت العيادة أو أعادت الجدولة فلا تُفرض رسوم. يطلب المساعد التأكيد دائمًا قبل تغيير أو إلغاء أي موعد.",
      },
    },
  },
  {
    key: "pharmacy",
    category: "facility",
    title: "Pharmacy and laboratory",
    content:
      "The pharmacy is on the ground floor of Block A, open Monday to Saturday 8:00 AM to 9:00 PM and Sunday 9:00 AM to 2:00 PM. The laboratory is next to it and opens at 7:30 AM for fasting samples. Reports are shared through the patient dashboard, usually within 24 hours.",
    keywords: ["pharmacy", "laboratory", "lab", "blood test", "medicine", "reports"],
    translations: {
      hi: {
        title: "फार्मेसी और प्रयोगशाला",
        content:
          "फार्मेसी ब्लॉक A की भूतल पर है, सोमवार से शनिवार सुबह 8:00 से रात 9:00 तक और रविवार सुबह 9:00 से दोपहर 2:00 तक। प्रयोगशाला उसके बगल में है और खाली पेट नमूनों के लिए सुबह 7:30 बजे खुलती है। रिपोर्ट आमतौर पर 24 घंटे में मरीज़ डैशबोर्ड पर मिलती हैं।",
      },
      es: {
        title: "Farmacia y laboratorio",
        content:
          "La farmacia está en la planta baja del Bloque A, de lunes a sábado de 8:00 a 21:00 y domingo de 9:00 a 14:00. El laboratorio está al lado y abre a las 7:30 para muestras en ayunas. Los resultados se comparten en el panel del paciente, normalmente en 24 horas.",
      },
      fr: {
        title: "Pharmacie et laboratoire",
        content:
          "La pharmacie est au rez-de-chaussée du bâtiment A, du lundi au samedi de 8h00 à 21h00 et le dimanche de 9h00 à 14h00. Le laboratoire est à côté et ouvre à 7h30 pour les prélèvements à jeun. Les résultats sont disponibles dans l'espace patient, généralement sous 24 heures.",
      },
      ar: {
        title: "الصيدلية والمختبر",
        content:
          "الصيدلية في الطابق الأرضي من المبنى A، مفتوحة من الاثنين إلى السبت من 8:00 صباحًا حتى 9:00 مساءً والأحد من 9:00 صباحًا حتى 2:00 ظهرًا. المختبر بجوارها ويفتح الساعة 7:30 لعينات الصيام. تُشارك النتائج عبر لوحة المريض عادة خلال 24 ساعة.",
      },
    },
  },
  {
    key: "accessibility",
    category: "facility",
    title: "Accessibility",
    content:
      "The hospital has step-free entrances, wheelchair-accessible lifts and restrooms, and accessible parking next to Gate 2. Wheelchairs are available at reception at no cost. If you need help getting to your appointment, tell us in chat or call reception and we will arrange assistance.",
    keywords: ["wheelchair", "accessible", "disabled", "lift", "elevator", "assistance"],
    translations: {
      hi: {
        title: "सुलभता",
        content:
          "अस्पताल में बिना सीढ़ी वाले प्रवेश, व्हीलचेयर-सुलभ लिफ्ट और शौचालय, और गेट 2 के पास सुलभ पार्किंग है। व्हीलचेयर रिसेप्शन पर निःशुल्क उपलब्ध हैं। अपॉइंटमेंट तक सहायता चाहिए तो चैट में बताएँ या रिसेप्शन को कॉल करें, हम सहायता की व्यवस्था करेंगे।",
      },
      es: {
        title: "Accesibilidad",
        content:
          "El hospital tiene entradas sin escalones, ascensores y baños accesibles, y estacionamiento accesible junto a la Puerta 2. Hay sillas de ruedas disponibles en recepción sin costo. Si necesita ayuda para llegar a su cita, dígalo en el chat o llame a recepción.",
      },
      fr: {
        title: "Accessibilité",
        content:
          "L'hôpital dispose d'entrées sans marches, d'ascenseurs et de toilettes accessibles, et de places de parking près de la porte 2. Des fauteuils roulants sont disponibles gratuitement à l'accueil. Si vous avez besoin d'aide pour votre rendez-vous, indiquez-le dans le chat ou appelez l'accueil.",
      },
      ar: {
        title: "إمكانية الوصول",
        content:
          "يحتوي المستشفى على مداخل بدون درجات، ومصاعد ودورات مياه مناسبة للكراسي المتحركة، ومواقف قريبة من البوابة 2. تتوفر كراسي متحركة في الاستقبال مجانًا. إذا كنت بحاجة لمساعدة في الوصول إلى موعدك أخبرنا في المحادثة أو اتصل بالاستقبال.",
      },
    },
  },
  {
    key: "wifi",
    category: "facility",
    title: "Free Wi-Fi",
    content:
      "Free Wi-Fi is available in all waiting areas. Connect to the 'MediQueue-Guest' network and accept the terms on the welcome page. The network does not require a password and is filtered for public use, so avoid entering sensitive information on unfamiliar sites.",
    keywords: ["wifi", "wi-fi", "internet", "network", "password"],
    translations: {
      hi: {
        title: "निःशुल्क वाई-फाई",
        content:
          "सभी प्रतीक्षा क्षेत्रों में निःशुल्क वाई-फाई है। 'MediQueue-Guest' नेटवर्क से जुड़ें और स्वागत पेज पर शर्तें स्वीकार करें। पासवर्ड की आवश्यकता नहीं है और नेटवर्क सार्वजनिक उपयोग के लिए फ़िल्टर किया गया है, इसलिए अपरिचित साइटों पर संवेदनशील जानकारी न डालें।",
      },
      es: {
        title: "Wi-Fi gratuito",
        content:
          "Hay Wi-Fi gratis en todas las salas de espera. Conéctese a 'MediQueue-Guest' y acepte los términos en la página de bienvenida. No requiere contraseña y está filtrado para uso público, así que evite introducir datos sensibles en sitios desconocidos.",
      },
      fr: {
        title: "Wi-Fi gratuit",
        content:
          "Le Wi-Fi est gratuit dans toutes les salles d'attente. Connectez-vous à « MediQueue-Guest » et acceptez les conditions sur la page d'accueil. Aucun mot de passe n'est requis et le réseau est filtré pour un usage public ; évitez de saisir des informations sensibles sur des sites inconnus.",
      },
      ar: {
        title: "واي فاي مجاني",
        content:
          "يتوفر واي فاي مجاني في جميع مناطق الانتظار. اتصل بشبكة 'MediQueue-Guest' واقبل الشروط في صفحة الترحيب. لا تحتاج كلمة مرور والشبكة مفلترة للاستخدام العام، لذا تجنب إدخال معلومات حساسة في مواقع غير مألوفة.",
      },
    },
  },
  {
    key: "emergency",
    category: "emergency",
    title: "Emergencies",
    content:
      "MediQueue is not an emergency department. For chest pain, difficulty breathing, heavy bleeding, stroke signs, a severe allergic reaction or any life-threatening symptoms, call emergency services (112 in India) or go to the nearest emergency room immediately. Do not wait for a chat reply or an appointment.",
    keywords: ["emergency", "ambulance", "chest pain", "breathing", "bleeding", "112"],
    translations: {
      hi: {
        title: "आपातकाल",
        content:
          "मेडीक्यू आपातकालीन विभाग नहीं है। सीने में दर्द, साँस लेने में कठिनाई, अत्यधिक रक्तस्राव, स्ट्रोक के लक्षण, गंभीर एलर्जी या जानलेवा लक्षणों में तुरंत आपातकालीन सेवा (भारत में 112) को कॉल करें या निकटतम आपातकालीन कक्ष में जाएँ। चैट उत्तर या अपॉइंटमेंट का इंतज़ार न करें।",
      },
      es: {
        title: "Emergencias",
        content:
          "MediQueue no es un servicio de urgencias. Ante dolor en el pecho, dificultad para respirar, sangrado abundante, signos de accidente cerebrovascular, una reacción alérgica grave o cualquier síntoma potencialmente mortal, llame a los servicios de emergencia (112 en India) o acuda de inmediato a urgencias. No espere una respuesta del chat ni una cita.",
      },
      fr: {
        title: "Urgences",
        content:
          "MediQueue n'est pas un service d'urgences. En cas de douleur thoracique, difficulté à respirer, saignement important, signes d'AVC, réaction allergique grave ou tout symptôme vital, appelez les urgences (112 en Inde) ou rendez-vous immédiatement aux urgences. N'attendez pas une réponse du chat ni un rendez-vous.",
      },
      ar: {
        title: "الحالات الطارئة",
        content:
          "ميديكيو ليس قسم طوارئ. عند ألم الصدر أو صعوبة التنفس أو النزيف الشديد أو علامات الجلطة أو رد فعل تحسسي خطير أو أي أعراض مهددة للحياة، اتصل بخدمات الطوارئ (112 في الهند) أو اذهب فورًا إلى أقرب قسم طوارئ. لا تنتظر رد المحادثة أو الموعد.",
      },
    },
  },
];

const CLINIC_NAMES = {
  en: "MediQueue City Hospital",
  hi: "मेडीक्यू सिटी अस्पताल",
  es: "Hospital MediQueue City",
  fr: "Hôpital MediQueue City",
  ar: "مستشفى ميديكيو سيتي",
};

async function ensureClinicInfo() {
  for (const info of CLINIC_INFO) {
    await ClinicInfo.findOneAndUpdate(
      { key: info.key },
      { $set: info },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

async function ensureDepartments() {
  for (const department of DEPARTMENTS) {
    await Department.findOneAndUpdate(
      { name: department.name },
      { $setOnInsert: department },
      { upsert: true, new: true }
    );
  }
}

/**
 * Insert a demo user only when its email does not already exist.
 *
 * Demo seeding used to be all-or-nothing: any real account in the database
 * (for example a patient who registered through the app) stopped the demo
 * users from being created, which left Atlas without an admin login. Upserting
 * with $setOnInsert keeps existing accounts untouched while making the demo
 * accounts available in both a fresh and a populated database.
 */
async function upsertDemoUser(data) {
  const existing = await User.findOne({ email: data.email }).select("_id").lean();
  if (existing) {
    // Skip the expensive bcrypt hash when the demo account already exists.
    return { user: existing, inserted: false };
  }

  const password = await bcrypt.hash(data.password, 10);
  const user = await User.findOneAndUpdate(
    { email: data.email },
    { $setOnInsert: { ...data, password } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { user, inserted: true };
}

async function upsertDoctorProfile(userId, profile) {
  const existing = await DoctorProfile.findOne({ userId }).select("_id").lean();
  await DoctorProfile.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, ...profile } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return !existing;
}

async function seedDatabase() {
  await ensureDepartments();
  await ensureClinicInfo();

  if (process.env.SEED_DEMO === "false") return;

  const general = await Department.findOne({ name: "General Medicine" }).lean();
  const cardiology = await Department.findOne({ name: "Cardiology" }).lean();
  const pediatrics = await Department.findOne({ name: "Pediatrics" }).lean();

  const admin = await upsertDemoUser({
    role: "admin",
    name: "System Admin",
    email: "admin@mediqueue.com",
    phone: "9000000001",
    password: "Admin@123",
    status: "approved",
    consentAccepted: true,
  });

  const receptionist = await upsertDemoUser({
    role: "receptionist",
    name: "Ria Reception",
    email: "reception@mediqueue.com",
    phone: "9000000002",
    password: "Reception@123",
    status: "approved",
    consentAccepted: true,
  });

  const doctorUser = await upsertDemoUser({
    role: "doctor",
    name: "Dr. Ananya Sharma",
    email: "doctor@mediqueue.com",
    phone: "9000000003",
    password: "Doctor@123",
    status: "approved",
    specialty: "Cardiology",
    licenseNumber: "MED-DEMO-001",
    department: cardiology?._id,
    consentAccepted: true,
  });

  const doctor2User = await upsertDemoUser({
    role: "doctor",
    name: "Dr. Rohan Mehta",
    email: "doctor2@mediqueue.com",
    phone: "9000000005",
    password: "Doctor@123",
    status: "approved",
    specialty: "General Physician",
    licenseNumber: "MED-DEMO-002",
    department: general?._id,
    consentAccepted: true,
  });

  const patient = await upsertDemoUser({
    role: "patient",
    name: "Priya Patient",
    email: "patient@mediqueue.com",
    phone: "9000000004",
    password: "Patient@123",
    status: "approved",
    consentAccepted: true,
    patientProfile: {
      dateOfBirth: "1994-05-12",
      gender: "female",
      address: "42 Lake View Road",
      bloodGroup: "O+",
      emergencyContact: "9000000099",
    },
  });

  const insertedProfiles = await Promise.all([
    upsertDoctorProfile(doctorUser.user._id, {
      department: cardiology?._id,
      qualification: "MBBS, MD (Cardiology)",
      experience: 9,
      hospitalName: "MediQueue City Hospital",
      clinicAddress: "First floor, Block B",
      consultationFee: 600,
      bio: "Cardiologist focused on preventive heart care and hypertension management.",
      dailyPatientCapacity: 24,
      avgConsultationMinutes: 12,
      availability: WEEKDAY_AVAILABILITY,
      profileCompleted: true,
      verificationStatus: "approved",
      isAvailable: true,
    }),
    upsertDoctorProfile(doctor2User.user._id, {
      department: general?._id,
      qualification: "MBBS, MD (General Medicine)",
      experience: 6,
      hospitalName: "MediQueue City Hospital",
      clinicAddress: "Ground floor, Block A",
      consultationFee: 400,
      bio: "General physician for everyday health concerns, fevers and checkups.",
      dailyPatientCapacity: 30,
      avgConsultationMinutes: 8,
      availability: WEEKDAY_AVAILABILITY,
      profileCompleted: true,
      verificationStatus: "approved",
      isAvailable: true,
    }),
  ]);

  const insertedUsers = [
    admin,
    receptionist,
    doctorUser,
    doctor2User,
    patient,
  ].filter((entry) => entry.inserted);

  if (insertedUsers.length || insertedProfiles.some(Boolean)) {
    console.log("Seeded demo database");
    console.log("  admin@mediqueue.com / Admin@123");
    console.log("  reception@mediqueue.com / Reception@123");
    console.log("  doctor@mediqueue.com / Doctor@123");
    console.log("  doctor2@mediqueue.com / Doctor@123");
    console.log("  patient@mediqueue.com / Patient@123");
  }

  return {
    admin: admin.user,
    receptionist: receptionist.user,
    doctorUser: doctorUser.user,
    doctor2User: doctor2User.user,
    patient: patient.user,
    pediatrics,
  };
}

module.exports = { seedDatabase, ensureDepartments, ensureClinicInfo, CLINIC_INFO };
