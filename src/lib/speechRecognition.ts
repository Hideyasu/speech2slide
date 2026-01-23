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
	onaudiostart: (() => void) | null;
	onaudioend: (() => void) | null;
	onsoundstart: (() => void) | null;
	onsoundend: (() => void) | null;
	onspeechstart: (() => void) | null;
	onspeechend: (() => void) | null;
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
export type StatusCallback = (status: string) => void;

export function createSpeechRecognition(
	onResult: SpeechCallback,
	onError?: (error: string) => void,
	lang: string = 'ja-JP',
	onStatusChange?: StatusCallback
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

	console.log('[SpeechRecognition] 初期化完了', { lang, continuous: true, interimResults: true });

	recognition.onstart = () => {
		console.log('[SpeechRecognition] 開始しました - マイクがアクティブです');
		onStatusChange?.('開始 - マイク待機中');
	};

	recognition.onaudiostart = () => {
		console.log('[SpeechRecognition] 音声入力開始 - マイクから音声を受信中');
		onStatusChange?.('音声入力中');
	};

	recognition.onsoundstart = () => {
		console.log('[SpeechRecognition] 音検出開始');
		onStatusChange?.('音検出中');
	};

	recognition.onspeechstart = () => {
		console.log('[SpeechRecognition] 音声検出開始 - 話し声を検出しました');
		onStatusChange?.('音声検出中');
	};

	recognition.onspeechend = () => {
		console.log('[SpeechRecognition] 音声検出終了');
		onStatusChange?.('音声検出終了');
	};

	recognition.onsoundend = () => {
		console.log('[SpeechRecognition] 音検出終了');
	};

	recognition.onaudioend = () => {
		console.log('[SpeechRecognition] 音声入力終了');
		onStatusChange?.('音声入力終了');
	};

	recognition.onresult = (event: SpeechRecognitionEvent) => {
		const result = event.results[event.results.length - 1];
		const transcript = result[0].transcript;
		const isFinal = result.isFinal;
		console.log('[SpeechRecognition] 結果:', { transcript, isFinal, confidence: result[0].confidence });
		onStatusChange?.(isFinal ? '認識完了' : '認識中...');
		onResult(transcript, isFinal);
	};

	recognition.onerror = (event: Event) => {
		const errorEvent = event as Event & { error?: string };
		const errorCode = errorEvent.error;

		console.log('[SpeechRecognition] エラー:', errorCode);

		// 無視してよいエラー（音声が検出されなかった、または中断された）
		if (errorCode === 'no-speech' || errorCode === 'aborted') {
			console.log('[SpeechRecognition] 無視するエラー:', errorCode);
			onStatusChange?.('音声なし - 再試行中');
			return;
		}

		// ネットワークエラーは再試行で回復することが多い
		if (errorCode === 'network') {
			console.warn('[SpeechRecognition] ネットワークエラー、再接続中...');
			onStatusChange?.('ネットワークエラー - 再接続中');
			return;
		}

		// それ以外のエラーはユーザーに通知
		const errorMessages: Record<string, string> = {
			'not-allowed': 'マイクの使用が許可されていません。ブラウザの設定を確認してください。',
			'audio-capture': 'マイクが見つかりません。マイクが接続されているか確認してください。',
			'service-not-allowed': '音声認識サービスが利用できません。'
		};

		onStatusChange?.('エラー');
		onError?.(errorMessages[errorCode || ''] || `音声認識エラー: ${errorCode || '不明なエラー'}`);
	};

	recognition.onend = () => {
		console.log('[SpeechRecognition] 終了しました', { isRunning });
		if (isRunning) {
			// 自動で再開
			console.log('[SpeechRecognition] 自動再開中...');
			onStatusChange?.('再接続中...');
			setTimeout(() => {
				try {
					recognition.start();
				} catch (e) {
					console.error('[SpeechRecognition] 再開失敗:', e);
				}
			}, 100);
		}
	};

	return {
		start: () => {
			console.log('[SpeechRecognition] start() 呼び出し');
			isRunning = true;
			onStatusChange?.('開始中...');
			try {
				recognition.start();
				console.log('[SpeechRecognition] recognition.start() 成功');
			} catch (e) {
				console.error('[SpeechRecognition] recognition.start() 失敗:', e);
				onStatusChange?.('開始失敗');
			}
		},
		stop: () => {
			console.log('[SpeechRecognition] stop() 呼び出し');
			isRunning = false;
			onStatusChange?.('停止');
			recognition.stop();
		},
		isSupported: true
	};
}
