import OpenAI from "openai";
import { getErrorMessage } from "../utils";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface SummarizationResult {
  overview: string;
  keyFindings: string[];
  recommendations: string[];
  nextSteps: string[];
  riskFlags: string[];
}

export interface GlossaryResult {
  terms: Array<{
    term: string;
    definition: string;
    pageRefs: number[];
  }>;
}

export interface QAResult {
  answer: string;
  citations: Array<{
    pageNumber: number;
    sectionId: string;
    text: string;
  }>;
  confidence: number;
}

export class OpenAIService {
  async summarizeDocument(
    text: string, 
    domain: 'legal' | 'medical', 
    language: string = 'en'
  ): Promise<SummarizationResult> {
    const prompt = `You are a patient/client-friendly explainer. Rewrite the following ${domain} text in plain language at a 6th–8th grade level. Keep it accurate and neutral. Extract key points, obligations, dates, risks, and next steps. Do not give legal or medical advice. Output in ${language}. 

Return a JSON object with this structure:
{
  "overview": "concise summary paragraph",
  "keyFindings": ["finding 1", "finding 2"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "nextSteps": ["step 1", "step 2"],
  "riskFlags": ["risk 1", "risk 2"]
}

Text: ${text}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      throw new Error(`Failed to summarize document: ${getErrorMessage(error)}`);
    }
  }

  async extractGlossary(
    text: string, 
    language: string = 'en'
  ): Promise<GlossaryResult> {
    const prompt = `Extract up to 25 technical terms from the document and define them simply in ${language}. Return JSON in this format:
    {
      "terms": [
        {
          "term": "term name",
          "definition": "simple definition",
          "pageRefs": [1, 2]
        }
      ]
    }
    
    Text: ${text}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      return JSON.parse(response.choices[0].message.content || '{"terms": []}');
    } catch (error) {
      throw new Error(`Failed to extract glossary: ${getErrorMessage(error)}`);
    }
  }

  async answerQuestion(
    question: string,
    documentChunks: Array<{ id: string; content: string; pageNumber: number }>,
    language: string = 'en'
  ): Promise<QAResult> {
    const chunksText = documentChunks.map(chunk => 
      `[${chunk.id}] Page ${chunk.pageNumber}: ${chunk.content}`
    ).join('\n\n');

    const prompt = `Answer the question based only on the provided chunks. Cite page/section IDs for every claim. If unknown, say you don't know. Output in ${language}.

Return JSON in this format:
{
  "answer": "your answer",
  "citations": [
    {
      "pageNumber": 1,
      "sectionId": "section_id",
      "text": "relevant excerpt"
    }
  ],
  "confidence": 0.85
}

Question: ${question}

Document chunks:
${chunksText}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      return JSON.parse(response.choices[0].message.content || '{"answer": "I don\'t know", "citations": [], "confidence": 0}');
    } catch (error) {
      throw new Error(`Failed to answer question: ${getErrorMessage(error)}`);
    }
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    const prompt = `Translate the following text to ${targetLanguage}, maintaining the same tone and technical accuracy:

${text}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
      });

      return response.choices[0].message.content || text;
    } catch (error) {
      throw new Error(`Failed to translate text: ${getErrorMessage(error)}`);
    }
  }
}
