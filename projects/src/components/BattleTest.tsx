'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * 对战模式测试工具
 * 
 * 使用说明：
 * 1. 先在游戏中点击"和奶酪PK"按钮进入对战模式
 * 2. 打开浏览器控制台（F12）查看实时状态日志
 * 3. 本页面提供状态监控、手动控制、自动测试三大功能
 */
interface BattleState {
  turnOwner: number;           // 0=玩家回合, 1=AI回合
  isAiMoving: boolean;         // AI行动锁
  currentTurn: string;         // 'player' | 'ai'
  gameState: string;           // 'idle' | 'charging' | 'jumping' | 'falling' | 'game_over'
  aiScore: number;             // AI分数
  playerScore: number;         // 玩家分数
  isAiBattleMode: boolean;     // 是否在对战模式
}

interface TestCase {
  id: number;
  name: string;
  description: string;
  steps: string[];
  expectedResults: string[];
}

export default function BattleTest() {
  const [battleState, setBattleState] = useState<BattleState>({
    turnOwner: 0,
    isAiMoving: false,
    currentTurn: 'player',
    gameState: 'idle',
    aiScore: 0,
    playerScore: 0,
    isAiBattleMode: false,
  });
  
  const [logs, setLogs] = useState<string[]>([]);
  const [isAutoTestRunning, setIsAutoTestRunning] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(true);
  
  // 日志容器ref，用于自动滚动到底部
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 测试用例定义
  const testCases: TestCase[] = [
    {
      id: 1,
      name: '场景1：对战模式初始化验证',
      description: '验证进入对战模式时，初始状态正确设置',
      steps: [
        '1. 点击游戏中"和奶酪PK"按钮',
        '2. 等待游戏初始化完成',
      ],
      expectedResults: [
        '✓ turnOwner === 0 (玩家回合)',
        '✓ isAiMoving === false (AI未锁定)',
        '✓ currentTurn === "player" (当前玩家行动)',
        '✓ 游戏状态为"idle"，可以跳跃',
      ],
    },
    {
      id: 2,
      name: '场景2：玩家成功跳跃→切换到AI回合',
      description: '验证玩家成功落地后，是否正确切换到AI回合',
      steps: [
        '1. 确保处于玩家回合（turnOwner=0）',
        '2. 按住鼠标/触摸屏幕蓄力，松开跳跃',
        '3. 成功落到下一个平台上',
      ],
      expectedResults: [
        '✓ 落地后 turnOwner === 1 (切到AI回合)',
        '✓ 落地后 isAiMoving === true (锁定AI行动)',
        '✓ 约600ms后自动触发AI跳跃动画',
        '✓ 玩家输入被暂时屏蔽',
      ],
    },
    {
      id: 3,
      name: '场景3：AI跳跃期间→行动锁验证',
      description: '验证AI跳跃期间，玩家输入被拦截且AI不重复执行',
      steps: [
        '1. 等待进入AI回合（turnOwner=1）',
        '2. 在AI跳跃动画执行期间',
        '3. 尝试点击屏幕或按住鼠标',
      ],
      expectedResults: [
        '✓ isAiMoving === true 期间，玩家点击不响应',
        '✓ performAiJump() 不会被重复调用',
        '✓ AI跳跃动画正常执行完成',
      ],
    },
    {
      id: 4,
      name: '场景4：AI成功跳跃→切回玩家回合',
      description: '验证奶酪AI成功落地后，是否正确解锁并切回玩家回合',
      steps: [
        '1. AI回合中，奶酪成功跳到下一个平台',
        '2. 观察状态变化',
      ],
      expectedResults: [
        '✓ 落地后 isAiMoving === false (解锁行动)',
        '✓ 落地后 turnOwner === 0 (切回玩家回合)',
        '✓ currentTurn === "player" (显示玩家回合)',
        '✓ 玩家可以重新开始蓄力跳跃',
      ],
    },
    {
      id: 5,
      name: '场景5：AI跳跃失败→直接结算玩家胜利',
      description: '验证奶酪AI掉落时，是否直接弹出结算面板，终止所有回合',
      steps: [
        '1. AI回合中，奶酪跳跃失败（没跳到平台上）',
        '2. 观察是否弹出结算界面',
      ],
      expectedResults: [
        '✓ 掉落瞬间 isAiMoving === false (解锁)',
        '✓ 直接弹出"你赢了！"结算面板',
        '✓ stateRef.current === "game_over" (游戏结束)',
        '✓ 无需切换回合，游戏结束',
      ],
    },
  ];

  // 添加日志
  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const colorMap = {
      info: '#333',
      success: '#00B894',
      warning: '#E17055',
      error: '#D63031',
    };
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-99), logEntry]);
    
    // 同时输出到控制台
    console.log(`%c${logEntry}`, `color: ${colorMap[type]}; font-weight: 500;`);
  };

  // 每500ms轮询状态（通过查找window上的调试对象）
  useEffect(() => {
    const interval = setInterval(() => {
      // 尝试从window上读取游戏调试状态（需要在Game组件中设置 window.__battleDebug）
      if ((window as any).__battleDebug) {
        const debug = (window as any).__battleDebug;
        setBattleState({
          turnOwner: debug.turnOwner ?? 0,
          isAiMoving: debug.isAiMoving ?? false,
          currentTurn: debug.currentTurn ?? 'player',
          gameState: debug.gameState ?? 'idle',
          aiScore: debug.aiScore ?? 0,
          playerScore: debug.playerScore ?? 0,
          isAiBattleMode: debug.isAiBattleMode ?? false,
        });
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  // 日志自动滚动
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // 自动测试：逐步模拟测试场景
  const runAutoTest = async (testId: number) => {
    setIsAutoTestRunning(true);
    addLog(`======== 开始执行测试用例 ${testId} ========`, 'info');
    
    const testCase = testCases.find(t => t.id === testId);
    if (!testCase) {
      addLog(`错误：未找到测试用例 ${testId}`, 'error');
      setIsAutoTestRunning(false);
      return;
    }

    addLog(`测试名称：${testCase.name}`, 'info');
    addLog(`测试描述：${testCase.description}`, 'info');
    addLog('---', 'info');

    // 执行测试步骤说明
    for (const step of testCase.steps) {
      addLog(`📝 ${step}`, 'info');
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    addLog('---', 'info');
    addLog('请手动在游戏中执行上述操作，然后观察以下预期结果：', 'warning');
    
    // 显示预期结果
    for (const expected of testCase.expectedResults) {
      addLog(expected, 'success');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    addLog(`======== 测试用例 ${testId} 执行完成 ========`, 'info');
    addLog('请在游戏中验证上述状态是否正确，然后在下方勾选确认', 'info');
    setIsAutoTestRunning(false);
  };

  // 手动检查当前状态
  const checkCurrentState = () => {
    addLog('--- 开始检查当前对战状态 ---', 'info');
    addLog(`1. 对战模式状态：${battleState.isAiBattleMode ? '✅ 已进入' : '❌ 未进入'}`, battleState.isAiBattleMode ? 'success' : 'warning');
    
    if (battleState.isAiBattleMode) {
      addLog(`2. turnOwner = ${battleState.turnOwner} (${battleState.turnOwner === 0 ? '玩家回合' : 'AI回合'})`, 'info');
      addLog(`3. isAiMoving = ${battleState.isAiMoving} (${battleState.isAiMoving ? '🔒 AI行动中，锁定' : '🔓 已解锁'})`, battleState.isAiMoving ? 'warning' : 'success');
      addLog(`4. currentTurn = "${battleState.currentTurn}"`, 'info');
      addLog(`5. 游戏状态 = "${battleState.gameState}"`, 'info');
      addLog(`6. 分数 - 玩家: ${battleState.playerScore}, 奶酪: ${battleState.aiScore}`, 'info');
      
      // 验证逻辑一致性
      if (battleState.turnOwner === 0 && battleState.currentTurn === 'player') {
        addLog('✓ 状态一致：当前为玩家回合，可以跳跃', 'success');
      } else if (battleState.turnOwner === 1 && battleState.currentTurn === 'ai') {
        addLog('✓ 状态一致：当前为AI回合，等待奶酪跳跃', 'success');
      } else {
        addLog('⚠ 状态可能不一致，请检查 turnOwner 和 currentTurn 是否匹配', 'warning');
      }
    }
    addLog('--- 状态检查完成 ---', 'info');
  };

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      width: '380px',
      maxHeight: 'calc(100vh - 20px)',
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '13px',
      pointerEvents: 'none',
    }}>
      {/* 折叠按钮 */}
      <button
        onClick={() => setShowTestPanel(!showTestPanel)}
        style={{
          pointerEvents: 'auto',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: '8px',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        {showTestPanel ? '▼ 隐藏测试面板' : '▶ 显示测试面板'}
      </button>

      {showTestPanel && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          padding: '16px',
          pointerEvents: 'auto',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 60px)',
          border: '1px solid #E0E0E0',
        }}>
          {/* 标题 */}
          <div style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#2D3436',
            marginBottom: '12px',
            borderBottom: '2px solid #667eea',
            paddingBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            🏆 对战模式测试工具
          </div>

          {/* 实时状态显示 */}
          <div style={{
            background: '#F8F9FA',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px',
            border: '1px solid #E9ECEF',
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#495057',
              marginBottom: '8px',
            }}>
              📊 实时对战状态
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '6px 12px',
              fontSize: '12px',
            }}>
              <div style={{ color: '#6C757D' }}>
                回合标识 turnOwner:
              </div>
              <div style={{
                color: battleState.turnOwner === 0 ? '#00B894' : '#0984E3',
                fontWeight: 600,
              }}>
                {battleState.turnOwner} ({battleState.turnOwner === 0 ? '玩家回合' : 'AI回合'})
              </div>

              <div style={{ color: '#6C757D' }}>
                AI行动锁 isAiMoving:
              </div>
              <div style={{
                color: battleState.isAiMoving ? '#D63031' : '#00B894',
                fontWeight: 600,
              }}>
                {String(battleState.isAiMoving)} ({battleState.isAiMoving ? '🔒 锁定中' : '🔓 已解锁'})
              </div>

              <div style={{ color: '#6C757D' }}>
                当前行动方:
              </div>
              <div style={{
                color: battleState.currentTurn === 'player' ? '#F39C12' : '#0984E3',
                fontWeight: 600,
              }}>
                {battleState.currentTurn === 'player' ? '🎮 玩家' : '🤖 奶酪AI'}
              </div>

              <div style={{ color: '#6C757D' }}>
                游戏状态:
              </div>
              <div style={{
                color: '#2D3436',
                fontWeight: 600,
              }}>
                {battleState.gameState}
              </div>

              <div style={{ color: '#6C757D' }}>
                玩家分数:
              </div>
              <div style={{ color: '#F39C12', fontWeight: 600 }}>
                {battleState.playerScore}
              </div>

              <div style={{ color: '#6C757D' }}>
                奶酪分数:
              </div>
              <div style={{ color: '#0984E3', fontWeight: 600 }}>
                {battleState.aiScore}
              </div>

              <div style={{ color: '#6C757D' }}>
                对战模式:
              </div>
              <div style={{
                color: battleState.isAiBattleMode ? '#00B894' : '#6C757D',
                fontWeight: 600,
              }}>
                {battleState.isAiBattleMode ? '✅ 已启用' : '❌ 未启用'}
              </div>
            </div>

            <button
              onClick={checkCurrentState}
              style={{
                marginTop: '10px',
                width: '100%',
                padding: '8px',
                background: '#6C5CE7',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              🔍 检查当前状态
            </button>
          </div>

          {/* 测试用例列表 */}
          <div style={{
            background: '#FFF9E6',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px',
            border: '1px solid #FFE8A3',
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#6B4226',
              marginBottom: '10px',
            }}>
              📋 测试用例（点击自动执行）
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {testCases.map(testCase => (
                <div
                  key={testCase.id}
                  style={{
                    background: 'white',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    border: '1px solid #E0E0E0',
                  }}
                >
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#2D3436',
                    marginBottom: '4px',
                  }}>
                    {testCase.name}
                  </div>
                  <div style={{
                    fontSize: '11px',
                    color: '#6C757D',
                    marginBottom: '6px',
                    lineHeight: 1.4,
                  }}>
                    {testCase.description}
                  </div>
                  <button
                    onClick={() => runAutoTest(testCase.id)}
                    disabled={isAutoTestRunning}
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      background: isAutoTestRunning ? '#B0B0B0' : '#F39C12',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isAutoTestRunning ? 'not-allowed' : 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    {isAutoTestRunning ? '⏳ 正在运行...' : '▶ 启动测试'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 操作提示 */}
          <div style={{
            background: '#E8F5E9',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '12px',
            border: '1px solid #A5D6A7',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#2E7D32',
              marginBottom: '6px',
            }}>
              💡 操作提示
            </div>
            <div style={{
              fontSize: '11px',
              color: '#388E3C',
              lineHeight: 1.6,
            }}>
              1. 先在游戏中点击 <b>"和奶酪PK"</b> 按钮<br />
              2. 状态面板会实时更新游戏状态<br />
              3. 点击测试用例按钮，按照日志提示操作<br />
              4. 观察游戏行为和状态是否符合预期
            </div>
          </div>

          {/* 日志面板 */}
          <div style={{
            background: '#263238',
            borderRadius: '8px',
            padding: '10px',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#B0BEC5',
              marginBottom: '6px',
            }}>
              📝 测试日志（同时输出到浏览器控制台）
            </div>
            <div
              ref={logContainerRef}
              style={{
                maxHeight: '200px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '11px',
                lineHeight: 1.6,
                background: '#1E282D',
                borderRadius: '4px',
                padding: '8px',
                color: '#ECEFF1',
              }}
            >
              {logs.length === 0 ? (
                <div style={{ color: '#78909C', fontStyle: 'italic' }}>
                  日志为空，请点击上方测试按钮开始...
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} style={{ marginBottom: '2px', wordBreak: 'break-word' }}>
                    {log}
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => setLogs([])}
              style={{
                marginTop: '6px',
                fontSize: '11px',
                padding: '4px 10px',
                background: '#546E7A',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              清空日志
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
