import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechRecognition } from './useSpeechRecognition';

describe('useSpeechRecognition hook', () => {
  let mockRecognitionInstance;

  beforeEach(() => {
    mockRecognitionInstance = {
      continuous: false,
      interimResults: false,
      lang: 'en-US',
      start: vi.fn(function () {
        if (this.onstart) this.onstart();
      }),
      stop: vi.fn(function () {
        if (this.onend) this.onend();
      }),
      abort: vi.fn(),
      onstart: null,
      onresult: null,
      onerror: null,
      onend: null,
    };

    window.SpeechRecognition = vi.fn().mockImplementation(() => mockRecognitionInstance);
    window.webkitSpeechRecognition = window.SpeechRecognition;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('detects browser support correctly', () => {
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.hasSupport).toBe(true);
    expect(result.current.isListening).toBe(false);
    expect(result.current.transcript).toBe('');
    expect(result.current.error).toBeNull();
  });

  it('starts listening and updates state when startListening is called', async () => {
    const { result } = renderHook(() => useSpeechRecognition());

    await act(async () => {
      await result.current.startListening();
    });

    expect(mockRecognitionInstance.start).toHaveBeenCalled();
    expect(result.current.isListening).toBe(true);
  });

  it('captures speech results and updates transcript', async () => {
    const onResultMock = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onResult: onResultMock })
    );

    await act(async () => {
      await result.current.startListening();
    });

    // Simulate speech recognition event
    act(() => {
      const mockEvent = {
        resultIndex: 0,
        results: [
          [{ transcript: 'Hello Cheeni' }],
        ],
      };
      mockEvent.results[0].isFinal = true;
      mockRecognitionInstance.onresult(mockEvent);
    });

    expect(result.current.transcript).toBe('Hello Cheeni');
    expect(onResultMock).toHaveBeenCalledWith('Hello Cheeni');
  });

  it('stops listening and triggers onEnd callback', async () => {
    const onEndMock = vi.fn();
    const { result } = renderHook(() =>
      useSpeechRecognition({ onEnd: onEndMock })
    );

    await act(async () => {
      await result.current.startListening();
    });

    // Feed some transcript
    act(() => {
      const mockEvent = {
        resultIndex: 0,
        results: [[{ transcript: 'Open GitHub' }]],
      };
      mockEvent.results[0].isFinal = true;
      mockRecognitionInstance.onresult(mockEvent);
    });

    act(() => {
      result.current.stopListening();
    });

    expect(mockRecognitionInstance.stop).toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
    expect(onEndMock).toHaveBeenCalledWith('Open GitHub');
  });

  it('handles permission denied error gracefully', async () => {
    const { result } = renderHook(() => useSpeechRecognition());

    await act(async () => {
      await result.current.startListening();
    });

    act(() => {
      mockRecognitionInstance.onerror({ error: 'not-allowed' });
    });

    expect(result.current.isListening).toBe(false);
    expect(result.current.error).toContain('Microphone permission blocked');
  });

  it('resets transcript when resetTranscript is called', () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.resetTranscript();
    });

    expect(result.current.transcript).toBe('');
  });
});
