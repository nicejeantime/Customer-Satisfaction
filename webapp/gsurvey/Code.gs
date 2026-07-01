/**
 * 운영서비스 만족도 조사 - 커스텀 웹페이지(Apps Script Web App) + 구글 시트 응답 수집
 *
 * 배포 방법:
 * 1) script.google.com → 새 프로젝트
 * 2) 이 파일 내용을 "Code.gs"에 붙여넣기
 * 3) 파일 추가 → HTML → 이름을 정확히 "Index"로 지정 → Index.html 내용 붙여넣기
 * 4) 배포 > 새 배포 > 유형: 웹 앱
 *      - 실행 계정: 나
 *      - 액세스 권한: 링크가 있는 모든 사용자
 * 5) 배포 후 생성되는 웹앱 URL을 확인 (예: https://script.google.com/macros/s/XXXX/exec)
 * 6) 고객사별로 아래처럼 쿼리 파라미터를 붙여 전달
 *      {웹앱URL}?client=한국%20암웨이&type=chatbot
 *      type 값: chatbot / web / crm / app (모르면 생략 가능, 응답자가 직접 선택)
 * 7) 응답은 최초 제출 시 자동 생성되는 구글 시트에 실시간으로 쌓임 (실행 로그 또는
 *    스크립트 속성에서 시트 링크 확인 가능 — getSheetUrl 함수 실행)
 */

const SERVICE_LABELS = {
  chatbot: '커넥트톡',
  web: '웹서비스운영',
  crm: 'CRM솔루션',
  app: '모바일앱',
};

const MODULES_DATA = {
  chatbot: [
    { name: '1차 대응 시간', detail: '접수~최초 응답 소요 시간 (목표 2H 이내)' },
    { name: '자체 처리 시간', detail: '운영팀 내부 종결 건 소요 시간 (목표 1일 이내)' },
    { name: '답변 딜리버리', detail: '2차(개발) 답변 수령 후 고객 안내 속도 (목표 1일 이내)' },
    { name: '총 처리 시간', detail: '접수~최종 답변 완료까지 전체 소요 시간' },
    { name: '컨테인먼트율 (자동 해결율)', detail: '사람 개입 없이 챗봇이 자체 해결한 비율 (목표 65~80% 이상)' },
    { name: '유관부서 협업 만족도', detail: '이슈 해결을 위한 소통 태도 및 적극성' },
    { name: '상담/응대 품질 (QA)', detail: '톤앤매너, 매뉴얼 준수, 답변 정확도' },
    { name: '챗봇 지식 성장 기여도', detail: '시나리오 업데이트, 학습 효과' },
    { name: '추이 관리', detail: '미탐/오탐 개선 활동' },
    { name: '정기 리포트 완성도', detail: '월간 성능 리포트의 적시성과 정확성' },
  ],
  web: [
    { name: '장애 대응 시간', detail: '인시던트 접수~최초 대응 (목표 30분~1H 이내)' },
    { name: '버그 픽스 처리 시간', detail: '접수~수정 배포 완료' },
    { name: '요청사항 반영 소요시간', detail: '기능/개선 요청 반영 속도' },
    { name: '배포/릴리즈 처리', detail: '배포 요청~실서비스 반영 속도' },
    { name: '페이지 응답속도 유지', detail: '목표 응답속도 기준 준수 여부' },
    { name: '유관부서 협업 만족도', detail: '기획/디자인/QA 협업 태도' },
    { name: '배포 안정성 (QA)', detail: '롤백/핫픽스 발생률, 테스트 커버리지 준수' },
    { name: '가용률(Uptime) 유지', detail: '목표 가용률(예: 99.9%) 달성 여부' },
    { name: '성능/UX 개선 기여도', detail: '로딩속도, 전환율 등 개선 활동과 효과' },
    { name: '정기 리포트 완성도', detail: '월간 운영 리포트의 적시성과 정확성' },
  ],
  crm: [
    { name: '문의 응답 시간', detail: '접수~최초 응답 (목표 4H 이내)' },
    { name: '설정/커스터마이징 처리시간', detail: '요청 접수~반영 완료' },
    { name: '데이터 동기화/배치 처리시간', detail: '배치 작업 시작~완료 및 검증' },
    { name: '총 처리 시간', detail: '접수~최종 완료' },
    { name: '유관부서 협업 만족도', detail: '영업/마케팅/IT 협업 태도' },
    { name: '데이터 정합성 테스트 (QA)', detail: '중복/누락/오류 데이터 발생률' },
    { name: '데이터 정합성/정확도 유지율', detail: '정기 점검 기준 데이터 품질 유지 수준' },
    { name: '사용자 교육·온보딩 지원 기여도', detail: '신규 사용자 온보딩, 매뉴얼/교육 지원 활동' },
    { name: '정기 리포트 완성도', detail: '월간 활용 현황 리포트의 적시성과 정확성' },
  ],
  app: [
    { name: '이슈 대응 시간', detail: '크래시/버그 접수~최초 대응' },
    { name: '버그 픽스 처리시간', detail: '접수~수정 배포 완료' },
    { name: '릴리즈 처리 시간', detail: '릴리즈 요청~스토어 배포 완료' },
    { name: 'OS 신버전 대응 소요시간', detail: 'OS 정식 출시~앱 호환성 확보 (목표 2주 이내)' },
    { name: '유관부서 협업 만족도', detail: '기획/디자인/QA 협업 태도' },
    { name: '크래시율/버그 밀도 (QA)', detail: '릴리즈 전 테스트 커버리지, 크래시율' },
    { name: '앱스토어 평점/리뷰 개선 기여도', detail: '평점 추이, 부정 리뷰 대응 활동' },
    { name: '신규기능 반영 기여도', detail: '로드맵 대비 기능 반영 속도 및 완성도' },
    { name: '정기 리포트 완성도', detail: '월간 앱 성능/사용자 지표 리포트의 적시성과 정확성' },
  ],
};

