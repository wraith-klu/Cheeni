import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpeechSynthesis } from './useSpeechSynthesis';

describe('useSpeechSynthesis hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default settings and loads available voices', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.isSpeaking).toBe(false);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.pitch).toBe(1.0);
    expect(result.current.rate).toBe(1.02);
    expect(Array.isArray(result.current.voices)).toBe(true);
  });

  it('allows toggling mute state', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    expect(result.current.isMuted).toBe(false);

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(true);

    act(() => {
      result.current.toggleMute();
    });

    expect(result.current.isMuted).toBe(false);
  });

  it('allows tuning pitch and rate', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.setPitch(1.2);
      result.current.setRate(1.1);
    });

    expect(result.current.pitch).toBe(1.2);
    expect(result.current.rate).toBe(1.1);
  });

  it('calls window.speechSynthesis.speak with cleaned text when speak is called', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('Hello from Cheeni assistant!');
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });

  it('cancels speech when stop is called', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('Testing speech interruption');
    });

    act(() => {
      result.current.stop();
    });

    expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    expect(result.current.isSpeaking).toBe(false);
  });

  it('strips markdown code blocks and json syntax before speaking', () => {
    const { result } = renderHook(() => useSpeechSynthesis());

    act(() => {
      result.current.speak('```javascript console.log("secret"); ``` Check this out.');
    });

    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });
});
