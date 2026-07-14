import { NextRequest } from 'next/server';

const AGENT_URL = 'https://9b8tyvy92p.coze.site/stream_run';

// 5种场景 → 构建不同query文本（统一由校园向导·奶酪智能体输出）
function buildQuery(scene: string, score: number, landmark: string, comboCount: number): string {
  switch (scene) {
    case 'game_start':
      return `[校园向导·奶酪] 玩家刚进入校园跳一跳打卡游戏，请用8-20字简短打招呼欢迎，鼓励开始校园打卡之旅！`;
    case 'perfect_land':
      return `[校园向导·奶酪] 玩家精准跳到平台中心获得额外加分！当前${score}分，请用8-20字夸赞精准厉害！`;
    case 'high_score':
      return `[校园向导·奶酪] 玩家达成高分${score}分，连胜中！请用8-20字鼓励加油打气！`;
    case 'game_over':
      return `[校园向导·奶酪] 玩家跳跃失误掉落了，当前${score}分，请用8-20字温柔安慰鼓励再来一局！`;
    case 'landmark':
      return `[校园向导·奶酪] 玩家到达校园地标「${landmark}」，当前${score}分，请用8-20字简短介绍「${landmark}」！`;
    default:
      return `[校园向导·奶酪] 当前${score}分，请用8-20字简短鼓励！`;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const scene = body.scene as string;
  const score = (body.score as number) || 0;
  const landmark = (body.landmark as string) || '';
  const comboCount = (body.comboCount as number) || 0;

  if (!scene) {
    return new Response(JSON.stringify({ error: 'Missing scene' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const query = buildQuery(scene, score, landmark, comboCount);

  // 每次请求生成唯一 session_id，避免状态干扰
  const sessionId = `jump_${scene}_${Date.now()}`;

  const token = process.env.COZE_WORKLOAD_API_TOKEN || '';
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing API token' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch(AGENT_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, session_id: sessionId, stream: true }),
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => '');
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: `Agent request failed: ${res.status} ${errText}` })}\n\n`)
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          // 保留最后一个可能不完整的行
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const jsonStr = trimmed.slice(6);
            try {
              const data = JSON.parse(jsonStr);

              // 提取 answer 类型的事件内容
              if (data.type === 'answer' && data.content?.answer) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text: data.content.answer })}\n\n`)
                );
              }

              // 检查 message_end 是否有错误
              if (data.type === 'message_end' && data.content?.message_end) {
                const endData = data.content.message_end;
                if (endData.code !== '0' && endData.message) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ error: endData.message })}\n\n`)
                  );
                }
              }
            } catch {
              // 忽略无法解析的行
            }
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Agent call failed';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
