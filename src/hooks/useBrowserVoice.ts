import React from 'react';
import type { AILanguage } from '@/ai';
import type { AIVoicePermission } from '@/ai/voice/types';

type SpeechRecognitionResultEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionErrorEventLike = Event & { error: string; message?: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & typeof globalThis & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const LANGUAGE_LOCALES: Record<AILanguage, string> = {
  en: 'en-GB',
  el: 'el-GR',
  de: 'de-DE',
  es: 'es-ES',
  tr: 'tr-TR',
};

const DEFAULT_SILENCE_GRACE_MS = 3000;
const RECOGNITION_RESTART_DELAY_MS = 160;

export function useBrowserVoice(input: {
  language: AILanguage;
  rate: number;
  pitch: number;
  silenceGraceMs?: number;
  onFinalTranscript: (transcript: string) => void | Promise<void>;
  onError?: (message: string) => void;
}) {
  const {
    language,
    rate,
    pitch,
    silenceGraceMs = DEFAULT_SILENCE_GRACE_MS,
    onFinalTranscript,
    onError,
  } = input;
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = React.useRef('');
  const interimTranscriptRef = React.useRef('');
  const listeningIntentRef = React.useRef(false);
  const submittedRef = React.useRef(false);
  const lastSpeechActivityRef = React.useRef(0);
  const silenceTimerRef = React.useRef<number | null>(null);
  const restartTimerRef = React.useRef<number | null>(null);
  const recognitionCycleRef = React.useRef<() => boolean>(() => false);
  const speechRunRef = React.useRef(0);
  const finalHandlerRef = React.useRef(onFinalTranscript);
  const errorHandlerRef = React.useRef(onError);
  const [permission, setPermission] = React.useState<AIVoicePermission>('unknown');
  const [listening, setListening] = React.useState(false);
  const [speaking, setSpeaking] = React.useState(false);
  const [interimTranscript, setInterimTranscript] = React.useState('');
  const [finalTranscript, setFinalTranscript] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    finalHandlerRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  React.useEffect(() => {
    errorHandlerRef.current = onError;
  }, [onError]);

  const recognitionConstructor = React.useCallback(() => {
    if (typeof window === 'undefined') return undefined;
    const voiceWindow = window as SpeechWindow;
    return voiceWindow.SpeechRecognition || voiceWindow.webkitSpeechRecognition;
  }, []);

  const supported = Boolean(
    typeof window !== 'undefined'
      && recognitionConstructor()
      && 'speechSynthesis' in window
      && typeof SpeechSynthesisUtterance !== 'undefined',
  );

  React.useEffect(() => {
    if (!supported) setPermission('unsupported');
  }, [supported]);

  const clearSilenceTimer = React.useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const clearRestartTimer = React.useCallback(() => {
    if (restartTimerRef.current !== null) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const reportError = React.useCallback((message: string) => {
    setError(message);
    errorHandlerRef.current?.(message);
  }, []);

  const requestPermission = React.useCallback(async () => {
    if (!supported) {
      setPermission('unsupported');
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission('prompt');
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      setPermission('granted');
      setError(null);
      return true;
    } catch (permissionError) {
      const message = permissionError instanceof Error ? permissionError.message : String(permissionError);
      setPermission('denied');
      reportError(message);
      return false;
    }
  }, [reportError, supported]);

  const finishListening = React.useCallback((submitTranscript: boolean) => {
    if (submittedRef.current && submitTranscript) return;

    listeningIntentRef.current = false;
    clearSilenceTimer();
    clearRestartTimer();

    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        recognition.abort();
      } catch {
        // Recognition may already have ended in the browser.
      }
    }

    setListening(false);
    setInterimTranscript('');

    if (!submitTranscript) {
      interimTranscriptRef.current = '';
      return;
    }

    submittedRef.current = true;
    const transcript = [finalTranscriptRef.current, interimTranscriptRef.current]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    interimTranscriptRef.current = '';
    if (transcript) void finalHandlerRef.current(transcript);
  }, [clearRestartTimer, clearSilenceTimer]);

  const scheduleSilenceCompletion = React.useCallback(() => {
    clearSilenceTimer();
    const grace = Math.max(3000, Math.min(Number(silenceGraceMs) || DEFAULT_SILENCE_GRACE_MS, 10000));
    silenceTimerRef.current = window.setTimeout(() => {
      finishListening(true);
    }, grace);
  }, [clearSilenceTimer, finishListening, silenceGraceMs]);

  const stopListening = React.useCallback((abort = false) => {
    finishListening(!abort);
  }, [finishListening]);

  const stopSpeaking = React.useCallback(() => {
    speechRunRef.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const startRecognitionCycle = React.useCallback(() => {
    if (!listeningIntentRef.current || submittedRef.current) return false;
    const Constructor = recognitionConstructor();
    if (!Constructor) return false;

    const recognition = new Constructor();
    recognition.lang = LANGUAGE_LOCALES[language];
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (!listeningIntentRef.current) return;
      setPermission('granted');
      setListening(true);
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = finalTranscriptRef.current;

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript || '';
        if (result?.isFinal) final = `${final} ${transcript}`.trim();
        else interim = `${interim} ${transcript}`.trim();
      }

      finalTranscriptRef.current = final;
      interimTranscriptRef.current = interim;
      lastSpeechActivityRef.current = Date.now();
      setFinalTranscript(final);
      setInterimTranscript(interim);
      scheduleSilenceCompletion();
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;
      if (event.error === 'no-speech') {
        // Chrome may end a recognition cycle after a short silence. The onend
        // handler restarts it while the 3-second grace period remains active.
        return;
      }

      const message = event.message || event.error || 'Voice recognition failed.';
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setPermission('denied');
        listeningIntentRef.current = false;
      }
      if (event.error === 'audio-capture' || event.error === 'network') {
        listeningIntentRef.current = false;
      }
      reportError(message);
    };

    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      if (!listeningIntentRef.current || submittedRef.current) {
        setListening(false);
        return;
      }

      const grace = Math.max(3000, Math.min(Number(silenceGraceMs) || DEFAULT_SILENCE_GRACE_MS, 10000));
      const hasTranscript = Boolean(finalTranscriptRef.current.trim() || interimTranscriptRef.current.trim());
      const elapsed = lastSpeechActivityRef.current > 0
        ? Date.now() - lastSpeechActivityRef.current
        : 0;

      if (hasTranscript && elapsed >= grace) {
        finishListening(true);
        return;
      }

      clearRestartTimer();
      restartTimerRef.current = window.setTimeout(() => {
        if (listeningIntentRef.current && !submittedRef.current) {
          recognitionCycleRef.current();
        }
      }, RECOGNITION_RESTART_DELAY_MS);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      return true;
    } catch (startError) {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
      reportError(startError instanceof Error ? startError.message : String(startError));
      return false;
    }
  }, [clearRestartTimer, finishListening, language, recognitionConstructor, reportError, scheduleSilenceCompletion, silenceGraceMs]);

  React.useEffect(() => {
    recognitionCycleRef.current = startRecognitionCycle;
  }, [startRecognitionCycle]);

  const startListening = React.useCallback(async () => {
    const Constructor = recognitionConstructor();
    if (!supported || !Constructor) {
      setPermission('unsupported');
      reportError('Speech recognition is not supported by this browser.');
      return false;
    }

    stopSpeaking();
    finishListening(false);
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    submittedRef.current = false;
    listeningIntentRef.current = true;
    lastSpeechActivityRef.current = 0;
    setFinalTranscript('');
    setInterimTranscript('');
    setError(null);

    return startRecognitionCycle();
  }, [finishListening, recognitionConstructor, reportError, startRecognitionCycle, stopSpeaking, supported]);

  const speak = React.useCallback((text: string, onEnd?: () => void) => {
    const cleanText = text.trim();
    if (!cleanText || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      return false;
    }

    stopListening(true);
    window.speechSynthesis.cancel();
    const speechRun = speechRunRef.current + 1;
    speechRunRef.current = speechRun;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = LANGUAGE_LOCALES[language];
    utterance.rate = Math.max(0.5, Math.min(rate, 2));
    utterance.pitch = Math.max(0.5, Math.min(pitch, 2));

    const voices = window.speechSynthesis.getVoices();
    const requestedLocale = LANGUAGE_LOCALES[language].toLowerCase();
    const localePrefix = requestedLocale.split('-')[0] || '';
    const matchingVoice = voices.find((voice) => voice.lang.toLowerCase() === requestedLocale)
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(localePrefix));
    if (matchingVoice) utterance.voice = matchingVoice;

    utterance.onstart = () => {
      if (speechRunRef.current === speechRun) setSpeaking(true);
    };
    utterance.onend = () => {
      if (speechRunRef.current !== speechRun) return;
      setSpeaking(false);
      onEnd?.();
    };
    utterance.onerror = (event) => {
      if (speechRunRef.current !== speechRun) return;
      setSpeaking(false);
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      reportError(event.error || 'Speech playback failed.');
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  }, [language, pitch, rate, reportError, stopListening]);

  React.useEffect(() => () => {
    finishListening(false);
    stopSpeaking();
  }, [finishListening, stopSpeaking]);

  return {
    supported,
    permission,
    listening,
    speaking,
    interimTranscript,
    finalTranscript,
    error,
    requestPermission,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    clearTranscript: () => {
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      setFinalTranscript('');
      setInterimTranscript('');
    },
  };
}
