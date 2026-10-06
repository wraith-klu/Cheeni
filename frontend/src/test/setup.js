import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Provide global mocks for Web Speech API if not present in jsdom
if (typeof window !== 'undefined') {
  if (!window.SpeechSynthesisUtterance) {
    class MockSpeechSynthesisUtterance {
      constructor(text = '') {
        this.text = text;
        this.lang = 'en-US';
        this.voice = null;
        this.volume = 1;
        this.rate = 1;
        this.pitch = 1;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
      }
    }
    window.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    global.SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  }

  if (!window.speechSynthesis) {
    const mockSpeechSynthesis = {
      speaking: false,
      paused: false,
      pending: false,
      onvoiceschanged: null,
      speak: vi.fn((utterance) => {
        if (utterance && utterance.onstart) utterance.onstart();
        if (utterance && utterance.onend) utterance.onend();
      }),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn(() => [
        { name: 'Microsoft Zira - English (United States)', lang: 'en-US', default: true },
        { name: 'Google US English Female', lang: 'en-US', default: false },
        { name: 'Samantha', lang: 'en-US', default: false },
      ]),
    };
    window.speechSynthesis = mockSpeechSynthesis;
    global.speechSynthesis = mockSpeechSynthesis;
  }
}
