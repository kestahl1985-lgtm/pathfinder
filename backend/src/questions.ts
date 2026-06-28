import type { Question } from "./types.js";

export const RIASEC_QUESTIONS: Question[] = [
  {
    number: 1,
    text: "Do you prefer building or fixing things with your hands?",
    options: [
      { text: "Yes, definitely", value: 3, riasec_trait: "R" },
      { text: "Maybe", value: 2, riasec_trait: "R" },
      { text: "Not really", value: 1, riasec_trait: "I" },
    ],
  },
  {
    number: 2,
    text: "Would you enjoy solving complex scientific problems?",
    options: [
      { text: "Very much", value: 3, riasec_trait: "I" },
      { text: "Somewhat", value: 2, riasec_trait: "I" },
      { text: "Not interested", value: 1, riasec_trait: "R" },
    ],
  },
  {
    number: 3,
    text: "Do you like creating art, music, or written content?",
    options: [
      { text: "Love it", value: 3, riasec_trait: "A" },
      { text: "Sometimes", value: 2, riasec_trait: "A" },
      { text: "No", value: 1, riasec_trait: "E" },
    ],
  },
  {
    number: 4,
    text: "Do you enjoy helping or teaching other people?",
    options: [
      { text: "Yes, very much", value: 3, riasec_trait: "S" },
      { text: "Sometimes", value: 2, riasec_trait: "S" },
      { text: "Not really", value: 1, riasec_trait: "E" },
    ],
  },
  {
    number: 5,
    text: "Would you like to lead or manage a team?",
    options: [
      { text: "Definitely", value: 3, riasec_trait: "E" },
      { text: "Maybe", value: 2, riasec_trait: "E" },
      { text: "No", value: 1, riasec_trait: "S" },
    ],
  },
  {
    number: 6,
    text: "Do you prefer following detailed procedures and rules?",
    options: [
      { text: "Yes, I do", value: 3, riasec_trait: "C" },
      { text: "Sometimes", value: 2, riasec_trait: "C" },
      { text: "I prefer creativity", value: 1, riasec_trait: "A" },
    ],
  },
  {
    number: 7,
    text: "Would you enjoy working outdoors in nature?",
    options: [
      { text: "Absolutely", value: 3, riasec_trait: "R" },
      { text: "Sometimes", value: 2, riasec_trait: "R" },
      { text: "Not really", value: 1, riasec_trait: "C" },
    ],
  },
  {
    number: 8,
    text: "Are you curious about how things work scientifically?",
    options: [
      { text: "Very curious", value: 3, riasec_trait: "I" },
      { text: "Somewhat", value: 2, riasec_trait: "I" },
      { text: "Not much", value: 1, riasec_trait: "S" },
    ],
  },
  {
    number: 9,
    text: "Would you like a career in design or creative fields?",
    options: [
      { text: "Yes", value: 3, riasec_trait: "A" },
      { text: "Maybe", value: 2, riasec_trait: "A" },
      { text: "No", value: 1, riasec_trait: "C" },
    ],
  },
  {
    number: 10,
    text: "Do you enjoy working with people and building relationships?",
    options: [
      { text: "Absolutely", value: 3, riasec_trait: "S" },
      { text: "Sometimes", value: 2, riasec_trait: "S" },
      { text: "I prefer working alone", value: 1, riasec_trait: "I" },
    ],
  },
  {
    number: 11,
    text: "Would you be interested in starting a business?",
    options: [
      { text: "Very interested", value: 3, riasec_trait: "E" },
      { text: "Maybe", value: 2, riasec_trait: "E" },
      { text: "Not interested", value: 1, riasec_trait: "C" },
    ],
  },
  {
    number: 12,
    text: "Do you like organizing and planning things?",
    options: [
      { text: "Yes, very much", value: 3, riasec_trait: "C" },
      { text: "Sometimes", value: 2, riasec_trait: "C" },
      { text: "I prefer spontaneity", value: 1, riasec_trait: "A" },
    ],
  },
  {
    number: 13,
    text: "Would you enjoy working with machines or technology?",
    options: [
      { text: "Definitely", value: 3, riasec_trait: "R" },
      { text: "Somewhat", value: 2, riasec_trait: "R" },
      { text: "Not really", value: 1, riasec_trait: "S" },
    ],
  },
  {
    number: 14,
    text: "Are you interested in research or investigation?",
    options: [
      { text: "Very interested", value: 3, riasec_trait: "I" },
      { text: "Somewhat", value: 2, riasec_trait: "I" },
      { text: "Not really", value: 1, riasec_trait: "E" },
    ],
  },
  {
    number: 15,
    text: "Do you express yourself through art, design, or performance?",
    options: [
      { text: "Yes, often", value: 3, riasec_trait: "A" },
      { text: "Sometimes", value: 2, riasec_trait: "A" },
      { text: "Not really", value: 1, riasec_trait: "C" },
    ],
  },
  {
    number: 16,
    text: "Would you like a career helping vulnerable or disadvantaged people?",
    options: [
      { text: "Yes, very much", value: 3, riasec_trait: "S" },
      { text: "Somewhat", value: 2, riasec_trait: "S" },
      { text: "No", value: 1, riasec_trait: "E" },
    ],
  },
  {
    number: 17,
    text: "Do you enjoy persuading or influencing others?",
    options: [
      { text: "Yes", value: 3, riasec_trait: "E" },
      { text: "Sometimes", value: 2, riasec_trait: "E" },
      { text: "Not really", value: 1, riasec_trait: "I" },
    ],
  },
  {
    number: 18,
    text: "Would you prefer a job with clear rules and stability?",
    options: [
      { text: "Yes, definitely", value: 3, riasec_trait: "C" },
      { text: "Somewhat", value: 2, riasec_trait: "C" },
      { text: "I prefer variety", value: 1, riasec_trait: "A" },
    ],
  },
  {
    number: 19,
    text: "Are you good with your hands and practical skills?",
    options: [
      { text: "Very good", value: 3, riasec_trait: "R" },
      { text: "Decent", value: 2, riasec_trait: "R" },
      { text: "Not particularly", value: 1, riasec_trait: "I" },
    ],
  },
  {
    number: 20,
    text: "Do you love learning about science and nature?",
    options: [
      { text: "Absolutely", value: 3, riasec_trait: "I" },
      { text: "Somewhat", value: 2, riasec_trait: "I" },
      { text: "Not really", value: 1, riasec_trait: "R" },
    ],
  },
  {
    number: 21,
    text: "Would you enjoy a career in entertainment or media?",
    options: [
      { text: "Yes", value: 3, riasec_trait: "A" },
      { text: "Maybe", value: 2, riasec_trait: "A" },
      { text: "No", value: 1, riasec_trait: "C" },
    ],
  },
  {
    number: 22,
    text: "Do you find satisfaction in serving your community?",
    options: [
      { text: "Very much", value: 3, riasec_trait: "S" },
      { text: "Sometimes", value: 2, riasec_trait: "S" },
      { text: "Not particularly", value: 1, riasec_trait: "E" },
    ],
  },
  {
    number: 23,
    text: "Would you want to be in charge and make decisions?",
    options: [
      { text: "Yes, I would", value: 3, riasec_trait: "E" },
      { text: "Maybe", value: 2, riasec_trait: "E" },
      { text: "No", value: 1, riasec_trait: "S" },
    ],
  },
  {
    number: 24,
    text: "Do you like maintaining order and accuracy?",
    options: [
      { text: "Yes, very much", value: 3, riasec_trait: "C" },
      { text: "Somewhat", value: 2, riasec_trait: "C" },
      { text: "Not really", value: 1, riasec_trait: "A" },
    ],
  },
  {
    number: 25,
    text: "Would you enjoy a job involving physical work and construction?",
    options: [
      { text: "Yes", value: 3, riasec_trait: "R" },
      { text: "Maybe", value: 2, riasec_trait: "R" },
      { text: "No", value: 1, riasec_trait: "S" },
    ],
  },
  {
    number: 26,
    text: "Are you drawn to understanding complex theories?",
    options: [
      { text: "Very much", value: 3, riasec_trait: "I" },
      { text: "Somewhat", value: 2, riasec_trait: "I" },
      { text: "Not really", value: 1, riasec_trait: "C" },
    ],
  },
  {
    number: 27,
    text: "Would you like to express original ideas and innovation?",
    options: [
      { text: "Absolutely", value: 3, riasec_trait: "A" },
      { text: "Sometimes", value: 2, riasec_trait: "A" },
      { text: "Not really", value: 1, riasec_trait: "C" },
    ],
  },
  {
    number: 28,
    text: "Do you prefer careers focused on human wellbeing?",
    options: [
      { text: "Yes, very much", value: 3, riasec_trait: "S" },
      { text: "Somewhat", value: 2, riasec_trait: "S" },
      { text: "Not particularly", value: 1, riasec_trait: "I" },
    ],
  },
  {
    number: 29,
    text: "Are you competitive and achievement-oriented?",
    options: [
      { text: "Very much", value: 3, riasec_trait: "E" },
      { text: "Somewhat", value: 2, riasec_trait: "E" },
      { text: "Not really", value: 1, riasec_trait: "S" },
    ],
  },
  {
    number: 30,
    text: "Do you enjoy working in well-structured environments?",
    options: [
      { text: "Yes", value: 3, riasec_trait: "C" },
      { text: "Sometimes", value: 2, riasec_trait: "C" },
      { text: "I prefer flexibility", value: 1, riasec_trait: "A" },
    ],
  },
  {
    number: 31,
    text: "Would you be interested in trades or skilled manual work?",
    options: [
      { text: "Yes", value: 3, riasec_trait: "R" },
      { text: "Maybe", value: 2, riasec_trait: "R" },
      { text: "No", value: 1, riasec_trait: "I" },
    ],
  },
  {
    number: 32,
    text: "Do you enjoy analyzing and solving problems logically?",
    options: [
      { text: "Very much", value: 3, riasec_trait: "I" },
      { text: "Somewhat", value: 2, riasec_trait: "I" },
      { text: "Not really", value: 1, riasec_trait: "A" },
    ],
  },
  {
    number: 33,
    text: "Would you want a job involving imagination and innovation?",
    options: [
      { text: "Yes, absolutely", value: 3, riasec_trait: "A" },
      { text: "Sometimes", value: 2, riasec_trait: "A" },
      { text: "Not really", value: 1, riasec_trait: "C" },
    ],
  },
  {
    number: 34,
    text: "Do you empathize with others' problems and emotions?",
    options: [
      { text: "Very much", value: 3, riasec_trait: "S" },
      { text: "Sometimes", value: 2, riasec_trait: "S" },
      { text: "Not really", value: 1, riasec_trait: "I" },
    ],
  },
  {
    number: 35,
    text: "Would you like to motivate and develop people?",
    options: [
      { text: "Yes", value: 3, riasec_trait: "E" },
      { text: "Maybe", value: 2, riasec_trait: "E" },
      { text: "No", value: 1, riasec_trait: "S" },
    ],
  },
  {
    number: 36,
    text: "Do you prefer jobs requiring attention to detail?",
    options: [
      { text: "Yes, definitely", value: 3, riasec_trait: "C" },
      { text: "Sometimes", value: 2, riasec_trait: "C" },
      { text: "Not really", value: 1, riasec_trait: "A" },
    ],
  },
  {
    number: 37,
    text: "Would you enjoy working on engines, electricity, or mechanics?",
    options: [
      { text: "Yes", value: 3, riasec_trait: "R" },
      { text: "Maybe", value: 2, riasec_trait: "R" },
      { text: "No", value: 1, riasec_trait: "S" },
    ],
  },
  {
    number: 38,
    text: "Are you curious about how the world works scientifically?",
    options: [
      { text: "Very curious", value: 3, riasec_trait: "I" },
      { text: "Somewhat", value: 2, riasec_trait: "I" },
      { text: "Not much", value: 1, riasec_trait: "E" },
    ],
  },
  {
    number: 39,
    text: "Would you want to create or perform art, music, or writing?",
    options: [
      { text: "Yes, very much", value: 3, riasec_trait: "A" },
      { text: "Sometimes", value: 2, riasec_trait: "A" },
      { text: "No", value: 1, riasec_trait: "C" },
    ],
  },
  {
    number: 40,
    text: "Would you prefer a career helping others over personal gain?",
    options: [
      { text: "Yes", value: 3, riasec_trait: "S" },
      { text: "Sometimes", value: 2, riasec_trait: "S" },
      { text: "No", value: 1, riasec_trait: "E" },
    ],
  },
];

export function getQuestion(number: number): Question | undefined {
  return RIASEC_QUESTIONS.find((q) => q.number === number);
}

export function getTotalQuestions(): number {
  return RIASEC_QUESTIONS.length;
}
