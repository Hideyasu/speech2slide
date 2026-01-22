<script lang="ts">
	import { onMount } from 'svelte';
	import { createSpeechRecognition } from '$lib/speechRecognition';

	let isListening = $state(false);
	let currentTranscript = $state('');
	let finalTranscript = $state('');
	let slideTitle = $state('');
	let slideImageUrl = $state('');
	let isGenerating = $state(false);
	let error = $state('');
	let isSupported = $state(true);
	let lastContext = $state('');

	let speechRecognition: ReturnType<typeof createSpeechRecognition> | null = null;
	let generateTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		speechRecognition = createSpeechRecognition(
			(transcript, isFinal) => {
				if (isFinal) {
					finalTranscript = transcript;
					currentTranscript = '';
					scheduleSlideGeneration(transcript);
				} else {
					currentTranscript = transcript;
				}
			},
			(errorMsg) => {
				error = errorMsg;
			},
			'ja-JP'
		);
		isSupported = speechRecognition.isSupported;
	});

	function scheduleSlideGeneration(transcript: string) {
		if (generateTimeout) {
			clearTimeout(generateTimeout);
		}
		// 1.5秒待ってからスライドを生成（連続した発話をまとめる）
		generateTimeout = setTimeout(() => {
			generateSlide(transcript);
		}, 1500);
	}

	async function generateSlide(transcript: string) {
		if (isGenerating || !transcript.trim()) return;

		isGenerating = true;
		error = '';

		try {
			const response = await fetch('/api/generate-slide', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					transcript,
					context: lastContext
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'スライド生成に失敗しました');
			}

			if (data.shouldGenerate && data.imageUrl) {
				slideImageUrl = data.imageUrl;
				slideTitle = data.title;
				lastContext = transcript;
			} else if (data.title) {
				slideTitle = data.title;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : '不明なエラーが発生しました';
		} finally {
			isGenerating = false;
		}
	}

	function toggleListening() {
		if (!speechRecognition) return;

		if (isListening) {
			speechRecognition.stop();
			isListening = false;
		} else {
			error = '';
			speechRecognition.start();
			isListening = true;
		}
	}
</script>

<svelte:head>
	<title>Speech2Slide - 音声でスライド生成</title>
</svelte:head>

<main>
	<div class="container">
		<header>
			<h1>Speech2Slide</h1>
			<p class="subtitle">話している内容に合わせてスライドを自動生成</p>
		</header>

		<div class="slide-area">
			{#if slideImageUrl}
				<div class="slide">
					<img src={slideImageUrl} alt={slideTitle} />
					{#if slideTitle}
						<div class="slide-title">{slideTitle}</div>
					{/if}
				</div>
			{:else}
				<div class="slide placeholder">
					<p>🎤 マイクをオンにして話し始めると、<br />内容に合ったスライドが表示されます</p>
				</div>
			{/if}
			{#if isGenerating}
				<div class="generating-overlay">
					<div class="spinner"></div>
					<p>スライドを生成中...</p>
				</div>
			{/if}
		</div>

		<div class="transcript-area">
			<div class="transcript">
				{#if finalTranscript || currentTranscript}
					<span class="final">{finalTranscript}</span>
					<span class="interim">{currentTranscript}</span>
				{:else}
					<span class="placeholder-text">ここに認識されたテキストが表示されます</span>
				{/if}
			</div>
		</div>

		<div class="controls">
			<button
				class="mic-button"
				class:listening={isListening}
				onclick={toggleListening}
				disabled={!isSupported}
			>
				{#if isListening}
					<span class="mic-icon">🎙️</span>
					<span>停止</span>
				{:else}
					<span class="mic-icon">🎤</span>
					<span>開始</span>
				{/if}
			</button>
		</div>

		{#if error}
			<div class="error">{error}</div>
		{/if}

		{#if !isSupported}
			<div class="warning">
				このブラウザは音声認識に対応していません。<br />
				Chrome、Edge、またはSafariをお使いください。
			</div>
		{/if}
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family:
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
		min-height: 100vh;
		color: #fff;
	}

	main {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.container {
		max-width: 1200px;
		width: 100%;
	}

	header {
		text-align: center;
		margin-bottom: 30px;
	}

	h1 {
		font-size: 2.5rem;
		margin: 0;
		background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.subtitle {
		color: #888;
		margin-top: 8px;
	}

	.slide-area {
		position: relative;
		aspect-ratio: 16 / 9;
		background: #222;
		border-radius: 16px;
		overflow: hidden;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
	}

	.slide {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.slide img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.slide-title {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 20px;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
		font-size: 1.5rem;
		font-weight: bold;
	}

	.slide.placeholder {
		background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
	}

	.slide.placeholder p {
		color: #666;
		text-align: center;
		font-size: 1.2rem;
		line-height: 1.8;
	}

	.generating-overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
	}

	.spinner {
		width: 50px;
		height: 50px;
		border: 4px solid #333;
		border-top-color: #667eea;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.transcript-area {
		margin-top: 24px;
		padding: 20px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 12px;
		min-height: 60px;
	}

	.transcript {
		font-size: 1.1rem;
		line-height: 1.6;
	}

	.transcript .final {
		color: #fff;
	}

	.transcript .interim {
		color: #888;
	}

	.placeholder-text {
		color: #555;
	}

	.controls {
		display: flex;
		justify-content: center;
		margin-top: 24px;
	}

	.mic-button {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 16px 32px;
		font-size: 1.2rem;
		border: none;
		border-radius: 50px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
	}

	.mic-button:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 6px 30px rgba(102, 126, 234, 0.6);
	}

	.mic-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.mic-button.listening {
		background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			box-shadow: 0 4px 20px rgba(240, 147, 251, 0.4);
		}
		50% {
			box-shadow: 0 4px 40px rgba(240, 147, 251, 0.8);
		}
	}

	.mic-icon {
		font-size: 1.5rem;
	}

	.error {
		margin-top: 20px;
		padding: 16px;
		background: rgba(239, 68, 68, 0.2);
		border: 1px solid rgba(239, 68, 68, 0.5);
		border-radius: 8px;
		color: #fca5a5;
		text-align: center;
	}

	.warning {
		margin-top: 20px;
		padding: 16px;
		background: rgba(245, 158, 11, 0.2);
		border: 1px solid rgba(245, 158, 11, 0.5);
		border-radius: 8px;
		color: #fcd34d;
		text-align: center;
	}
</style>