function doGet(e) {
  const tmpl = HtmlService.createTemplateFromFile('Index');
  tmpl.clientName = (e && e.parameter && e.parameter.client) || '';
  tmpl.presetType = (e && e.parameter && e.parameter.type) || '';
  tmpl.modulesJson = JSON.stringify(MODULES_DATA);
  tmpl.labelsJson = JSON.stringify(SERVICE_LABELS);
  return tmpl.evaluate()
    .setTitle('2026년 운영서비스 만족도 조사')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getHalfYearLabel(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const isFirstHalf = d.getMonth() < 6; // 0~5월 = 1~6월
  const half = isFirstHalf ? '상반기' : '하반기';
  const start = isFirstHalf ? (y + '-01-01') : (y + '-07-01');
  const end = isFirstHalf ? (y + '-06-30') : (y + '-12-31');
  return y + '년 ' + half + ' (' + start + '~' + end + ')';
}

function getColumnDefs() {
  const defs = [
    { header: '제출시각', kind: 'timestamp' },
    { header: '고객사명', kind: 'client' },
    { header: '평가기간', kind: 'period' },
    { header: '서비스형태', kind: 'serviceLabel' },
  ];
  Object.keys(MODULES_DATA).forEach(function (key) {
    MODULES_DATA[key].forEach(function (it) {
      defs.push({ header: '[' + SERVICE_LABELS[key] + '] ' + it.name, kind: 'score', serviceKey: key, itemName: it.name });
    });
    defs.push({ header: '[' + SERVICE_LABELS[key] + '] 추가 의견', kind: 'comment', serviceKey: key });
  });
  defs.push({ header: '강점(Keep)', kind: 'strengths' });
  defs.push({ header: '개선점(Improve)', kind: 'improvements' });
  defs.push({ header: '재계약/추천 의향', kind: 'relationship' });
  return defs;
}

function getOrCreateSheet() {
  const props = PropertiesService.getScriptProperties();
  let sheetId = props.getProperty('SHEET_ID');
  let ss;
  if (sheetId) {
    ss = SpreadsheetApp.openById(sheetId);
  } else {
    ss = SpreadsheetApp.create('2026 운영서비스 만족도 조사_응답');
    props.setProperty('SHEET_ID', ss.getId());
  }
  const sheet = ss.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    const headers = getColumnDefs().map(function (d) { return d.header; });
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// 응답 시트 링크가 필요할 때 이 함수를 직접 실행해서 로그로 확인
function getSheetUrl() {
  const sheet = getOrCreateSheet();
  Logger.log(sheet.getParent().getUrl());
}

function submitResponse(payload) {
  if (!payload || !payload.clientName || !payload.serviceType) {
    throw new Error('필수 정보(고객사명, 서비스 형태)가 누락되었습니다.');
  }
  const sheet = getOrCreateSheet();
  const defs = getColumnDefs();
  const row = defs.map(function (d) {
    switch (d.kind) {
      case 'timestamp': return new Date();
      case 'client': return payload.clientName || '';
      case 'period': return getHalfYearLabel(new Date());
      case 'serviceLabel': return SERVICE_LABELS[payload.serviceType] || payload.serviceType;
      case 'score':
        if (d.serviceKey === payload.serviceType && payload.scores) {
          return payload.scores[d.itemName] !== undefined ? payload.scores[d.itemName] : '';
        }
        return '';
      case 'comment':
        return d.serviceKey === payload.serviceType ? (payload.sectionComment || '') : '';
      case 'strengths': return payload.strengths || '';
      case 'improvements': return payload.improvements || '';
      case 'relationship': return payload.relationship || '';
      default: return '';
    }
  });
  sheet.appendRow(row);
  return { ok: true };
}
