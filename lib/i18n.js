// Translations for Vula's WhatsApp flow — English, isiZulu, isiXhosa, Afrikaans.
//
// IMPORTANT: the zu/xh/af translations below were drafted by an AI model, not
// a native speaker. English and Afrikaans confidence is reasonably high;
// isiZulu and isiXhosa confidence is lower, especially for natural
// conversational register aimed at teenagers. These MUST be reviewed by a
// native speaker of each language before this ships to real students —
// this is not a formality, it's the same accuracy bar applied to the
// career/subject research in CAREER_RESEARCH_DRAFT.md. Do not treat this
// file as final without that review.

const LANGUAGES = [
  { id: "en", title: "English" },
  { id: "zu", title: "isiZulu" },
  { id: "xh", title: "isiXhosa" },
  { id: "af", title: "Afrikaans" },
];

const DEFAULT_LANG = "en";

const STRINGS = {
  en: {
    languageQuestion: "🌍 Which language would you like to use?",
    languageListButton: "Choose language",
    welcome:
      "👋 Welcome to *Vula* — your free career guide on WhatsApp!\n\n" +
      "Before we start, a quick note on your privacy:\n" +
      "• We'll ask a few details (name, school, age, city, grade) to give you accurate guidance.\n" +
      "• Your info is kept private and used only to help you.\n" +
      "• We may show you sponsor college/bursary options that match your results — reaching out to them is always your choice.\n" +
      "• If you're under 18, please make sure a *parent or guardian* is happy for you to continue.\n\n" +
      "Read how we protect your info: {privacyUrl}\n\n" +
      "Tap *I agree* to begin. 👇",
    moreInfo:
      "🔒 *How Vula uses your info*\n\n" +
      "• We only collect what's needed to guide you: name, school, age, city, grade and your answers.\n" +
      "• We never ask for ID numbers, passwords or banking details.\n" +
      "• Vula is funded by sponsoring colleges — we may show you their courses if they match your results, but we *never* share your personal details with them. Reaching out is always your choice.\n" +
      "• You can reply *DELETE* at any time to remove your information.\n\n" +
      "Full policy: {privacyUrl}\n\n" +
      "Tap *I agree* to continue. 👇",
    consentRetry: "To use Vula we need your agreement to continue. Tap *I agree*, or *More info* to learn more. 👇",
    askName: "Thank you! 🙌\n\nLet's begin — what's your *first name*?",
    thankName: (name) => `Nice to meet you, ${name}! 🎓\n\nWhich school do you attend?`,
    thankSchool: (school) => `Got it — ${school}. 🏫\n\nHow old are you? (e.g. 16)`,
    invalidAge: "Please reply with a valid age between 12 and 25.",
    askCity: "Thanks! 🎂\n\nWhich city or town are you closest to? (e.g. Cape Town, Johannesburg, Durban)",
    askSuburb: "Got it! 📍\n\nAnd which suburb or area do you live in?",
    askGrade: (suburb) => `${suburb} — noted.\n\nWhat grade are you in?`,
    invalidGrade: "Please choose your grade below 👇",
    assessmentIntro: (name) =>
      `✅ Thanks ${name}, your profile is set!\n\n` +
      `📋 *Now the assessment* — 30 quick questions about what you enjoy. ` +
      `There are no right or wrong answers, just tap what feels like *you*. ` +
      `It takes about 4 minutes and you can pause anytime. 💡`,
    invalidAssessmentAnswer: "Please tap one of the options below 👇\n\n",
    completionIntro: (name, count) => `🎉 You did it, ${name}! You answered all ${count} questions.\n\n`,
    resultsIntro: "Here's what your profile reveals 👇",
    gradeTip10: "You're in Grade 10 — perfect timing to choose the right subjects. 🎯",
    gradeTip11: "You're in Grade 11 — there may still be time to adjust subjects. ⏳",
    gradeTip12: "You're in Grade 12 — focus on the marks and applications these paths need. 📨",
    yourTopStrengths: "🧭 *Your top strengths:*",
    careersThatFit: "💼 *Careers that fit you:*",
    exploreInstruction: (n) => `\n👉 Reply with a *number (1–${n})* to explore a career — why it fits you, the subjects you'll need, and how to qualify.`,
    exploreMatchesHeader: "Now explore your matches 👇\n\n",
    menuHeader: "🔁 *Explore another career — reply a number:*\n",
    menuFooter: "\n_Reply RESTART to retake the assessment._",
    invalidExplore: "Please reply with a number from the list 👇",
    fallbackRestart: "Reply RESTART to begin again.",
    careerWhy: "✅ *Why it fits you:*",
    careerSubjects: "📚 *Subjects you'll need:*",
    careerQual: "🎓 *How to qualify:*",
    sponsoredNear: "\n\n🏫 *Sponsored option near you:*",
    deleteConfirm: "🗑️ Done — your information has been deleted from Vula. Reply *Hi* anytime to start fresh.",
    stopConfirm: "👋 You won't receive more messages from Vula. Reply *Hi* anytime to resume. To delete your info, reply *DELETE*.",
    reportNotReady: "You'll get your report once you finish the assessment. Reply *Hi* to begin.",
    reportCaption: (name) =>
      `📄 *Here's your full Vula Career Report, ${name}!*\n\n` +
      "It lays out your strengths, your matched careers, the exact subjects you'll need and how to qualify. " +
      "Save it and share it with your parents or teacher. 🎓\n\n" +
      "_Reply REPORT anytime to get it again._",
    yesnoButtons: ["No", "Maybe", "Yes"],
    gradeButtons: ["Grade 10", "Grade 11", "Grade 12"],
    consentButtons: ["I agree", "More info"],
  },

  // isiZulu — drafted, needs native-speaker review before launch.
  zu: {
    languageQuestion: "🌍 Ufuna ukusebenzisa luphi ulimi?",
    languageListButton: "Khetha ulimi",
    welcome:
      "👋 Siyakwamukela ku-*Vula* — umhlahlandlela wakho womsebenzi wamahhala ku-WhatsApp!\n\n" +
      "Ngaphambi kokuqala, umyalezo omfushane mayelana nobumfihlo bakho:\n" +
      "• Sizobuza imininingwane embalwa (igama, isikole, iminyaka, idolobha, ibanga) ukuze sikunikeze isiqondiso esiqondile.\n" +
      "• Ulwazi lwakho lugcinwa luyimfihlo futhi lusetshenziselwa ukukusiza kuphela.\n" +
      "• Singakubonisa izinketho zamakolishi/ama-bursary axhasayo ahambelana nemiphumela yakho — ukuxhumana nawo kuhlala kuwukukhetha kwakho.\n" +
      "• Uma umncane kune-18, sicela uqinisekise ukuthi *umzali noma umgcini* wakho uyavuma ukuthi uqhubeke.\n\n" +
      "Funda ukuthi sivikela kanjani ulwazi lwakho: {privacyUrl}\n\n" +
      "Cindezela *Ngiyavuma* ukuze siqale. 👇",
    moreInfo:
      "🔒 *Indlela i-Vula esebenzisa ngayo ulwazi lwakho*\n\n" +
      "• Siqoqa kuphela lokho okudingekayo ukuze sikuqondise: igama, isikole, iminyaka, idolobha, ibanga nezimpendulo zakho.\n" +
      "• Asisoze sacela izinombolo zomazisi, amaphasiwedi noma imininingwane yebhange.\n" +
      "• I-Vula ixhaswa ngamakolishi axhasayo — singakubonisa izifundo zawo uma zihambelana nemiphumela yakho, kodwa *asisoze* sabelana nawo ngemininingwane yakho yomuntu siqu. Ukuxhumana nawo kuhlala kuwukukhetha kwakho.\n" +
      "• Ungaphendula ngo-*DELETE* noma nini ukuze ususe ulwazi lwakho.\n\n" +
      "Inqubomgomo egcwele: {privacyUrl}\n\n" +
      "Cindezela *Ngiyavuma* ukuze uqhubeke. 👇",
    consentRetry: "Ukuze usebenzise i-Vula, sidinga imvume yakho ukuze siqhubeke. Cindezela *Ngiyavuma*, noma *Imininingwane engeziwe* ukuze ufunde kabanzi. 👇",
    askName: "Ngiyabonga! 🙌\n\nAsiqale — *igama lakho lokuqala* ungubani?",
    thankName: (name) => `Kuhle ukukwazi, ${name}! 🎓\n\nUfunda kuliphi isikole?`,
    thankSchool: (school) => `Kulungile — ${school}. 🏫\n\nUneminyaka emingaki? (isb. 16)`,
    invalidAge: "Sicela uphendule ngeminyaka efanele phakathi kuka-12 no-25.",
    askCity: "Ngiyabonga! 🎂\n\nUseduze kabani nedolobha? (isb. iKapa, eGoli, eThekwini)",
    askSuburb: "Kulungile! 📍\n\nUhlala kuliphi ilokishi noma indawo?",
    askGrade: (suburb) => `${suburb} — sekubhaliwe.\n\nUsebangeni bani?`,
    invalidGrade: "Sicela ukhethe ibanga lakho ngezansi 👇",
    assessmentIntro: (name) =>
      `✅ Ngiyabonga ${name}, iphrofayela yakho isilungile!\n\n` +
      `📋 *Manje uhlolo* — imibuzo engu-30 esheshayo mayelana nalokho okuthanda ukukwenza. ` +
      `Awukho impendulo elungile noma engalungile, cindezela lokho okuzwakala *unguwe*. ` +
      `Kuthatha imizuzu engu-4 futhi ungakwazi ukuyeka noma nini bese uqhubeka. 💡`,
    invalidAssessmentAnswer: "Sicela ucindezele okukodwa kwezinketho ezingezansi 👇\n\n",
    completionIntro: (name, count) => `🎉 Ukwenzile, ${name}! Uphendule yonke imibuzo engu-${count}.\n\n`,
    resultsIntro: "Nakhu okuvezwa iphrofayela yakho 👇",
    gradeTip10: "Usebangeni le-10 — yisikhathi esihle sokukhetha izifundo ezifanele. 🎯",
    gradeTip11: "Usebangeni le-11 — kungenzeka kusenesikhathi sokulungisa izifundo. ⏳",
    gradeTip12: "Usebangeni le-12 — gxila emamaki nasezicelweni ezidingwa yilezi zindlela. 📨",
    yourTopStrengths: "🧭 *Amandla akho aphezulu:*",
    careersThatFit: "💼 *Imisebenzi ekufanele:*",
    exploreInstruction: (n) => `\n👉 Phendula nge-*nombolo (1–${n})* ukuze uhlole umsebenzi — ukuthi kukufanele kanjani, izifundo ozidingayo, nokuthi ungazuza kanjani izimfanelo.`,
    exploreMatchesHeader: "Manje hlola imisebenzi ekufanele kuwe 👇\n\n",
    menuHeader: "🔁 *Hlola omunye umsebenzi — phendula ngenombolo:*\n",
    menuFooter: "\n_Phendula ngo-RESTART ukuze uphinde uhlolwe futhi._",
    invalidExplore: "Sicela uphendule ngenombolo esohlwini 👇",
    fallbackRestart: "Phendula ngo-RESTART ukuze uqale futhi.",
    careerWhy: "✅ *Kungani kukufanele:*",
    careerSubjects: "📚 *Izifundo ozidingayo:*",
    careerQual: "🎓 *Ungazuza kanjani izimfanelo:*",
    sponsoredNear: "\n\n🏫 *Inketho exhaswayo eduze kwakho:*",
    deleteConfirm: "🗑️ Kwenziwe — ulwazi lwakho lususiwe ku-Vula. Phendula ngo-*Hi* noma nini ukuze uqale kabusha.",
    stopConfirm: "👋 Ngeke usaphinde uthole imiyalezo evela ku-Vula. Phendula ngo-*Hi* noma nini ukuze uqhubeke. Ukuze ususe ulwazi lwakho, phendula ngo-*DELETE*.",
    reportNotReady: "Uzothola umbiko wakho lapho usuqedile uhlolo. Phendula ngo-*Hi* ukuze uqale.",
    reportCaption: (name) =>
      `📄 *Nawu umbiko wakho ogcwele we-Vula Career Report, ${name}!*\n\n` +
      "Ubeka amandla akho, imisebenzi ekufanele, izifundo ozidingayo nokuthi ungazuza kanjani izimfanelo. " +
      "Uwugcine futhi wabelane ngawo nabazali noma othisha bakho. 🎓\n\n" +
      "_Phendula ngo-REPORT noma nini ukuze uwuthole futhi._",
    yesnoButtons: ["Cha", "Mhlawumbe", "Yebo"],
    gradeButtons: ["Ibanga 10", "Ibanga 11", "Ibanga 12"],
    consentButtons: ["Ngiyavuma", "Okuningi"],
  },

  // isiXhosa — drafted, needs native-speaker review before launch.
  xh: {
    languageQuestion: "🌍 Ufuna ukusebenzisa luphi ulwimi?",
    languageListButton: "Khetha ulwimi",
    welcome:
      "👋 Wamkelekile ku-*Vula* — isikhokelo sakho semisebenzi samahhala kwi-WhatsApp!\n\n" +
      "Phambi kokuqala, umyalezo omfutshane malunga nabucala bakho:\n" +
      "• Siza kubuza iinkcukacha ezimbalwa (igama, isikolo, iminyaka, isixeko, ibanga) ukukunika isikhokelo esichanekileyo.\n" +
      "• Ulwazi lwakho lugcinwa lubucala kwaye lusetyenziselwa ukukunceda kuphela.\n" +
      "• Sinokukubonisa iinketho zamakholeji/ii-bursary ezixhasayo ezihambelana neziphumo zakho — ukuqhagamshelana nazo kuhlala kukukhetha kwakho.\n" +
      "• Ukuba uneminyaka engaphantsi kwe-18, nceda uqinisekise ukuba *umzali okanye umgcini* wakho uyavuma ukuba uqhubeke.\n\n" +
      "Funda indlela esikhusela ngayo ulwazi lwakho: {privacyUrl}\n\n" +
      "Cofa u-*Ndiyavuma* ukuze siqale. 👇",
    moreInfo:
      "🔒 *Indlela i-Vula esebenzisa ngayo ulwazi lwakho*\n\n" +
      "• Siqokelela kuphela oko kufunekayo ukuze sikukhokele: igama, isikolo, iminyaka, isixeko, ibanga kunye neempendulo zakho.\n" +
      "• Asisoze sicele iinombolo zesazisi, iipasiwedi okanye iinkcukacha zebhanki.\n" +
      "• I-Vula ixhaswa ngamakholeji axhasayo — sinokukubonisa izifundo zawo ukuba ziyahambelana neziphumo zakho, kodwa *asisoze* sabelane nawo ngeenkcukacha zakho zobuqu. Ukuqhagamshelana nawo kuhlala kukukhetha kwakho.\n" +
      "• Ungaphendula nge-*DELETE* nangaliphi na ixesha ukususa ulwazi lwakho.\n\n" +
      "Umgaqo-nkqubo opheleleyo: {privacyUrl}\n\n" +
      "Cofa u-*Ndiyavuma* ukuze uqhubeke. 👇",
    consentRetry: "Ukuze usebenzise i-Vula sifuna imvume yakho ukuze siqhubeke. Cofa u-*Ndiyavuma*, okanye u-*Ulwazi olongezelelweyo* ukuze ufunde ngokugqithiseleyo. 👇",
    askName: "Enkosi! 🙌\n\nMasiqale — ngubani *igama lakho lokuqala*?",
    thankName: (name) => `Kumnandi ukukwazi, ${name}! 🎓\n\nUfunda kweliphi isikolo?`,
    thankSchool: (school) => `Kulungile — ${school}. 🏫\n\nUneminyaka emingaphi? (umz. 16)`,
    invalidAge: "Nceda uphendule ngeminyaka esemthethweni phakathi kwe-12 ne-25.",
    askCity: "Enkosi! 🎂\n\nUkufuphi nesiphi isixeko? (umz. iKapa, eRhawutini, eThekwini)",
    askSuburb: "Kulungile! 📍\n\nUhlala kweliphi ilokishi okanye indawo?",
    askGrade: (suburb) => `${suburb} — kuqatshelwe.\n\nUkweliphi ibanga?`,
    invalidGrade: "Nceda ukhethe ibanga lakho ngezantsi 👇",
    assessmentIntro: (name) =>
      `✅ Enkosi ${name}, iprofayile yakho isele ilungile!\n\n` +
      `📋 *Ngoku uvavanyo* — imibuzo engama-30 ekhawulezayo malunga noko ukuthandayo. ` +
      `Akukho mpendulo ichanekileyo okanye engachanekanga, cofa oko kuvakala *ngunguwe*. ` +
      `Kuthatha imizuzu emalunga ne-4 kwaye ungayeka nanini na uze uqhubeke. 💡`,
    invalidAssessmentAnswer: "Nceda ucofe enye yeenketho ezingezantsi 👇\n\n",
    completionIntro: (name, count) => `🎉 Uyenzile, ${name}! Uphendule yonke imibuzo engama-${count}.\n\n`,
    resultsIntro: "Nantsi into ebonisa iprofayile yakho 👇",
    gradeTip10: "Ukwibanga le-10 — lixesha elifanelekileyo lokukhetha izifundo ezichanekileyo. 🎯",
    gradeTip11: "Ukwibanga le-11 — kusenokubakho ithuba lokulungisa izifundo. ⏳",
    gradeTip12: "Ukwibanga le-12 — gxila kumanqaku nakwizicelo ezifunwa zezi ndlela. 📨",
    yourTopStrengths: "🧭 *Amandla akho aphezulu:*",
    careersThatFit: "💼 *Imisebenzi ekufanelekileyo:*",
    exploreInstruction: (n) => `\n👉 Phendula nge-*nombolo (1–${n})* ukuze uphonononge umsebenzi — ukuba kukulungele njani, izifundo ozidingayo, nendlela onokufaneleka ngayo.`,
    exploreMatchesHeader: "Ngoku phonononga imisebenzi ekufanelekileyo 👇\n\n",
    menuHeader: "🔁 *Phonononga omnye umsebenzi — phendula ngenombolo:*\n",
    menuFooter: "\n_Phendula nge-RESTART ukuze uphinde uvavanywe._",
    invalidExplore: "Nceda uphendule ngenombolo esuka kuluhlu 👇",
    fallbackRestart: "Phendula nge-RESTART ukuze uqale kwakhona.",
    careerWhy: "✅ *Kutheni ikulungele:*",
    careerSubjects: "📚 *Izifundo ozidingayo:*",
    careerQual: "🎓 *Indlela onokufaneleka ngayo:*",
    sponsoredNear: "\n\n🏫 *Ukhetho oluxhaswayo olukufuphi:*",
    deleteConfirm: "🗑️ Kwenziwe — ulwazi lwakho lucinyiwe kwi-Vula. Phendula nge-*Hi* nanini na ukuze uqale ngokutsha.",
    stopConfirm: "👋 Awuzukuphinda ufumane imiyalezo evela kwi-Vula. Phendula nge-*Hi* nanini na ukuze uqhubeke. Ukususa ulwazi lwakho, phendula nge-*DELETE*.",
    reportNotReady: "Uza kufumana ingxelo yakho xa ugqibile uvavanyo. Phendula nge-*Hi* ukuze uqale.",
    reportCaption: (name) =>
      `📄 *Nantsi ingxelo yakho epheleleyo ye-Vula Career Report, ${name}!*\n\n` +
      "Ibeka amandla akho, imisebenzi ekufanelekileyo, izifundo ozidingayo nendlela onokufaneleka ngayo. " +
      "Yigcine kwaye wabelane ngayo nabazali okanye ootitshala bakho. 🎓\n\n" +
      "_Phendula nge-REPORT nanini na ukuze uyifumane kwakhona._",
    yesnoButtons: ["Hayi", "Mhlawumbi", "Ewe"],
    gradeButtons: ["Ibanga 10", "Ibanga 11", "Ibanga 12"],
    consentButtons: ["Ndiyavuma", "Ulwazi olongezelelweyo"],
  },

  // Afrikaans — drafted, recommend a native-speaker pass before launch.
  af: {
    languageQuestion: "🌍 Watter taal wil jy gebruik?",
    languageListButton: "Kies taal",
    welcome:
      "👋 Welkom by *Vula* — jou gratis loopbaangids op WhatsApp!\n\n" +
      "Voor ons begin, 'n kort noot oor jou privaatheid:\n" +
      "• Ons sal 'n paar besonderhede vra (naam, skool, ouderdom, stad, graad) om jou akkurate leiding te gee.\n" +
      "• Jou inligting word privaat gehou en slegs gebruik om jou te help.\n" +
      "• Ons wys dalk borg-kolleges/beurse wat by jou resultate pas — om hulle te kontak is altyd jou keuse.\n" +
      "• As jy onder 18 is, maak asseblief seker 'n *ouer of voog* is tevrede dat jy voortgaan.\n\n" +
      "Lees hoe ons jou inligting beskerm: {privacyUrl}\n\n" +
      "Druk *Ek stem saam* om te begin. 👇",
    moreInfo:
      "🔒 *Hoe Vula jou inligting gebruik*\n\n" +
      "• Ons versamel net wat nodig is om jou te lei: naam, skool, ouderdom, stad, graad en jou antwoorde.\n" +
      "• Ons vra nooit ID-nommers, wagwoorde of bankbesonderhede nie.\n" +
      "• Vula word deur borg-kolleges befonds — ons wys dalk hul kursusse as dit by jou resultate pas, maar ons deel *nooit* jou persoonlike besonderhede met hulle nie. Om hulle te kontak is altyd jou keuse.\n" +
      "• Jy kan enige tyd *DELETE* antwoord om jou inligting te verwyder.\n\n" +
      "Volledige beleid: {privacyUrl}\n\n" +
      "Druk *Ek stem saam* om voort te gaan. 👇",
    consentRetry: "Om Vula te gebruik het ons jou toestemming nodig om voort te gaan. Druk *Ek stem saam*, of *Meer inligting* om meer te leer. 👇",
    askName: "Dankie! 🙌\n\nKom ons begin — wat is jou *voornaam*?",
    thankName: (name) => `Aangename kennis, ${name}! 🎓\n\nBy watter skool is jy?`,
    thankSchool: (school) => `Reg so — ${school}. 🏫\n\nHoe oud is jy? (bv. 16)`,
    invalidAge: "Antwoord asseblief met 'n geldige ouderdom tussen 12 en 25.",
    askCity: "Dankie! 🎂\n\nWatter stad of dorp is naaste aan jou? (bv. Kaapstad, Johannesburg, Durban)",
    askSuburb: "Reg so! 📍\n\nEn in watter voorstad of area woon jy?",
    askGrade: (suburb) => `${suburb} — genoteer.\n\nIn watter graad is jy?`,
    invalidGrade: "Kies asseblief jou graad hieronder 👇",
    assessmentIntro: (name) =>
      `✅ Dankie ${name}, jou profiel is opgestel!\n\n` +
      `📋 *Nou die assessering* — 30 vinnige vrae oor wat jy geniet. ` +
      `Daar is geen regte of verkeerde antwoorde nie, tik net wat soos *jy* voel. ` +
      `Dit neem omtrent 4 minute en jy kan enige tyd 'n pouse neem. 💡`,
    invalidAssessmentAnswer: "Tik asseblief een van die opsies hieronder 👇\n\n",
    completionIntro: (name, count) => `🎉 Jy het dit gedoen, ${name}! Jy het al ${count} vrae beantwoord.\n\n`,
    resultsIntro: "Hier is wat jou profiel wys 👇",
    gradeTip10: "Jy is in Graad 10 — die perfekte tyd om die regte vakke te kies. 🎯",
    gradeTip11: "Jy is in Graad 11 — daar mag nog tyd wees om vakke aan te pas. ⏳",
    gradeTip12: "Jy is in Graad 12 — fokus op die punte en aansoeke wat hierdie paaie benodig. 📨",
    yourTopStrengths: "🧭 *Jou top sterkpunte:*",
    careersThatFit: "💼 *Loopbane wat by jou pas:*",
    exploreInstruction: (n) => `\n👉 Antwoord met 'n *nommer (1–${n})* om 'n loopbaan te verken — hoekom dit by jou pas, die vakke wat jy nodig het, en hoe om te kwalifiseer.`,
    exploreMatchesHeader: "Verken nou jou passings 👇\n\n",
    menuHeader: "🔁 *Verken 'n ander loopbaan — antwoord met 'n nommer:*\n",
    menuFooter: "\n_Antwoord RESTART om die assessering weer te doen._",
    invalidExplore: "Antwoord asseblief met 'n nommer van die lys 👇",
    fallbackRestart: "Antwoord RESTART om weer te begin.",
    careerWhy: "✅ *Hoekom dit by jou pas:*",
    careerSubjects: "📚 *Vakke wat jy nodig het:*",
    careerQual: "🎓 *Hoe om te kwalifiseer:*",
    sponsoredNear: "\n\n🏫 *Geborgde opsie naby jou:*",
    deleteConfirm: "🗑️ Gedoen — jou inligting is van Vula verwyder. Antwoord *Hi* enige tyd om vars te begin.",
    stopConfirm: "👋 Jy sal nie meer boodskappe van Vula ontvang nie. Antwoord *Hi* enige tyd om te hervat. Om jou inligting te verwyder, antwoord *DELETE*.",
    reportNotReady: "Jy sal jou verslag kry sodra jy die assessering voltooi het. Antwoord *Hi* om te begin.",
    reportCaption: (name) =>
      `📄 *Hier's jou volledige Vula-loopbaanverslag, ${name}!*\n\n` +
      "Dit stel jou sterkpunte, jou passende loopbane, die presiese vakke wat jy nodig het en hoe om te kwalifiseer uiteen. " +
      "Stoor dit en deel dit met jou ouers of onderwyser. 🎓\n\n" +
      "_Antwoord REPORT enige tyd om dit weer te kry._",
    yesnoButtons: ["Nee", "Miskien", "Ja"],
    gradeButtons: ["Graad 10", "Graad 11", "Graad 12"],
    consentButtons: ["Ek stem saam", "Meer inligting"],
  },
};

