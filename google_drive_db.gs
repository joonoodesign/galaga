/**
 * 🚀 전준우의 갤러그 (CAPTAIN JUNWOO GALAGA)
 * 내 구글 드라이브(Google Drive) 실시간 랭킹 & 업적 DB 연동 스크립트
 *
 * [사용 방법]
 * 1. https://script.google.com 접속 -> [새 프로젝트] 클릭
 * 2. 아래 코드를 붙여넣고 저장(Ctrl+S)
 * 3. 우측 상단 [배포] -> [새 배포] -> 유형: [웹 앱]
 *    - 다음 사용자 인증 정보로 실행: 나(본인 계정)
 *    - 액세스 권한이 있는 사용자: 모든 사용자
 * 4. 배포 후 생성된 웹 앱 URL을 게임 상단 [클라우드 동기화] 모달에 붙여넣으면 연결 완료!
 */

const DB_FILE_NAME = 'junwoo_galaga_db.json';

function getOrCreateDbFile() {
  const files = DriveApp.getFilesByName(DB_FILE_NAME);
  if (files.hasNext()) {
    return files.next();
  }
  const initialData = {
    updatedAt: 0,
    highScore: 20000,
    leaderboard: []
  };
  return DriveApp.createFile(DB_FILE_NAME, JSON.stringify(initialData, null, 2), MimeType.PLAIN_TEXT);
}

function doGet(e) {
  try {
    const content = getOrCreateDbFile().getBlob().getDataAsString('UTF-8') || '{"updatedAt":0}';
    return ContentService.createTextOutput(content).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const rawBody = e.postData && e.postData.contents ? e.postData.contents : '{}';
    JSON.parse(rawBody);
    getOrCreateDbFile().setContent(rawBody);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, savedAt: Date.now() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
