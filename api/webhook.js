// Pathfinder WhatsApp webhook — replies to Twilio with TwiML.
// No outbound API call, no credentials, no external dependencies.
//
// NOTE: conversation state is held in-memory below. On Vercel's serverless
// runtime this persists only while a lambda instance stays warm. It is enough
// to verify the flow end-to-end; persistence is moved to Supabase next.

const sessions = {};

const ONBOARDING = ["name", "school", "age", "suburb", "grade"];

const QUESTIONS = [
  "Do you prefer building or fixing things with your hands?",
  "Would you enjoy solving complex scientific problems?",
  "Do you like creating art, music, or written content?",
  "Do you enjoy helping or teaching other people?",
  "Would you like to lead or manage a team?",
];

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(message) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
    message
  )}</Message></Response>`;
}

function question(index) {
  return `Question ${index + 1} of ${QUESTIONS.length}\n\n${QUESTIONS[index]}\n\nReply:\n0 = No\n1 = Maybe\n2 = Yes`;
}

// Core state machine. Returns the text reply for a given sender + message.
function getReply(from, body) {
  let s = sessions[from];

  // Brand-new conversation
  if (!s) {
    sessions[from] = { step: "name", data: {}, q: 0, responses: [] };
    return (
      "👋 Welcome to *Pathfinder* — your free career guide on WhatsApp!\n\n" +
      "Choosing a career can feel overwhelming. Most learners only start thinking about it in matric — but the subjects you pick in Grade 9, 10 and 11 already shape the doors that stay open to you. 🚪\n\n" +
      "Pathfinder helps you discover *what you're naturally good at*, the careers that fit you, and the exact subjects and marks you'll need to get there — before it's too late to change course.\n\n" +
      "It takes about 5 minutes, it's completely free, and the path is yours to keep. 🌱\n\n" +
      "Let's begin! What's your *first name*?"
    );
  }

  // ---- Onboarding ----
  if (s.step === "name") {
    s.data.name = body;
    s.step = "school";
    return `Nice to meet you, ${body}! 🎓\n\nWhich school do you attend?`;
  }

  if (s.step === "school") {
    s.data.school = body;
    s.step = "age";
    return `Got it — ${body}. 🏫\n\nHow old are you? (e.g. 16)`;
  }

  if (s.step === "age") {
    const age = parseInt(body, 10);
    if (isNaN(age) || age < 12 || age > 25) {
      return "Please reply with a valid age between 12 and 25.";
    }
    s.data.age = age;
    s.step = "suburb";
    return `Thanks! 🎂\n\nWhich suburb or area do you live in?`;
  }

  if (s.step === "suburb") {
    s.data.suburb = body;
    s.step = "grade";
    return (
      `📍 ${body} — noted.\n\n` +
      "What grade are you in?\n\n10 = Grade 10\n11 = Grade 11\n12 = Grade 12"
    );
  }

  if (s.step === "grade") {
    const grade = parseInt(body, 10);
    if (![10, 11, 12].includes(grade)) {
      return "Please reply with 10, 11, or 12.";
    }
    s.data.grade = grade;
    s.step = "assessment";
    s.q = 0;
    return (
      `✅ Thanks ${s.data.name}, your profile is set!\n\n` +
      `• School: ${s.data.school}\n` +
      `• Age: ${s.data.age}\n` +
      `• Area: ${s.data.suburb}\n` +
      `• Grade: ${grade}\n\n` +
      "📋 *Now the fun part.*\n\n" +
      "There are no right or wrong answers here — just be honest about what feels like *you*. " +
      "Your answers reveal your natural strengths and the careers where you'll thrive. 💡\n\n" +
      question(0)
    );
  }

  // ---- Assessment ----
  if (s.step === "assessment") {
    const answer = parseInt(body, 10);
    if (![0, 1, 2].includes(answer)) {
      return "Please reply with 0 (No), 1 (Maybe), or 2 (Yes).";
    }
    s.responses.push(answer);
    s.q += 1;

    if (s.q < QUESTIONS.length) {
      return question(s.q);
    }

    // Finished
    s.step = "done";
    const total = s.responses.reduce((a, b) => a + b, 0);
    const avg = (total / s.responses.length).toFixed(1);
    return (
      `🎉 You did it, ${s.data.name}!\n\n` +
      "That's a real step most learners never take — you've started shaping your future on purpose. 🌟\n\n" +
      "We're now matching your strengths to careers, the subjects you'll need, and colleges and bursaries that fit *you*. " +
      "You'll get your personalised path shortly.\n\n" +
      "Remember: the earlier you know your direction, the more choices you keep open. You're ahead of the game. 🚀\n\n" +
      "_Reply RESTART anytime to take it again._"
    );
  }

  // ---- Already finished ----
  if (s.step === "done") {
    return (
      "You've already completed your assessment ✅\n\n" +
      "Reply RESTART to take it again."
    );
  }

  return "Sorry, something went wrong. Reply RESTART to begin again.";
}

module.exports = (req, res) => {
  // Twilio sends application/x-www-form-urlencoded; Vercel parses it into req.body.
  const body = req.body || {};
  const from = body.From || "";
  let text = (body.Body || "").trim();

  // Allow a hard reset
  if (text.toUpperCase() === "RESTART") {
    delete sessions[from];
    text = "";
  }

  const reply = getReply(from, text);

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/xml");
  res.end(twiml(reply));
};
