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
  en: 'en-US',
  el: 'el-GR',
  de: 'de-DE',
  es: 'es-ES',
  tr: 'tr-TR',
};

export function useBrowserVoice(input: {
  language: AILanguage;
  rate: number;
  pitch: number;
  onFinalTranscript: (transcript: string) => void | Promise<void>;
  onError?: (message: string) => void;
}) {
  const { language, rate, pitch, onFinalTranscript, onError } = input;
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = React.useRef('');
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

  const stopListening = React.useCallback((abort = false) => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      try {
        if (abort) recognition.abort();
        else recognition.stop();
      } catch {
        // Recognition may already have stopped in the browser.
      }
    }
    setListening(false);
  }, []);

  const stopSpeaking = React.useCallback(() => {
    speechRunRef.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const startListening = React.useCallback(async () => {
    const Constructor = recognitionConstructor();
    if (!supported || !Constructor) {
      setPermission('unsupported');
      reportError('Speech recognition is not supported by this browser.');
      return false;
    }

    stopSpeaking();
    stopListening(true);
    finalTranscriptRef.current = '';
    setFinalTranscript('');
    setInterimTranscript('');
    setError(null);

    const recognition = new Constructor();
    recognition.lang = LANGUAGE_LOCALES[language];
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
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
      setFinalTranscript(final);
      setInterimTranscript(interim);
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      const message = event.message || event.error || 'Voice recognition failed.';
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setPermission('denied');
      }
      reportError(message);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterimTranscript('');
      const transcript = finalTranscriptRef.current.trim();
      if (transcript) void finalHandlerRef.current(transcript);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      return true;
    } catch (startError) {
      recognitionRef.current = null;
      setListening(false);
      reportError(startError instanceof Error ? startError.message : String(startError));
      return false;
    }
  }, [language, recognitionConstructor, reportError, stopListening, stopSpeaking, supported]);

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
    const localePrefix = LANGUAGE_LOCALES[language].split('-')[0]?.toLowerCase();
    const matchingVoice = voices.find((voice) => voice.lang.toLowerCase() === LANGUAGE_LOCALES[language].toLowerCase())
      || voices.find((voice) => voice.lang.toLowerCase().startsWith(localePrefix || ''));
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
    stopListening(true);
    stopSpeaking();
  }, [stopListening, stopSpeaking]);

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
      setFinalTranscript('');
      setInterimTranscript('');
    },
  };
}
