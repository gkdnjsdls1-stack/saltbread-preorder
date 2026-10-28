// 사장님 알림(텔레그램) 설정 도우미. 실행: npm run check:notify
//
// 토큰만 넣고 돌리면 채팅 ID를 대신 찾아준다. 둘 다 있으면 시험 메시지를 보낸다.
// 채팅 ID 찾기가 이 과정에서 제일 헷갈리는 단계라 자동으로 처리한다.

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

function title(s) {
  console.log(`\n${s}`);
}

if (!token) {
  title('TELEGRAM_BOT_TOKEN 이 비어 있습니다.');
  console.log(`
  1. 텔레그램에서 @BotFather 를 찾아 대화를 엽니다.
  2. /newbot 을 보내고, 봇 이름과 아이디를 정합니다.
     (아이디는 반드시 bot 으로 끝나야 합니다. 예: bridegroom_order_bot)
  3. 받은 토큰을 .env.local 의 TELEGRAM_BOT_TOKEN= 에 붙여넣습니다.
  4. 이 명령을 다시 돌립니다.
`);
  process.exit(1);
}

async function api(method, body) {
  let res;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    // 회사·학교 네트워크가 텔레그램을 막아둔 경우가 흔하다. 그때 이 스크립트가
    // 그냥 터지면 토큰이 틀린 줄 알게 되므로, 네트워크 문제라고 분명히 알려준다.
    console.log(`
  FAIL  텔레그램 서버에 닿지 못했습니다 (${err instanceof Error ? err.message : err}).

  토큰 문제가 아니라 네트워크 문제일 수 있습니다. 회사나 학교 인터넷은
  텔레그램을 막아두는 곳이 많습니다. 확인하려면:

    Resolve-DnsName api.telegram.org

  엉뚱한 주소(예: 172.x)가 나오면 이 네트워크가 막고 있는 것입니다.
  휴대폰 핫스팟에 연결해서 다시 돌려보세요.

  운영 서버(Vercel)는 이 네트워크를 쓰지 않으므로 배포 후에는 정상입니다.
  알림이 실패해도 예약은 그대로 저장됩니다.
`);
    process.exit(1);
  }
  return res.json();
}

title('봇 확인');
const me = await api('getMe');
if (!me.ok) {
  console.log(`  FAIL  토큰이 맞지 않습니다 — ${me.description ?? ''}`);
  console.log('        BotFather 가 준 토큰을 그대로(공백 없이) 넣었는지 확인하세요.');
  process.exit(1);
}
console.log(`  OK    @${me.result.username} (${me.result.first_name})`);

if (!chatId) {
  title('TELEGRAM_CHAT_ID 가 비어 있습니다. 대신 찾아보겠습니다.');
  const updates = await api('getUpdates');
  const chats = new Map();
  for (const u of updates.result ?? []) {
    const chat = u.message?.chat ?? u.channel_post?.chat;
    if (chat) chats.set(chat.id, chat);
  }

  if (chats.size === 0) {
    console.log(`
  아직 대화 기록이 없습니다.

  1. 텔레그램에서 @${me.result.username} 를 찾습니다.
  2. 시작을 누르고 아무 말이나 한 번 보냅니다. ("안녕" 같은 것)
  3. 이 명령을 다시 돌립니다.

  여러 사람이 함께 받으려면, 그룹을 만들어 봇을 넣고
  그 그룹에 아무 말이나 보낸 뒤 다시 돌리세요.
`);
    process.exit(1);
  }

  console.log('  찾았습니다. 아래 ID 를 .env.local 의 TELEGRAM_CHAT_ID= 에 넣으세요.\n');
  for (const chat of chats.values()) {
    const who = chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(' ');
    console.log(`    ${chat.id}   ${who} (${chat.type})`);
  }
  console.log('');
  process.exit(1);
}

title('시험 메시지 보내기');
const sent = await api('sendMessage', {
  chat_id: chatId,
  text: '🥐 소금빵 예약 알림 연결됐습니다.\n새 예약이 들어오면 여기로 알려드립니다.',
});

if (!sent.ok) {
  console.log(`  FAIL  ${sent.description ?? '보내지 못했습니다'}`);
  if (String(sent.error_code) === '400') {
    console.log('        채팅 ID 가 맞는지, 봇과 대화를 한 번 시작했는지 확인하세요.');
  }
  if (String(sent.error_code) === '403') {
    console.log('        봇이 차단되어 있거나 그룹에서 나간 상태입니다.');
  }
  process.exit(1);
}

console.log(`  OK    보냈습니다. 텔레그램을 확인하세요.`);
console.log('\n알림 연결 완료.\n');
