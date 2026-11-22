// Korean display layer. The page's own language toggle (#lang) sets <html lang>.
// This module watches that attribute and swaps visible text between English and
// Korean without touching form values, ids or any request data. English is kept
// in a WeakMap so switching back restores the exact original.
// NOTE: wording needs review by a native Korean speaker before public launch.

const PLACES = {
  'Seoul':'서울','Busan':'부산','Daegu':'대구','Incheon':'인천','Gwangju':'광주','Daejeon':'대전','Ulsan':'울산','Sejong':'세종',
  'Gyeonggi':'경기','Gyeonggi-do':'경기도','Gangwon':'강원','Gangwon-do':'강원도','Chungcheongbuk-do':'충청북도','Chungcheongnam-do':'충청남도',
  'Jeollabuk-do':'전라북도','Jeollanam-do':'전라남도','Gyeongsangbuk-do':'경상북도','Gyeongsangnam-do':'경상남도','Jeju':'제주','Jeju-do':'제주도',
  'N.Chungcheong':'충북','S.Chungcheong':'충남','N.Jeolla':'전북','S.Jeolla':'전남','N.Gyeongsang':'경북','S.Gyeongsang':'경남',
  'Gangnam-gu':'강남구','Mapo-gu':'마포구','Gwanak-gu':'관악구','Jongno-gu':'종로구','Seodaemun-gu':'서대문구','Seongbuk-gu':'성북구','Seongdong-gu':'성동구',
  'Haeundae-gu':'해운대구','Busanjin-gu':'부산진구','Geumjeong-gu':'금정구','Nam-gu':'남구','Buk-gu':'북구','Jung-gu':'중구','Suseong-gu':'수성구',
  'Dong-gu':'동구','Seo-gu':'서구','Yuseong-gu':'유성구','Gwangsan-gu':'광산구','Michuhol-gu':'미추홀구','Namdong-gu':'남동구','Yeonsu-gu':'연수구',
  'Cheongju':'청주시','Chungju':'충주시','Asan':'아산시','Cheonan':'천안시','Chuncheon':'춘천시','Gangneung':'강릉시','Wonju':'원주시',
  'Goyang':'고양시','Seongnam':'성남시','Suwon':'수원시','Yongin':'용인시','Gumi':'구미시','Gyeongsan':'경산시','Pohang':'포항시',
  'Changwon':'창원시','Gimhae':'김해시','Jinju':'진주시','Jeju-si':'제주시','Seogwipo':'서귀포시','Iksan':'익산시','Jeonju':'전주시',
  'Mokpo':'목포시','Suncheon':'순천시','Yeosu':'여수시','Sejong (single unit)':'세종(단일 단위)',
  'Hanyang University':'한양대학교','Korea University':'고려대학교','Yonsei University':'연세대학교',
  'South Korea':'대한민국','Korea':'한국'
};

const LEVEL = {Low:'낮음',Moderate:'보통',Elevated:'다소 높음',High:'높음','Insufficient data':'데이터 부족'};
const TREND = {Increasing:'증가',Decreasing:'감소',Steady:'유지'};

