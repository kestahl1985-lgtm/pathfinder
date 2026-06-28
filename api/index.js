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

// In-memory storage for demo (replace with Supabase in production)
const students = new Map();

const QUESTIONS = [
  { num: 1, text: "Do you prefer building or fixing things? (0=No, 1=Maybe, 2=Yes)" },
  { num: 2, text: "Would you enjoy solving complex scientific problems? (0=No, 1=Maybe, 2=Yes)" },
  { num: 3, text: "Do you like creating art or music? (0=No, 1=Maybe, 2=Yes)" },
  { num: 4, text: "Do you enjoy helping or teaching others? (0=No, 1=Maybe, 2=Yes)" },
  { num: 5, text: "Would you like to lead a team? (0=No, 1=Maybe, 2=Yes)" },
];

// Handle incoming WhatsApp message
async function handleWebhook(from, messageBody) {
  const studentPhone = from.replace("whatsapp:", "");

  if (!students.has(studentPhone)) {
    students.set(studentPhone, {
      phone: from,
      grade: null,
      status: "selecting_grade",
      currentQuestion: 0,
      responses: [],
    });
  }

  const student = students.get(studentPhone);

  // Grade selection
  if (!student.grade) {
    const gradeNum = parseInt(messageBody);
    if (gradeNum === 10 || gradeNum === 11 || gradeNum === 12) {
      student.grade = gradeNum;
      student.status = "in_assessment";
      student.currentQuestion = 1;

      await sendWhatsAppMessage(
        from,
        `✅ Grade ${gradeNum} selected!\n\n📋 Starting Career Assessment (5 questions)\n\n${QUESTIONS[0].text}`
      );
      return;
    }

    await sendWhatsAppMessage(
      from,
      "Welcome to Pathfinder! 🚀\n\nWhat grade are you in?\n10 = Grade 10\n11 = Grade 11\n12 = Grade 12"
    );
    return;
  }

  // Assessment in progress
  if (student.status === "in_assessment") {
    const answer = parseInt(messageBody);
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
        `🎉 Assessment Complete!\n\nYour Score: ${avgScore}/2\n\nWe're analyzing your results and will match you with perfect career paths soon!\n\nThank you for using Pathfinder! 🎓`
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
      const { From, Body } = req.body || {};

      if (!From || !Body) {
        res.setHeader("Content-Type", "application/json");
        res.status(400).end(JSON.stringify({ error: "Missing From or Body" }));
        return;
      }

      // Process asynchronously
      handleWebhook(From, Body).catch(console.error);

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
