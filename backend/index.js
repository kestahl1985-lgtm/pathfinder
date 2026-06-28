const https = require("https");

// Send WhatsApp message via Twilio
async function sendWhatsAppMessage(to, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.error("Missing Twilio credentials");
    return { success: false, error: "Missing credentials" };
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const toPhone = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  const params = new URLSearchParams();
  params.append("From", `whatsapp:${fromNumber}`);
  params.append("To", toPhone);
  params.append("Body", message);

  return new Promise((resolve) => {
    const options = {
      hostname: "api.twilio.com",
      path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${auth}`,
        "Content-Length": Buffer.byteLength(params.toString()),
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          resolve({ success: res.statusCode === 201, messageId: data.sid });
        } catch {
          resolve({ success: res.statusCode === 201, body });
        }
      });
    });

    req.on("error", (error) => {
      console.error("Twilio request error:", error);
      resolve({ success: false, error: error.message });
    });

    req.write(params.toString());
    req.end();
  });
}

// In-memory storage (replace with Supabase in production)
const students = new Map();

const QUESTIONS = [
  { num: 1, text: "Do you prefer building or fixing things? (0=No, 1=Maybe, 2=Yes)" },
  { num: 2, text: "Would you enjoy solving complex scientific problems? (0=No, 1=Maybe, 2=Yes)" },
  { num: 3, text: "Do you like creating art or music? (0=No, 1=Maybe, 2=Yes)" },
  { num: 4, text: "Do you enjoy helping or teaching others? (0=No, 1=Maybe, 2=Yes)" },
  { num: 5, text: "Would you like to lead a team? (0=No, 1=Maybe, 2=Yes)" },
];

// Onboarding steps
const ONBOARDING_STEPS = ["name", "school", "age", "suburb", "grade"];

// Handle incoming WhatsApp message
async function handleWebhook(from, messageBody) {
  const studentPhone = from.replace("whatsapp:", "");
  const trimmedInput = messageBody.trim();

  // Initialize new student
  if (!students.has(studentPhone)) {
    students.set(studentPhone, {
      phone: from,
      name: null,
      school: null,
      age: null,
      suburb: null,
      grade: null,
      onboardingStep: 0,
      status: "onboarding",
      currentQuestion: 0,
      responses: [],
    });

    await sendWhatsAppMessage(
      from,
      "👋 Welcome to Pathfinder!\n\nThe free career guidance platform for South African students.\n\n📝 Let's get to know you better.\n\nWhat's your first name?"
    );
    return;
  }

  const student = students.get(studentPhone);

  // ONBOARDING PHASE
  if (student.status === "onboarding") {
    const currentStep = ONBOARDING_STEPS[student.onboardingStep];

    if (currentStep === "name") {
      student.name = trimmedInput;
      student.onboardingStep++;
      await sendWhatsAppMessage(from, `Nice to meet you, ${student.name}! 👋\n\nWhat school do you attend?`);
      return;
    }

    if (currentStep === "school") {
      student.school = trimmedInput;
      student.onboardingStep++;
      await sendWhatsAppMessage(from, `Great! ${student.school} 🏫\n\nHow old are you? (e.g., 16)`);
      return;
    }

    if (currentStep === "age") {
      const age = parseInt(trimmedInput);
      if (isNaN(age) || age < 13 || age > 25) {
        await sendWhatsAppMessage(from, "Please enter a valid age (13-25)");
        return;
      }
      student.age = age;
      student.onboardingStep++;
      await sendWhatsAppMessage(from, `Got it, you're ${age} years old! 🎂\n\nWhat suburb/area do you live in?`);
      return;
    }

    if (currentStep === "suburb") {
      student.suburb = trimmedInput;
      student.onboardingStep++;
      await sendWhatsAppMessage(
        from,
        `Perfect, ${student.suburb}! 📍\n\nWhat grade are you in?\n\n10 = Grade 10\n11 = Grade 11\n12 = Grade 12`
      );
      return;
    }

    if (currentStep === "grade") {
      const gradeNum = parseInt(trimmedInput);
      if (gradeNum !== 10 && gradeNum !== 11 && gradeNum !== 12) {
        await sendWhatsAppMessage(from, "Invalid. Please reply with 10, 11, or 12");
        return;
      }

      student.grade = gradeNum;
      student.status = "in_assessment";
      student.currentQuestion = 1;

      await sendWhatsAppMessage(
        from,
        `✅ Grade ${gradeNum} selected!\n\n🎓 Your Profile:\n• Name: ${student.name}\n• School: ${student.school}\n• Age: ${student.age}\n• Area: ${student.suburb}\n\n📋 Starting Career Assessment (5 questions)\n\n${QUESTIONS[0].text}`
      );
      return;
    }
  }

  // ASSESSMENT PHASE
  if (student.status === "in_assessment") {
    const answer = parseInt(trimmedInput);
    if (isNaN(answer) || answer < 0 || answer > 2) {
      await sendWhatsAppMessage(from, "Invalid. Reply with 0, 1, or 2");
      return;
    }

    student.responses.push(answer);

    if (student.currentQuestion >= QUESTIONS.length) {
      // Assessment complete
      student.status = "completed";
      const avgScore = (student.responses.reduce((a, b) => a + b, 0) / student.responses.length).toFixed(1);

      await sendWhatsAppMessage(
        from,
        `🎉 Assessment Complete!\n\nYour Score: ${avgScore}/2\n\nWe're analyzing your results and will match you with perfect career paths soon!\n\nThank you for using Pathfinder, ${student.name}! 🚀`
      );
      return;
    }

    // Next question
    student.currentQuestion++;
    const nextQ = QUESTIONS[student.currentQuestion - 1];
    await sendWhatsAppMessage(from, `Q${student.currentQuestion}: ${nextQ.text}`);
  }
}

module.exports = async (req, res) => {
  const path = req.url || "/";

  try {
    if (req.method === "GET" && path.includes("health")) {
      res.setHeader("Content-Type", "application/json");
      res.status(200).end(JSON.stringify({ status: "ok", service: "pathfinder-backend" }));
      return;
    }

    if (req.method === "POST" && path.includes("webhook")) {
      console.log("Webhook received");
      console.log("Raw body:", req.body);
      console.log("Body type:", typeof req.body);

      // Parse body - handle both JSON and form-encoded
      let bodyData = req.body;
      if (typeof bodyData === "string") {
        try {
          bodyData = JSON.parse(bodyData);
        } catch {
          const params = new URLSearchParams(bodyData);
          bodyData = {
            From: params.get("From"),
            Body: params.get("Body"),
          };
        }
      }

      console.log("Parsed body:", bodyData);
      const { From, Body } = bodyData || {};

      if (!From || !Body) {
        console.log("Missing From or Body");
        res.setHeader("Content-Type", "application/json");
        res.status(400).end(JSON.stringify({ error: "Missing From or Body", received: bodyData }));
        return;
      }

      console.log("Processing webhook for", From, "with message:", Body);

      // Process asynchronously
      handleWebhook(From, Body).catch(err => {
        console.error("Webhook error:", err);
      });

      // Respond immediately
      res.setHeader("Content-Type", "application/json");
      res.status(200).end(JSON.stringify({ received: true }));
      return;
    }

    if (req.method === "GET" && path.includes("stats")) {
      const completed = Array.from(students.values()).filter(s => s.status === "completed").length;
      res.setHeader("Content-Type", "application/json");
      res.status(200).end(JSON.stringify({
        total_students: students.size,
        completed_assessments: completed,
        qualified_leads: completed,
        colleges_connected: 0,
        leads_contacted: 0,
        leads_enrolled: 0,
      }));
      return;
    }

    res.setHeader("Content-Type", "application/json");
    res.status(404).end(JSON.stringify({ error: "Not found" }));
  } catch (error) {
    console.error("Error:", error);
    res.setHeader("Content-Type", "application/json");
    res.status(500).end(JSON.stringify({ error: "Server error" }));
  }
};

module.exports = handler;