const X = {
  // header, hero, sections
  'Menu':'메뉴','Map':'지도','Report':'신고','Patterns':'패턴','Log in':'로그인','Log out':'로그아웃','Create account':'계정 만들기','Quick exit':'빠른 나가기',
  'English':'English','Unlocked':'Unlocked','Korea Unlocked':'Korea Unlocked','Home':'홈','Close':'닫기','Back':'뒤로','Continue':'계속','Search':'검색','Ask':'질문하기',
  'Korea has a pattern you cannot see from one story.':'한 사람의 이야기로는 보이지 않는 한국의 패턴이 있습니다.',
  'Report discrimination. Protect your evidence. Understand patterns. Find support.':'차별을 신고하세요. 증거를 보호하세요. 패턴을 이해하세요. 지원을 찾으세요.',
  'Report an experience':'경험 신고하기','Explore Korea map':'한국 지도 살펴보기','What are students reporting?':'학생들은 무엇을 신고하고 있나요?',
  'Your report moves through five protected stages.':'신고는 보호되는 다섯 단계를 거칩니다.',
  'Select a stage to see what happens and what is still waiting on a live service.':'단계를 선택하면 어떤 일이 일어나는지, 아직 실제 서비스가 필요한 부분이 무엇인지 볼 수 있습니다.',
  'Explore the Unlocked Korea':'언락드 코리아 살펴보기','Protect the evidence before anyone sees it.':'누구도 보기 전에 증거를 보호합니다.','Help that exists today.':'지금 받을 수 있는 도움.',
  'Your identity is not the story. The pattern is. No account is needed to report.':'당신의 신원이 이야기의 핵심이 아닙니다. 패턴이 핵심입니다. 신고에 계정은 필요하지 않습니다.',
  'Emergency now? Call':'긴급 상황인가요? 전화하세요:','(police) or':'(경찰) 또는','(fire and ambulance). This site is a prototype and does not replace legal advice or official services.':'(소방·구급). 이 사이트는 프로토타입이며 법률 자문이나 공식 서비스를 대체하지 않습니다.',
  'Emergency:':'긴급 연락:','112 (police) or 119 (fire and ambulance).':'112(경찰) 또는 119(소방·구급).','or':'또는',
  'Korea Unlocked, a free non-commercial student project':'Korea Unlocked, 무료 비영리 학생 프로젝트',
  'AI assistant':'AI 도우미','About':'소개','Access':'접근성','Language':'언어',
  // stages
  'Private by default. Categories: workplace, housing, university, public space, online. Optional contribution to anonymized patterns.':'기본적으로 비공개입니다. 범주: 직장, 주거, 대학, 공공장소, 온라인. 익명화된 패턴에 대한 기여는 선택 사항입니다.',
  'Strip metadata, detect ID/passport/faces, OCR Korean and English, find PII, redact. Raw evidence stays in memory.':'메타데이터를 제거하고, 신분증·여권·얼굴을 탐지하며, 한국어와 영어를 OCR로 읽어 개인정보를 찾아 가립니다. 원본 증거는 메모리에만 있습니다.',
  'AI pre-check, human review, duplicate and abuse detection, cross-report corroboration. Named parties get a right of response.':'AI 사전 점검, 사람의 검토, 중복·악용 탐지, 신고 간 교차 확인. 언급된 당사자에게는 반론의 기회가 주어집니다.',
  'Only aggregates reach the map: province and district, broad category, count and trend. Nothing public below k ≥ 5, and never a single complaint as a marker.':'지도에는 집계 값만 표시됩니다: 시·도와 시·군·구, 큰 범주, 건수와 추세. k ≥ 5 미만은 공개되지 않으며, 개별 신고가 표시로 나타나는 일은 없습니다.',
  'Guidance, connection to support offices, signed evidence packet, private status alerts.':'안내, 지원 기관 연결, 서명된 증거 묶음, 비공개 상태 알림.',
  'Needs: report API + database':'필요: 신고 API + 데이터베이스','Needs: evidence protection service':'필요: 증거 보호 서비스','Needs: verification engine + moderators':'필요: 검증 엔진 + 운영자','Needs: PostGIS aggregation':'필요: PostGIS 집계','Needs: partner offices + notifications':'필요: 협력 기관 + 알림',
  'Protect':'보호','Verify':'검증','Support':'지원',
  // categories
  'All categories':'모든 범주','Racism':'인종차별','Language':'언어','Harassment':'괴롭힘','Online':'온라인','University':'대학','Workplace':'직장','Housing':'주거','Public service':'공공 서비스','Discrimination':'차별','Immigration':'출입국','Other':'기타',
  'Language discrimination':'언어 차별','Online harassment':'온라인 괴롭힘',
  'Racism / Racial discrimination':'인종차별 / 인종 기반 차별','Harassment / Verbal abuse':'괴롭힘 / 언어폭력','Workplace / Part-time job':'직장 / 아르바이트','Housing / Landlord':'주거 / 집주인',
  'University / Classroom':'대학 / 강의실','Public transport / Public space':'대중교통 / 공공장소','Public service / Business':'공공 서비스 / 업체','Immigration / Administrative difficulty':'출입국 / 행정상 어려움','Healthcare / Service access':'의료 / 서비스 이용',
  'Most reported categories':'가장 많이 신고된 범주','Corroborated patterns':'교차 확인된 패턴','Verified/assessed patterns':'확인·평가된 패턴','All eligible patterns':'모든 적격 패턴',
  // map
  'Demo data':'데모 데이터','Demonstration data:':'데모 데이터:','Not real reports.':'실제 신고가 아닙니다.','Insufficient data':'데이터 부족',
  'the numbers shown here are illustrative and are not real reports.':'여기에 표시된 수치는 예시이며 실제 신고가 아닙니다.',
  'figures are illustrative, not real reports.':'수치는 예시이며 실제 신고가 아닙니다.',
  'Choose a category to filter the map. Counts appear only as aggregates.':'범주를 선택해 지도를 필터링하세요. 건수는 집계 값으로만 표시됩니다.',
  'This map shows aggregated reported patterns, not a definitive safety rating.':'이 지도는 집계된 신고 패턴을 보여 줄 뿐, 확정적인 안전 등급이 아닙니다.',
  'Fewer than 5 reports shows as grey.':'신고가 5건 미만이면 회색으로 표시됩니다.',
  'Generated for this prototype; not real reports or statistics. Tiles are a stylised layout, not real boundaries. Real boundary polygons (MapLibre + GeoJSON from PostGIS) are the next step.':'이 프로토타입을 위해 생성된 값이며 실제 신고나 통계가 아닙니다. 타일은 도식적 배치일 뿐 실제 경계가 아닙니다. 실제 경계 폴리곤(PostGIS의 MapLibre + GeoJSON)은 다음 단계입니다.',
  'Hover or focus an area.':'지역 위에 마우스를 올리거나 선택하세요.','Select a province, then a district.':'시·도를 선택한 뒤 시·군·구를 선택하세요.','Select a district':'시·군·구 선택',
  'Seoul, Haeundae-gu, Yonsei University':'서울, 해운대구, 연세대학교','Search province, district or university':'시·도, 시·군·구 또는 대학교 검색','Pattern directory':'패턴 목록',
  'Aggregates only, listed alphabetically and never ranked. Uses the filters above.':'집계 값만 가나다순(알파벳순)으로 표시하며 순위는 매기지 않습니다. 위의 필터를 사용합니다.',
  'Map and directory figures marked Demonstration data are illustrative and are not real reports or statistics.':'‘데모 데이터’로 표시된 지도와 목록의 수치는 예시이며 실제 신고나 통계가 아닙니다.',
  'Last 7 days':'최근 7일','Last 30 days':'최근 30일','Last 3 months':'최근 3개월','Last 6 months':'최근 6개월','Last year':'최근 1년','All time':'전체 기간',
  'eligible reports ·':'적격 신고 ·','corroborated (10+ similar experiences)':'교차 확인됨(유사 경험 10건 이상)',
  'Moderate reported pattern concentration':'신고 패턴 집중도: 보통','Elevated reported pattern concentration':'신고 패턴 집중도: 다소 높음','Low reported pattern concentration':'신고 패턴 집중도: 낮음','High reported pattern concentration':'신고 패턴 집중도: 높음',
  'Low':'낮음','Moderate':'보통','Elevated':'다소 높음','High':'높음','Legend':'범례',
  'Universities in or near the area: none listed in demo data':'지역 내 또는 인근 대학교: 데모 데이터에 없음',
  'See where this pattern appears':'이 패턴이 나타나는 곳 보기',
  'Verified support organisations (university offices, human rights and labor centers, counseling) are not listed yet because their contact details have not been verified.':'검증된 지원 기관(대학 사무국, 인권·노동 센터, 상담)은 연락처가 아직 확인되지 않아 목록에 없습니다.',
  // support
  'Police emergency':'경찰 긴급 신고','Fire and medical emergency':'소방·응급 의료 신고','Immigration contact':'출입국 문의','Korea, emergency':'한국, 긴급','Immigration':'출입국',
  'Not yet added':'아직 추가되지 않음','University support, Human Rights Commission, labor centers, legal and counseling':'대학 지원 기관, 국가인권위원회, 노동 센터, 법률 및 상담','Needs verified contact data':'확인된 연락처 정보 필요',
  'Support: university international office (verified contact needed) · Immigration 1345 · Emergency 112 / 119':'지원: 대학 국제처(확인된 연락처 필요) · 출입국 1345 · 긴급 112 / 119',
  // protection architecture
  'Privacy and security architecture':'개인정보 및 보안 구조','Pseudonymous case IDs':'가명 사례 ID','Design':'설계','k ≥ 5 before anything is public':'공개 전 k ≥ 5 충족',
  'Protection service':'보호 서비스','EXIF · face/ID · OCR · PII':'EXIF · 얼굴/신분증 · OCR · 개인정보','Original':'원본','in memory only':'메모리에만 보관','Redacted':'가림 처리본','only this is stored':'이것만 저장됨',
  'Malware scan on upload':'업로드 시 악성코드 검사','Needs backend':'백엔드 필요','TLS 1.3, AES-256 at rest':'TLS 1.3, 저장 시 AES-256','Needs deployment':'배포 필요',
  'Hash-chained audit trail, least-privilege RBAC':'해시 체인 감사 기록, 최소 권한 역할 기반 접근 제어','Retention and delete-my-data':'보관 기간 및 내 데이터 삭제',
  'Raw evidence is processed in memory only, never stored, and never shown publicly. The design detects passport, ARC/ID, faces, phone numbers, addresses, account numbers, emails and document numbers with YOLO and OCR (Korean + English), then redacts them before a moderator sees the safe version.':'원본 증거는 메모리에서만 처리되며 저장되지 않고 공개되지도 않습니다. 설계상 YOLO와 OCR(한국어 + 영어)로 여권, 외국인등록증/신분증, 얼굴, 전화번호, 주소, 계좌번호, 이메일, 문서 번호를 탐지한 뒤 가려서, 운영자는 안전한 버전만 보게 됩니다.',
  'Only numbers confirmed in your architecture are listed. The assistant routes legal, emergency and immigration questions to official resources; it does not give legal advice.':'구조상 확인된 번호만 표시합니다. 도우미는 법률, 긴급, 출입국 질문을 공식 자료로 안내하며 법률 자문은 제공하지 않습니다.',
  // login / signup
  'Email':'이메일','Password':'비밀번호','Remember me':'로그인 상태 유지','Forgot password':'비밀번호 찾기','Continue with Google':'Google로 계속하기',
  'Enter your email and password.':'이메일과 비밀번호를 입력하세요.','Enter a valid email and a password of at least 8 characters.':'올바른 이메일과 8자 이상의 비밀번호를 입력하세요.','At least 8 characters.':'8자 이상.',
  'Google sign-in is not available yet. Please use email and password.':'Google 로그인은 아직 사용할 수 없습니다. 이메일과 비밀번호를 사용하세요.',
  'Password reset by email is not available yet.':'이메일을 통한 비밀번호 재설정은 아직 사용할 수 없습니다.',
  'Identity':'신원','Profile':'프로필','Privacy':'개인정보','Ready':'준비 완료','Preferred language':'선호 언어','Student status':'학생 신분',
  'Current student':'재학생','Incoming student':'입학 예정','Recent graduate':'최근 졸업생','Not applicable':'해당 없음','University (optional)':'대학교(선택)','District (optional)':'시·군·구(선택)',
  'Create your account. We will email you a link to confirm it before you can log in.':'계정을 만드세요. 로그인하기 전에 확인 링크를 이메일로 보내 드립니다.',
  'Your session has expired. Please log in again.':'세션이 만료되었습니다. 다시 로그인하세요.','Something went wrong. Please try again.':'문제가 발생했습니다. 다시 시도하세요.',
  'Please log in to use the assistant.':'도우미를 사용하려면 로그인하세요.','My reports':'내 신고','Show password':'비밀번호 표시','Hide password':'비밀번호 숨기기',
  'Switch language':'언어 전환','AI support':'AI 지원','Information':'정보','Quick exit: leave this site immediately (or press Escape twice)':'빠른 나가기: 이 사이트를 즉시 떠납니다(또는 Esc 키를 두 번 누르세요)',
  'Aggregated pattern map of South Korea. Demo data.':'대한민국 집계 패턴 지도. 데모 데이터.',
  // report flow
  'Where?':'어디에서?','What happened?':'무슨 일이 있었나요?','Incident category':'사건 범주','Incident':'사건','Evidence':'증거','Review':'검토','Time':'시기','Visibility':'공개 범위','Verification':'확인',
  'When':'언제','When and outcome':'시기와 결과','Province / metropolitan city':'시·도 / 광역시','District / Gu':'시·군·구','Please choose a district.':'시·군·구를 선택하세요.',
  'Please describe what happened (at least 10 characters).':'무슨 일이 있었는지 설명해 주세요(10자 이상).',
  'Leave out names, phone numbers and exact addresses.':'이름, 전화번호, 정확한 주소는 적지 마세요.',
  'Workplace category (optional)':'직장 범주(선택)','Housing category (optional)':'주거 범주(선택)','What kind of treatment?':'어떤 대우였나요?',
  'Employer':'고용주','Part-time job':'아르바이트','Factory':'공장','Restaurant':'식당','Retail':'소매점','Delivery':'배달','Other workplace':'기타 직장',
  'Landlord':'집주인','Dormitory':'기숙사','Shared housing':'공유 주택','Real estate agency':'부동산 중개소','Rental contract':'임대차 계약','Other housing':'기타 주거',
  'Refusal of service':'서비스 거부','Unfair treatment':'부당한 대우','Threat':'위협','Still happening':'현재 진행 중','Was it resolved?':'해결되었나요?','Did you seek help?':'도움을 요청했나요?',
  'In the last 7 days':'최근 7일 이내','In the last 30 days':'최근 30일 이내','In the last 3 months':'최근 3개월 이내','In the last year':'최근 1년 이내','More than one year ago':'1년 이상 전',
  'This is a time range, not an exact date. Only the range is stored.':'정확한 날짜가 아니라 기간입니다. 기간만 저장됩니다.',
  'Yes':'예','No':'아니요','Partly':'부분적으로','None':'없음','Online —':'온라인 —','Police':'경찰','University office':'대학 사무국','Labor or human rights office':'노동·인권 기관',
  'I consent to anonymized pattern analysis (optional)':'익명화된 패턴 분석에 동의합니다(선택)','Contribute to aggregate patterns after review':'검토 후 집계 패턴에 기여',
  'Private: moderators only':'비공개: 운영자만 열람','Check your answers, then submit.':'답변을 확인한 뒤 제출하세요.','Submit report':'신고 제출',
  'Evidence upload is not available yet, so nothing is uploaded, processed or stored. Do not send evidence through the report form.':'증거 업로드는 아직 사용할 수 없으므로 아무것도 업로드, 처리, 저장되지 않습니다. 신고 양식으로 증거를 보내지 마세요.',
  'Optional uploads are not available yet. Nothing is stored.':'선택 업로드는 아직 사용할 수 없습니다. 아무것도 저장되지 않습니다.','Processing service unavailable':'처리 서비스 이용 불가',
  'Report received.':'신고가 접수되었습니다.','Case code':'사례 코드','Case code: ':'사례 코드: ','Tracking secret':'추적 비밀키','Tracking secret (shown once): ':'추적 비밀키(한 번만 표시): ','Save both now. The secret cannot be recovered.':'두 가지를 지금 저장하세요. 비밀키는 복구할 수 없습니다.',
  'Because you are signed in, you do not need a tracking secret. Open My reports from the menu to follow it.':'로그인한 상태이므로 추적 비밀키가 필요 없습니다. 메뉴의 ‘내 신고’에서 진행 상황을 확인하세요.',
  'Anonymous reports get a case code and a tracking secret. Only a one-way hash of the secret is stored, so we cannot show it to you again. Keep it safe.':'익명 신고에는 사례 코드와 추적 비밀키가 발급됩니다. 비밀키는 단방향 해시만 저장되므로 다시 보여 드릴 수 없습니다. 안전하게 보관하세요.',
  'Track a case':'사례 추적','Track an existing case':'기존 사례 추적','Check status':'상태 확인','Tracking shows the status only, never your description.':'추적 화면에는 상태만 표시되며 작성한 설명은 표시되지 않습니다.',
  'No case matches that code and secret.':'해당 코드와 비밀키에 맞는 사례가 없습니다.','Some details are missing or invalid. Please check and try again.':'일부 항목이 누락되었거나 올바르지 않습니다. 확인한 뒤 다시 시도하세요.',
  'Verification failed. Please try again.':'인증에 실패했습니다. 다시 시도하세요.','Too many attempts. Please wait a while and try again.':'시도 횟수가 너무 많습니다. 잠시 후 다시 시도하세요.',
  'Received':'접수됨','Privacy protected':'개인정보 보호됨','Under review':'검토 중','Needs more information':'추가 정보 필요','Corroborated':'교차 확인됨','Included in pattern':'패턴에 포함됨','Not published':'비공개 유지','Support referred':'지원 연계됨',
  'Please do not type names, phone numbers or other personal details. Legal, emergency and immigration questions are best answered by official resources.':'이름, 전화번호 등 개인 정보를 입력하지 마세요. 법률, 긴급, 출입국 질문은 공식 자료에서 답을 얻는 것이 가장 좋습니다.',
  'I experienced something similar':'저도 비슷한 일을 겪었습니다','Demo only, nothing recorded. Live, this raises internal corroboration confidence. It is not a public vote or like.':'데모 전용이며 아무것도 기록되지 않습니다. 실제 운영 시에는 내부 교차 확인의 신뢰도를 높이며, 공개 투표나 좋아요가 아닙니다.',
  // chat
  'Your question':'질문','Type your question first.':'먼저 질문을 입력하세요.','General information only, not legal advice. For signed-in users. The assistant can use live totals from the database and stories that their authors chose to share publicly. It cannot read private reports. Answers may be wrong, so check anything important with an official service.':'일반 정보일 뿐 법률 자문이 아닙니다. 로그인한 사용자용입니다. 도우미는 데이터베이스의 실시간 합계와 작성자가 공개하기로 선택한 이야기를 사용할 수 있습니다. 비공개 신고는 읽을 수 없습니다. 답이 틀릴 수 있으므로 중요한 내용은 공식 서비스에서 확인하세요.',
  'Experimental':'실험적 기능','My landlord will not return my deposit. What can I do?':'집주인이 보증금을 돌려주지 않습니다. 어떻게 해야 하나요?','What counts as discrimination at a part-time job in Korea?':'한국의 아르바이트에서 차별로 인정되는 것은 무엇인가요?',
  // info pages
  'Privacy notice':'개인정보 처리 안내','Terms of use':'이용 약관','FAQ':'자주 묻는 질문','Contact and support':'문의 및 지원','Draft for a student prototype.':'학생 프로토타입용 초안입니다.',
  'Status: draft for a student prototype.':'상태: 학생 프로토타입용 초안.',
  'Status: draft for a student prototype. It has not had legal review and is not a statement of compliance with Korea\'s PIPA or any other law.':'상태: 학생 프로토타입용 초안. 법률 검토를 받지 않았으며 한국 개인정보 보호법(PIPA)이나 다른 법률의 준수를 선언하는 것이 아닙니다.',
  'It has not had legal review and is not a statement of compliance with Korea\'s PIPA or any other law.':'법률 검토를 받지 않았으며 한국 개인정보 보호법(PIPA)이나 다른 법률의 준수를 선언하는 것이 아닙니다.',
  'What we collect':'수집하는 정보','Your choices':'선택할 수 있는 사항','Services we use':'이용하는 서비스','Account data':'계정 정보','Report content':'신고 내용','Technical data':'기술 정보',
  'if you sign up: email address, password (handled by the sign-in service, never visible to us), preferred language and optional student status, university and district.':'가입하는 경우: 이메일 주소, 비밀번호(로그인 서비스가 처리하며 저희는 볼 수 없습니다), 선호 언어, 선택 사항인 학생 신분·대학교·시·군·구.',
  'you type: category, description, area, dates and the options you choose. Do not include names, phone numbers, addresses or ID numbers.':'직접 입력한 범주, 설명, 지역, 날짜 및 선택한 옵션. 이름, 전화번호, 주소, 신분증 번호는 포함하지 마세요.',
  ': to stop abuse we keep a salted one-way hash of your network address for rate limiting. The address itself is not stored.':': 악용을 막기 위해 요청 횟수 제한 용도로 네트워크 주소의 솔트 처리된 단방향 해시를 보관합니다. 주소 자체는 저장하지 않습니다.',
  'You can submit without an account. Deleting your data is not available yet; contact us using the details on the Contact page once they are published.':'계정 없이도 제출할 수 있습니다. 데이터 삭제는 아직 사용할 수 없습니다. 문의처가 공개되면 문의 페이지의 정보를 이용해 연락해 주세요.',
  'The site is built on Supabase (database and sign-in) and Cloudflare Turnstile (bot check on submit). They process data as described in their own policies.':'이 사이트는 Supabase(데이터베이스 및 로그인)와 Cloudflare Turnstile(제출 시 봇 확인)을 기반으로 합니다. 각 서비스는 자체 정책에 따라 데이터를 처리합니다.',
  'Case IDs and k ≥ 5 aggregation are built into the reporting service. Deleting your data is not available yet.':'사례 ID와 k ≥ 5 집계는 신고 서비스에 포함되어 있습니다. 데이터 삭제는 아직 사용할 수 없습니다.',
  'Submit only true accounts of your own experience. Do not post other people\'s personal details, threats or unlawful content.':'본인이 직접 겪은 사실만 제출하세요. 다른 사람의 개인 정보, 협박, 불법 콘텐츠를 게시하지 마세요.',
  'This site is free and non-commercial. It is a capstone project, provided as is, with no guarantee that it is available or error-free.':'이 사이트는 무료이며 비영리입니다. 졸업 프로젝트로 현 상태 그대로 제공되며, 이용 가능성이나 무오류를 보장하지 않습니다.',
  'We may change or remove features at any time while the project is in development.':'프로젝트 개발 중에는 언제든지 기능을 변경하거나 제거할 수 있습니다.',
  'legal advice, not an emergency service and not an official complaint channel. For danger call 112 or 119. Reports here are not automatically sent to the police, your university, an employer or any authority.':'법률 자문, 긴급 서비스, 공식 민원 창구가 아닙니다. 위험할 때는 112 또는 119에 전화하세요. 여기에 접수된 신고는 경찰, 대학, 고용주 또는 어떤 기관에도 자동으로 전달되지 않습니다.',
  'not':'아닙니다','It is':'이 사이트는',
  'A project contact address will be published here before any public launch. Until then, please do not send personal information to unverified addresses.':'공개 출시 전에 프로젝트 연락처가 이곳에 게시됩니다. 그때까지는 확인되지 않은 주소로 개인 정보를 보내지 마세요.',
  'Reports are private by default. In this version no one reviews them yet, and nothing is published.':'신고는 기본적으로 비공개입니다. 이 버전에서는 아직 아무도 검토하지 않으며 아무것도 게시되지 않습니다.',
  'Reports are private by default. Nothing is public. Counts could only ever be shown as district-level totals once there are at least 5 reports.':'신고는 기본적으로 비공개이며 공개되는 것은 없습니다. 신고가 5건 이상 쌓인 뒤에야 시·군·구 단위 합계로만 건수를 표시할 수 있습니다.',
  'Reports get a pseudonymous case ID. Only aggregated, district-level patterns can ever be shown, and only at k ≥ 5. You will be able to delete your data.':'신고에는 가명 사례 ID가 부여됩니다. 집계된 시·군·구 단위 패턴만, 그것도 k ≥ 5일 때만 표시될 수 있습니다. 앞으로 데이터를 삭제할 수 있게 됩니다.',
  'Report status you will see: Received, Privacy protected, Under review, Needs more information, Corroborated, Included in pattern, Not published, Support referred. Passing moderation never means an allegation is proven. Individual reports are called reported experiences; only aggregates form a pattern.':'확인할 수 있는 신고 상태: 접수됨, 개인정보 보호됨, 검토 중, 추가 정보 필요, 교차 확인됨, 패턴에 포함됨, 비공개 유지, 지원 연계됨. 검토를 통과했다고 해서 주장이 사실로 입증된 것은 아닙니다. 개별 신고는 ‘신고된 경험’이라 부르며, 집계만이 패턴을 이룹니다.',
  'Who sees my report?':'누가 내 신고를 보나요?','Do I need an account to report?':'신고하려면 계정이 필요한가요?','No. An anonymous report gives you a case code and a tracking secret.':'아니요. 익명 신고를 하면 사례 코드와 추적 비밀키가 발급됩니다.',
  'Can I upload evidence?':'증거를 업로드할 수 있나요?','Not yet. Please do not put documents or personal details in the description.':'아직은 안 됩니다. 설명란에 문서나 개인 정보를 넣지 마세요.',
  'I lost my tracking secret. Can you recover it?':'추적 비밀키를 잃어버렸습니다. 복구할 수 있나요?','No. Only a hash is stored, so it cannot be shown again. You can submit a new report.':'아니요. 해시만 저장되므로 다시 보여 드릴 수 없습니다. 새로 신고하실 수 있습니다.',
  'Is the map real?':'지도는 실제 데이터인가요?','Not yet. Map and directory numbers are demonstration data until enough real reports exist (at least 5 per area).':'아직은 아닙니다. 충분한 실제 신고(지역당 최소 5건)가 쌓이기 전까지 지도와 목록의 수치는 데모 데이터입니다.',
  'Is there an AI assistant?':'AI 도우미가 있나요?','Not switched on yet. When it is, it will use only public information and will never see report text.':'아직 켜져 있지 않습니다. 켜지면 공개 정보만 사용하며 신고 내용은 절대 보지 않습니다.',
  'Is this legal advice?':'이것은 법률 자문인가요?','No. For legal or immigration questions use official services.':'아니요. 법률 또는 출입국 관련 질문은 공식 서비스를 이용하세요.',
  'This is the design, not a claim of compliance. PIPA and legal review are required before launch.':'이것은 설계이며 법 준수를 주장하는 것이 아닙니다. 출시 전에 개인정보 보호법(PIPA) 및 법률 검토가 필요합니다.',
  'How a report is protected':'신고가 보호되는 방식','Experimental ':'실험적 기능',
  'Ask anything':'무엇이든 물어보세요','Send':'보내기','New chat':'새 대화','Thinking...':'생각하는 중...',
  'Choose how your report may be used. You must pick one. Nothing is pre-selected.':'신고 내용을 어떻게 사용할 수 있는지 선택하세요. 반드시 하나를 골라야 하며, 미리 선택된 항목은 없습니다.',
  'Keep my report private':'내 신고를 비공개로 유지','Only moderators can read it. It is not counted in public numbers.':'운영자만 읽을 수 있습니다. 공개 수치에는 포함되지 않습니다.',
  'Count it in anonymous statistics':'익명 통계에 포함','Only totals by area and category are shown, never your text.':'지역과 범주별 합계만 표시되며 작성한 내용은 절대 표시되지 않습니다.',
  'Share an anonymous version publicly':'익명 버전을 공개적으로 공유','A moderator rewrites it to remove names, places and dates before anything is shown. You will not be named. The AI assistant may show approved stories to other students.':'운영자가 이름, 장소, 날짜를 지우도록 다시 작성한 뒤에만 공개됩니다. 당신의 이름은 표시되지 않습니다. AI 도우미가 승인된 이야기를 다른 학생에게 보여 줄 수 있습니다.',
  'Do not include names, phone numbers or exact addresses in your description. Removing a published story is not automatic yet. Contact the project team once its contact details are published.':'설명에 이름, 전화번호, 정확한 주소를 포함하지 마세요. 공개된 이야기를 삭제하는 기능은 아직 자동화되지 않았습니다. 프로젝트 팀의 연락처가 공개되면 그쪽으로 문의하세요.',
  'Please choose how your report may be used.':'신고 내용을 어떻게 사용할 수 있는지 선택하세요.',
  'Shared story':'공유된 이야기','Read the shared story':'공유된 이야기 읽기','This story is not available.':'이 이야기를 볼 수 없습니다.',
  'This anonymous story was shared by its author and reviewed by a moderator. It is not proof of any allegation. For help, see the Support section.':'이 익명 이야기는 작성자가 공유했으며 운영자가 검토했습니다. 어떤 주장의 증거도 아닙니다. 도움이 필요하면 지원 섹션을 확인하세요.',
  'Reports are private unless you choose otherwise when you submit. You pick one of three options: keep it private, count it in anonymous statistics (totals only, shown only for groups of at least 5), or share an anonymous version publicly. A public version appears only after a moderator removes names, places and dates.':'신고는 제출할 때 다르게 선택하지 않는 한 비공개입니다. 세 가지 중 하나를 고릅니다: 비공개로 유지, 익명 통계에 포함(합계만, 5건 이상인 그룹에만 표시), 또는 익명 버전을 공개적으로 공유. 공개 버전은 운영자가 이름, 장소, 날짜를 지운 뒤에만 표시됩니다.',
  'The AI assistant sends your question and the last few messages of the chat to Anthropic\'s Claude API to get an answer. Nothing from the chat is stored on this site. Do not type personal details. These services process data as described in their own policies.':'AI 도우미는 답변을 받기 위해 질문과 최근 몇 개의 대화 메시지를 Anthropic의 Claude API로 보냅니다. 대화 내용은 이 사이트에 저장되지 않습니다. 개인 정보를 입력하지 마세요. 이 서비스들은 각자의 정책에 따라 데이터를 처리합니다.',
  'Reports are private by default and only moderators can read them. If you choose to share an anonymous version publicly, a moderator rewrites it before anything is shown, and the AI assistant may show it to other students.':'신고는 기본적으로 비공개이며 운영자만 읽을 수 있습니다. 익명 버전을 공개적으로 공유하기로 하면, 운영자가 다시 작성한 뒤에만 표시되며 AI 도우미가 다른 학생에게 보여 줄 수 있습니다.',
  'Yes, for signed-in users. It can use live totals and stories that their authors chose to share publicly. It cannot read private reports.':'네, 로그인한 사용자에게 제공됩니다. 실시간 합계와 작성자가 공개하기로 선택한 이야기를 사용할 수 있으며, 비공개 신고는 읽을 수 없습니다.',
  'The site is built on Supabase (database and sign-in) and Cloudflare Turnstile (bot check on submit). The AI assistant sends your question and the last few messages of the chat to Anthropic\'s Claude API to get an answer. Nothing from the chat is stored on this site. Do not type personal details. These services process data as described in their own policies.':'이 사이트는 Supabase(데이터베이스 및 로그인)와 Cloudflare Turnstile(제출 시 봇 확인)을 기반으로 합니다. AI 도우미는 답변을 받기 위해 질문과 최근 몇 개의 대화 메시지를 Anthropic의 Claude API로 보냅니다. 대화 내용은 이 사이트에 저장되지 않습니다. 개인 정보를 입력하지 마세요. 이 서비스들은 각자의 정책에 따라 데이터를 처리합니다.',
  'Public version':'공개 버전','This is the only text that can be shown publicly. Your private description stays private. Before publishing we check it for phone numbers, people\'s names and business details. Places and locations may stay.':'공개적으로 표시될 수 있는 것은 이 글뿐입니다. 비공개 설명은 계속 비공개로 유지됩니다. 게시하기 전에 전화번호, 사람 이름, 업체 정보가 있는지 확인합니다. 장소와 위치는 그대로 둘 수 있습니다.',
  'Do not include names, phone numbers or exact addresses in your description. You can withdraw a public story at any time from Track an existing case.':'설명에 이름, 전화번호, 정확한 주소를 포함하지 마세요. 공개한 이야기는 언제든 ‘기존 사례 추적’에서 철회할 수 있습니다.',
  'Please write the public version (at least 10 characters).':'공개 버전을 작성하세요(10자 이상).','Checking the public version...':'공개 버전을 확인하는 중...',
  'The automatic check is not available right now. If you continue, your public version will be held for review and not shown until it is checked.':'자동 확인을 지금은 사용할 수 없습니다. 계속하면 공개 버전은 검토 대기 상태가 되며, 확인되기 전에는 표시되지 않습니다.','Continue anyway':'그래도 계속',
  'We found details that should not be public:':'공개하면 안 되는 정보가 발견되었습니다:','Suggested clean version:':'수정된 버전 제안:','Use the clean version':'수정된 버전 사용','Updated. Press Continue to check it again.':'업데이트되었습니다. 계속을 눌러 다시 확인하세요.',
  'The check could not be done. Please try again.':'확인을 완료할 수 없었습니다. 다시 시도하세요.',
  'Your public version passed the automatic check and is now published.':'공개 버전이 자동 확인을 통과하여 게시되었습니다.','Your public version is held for review and is not public yet.':'공개 버전이 검토 대기 중이며 아직 공개되지 않았습니다.',
  'Withdraw my public story':'내 공개 이야기 철회','Withdraw my public story (if any)':'내 공개 이야기 철회(있는 경우)','Your public story was withdrawn. It is no longer shown.':'공개 이야기가 철회되었습니다. 더 이상 표시되지 않습니다.',
  'Could not withdraw the story. Please try again.':'이야기를 철회하지 못했습니다. 다시 시도하세요.','No public story to withdraw for this report.':'이 신고에는 철회할 공개 이야기가 없습니다.',
  'Removed a phone number':'전화번호를 삭제했습니다','Removed an email address':'이메일 주소를 삭제했습니다','Removed an ID number':'신분증 번호를 삭제했습니다','Removed a passport-style number':'여권 번호 형식의 숫자를 삭제했습니다','Removed a long number (account or ID)':'긴 숫자(계좌 또는 신분증)를 삭제했습니다',
  'Public stories':'공개 이야기','Anonymous, unverified stories shared by their authors. They are not proof of any allegation and this is not an official complaint channel.':'작성자가 공유한 익명의 미확인 이야기입니다. 어떤 주장의 증거도 아니며 공식 민원 창구가 아닙니다.',
  'Share anonymously':'익명으로 공유','Automatic check removes names, phone numbers and business details':'자동 확인으로 이름, 전화번호, 업체 정보를 삭제','Published, and the author can withdraw it any time':'게시되며 작성자는 언제든 철회할 수 있음',
  'Published stories':'게시된 이야기','All provinces':'모든 시·도','Load more':'더 보기','No public stories yet.':'아직 공개된 이야기가 없습니다.','Stories could not be loaded right now. Please try again later.':'지금은 이야기를 불러올 수 없습니다. 나중에 다시 시도하세요.',
  'Category':'범주','Province':'시·도',
  'Support intelligence':'지원 정보','Loading...':'불러오는 중...','Account created':'계정이 만들어졌습니다','Account':'계정','Check your email':'이메일을 확인하세요','Go to log in':'로그인으로 이동',
  'Overview':'개요','Your reports':'내 신고 목록','Korean':'한국어','Signed in.':'로그인되었습니다.','You are signed in.':'로그인되어 있습니다.',
  'Email or password is incorrect.':'이메일 또는 비밀번호가 올바르지 않습니다.','Please confirm your email first. Check your inbox.':'먼저 이메일을 인증하세요. 받은편지함을 확인하세요.',
  'Please log in to see your reports.':'신고 내역을 보려면 로그인하세요.','Too many attempts. Please wait a while.':'시도 횟수가 너무 많습니다. 잠시 기다려 주세요.',
  'That password is too weak. Try a longer, less common one.':'비밀번호가 너무 약합니다. 더 길고 흔하지 않은 비밀번호를 사용하세요.','We could not create the account. Please try again.':'계정을 만들 수 없었습니다. 다시 시도하세요.',
  'Integration required: Supabase is not configured.':'연동 필요: Supabase가 설정되지 않았습니다.','The status timeline could not be loaded.':'상태 이력을 불러올 수 없습니다.',
  'Your reports could not be loaded right now. Please try again later.':'지금은 신고 목록을 불러올 수 없습니다. 나중에 다시 시도하세요.',
  'You have no reports linked to this account yet. Reports made while signed in appear here.':'이 계정에 연결된 신고가 아직 없습니다. 로그인한 상태에서 제출한 신고가 여기에 표시됩니다.',
  'Report details you wrote stay private. Deleting your data and changing your email are not available yet.':'작성한 신고 내용은 비공개로 유지됩니다. 데이터 삭제와 이메일 변경은 아직 사용할 수 없습니다.',
  'Your account is ready once you confirm it. Then log in.':'인증을 마치면 계정을 사용할 수 있습니다. 그런 다음 로그인하세요.',
  'Could not start Google sign-in. Please try again or use email and password.':'Google 로그인을 시작할 수 없습니다. 다시 시도하거나 이메일과 비밀번호를 사용하세요.',
  'Project team':'프로젝트 팀','Korea Unlocked is a free capstone project built by three students.':'Korea Unlocked는 세 명의 학생이 만든 무료 캡스톤 프로젝트입니다.',
  ' — Team Leader':' — 팀장',
  "Public reports cannot contain names or phone numbers. Before a public version is shared, an automatic check looks for people's names, phone numbers and business details. If it finds any, you see what was found and a cleaned version, and you cannot continue until the text is clean. The check runs again on our server, so a public version that still contains them is held for review and not shown. Places and locations may stay.":"공개 신고에는 이름이나 전화번호를 넣을 수 없습니다. 공개 버전이 공유되기 전에 자동 검사가 사람 이름, 전화번호, 업체 정보가 있는지 확인합니다. 발견되면 어떤 내용이 문제인지와 정리된 버전을 보여 주며, 글이 깨끗해질 때까지 다음 단계로 넘어갈 수 없습니다. 이 검사는 서버에서 다시 실행되므로, 그런 정보가 남아 있는 공개 버전은 검토를 위해 보류되고 표시되지 않습니다. 장소와 위치는 남아 있을 수 있습니다.",
  'Latest report':'최근 신고','Total reports':'전체 신고','Top cities':'신고 많은 도시','3 days ago':'3일 전',
  'reports in 17 cities and provinces':'17개 시·도의 신고',
  "Live":"실시간",
  "reports.":"신고",
  "Every entry is an unverified, anonymous story shared by its author.":"모든 글은 작성자가 직접 공유한 익명의 미확인 이야기입니다.",
  "View all public stories →":"공개 이야기 모두 보기 →",
  "No stories match these filters.":"이 조건에 맞는 이야기가 없습니다.",
  "The landlord stopped replying after learning I was an international student. The room was listed as available again the next day.":"집주인은 제가 유학생이라는 것을 알고 나서 답장을 멈췄습니다. 그 방은 다음 날 다시 입주 가능으로 올라왔습니다.",
  "My manager gave me the least popular shifts and joked about my accent in front of customers.":"매니저는 제게 가장 인기 없는 근무 시간을 배정했고, 손님들 앞에서 제 억양을 두고 농담을 했습니다.",
  "A shop refused to serve me and said it only accepts Korean customers.":"한 가게가 저에게 서비스를 거부하며 한국인 손님만 받는다고 말했습니다.",
  'Cards':'카드','Table':'표','Month':'월','Story':'이야기','Confirmations':'확인 수',
  'Division ledger':'시·도별 현황','Average per division':'시·도 평균','Total reports divided by the number of divisions.':'전체 신고 수를 시·도 수로 나눈 값입니다.',
  "How it works.":"이용 방법.",
  "Three steps.":"세 단계.",
  "Anonymous":"익명",
  "Checked":"검사",
  "Public":"공개",
  "Share your experience":"경험을 공유하세요",
  "Choose a category, an area and what happened. You can report without an account. Do not include names or phone numbers.":"범주와 지역, 일어난 일을 선택하세요. 계정 없이도 신고할 수 있습니다. 이름이나 전화번호는 넣지 마세요.",
  "Safety check before publishing":"공개 전 안전 검사",
  "A public version is checked automatically for people's names, phone numbers and business details. If anything is found, it is held for review and not shown.":"공개 버전은 사람 이름, 전화번호, 업체 정보가 있는지 자동으로 검사됩니다. 발견되면 검토를 위해 보류되고 표시되지 않습니다.",
  "Patterns stay searchable":"패턴은 검색할 수 있습니다",
  "Only stories whose authors choose to share become public. They can be filtered by category and province, and the map shows counts only for areas with at least 5 reports.":"작성자가 공유하기로 선택한 이야기만 공개됩니다. 범주와 시·도로 걸러 볼 수 있고, 지도에는 신고가 5건 이상인 지역의 수치만 표시됩니다.",
  "FAQ / Safety notes":"자주 묻는 질문 / 안전 안내",
  "Questions.":"질문.",
  "Clear answers before you put anything on the public record.":"공개 기록에 무언가를 남기기 전에 확인할 수 있는 분명한 답변입니다.",
  "Is my report really anonymous?":"내 신고는 정말 익명인가요?",
  "Yes. You can report without an account or contact details, and you get a case code and a tracking secret instead. Public versions never include your name. Only a hash of your tracking secret is stored, and network addresses are used only in scrambled form to limit abuse.":"네. 계정이나 연락처 없이 신고할 수 있으며, 대신 사건 코드와 추적 비밀번호를 받습니다. 공개 버전에는 이름이 들어가지 않습니다. 추적 비밀번호는 해시만 저장되고, 네트워크 주소는 악용을 막기 위해 암호화된 형태로만 사용됩니다.",
  "Can I name the person who treated me unfairly?":"부당하게 대한 사람의 이름을 적어도 되나요?",
  "No. Public versions cannot contain names or phone numbers. An automatic check looks for people's names, phone numbers and business details before anything is shown. Describe what happened and where in general terms. Places may stay.":"아니요. 공개 버전에는 이름이나 전화번호를 넣을 수 없습니다. 무엇이든 공개되기 전에 자동 검사가 사람 이름, 전화번호, 업체 정보를 확인합니다. 일어난 일과 장소를 일반적인 표현으로 설명해 주세요. 장소는 남을 수 있습니다.",
  "Is this an official complaint?":"이것은 공식 민원인가요?",
  "No. Korea Unlocked is a free student project, not an official complaint channel, and a story here is not proof of any allegation. For emergencies call 112 or 119, and for immigration questions call 1345.":"아니요. Korea Unlocked는 무료 학생 프로젝트이며 공식 민원 창구가 아니고, 여기에 올라온 이야기는 어떤 주장의 증거도 아닙니다. 긴급 상황에는 112 또는 119, 출입국 문의는 1345로 연락하세요.",
  "Can I take my story down?":"내 이야기를 내릴 수 있나요?",
  "Yes. If you shared a public story, open Track an existing case with your case code and tracking secret, or My reports if you have an account, and use the withdraw button. It stops being shown. Deleting all your data is not available yet.":"네. 공개 이야기를 공유했다면 사건 코드와 추적 비밀번호로 '기존 사건 추적'을 열거나, 계정이 있다면 '내 신고'에서 철회 버튼을 누르세요. 그러면 더 이상 표시되지 않습니다. 모든 데이터를 삭제하는 기능은 아직 제공되지 않습니다.",
  "Optional. Add up to 4 photos or audio recordings, up to 10 MB each. Files are stored privately and only moderators can see them.":"선택 사항입니다. 사진이나 음성 녹음을 최대 4개까지, 각각 10MB 이하로 추가할 수 있습니다. 파일은 비공개로 저장되며 운영자만 볼 수 있습니다.",
  "Only add recordings of conversations you took part in. Avoid photos that show other people's faces, ID cards or phone numbers. Hidden data such as location is removed from photos on your device before they are uploaded.":"직접 참여한 대화의 녹음만 추가하세요. 다른 사람의 얼굴, 신분증, 전화번호가 보이는 사진은 피하세요. 사진의 위치 같은 숨은 정보는 업로드 전에 기기에서 제거됩니다.",
  "If I share a public version, a moderator may show these files with it. They are checked first and may be hidden or rejected.":"공개 버전을 공유하면 운영자가 이 파일을 함께 보여 줄 수 있습니다. 파일은 먼저 검토되며 숨겨지거나 거부될 수 있습니다.",
  "You can add up to 4 files.":"파일은 최대 4개까지 추가할 수 있습니다.",
  "This file is larger than 10 MB: ":"이 파일은 10MB보다 큽니다: ",
  "This file type is not supported: ":"지원하지 않는 파일 형식입니다: ",
  "Remove":"삭제",
  "Uploading your files...":"파일을 업로드하는 중...",
  "Your report was received, but the files could not be uploaded.":"신고는 접수되었지만 파일을 업로드하지 못했습니다.",
  "Evidence files":"증거 파일",
  " (optional photos and audio you attach), stored privately so that only moderators can open them. Photos are re-saved on your device before upload, which removes hidden data such as location. Audio files may contain hidden data that we do not remove.":" (첨부하는 사진과 음성, 선택 사항)은 비공개로 저장되어 운영자만 열 수 있습니다. 사진은 업로드 전에 기기에서 다시 저장되어 위치 같은 숨은 정보가 제거됩니다. 음성 파일에는 제거하지 않는 숨은 정보가 있을 수 있습니다.",
  "A public version is checked automatically for people's names, phone numbers and business details before it appears; places may stay.":"공개 버전은 표시되기 전에 사람 이름, 전화번호, 업체 정보가 있는지 자동으로 검사되며, 장소는 남을 수 있습니다.",
  "Files are never public by default. If you share a public version and tick the box, a moderator may show your files with it after checking them. We cannot automatically check photos or audio for faces, names or voices, so keep them free of other people's details. If you withdraw a public story, its files stop being shown.":"파일은 기본적으로 공개되지 않습니다. 공개 버전을 공유하면서 체크박스를 선택하면, 운영자가 검토한 뒤 파일을 함께 보여 줄 수 있습니다. 사진이나 음성에서 얼굴, 이름, 목소리는 자동으로 검사할 수 없으니 다른 사람의 정보가 담기지 않게 해 주세요. 공개 이야기를 철회하면 파일도 더 이상 표시되지 않습니다.",
  "Yes. You can attach up to 4 photos or audio recordings (10 MB each) when you report. Files are private and only moderators can open them. If you share a public version, you can let a moderator show the files with it. Do not include other people's personal details.":"네. 신고할 때 사진이나 음성 녹음을 최대 4개(각 10MB)까지 첨부할 수 있습니다. 파일은 비공개이며 운영자만 열 수 있습니다. 공개 버전을 공유하면 운영자가 파일을 함께 보여 주도록 허용할 수 있습니다. 다른 사람의 개인정보는 넣지 마세요.",
  "It is checked automatically for names, phone numbers and business details before it is shown. You will not be named. The AI assistant may show published stories to other students.":"표시되기 전에 이름, 전화번호, 업체 정보가 있는지 자동으로 검사됩니다. 작성자의 이름은 공개되지 않습니다. AI 도우미가 게시된 이야기를 다른 학생에게 보여 줄 수 있습니다.",
  "This anonymous story was shared by its author and checked automatically. It is not proof of any allegation. For help, see the Support section.":"이 익명 이야기는 작성자가 공유했고 자동 검사를 거쳤습니다. 어떤 주장의 증거도 아닙니다. 도움이 필요하면 지원 섹션을 보세요.",
  "Behind the tiles are the Taegukgi (South Korea's flag, drawn as an illustration) and the country's coastline (Natural Earth, public domain). Move your mouse or finger over the map to tilt it.":"타일 뒤에는 태극기(일러스트로 그린 것)와 대한민국의 해안선(Natural Earth, 퍼블릭 도메인)이 있습니다. 마우스나 손가락을 지도 위에서 움직이면 지도가 기울어집니다.",
  // ghush-style redesign
  "▲ Confirm this report":"▲ 이 신고 확인하기",
  "✓ Confirmed":"✓ 확인함",
  "Could not confirm. Try again.":"확인하지 못했습니다. 다시 시도해 주세요.",
  "Latest":"최신순",
  "Most confirmed":"확인 많은 순",
  "Sort":"정렬",
  "Anonymous, unverified stories shared by their authors. They are not proof of any allegation and this is not an official complaint channel. If a story matches something you have experienced or know to be true, you can confirm it. Confirmations come from other readers and are not verification.":"작성자가 공유한 익명의 미확인 이야기입니다. 어떤 주장의 증거가 아니며, 공식 신고 창구도 아닙니다. 본인이 겪었거나 사실이라고 아는 내용이라면 확인할 수 있습니다. 확인은 다른 독자들이 남기는 것이며 검증이 아닙니다.",
  'Ask the AI assistant':'AI 도우미에게 물어보기',
  "Anonymous reporting":"익명 신고",
  "No account needed":"계정 불필요",
  "Private unless you choose to share":"공유를 선택하지 않으면 비공개",
  "Public pattern ledger":"공개 패턴 기록부",
  "Aggregates only":"집계 데이터만",
  "Free student project":"무료 학생 프로젝트",
  "Someone treated you":"누군가 당신을",
  "differently.":"다르게 대했습니다.",
  "You remember":"모든 것을",
  "every detail.":"기억하고 있습니다.",
  "Now put it":"이제",
  "on the record.":"기록으로 남기세요.",
  "Report an experience →":"경험 신고하기 →",
  "Public stories":"공개 이야기",
  "Anonymous":"익명",
  "No real name needed":"실명 불필요",
  "File a report without an account and track it with a case code.":"계정 없이 신고하고 사건 코드로 진행 상황을 확인하세요.",
  "Private by default":"기본은 비공개",
  "You choose what is shared":"공유할 내용은 직접 선택합니다",
  "Only stories whose authors pick public are ever published.":"작성자가 공개를 선택한 이야기만 게시됩니다.",
  "Checked first":"먼저 검사",
  "Names and phone numbers removed":"이름과 전화번호는 삭제됩니다",
  "An automatic check runs before any story goes public.":"공개되기 전에 자동 검사가 실행됩니다.",
  "Patterns are hard to ignore.":"패턴은 외면하기 어렵습니다.",
  "One story is a complaint. Many records expose a system.":"하나의 이야기는 하나의 호소일 뿐입니다. 많은 기록이 구조를 드러냅니다.",
  "How it works →":"작동 방식 →",
  "What are students":"유학생들은 무엇을",
  "reporting?":"신고하고 있나요?",
  "Your report moves through":"신고는",
  "five protected stages.":"다섯 단계의 보호 과정을 거칩니다.",
  "Explore":"함께 살펴보는",
  "the pattern":"패턴",
  "Protect the evidence":"증거를 보호하세요,",
  "before anyone sees it.":"누구도 보기 전에.",
  "Help":"지금 이용 가능한",
  "that exists today.":"도움.",
  "Pattern":"패턴",
  "directory":"디렉터리",
  "Privacy and":"개인정보 보호 및",
  "security architecture":"보안 구조",
  "Take part":"참여하기",
  "Seen or lived something unfair?":"부당한 일을 겪거나 목격하셨나요?",
  "Add it to the record.":"기록에 남겨 주세요.",
  "One story can be dismissed.":"하나의 이야기는 묻힐 수 있습니다.",
  "Many together cannot.":"함께 모이면 묻히지 않습니다.",
  "No account needed. No real name.":"계정도, 실명도 필요하지 않습니다."
};

