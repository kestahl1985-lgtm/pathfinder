import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateMidwayInsight(
  riasecScores: Record<string, number>,
  currentQuestion: number
): Promise<string> {
  const totalScore = Object.values(riasecScores).reduce((a, b) => a + b, 0);
  const topTraits = Object.entries(riasecScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([trait]) => trait)
    .join(", ");

  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `You are a career guidance counselor. Based on RIASEC assessment responses (currently at question ${currentQuestion}/40), the student shows strongest interest in: ${topTraits}.

Generate a brief, encouraging 2-3 sentence insight about their emerging career profile. Keep it positive and motivational.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}

export async function generateFinalReport(
  firstName: string,
  riasecScores: Record<string, number>,
  coursesMatched: Array<{ name: string; college: string; matchScore: number }>
): Promise<string> {
  const code = Object.entries(riasecScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([trait]) => trait)
    .join("");

  const topCourses = coursesMatched
    .slice(0, 5)
    .map((c) => `- ${c.name} at ${c.college} (${Math.round(c.matchScore)}% match)`)
    .join("\n");

  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `You are a career guidance counselor creating a detailed report for a South African student.

Student Name: ${firstName}
RIASEC Code: ${code}
RIASEC Scores: ${Object.entries(riasecScores)
          .map(([trait, score]) => `${trait}: ${score}`)
          .join(", ")}

Top Recommended Courses:
${topCourses}

Create a personalized career report (300-400 words) that:
1. Explains what their RIASEC code means
2. Describes 3-4 career fields that match their profile
3. Lists required subjects for success
4. Provides specific advice for next steps
5. Mentions the recommended courses above

Make it encouraging and practical for a South African context.`,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}
