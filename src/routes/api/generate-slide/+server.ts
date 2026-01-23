import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import OpenAI from 'openai';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
	try {
		if (!env.OPENAI_API_KEY) {
			return json({ error: 'OpenAI APIキーが設定されていません' }, { status: 500 });
		}

		const openai = new OpenAI({
			apiKey: env.OPENAI_API_KEY
		});

		const { transcript, context } = await request.json();

		if (!transcript) {
			return json({ error: 'トランスクリプトが必要です' }, { status: 400 });
		}

		// GPT-4o-miniでスライドの内容を決定（高速化）
		const contentResponse = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content: `あなたはプレゼンテーションスライドを生成するアシスタントです。
ユーザーが話している内容に基づいて、適切なスライド画像のプロンプトを生成してください。

以下の形式でJSONを返してください:
{
  "title": "スライドのタイトル（短く）",
  "imagePrompt": "DALL-E用の英語の画像生成プロンプト（シンプルでプロフェッショナルなビジネスイラスト風）",
  "shouldGenerate": true/false (前回と大きく異なるトピックならtrue)
}

注意:
- imagePromptは必ず英語で書いてください
- シンプルでクリーンなビジネスプレゼンテーション向けのイラストを指定してください
- 文字や複雑な要素は避け、コンセプトを視覚的に表現してください`
				},
				{
					role: 'user',
					content: `現在の発言: ${transcript}\n\n前回のコンテキスト: ${context || 'なし'}`
				}
			],
			response_format: { type: 'json_object' }
		});

		const content = JSON.parse(contentResponse.choices[0].message.content || '{}');

		if (!content.shouldGenerate) {
			return json({ shouldGenerate: false, title: content.title });
		}

		// DALL-E 2で画像を生成（高速化）
		const imageResponse = await openai.images.generate({
			model: 'dall-e-2',
			prompt: `Professional presentation slide illustration: ${content.imagePrompt}. Clean, minimal, modern business style. No text. White background.`,
			n: 1,
			size: '1024x1024'
		});

		const imageUrl = imageResponse.data[0].url;

		return json({
			shouldGenerate: true,
			title: content.title,
			imageUrl,
			imagePrompt: content.imagePrompt
		});
	} catch (error) {
		console.error('Error generating slide:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'スライド生成エラー' },
			{ status: 500 }
		);
	}
};