const HANGUL = /[ㄱ-ㆎ가-힣]/;
const nodeOrig = new WeakMap();   // text node -> {en, ko}
const attrOrig = new WeakMap();   // element -> {attr: {en, ko}}
const SKIP = new Set(['SCRIPT','STYLE','TEXTAREA','NOSCRIPT']);

const place = s => PLACES[s] ?? null;

function translate(raw){
  const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
  const s = raw.trim().replace(/\s+/g,' ');
  if(!s || HANGUL.test(s) || !/[A-Za-z]/.test(s)) return null;
  const core = tr1(s);
  return core == null ? null : lead + core + trail;
}

function tr1(s){
  if(X[s] != null) return X[s];
  if(PLACES[s] != null) return PLACES[s];
  let m;
  if((m = s.match(/^(\d+) eligible · (\d+) corroborated · (Increasing|Decreasing|Steady)$/))) return `적격 ${m[1]}건 · 교차 확인 ${m[2]}건 · ${TREND[m[3]]}`;
  if((m = s.match(/^Trend, last 6 months: (Increasing|Decreasing|Steady)$/))) return `최근 6개월 추세: ${TREND[m[1]]}`;
  if((m = s.match(/^Trend (Increasing|Decreasing|Steady)$/))) return `추세: ${TREND[m[1]]}`;
  if((m = s.match(/^Universities in or near the area: (.+)$/))) return '지역 내 또는 인근 대학교: ' + m[1].split(', ').map(u => PLACES[u] ?? u).join(', ');
  if((m = s.match(/^(\S+) (\S+): (Low|Moderate|Elevated|High) reported pattern concentration$/)) && place(m[1]) && place(m[2])) return `${place(m[1])} ${place(m[2])}: 신고 패턴 집중도 ${LEVEL[m[3]]}`;
  if((m = s.match(/^(.+) — (\d+%)$/)) && (X[m[1]] || PLACES[m[1]])) return `${X[m[1]] || PLACES[m[1]]} — ${m[2]}`;
  if((m = s.match(/^(.+?) (—|›) (.+)$/)) && (PLACES[m[1]] || X[m[1]])){
    const b = PLACES[m[3]] ?? X[m[3]] ?? m[3];
    return `${PLACES[m[1]] ?? X[m[1]]} ${m[2]} ${b}`;
  }
  // aria-labels on map tiles: "Seoul: Low concentration. Select to see districts."
  if((m = s.match(/^(.+?): (Low|Moderate|Elevated|High) concentration\. Select to see districts\.$/)) && place(m[1])) return `${place(m[1])}: 집중도 ${LEVEL[m[2]]}. 선택하면 시·군·구를 볼 수 있습니다.`;
  if((m = s.match(/^(\S+) (\S+): (Low|Moderate|Elevated|High) concentration$/)) && place(m[1]) && place(m[2])) return `${place(m[1])} ${place(m[2])}: 집중도 ${LEVEL[m[3]]}`;
  if((m = s.match(/^Public story: (.+)$/))) return '공개 이야기: ' + ({Approved:'게시됨',Pending:'검토 대기',Withdrawn:'철회됨',Rejected:'거부됨'}[m[1]] ?? m[1]);
  if((m = s.match(/^Signed in as (.+)$/))) return `${m[1]} 계정으로 로그인됨`;
  if((m = s.match(/^If this address can be registered, we sent a confirmation link to (.+?)\.?$/))) return `이 주소로 가입할 수 있는 경우, ${m[1]} 로 확인 링크를 보냈습니다.`;
  if((m = s.match(/^(Low|Moderate|Elevated|High)$/))) return LEVEL[m[1]];
  return null;
}

