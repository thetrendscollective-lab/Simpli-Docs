import OpenAI from "openai";

export interface LanguageDetectionResult {
  language: string;
  confidence: number; // 0-100
  languageName: string;
}

const languageMap: { [key: string]: string } = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'pa': 'Punjabi',
  'ur': 'Urdu',
  'bn': 'Bengali',
  'tr': 'Turkish',
  'vi': 'Vietnamese',
  'th': 'Thai',
  'fil': 'Filipino',
  'sw': 'Swahili'
};

const supportedLanguageCodes = Object.keys(languageMap);

export class LanguageDetectionService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async detectLanguage(text: string): Promise<LanguageDetectionResult> {
    try {
      // Take a sample of the text (first 1000 characters for efficiency)
      const sample = text.substring(0, 1000);

      const prompt = `Analyze the following text and identify its primary language.

Respond with ONLY a JSON object in this exact format:
{
  "languageCode": "ISO 639-1 code or region-specific code (e.g., 'en', 'es', 'fr', 'zh-CN', 'zh-TW')",
  "confidence": number between 0-100,
  "languageName": "Full language name (e.g., 'English', 'Spanish', 'Simplified Chinese')"
}

Supported language codes: ${supportedLanguageCodes.join(', ')}

If the text is in Simplified Chinese, use "zh-CN". If Traditional Chinese, use "zh-TW".
If confidence is below 60, default to "en" (English).

Text to analyze:
${sample}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a language detection expert. Respond only with valid JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);
      
      // Validate and normalize the result
      let languageCode = result.languageCode || 'en';
      let confidence = Math.max(0, Math.min(100, result.confidence || 50));

      // If detected language is not in our supported set, default to English
      if (!supportedLanguageCodes.includes(languageCode)) {
        console.log(`Detected unsupported language ${languageCode}, defaulting to English`);
        languageCode = 'en';
        confidence = Math.min(confidence, 70); // Reduce confidence when falling back
      }

      // If confidence is too low, default to English
      if (confidence < 60) {
        console.log(`Low confidence (${confidence}%), defaulting to English`);
        languageCode = 'en';
      }

      return {
        language: languageCode,
        confidence: Math.round(confidence),
        languageName: languageMap[languageCode] || 'English'
      };

    } catch (error) {
      console.error('Language detection error:', error);
      // Fallback to English on any error
      return {
        language: 'en',
        confidence: 50,
        languageName: 'English'
      };
    }
  }

  // Heuristic fallback method (doesn't use OpenAI)
  detectLanguageHeuristic(text: string): LanguageDetectionResult {
    const sample = text.substring(0, 500).toLowerCase();
    
    // Simple heuristic patterns
    const patterns = {
      'zh-CN': /[\u4e00-\u9fa5]/,  // Chinese characters
      'ja': /[\u3040-\u309f\u30a0-\u30ff]/,  // Hiragana/Katakana
      'ko': /[\uac00-\ud7af]/,  // Hangul
      'ar': /[\u0600-\u06ff]/,  // Arabic
      'ru': /[\u0400-\u04ff]/,  // Cyrillic
      'th': /[\u0e00-\u0e7f]/,  // Thai
    };

    for (const [lang, pattern] of Object.entries(patterns)) {
      if (pattern.test(sample)) {
        return {
          language: lang,
          confidence: 80,
          languageName: languageMap[lang] || lang
        };
      }
    }

    // Default to English
    return {
      language: 'en',
      confidence: 70,
      languageName: 'English'
    };
  }
}
