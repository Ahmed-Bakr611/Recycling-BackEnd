import axios from 'axios';
import FormData from 'form-data';

interface TranscriptionResult {
  success: boolean;
  transcription?: string;
  error?: string;
}

class TranscriptionService {
  private groqApiKey: string;
  private baseUrl: string;

  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY!;
    this.baseUrl = 'https://api.groq.com/openai/v1';
  }

  async transcribeAudio(audioBuffer: Buffer, language: string = 'ar'): Promise<TranscriptionResult> {
    try {
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'recording.m4a',
        contentType: 'audio/m4a'
      } as any);
      formData.append('model', 'whisper-large-v3');
      formData.append('language', language);
      formData.append('response_format', 'json');
      formData.append('prompt',
        'هذا التسجيل يحتوي على متحدث يذكر مواد قابلة لإعادة التدوير وكمياتها باللغة العربية المصرية...'
      );

      const response = await axios.post(
        `${this.baseUrl}/audio/transcriptions`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.groqApiKey}`,
            'Content-Type': 'multipart/form-data'
          },
          timeout: 30000 // 30 seconds timeout
        }
      );

      return {
        success: true,
        transcription: response.data.text?.trim() || ''
      };
    } catch (error: any) {
      console.error('Transcription API error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.message || 'Transcription failed'
      };
    }
  }
}

export default new TranscriptionService();