function doText(n){
  const rec = nodeOrig.get(n);
  if(rec && n.data === rec.ko) return;          // already translated
  const ko = translate(n.data);
  if(ko == null || ko === n.data) return;
  nodeOrig.set(n, {en: n.data, ko});
  n.data = ko;
}
const ATTRS = ['aria-label','placeholder','title','alt'];
function doAttrs(el){
  for(const a of ATTRS){
    const v = el.getAttribute(a); if(!v) continue;
    let rec = attrOrig.get(el); if(rec?.[a] && v === rec[a].ko) continue;
    const ko = translate(v); if(ko == null) continue;
    if(!rec){ rec = {}; attrOrig.set(el, rec); }
    rec[a] = {en: v, ko}; el.setAttribute(a, ko);
  }
}
function walk(root){
  if(root.nodeType === 3){ doText(root); return; }
  if(root.nodeType !== 1) return;
  doAttrs(root);
  if(SKIP.has(root.tagName)) return;
  for(const c of root.childNodes) walk(c);
}
function restore(root){
  if(root.nodeType === 3){ const r = nodeOrig.get(root); if(r && root.data === r.ko) root.data = r.en; nodeOrig.delete(root); return; }
  if(root.nodeType !== 1) return;
  const ar = attrOrig.get(root);
  if(ar){ for(const a in ar) if(root.getAttribute(a) === ar[a].ko) root.setAttribute(a, ar[a].en); attrOrig.delete(root); }
  for(const c of root.childNodes) restore(c);
}

const isKo = () => document.documentElement.lang === 'ko';
let busy = false;
const apply = () => { if(busy) return; busy = true; try{ isKo() ? walk(document.body) : restore(document.body); } finally{ busy = false; } };

// language switch: the page toggles <html lang>
new MutationObserver(() => apply()).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
// dynamic content (overlays, forms, map panels) while Korean is on
const mo = new MutationObserver(muts => {
  if(busy || !isKo()) return;
  busy = true;
  try{
    for(const m of muts){
      if(m.type === 'characterData') doText(m.target);
      else if(m.type === 'attributes') doAttrs(m.target);
      else m.addedNodes.forEach(walk);
    }
  } finally{ busy = false; }
});
mo.observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:ATTRS});
apply();