const TRAIT_NAMES = {
  en: { R: "Hands-on & practical", I: "Curious & analytical", A: "Creative & expressive", S: "Caring & people-focused", E: "Driven & enterprising", C: "Organised & detail-focused" },
  zu: { R: "Onobuciko bezandla & osebenzayo", I: "Onenkulumo yokuhlola & ohlaziyayo", A: "Onobuciko & ozibonakalisayo", S: "Onendaba & ogxile ebantwini", E: "Oshisekelayo & onobuchwepheshe bebhizinisi", C: "Ohleliwe & ogxile emininingwaneni" },
  xh: { R: "Onobuchule ngezandla & osebenzayo", I: "Onombuzo & ohlalutyayo", A: "Onobuchule & ozibonakalisayo", S: "Onenkathalo & ogxile ebantwini", E: "Onenjongo & onobuchule beshishini", C: "Ohlelekileyo & ogxile kwiinkcukacha" },
  af: { R: "Prakties & hands-on", I: "Nuuskierig & analities", A: "Kreatief & uitdrukkend", S: "Sorgsaam & mensgerig", E: "Gedrewe & ondernemend", C: "Georganiseerd & detail-gefokus" },
};

// 30 questions' text, per language, in the same order as QUESTIONS in
// assessment.js (trait letters live there; only the question wording lives
// here so the two stay in sync by array index).
const QUESTION_TEXT = {
  en: [
    "Do you enjoy building, fixing or assembling things with your hands?",
    "Do you enjoy solving puzzles or figuring out how things work?",
    "Do you enjoy drawing, designing, writing or making music?",
    "Do you enjoy helping people solve their problems?",
    "Do you enjoy leading a team or being in charge?",
    "Do you like keeping things organised and in order?",
    "Would you like a job working with tools, machines or equipment?",
    "Are you curious about science, nature or how the world works?",
    "Do you like coming up with original ideas and being creative?",
    "Would you like a job caring for, teaching or supporting others?",
    "Would you like to start your own business one day?",
    "Do you enjoy working with numbers, records or budgets?",
    "Do you prefer being active and on your feet rather than at a desk?",
    "Do you like researching a topic deeply until you understand it?",
    "Would you enjoy a career in art, media, fashion or performance?",
    "Do friends often come to you for advice or support?",
    "Are you good at convincing or persuading people?",
    "Do you prefer clear instructions and well-structured tasks?",
    "Are you interested in how engines, electronics or structures work?",
    "Would you enjoy analysing data or numbers to find answers?",
    "Do you express yourself through style, art or storytelling?",
    "Do you feel good when you make a difference in someone's life?",
    "Do you enjoy competing and aiming to win?",
    "Are you careful with details and accuracy?",
    "Would you enjoy working outdoors or on a worksite?",
    "Do you enjoy subjects like Maths, Physics or Life Sciences?",
    "Do you prefer freedom and variety over strict routine?",
    "Do you enjoy working closely with people rather than alone?",
    "Would you enjoy selling, marketing or pitching ideas?",
    "Would you enjoy office work like admin, finance or planning?",
  ],
  zu: [
    "Ingabe uyakuthanda ukwakha, ukulungisa noma ukuhlanganisa izinto ngezandla zakho?",
    "Ingabe uyakuthanda ukuxazulula amaphazili noma ukuqonda ukuthi izinto zisebenza kanjani?",
    "Ingabe uyakuthanda ukudweba, ukuklama, ukubhala noma ukwenza umculo?",
    "Ingabe uyakuthanda ukusiza abantu baxazulule izinkinga zabo?",
    "Ingabe uyakuthanda ukuhola ithimba noma ukuphatha?",
    "Ingabe uthanda ukugcina izinto zihlelekile futhi zilungile?",
    "Ingabe ungathanda umsebenzi osebenza namathuluzi, imishini noma izinsiza?",
    "Ingabe unesifiso sokwazi ngesayensi, imvelo noma ukuthi umhlaba usebenza kanjani?",
    "Ingabe uthanda ukuqhamuka nemibono emisha nokuba nobuciko?",
    "Ingabe ungathanda umsebenzi wokunakekela, ukufundisa noma ukusekela abanye?",
    "Ingabe ungathanda ukuqala ibhizinisi lakho ngelinye ilanga?",
    "Ingabe uyakuthanda ukusebenza ngezinombolo, amarekhodi noma amabhajethi?",
    "Ingabe uthanda ukuvocavoca futhi ume ezinyaweni kunokuhlala etafuleni?",
    "Ingabe uthanda ukucwaninga indaba ngokujulile uze uyiqonde?",
    "Ingabe ungathanda umsebenzi wobuciko, imidiya, ifeshini noma ukubukwa?",
    "Ingabe abangani bavame ukuza kuwe ukuzocela iseluleko noma ukusekelwa?",
    "Ingabe umuhle ekukholiseni noma ekunxenxeni abantu?",
    "Ingabe uthanda imiyalelo ecacile nemisebenzi ehleleke kahle?",
    "Ingabe unentshisekelo yokuthi ama-injini, izinto ze-elekthronikhi noma izakhiwo zisebenza kanjani?",
    "Ingabe ungathanda ukuhlaziya idatha noma izinombolo ukuthola izimpendulo?",
    "Ingabe uzibonakalisa ngesitayela, ubuciko noma ukulanda izindaba?",
    "Ingabe uzizwa kahle uma wenza umehluko empilweni yomunye umuntu?",
    "Ingabe uyakuthanda ukuncintisana futhi ufune ukunqoba?",
    "Ingabe unonogada emininingwaneni nasekunembeni?",
    "Ingabe ungathanda ukusebenza ngaphandle noma endaweni yomsebenzi?",
    "Ingabe uyazithanda izifundo ezinjenge-Zibalo, i-Physics noma i-Life Sciences?",
    "Ingabe uthanda inkululeko nokwehlukahlukana kunokulandela umgudu oqinile?",
    "Ingabe uthanda ukusebenza eduze nabantu kunokuba wedwa?",
    "Ingabe ungathanda ukuthengisa, ukumaketha noma ukwethula imibono?",
    "Ingabe ungathanda umsebenzi wehhovisi njengokuphatha, ezimali noma ukuhlela?",
  ],
  xh: [
    "Ngaba uyakonwabela ukwakha, ukulungisa okanye ukudibanisa izinto ngezandla zakho?",
    "Ngaba uyakonwabela ukusombulula amaqhinga okanye ukuqonda indlela izinto ezisebenza ngayo?",
    "Ngaba uyakonwabela ukuzoba, ukuyila, ukubhala okanye ukwenza umculo?",
    "Ngaba uyakonwabela ukunceda abantu basombulule iingxaki zabo?",
    "Ngaba uyakonwabela ukukhokela iqela okanye ukuphatha?",
    "Ngaba uthanda ukugcina izinto zihlelekile kwaye zilungile?",
    "Ngaba ungathanda umsebenzi osebenza ngezixhobo, imatshini okanye impahla?",
    "Ngaba unomdla kwinzululwazi, indalo okanye indlela ihlabathi elisebenza ngayo?",
    "Ngaba uthanda ukuza neengcamango ezintsha kwaye ube nobuchule?",
    "Ngaba ungathanda umsebenzi wokukhathalela, ukufundisa okanye ukuxhasa abanye?",
    "Ngaba ungathanda ukuqalisa ishishini lakho ngenye imini?",
    "Ngaba uyakonwabela ukusebenza namanani, iirekhodi okanye iibhajethi?",
    "Ngaba ukhetha ukuba nemisebenzi kunokuhlala kwidesika?",
    "Ngaba uthanda ukuphanda ngokunzulu ude uyiqonde into?",
    "Ngaba ungakonwabela umsebenzi kubugcisa, kwiimidiya, kwifashoni okanye kumboniso?",
    "Ngaba abahlobo bafudula besiza kuwe becela icebiso okanye inkxaso?",
    "Ngaba uyakwazi ukweyisela okanye ukucenga abantu?",
    "Ngaba ukhetha imiyalelo ecacileyo nemisebenzi ehlelwe kakuhle?",
    "Ngaba unomdla kwindlela iinjini, izinto zombane okanye izakhiwo ezisebenza ngazo?",
    "Ngaba ungakonwabela ukuhlalutya idatha okanye amanani ukufumana iimpendulo?",
    "Ngaba uzibonakalisa ngesimbo, ubugcisa okanye ukubalisa amabali?",
    "Ngaba uziva kamnandi xa wenza umahluko kubomi bomntu?",
    "Ngaba uyakonwabela ukhuphiswano kwaye ufune ukuphumelela?",
    "Ngaba unyanisekile kwiinkcukacha nakuchaneko?",
    "Ngaba ungakonwabela ukusebenza ngaphandle okanye kwindawo yomsebenzi?",
    "Ngaba uyazithanda izifundo ezifana ne-Mathematics, i-Physics okanye i-Life Sciences?",
    "Ngaba ukhetha inkululeko noguqu-guquko kunokulandela indlela eqinileyo?",
    "Ngaba uthanda ukusebenza kufuphi nabantu kunokuba wedwa?",
    "Ngaba ungakonwabela ukuthengisa, ukumakethi okanye ukubonisa iingcamango?",
    "Ngaba ungakonwabela umsebenzi weofisi ofana nolawulo, ezemali okanye ucwangciso?",
  ],
  af: [
    "Geniet jy dit om dinge met jou hande te bou, reg te maak of te monteer?",
    "Geniet jy dit om raaisels op te los of uit te vind hoe dinge werk?",
    "Geniet jy dit om te teken, te ontwerp, te skryf of musiek te maak?",
    "Geniet jy dit om mense te help om hul probleme op te los?",
    "Geniet jy dit om 'n span te lei of in beheer te wees?",
    "Hou jy daarvan om dinge georganiseerd en netjies te hou?",
    "Sou jy 'n werk wil hê wat met gereedskap, masjiene of toerusting werk?",
    "Is jy nuuskierig oor wetenskap, die natuur of hoe die wêreld werk?",
    "Hou jy daarvan om met oorspronklike idees vorendag te kom en kreatief te wees?",
    "Sou jy 'n werk wil hê waar jy vir ander sorg, onderrig of ondersteun?",
    "Sou jy eendag jou eie besigheid wil begin?",
    "Geniet jy dit om met syfers, rekords of begrotings te werk?",
    "Verkies jy om aktief en op jou voete te wees eerder as by 'n lessenaar?",
    "Hou jy daarvan om 'n onderwerp diepgaande na te vors totdat jy dit verstaan?",
    "Sou jy 'n loopbaan in kuns, media, mode of vertoning geniet?",
    "Kom vriende dikwels na jou toe vir raad of ondersteuning?",
    "Is jy goed daarin om mense te oorreed of te oortuig?",
    "Verkies jy duidelike instruksies en goed-gestruktureerde take?",
    "Stel jy belang in hoe enjins, elektronika of strukture werk?",
    "Sou jy dit geniet om data of syfers te ontleed om antwoorde te vind?",
    "Druk jy jouself uit deur styl, kuns of storievertelling?",
    "Voel jy goed wanneer jy 'n verskil in iemand se lewe maak?",
    "Geniet jy kompetisie en mik jy daarna om te wen?",
    "Is jy versigtig met detail en akkuraatheid?",
    "Sou jy dit geniet om buite of by 'n werkplek te werk?",
    "Geniet jy vakke soos Wiskunde, Fisika of Lewenswetenskappe?",
    "Verkies jy vryheid en verskeidenheid bo 'n streng roetine?",
    "Geniet jy dit om nou saam met mense te werk eerder as alleen?",
    "Sou jy dit geniet om te verkoop, te bemark of idees aan te bied?",
    "Sou jy kantoorwerk soos administrasie, finansies of beplanning geniet?",
  ],
};

function t(lang, key, ...args) {
  const set = STRINGS[lang] || STRINGS[DEFAULT_LANG];
  const entry = set[key] !== undefined ? set[key] : STRINGS[DEFAULT_LANG][key];
  return typeof entry === "function" ? entry(...args) : entry;
}

module.exports = { LANGUAGES, DEFAULT_LANG, STRINGS, TRAIT_NAMES, QUESTION_TEXT, t };
