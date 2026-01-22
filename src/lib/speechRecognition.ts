// Web Speech API types
interface SpeechRecognitionEvent extends Event {
	results: SpeechRecognitionResultList;
	resultIndex: number;
}

interface SpeechRecognitionResultList {
	length: number;
	item(index: number): SpeechRecognitionResult;
	[index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
	length: number;
	item(index: number): SpeechRecognitionAlternative;
	[index: number]: SpeechRecognitionAlternative;
	isFinal: boolean;
}

interface SpeechRecognitionAlternative {
	transcript: string;
	confidence: number;
}

interface SpeechRecognition extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	onerror: ((event: Event) => void) | null;
	onend: (() => void) | null;
	onstart: (() => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

declare global {
	interface Window {
		SpeechRecognition: new () => SpeechRecognition;
		webkitSpeechRecognition: new () => SpeechRecognition;
	}
}

export type SpeechCallback = (transcript: string, isFinal: boolean) => void;

export function createSpeechRecognition(
	onResult: SpeechCallback,
	onError?: (error: string) => void,
	lang: string = 'ja-JP'
): {
	start: () => void;
	stop: () => void;
	isSupported: boolean;
} {
	const SpeechRecognitionClass =
		typeof window !== 'undefined'
			? window.SpeechRecognition || window.webkitSpeechRecognition
			: null;

	if (!SpeechRecognitionClass) {
		return {
			start: () => onError?.('音声認識がサポートされていません'),
			stop: () => {},
			isSupported: false
		};
	}

	const recognition = new SpeechRecognitionClass();
	recognition.continuous = true;
	recognition.interimResults = true;
	recognition.lang = lang;

	let isRunning = false;

	recognition.onresult = (event: SpeechRecognitionEvent) => {
		const result = event.results[event.results.length - 1];
		const transcript = result[0].transcript;
		const isFinal = result.isFinal;
		onResult(transcript, isFinal);
	};

	recognition.onerror = (event: Event) => {
		const errorEvent = event as Event & { error?: string };
		onError?.(`音声認識エラー: ${errorEvent.error || '不明なエラー'}`);
	};

	recognition.onend = () => {
		if (isRunning) {
			// 自動で再開
			try {
				recognition.start();
			} catch {
				// Already started
			}
		}
	};

	return {
		start: () => {
			isRunning = true;
			try {
				recognition.start();
			} catch {
				// Already started
			}
		},
		stop: () => {
			isRunning = false;
			recognition.stop();
		},
		isSupported: true
	};
}
