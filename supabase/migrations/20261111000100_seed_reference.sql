-- Reference data exported from the live project (prototype seed: 17 provinces, 50 districts, 5 universities).
-- No user data. All rows are flagged is_prototype_seed = true.
insert into public.provinces (code,name_en,name_ko,official_code,sort_order,is_prototype_seed) values
('seoul','Seoul','서울',NULL,1,true),('busan','Busan','부산',NULL,2,true),('incheon','Incheon','인천',NULL,3,true),
('daegu','Daegu','대구',NULL,4,true),('daejeon','Daejeon','대전',NULL,5,true),('gwangju','Gwangju','광주',NULL,6,true),
('ulsan','Ulsan','울산',NULL,7,true),('sejong','Sejong','세종',NULL,8,true),('gyeonggi','Gyeonggi-do','경기',NULL,9,true),
('gangwon','Gangwon-do','강원',NULL,10,true),('chungbuk','Chungcheongbuk-do','충북',NULL,11,true),('chungnam','Chungcheongnam-do','충남',NULL,12,true),
('jeonbuk','Jeollabuk-do','전북',NULL,13,true),('jeonnam','Jeollanam-do','전남',NULL,14,true),('gyeongbuk','Gyeongsangbuk-do','경북',NULL,15,true),
('gyeongnam','Gyeongsangnam-do','경남',NULL,16,true),('jeju','Jeju','제주',NULL,17,true)
on conflict (code) do nothing;

insert into public.districts (code,province_code,name_en,name_ko,official_code,is_prototype_seed) values
('busan-busanjin-gu','busan','Busanjin-gu',NULL,NULL,true),('busan-geumjeong-gu','busan','Geumjeong-gu',NULL,NULL,true),
('busan-haeundae-gu','busan','Haeundae-gu',NULL,NULL,true),('busan-nam-gu','busan','Nam-gu',NULL,NULL,true),
('chungbuk-cheongju','chungbuk','Cheongju',NULL,NULL,true),('chungbuk-chungju','chungbuk','Chungju',NULL,NULL,true),
('chungnam-asan','chungnam','Asan',NULL,NULL,true),('chungnam-cheonan','chungnam','Cheonan',NULL,NULL,true),
('daegu-buk-gu','daegu','Buk-gu',NULL,NULL,true),('daegu-jung-gu','daegu','Jung-gu',NULL,NULL,true),('daegu-suseong-gu','daegu','Suseong-gu',NULL,NULL,true),
('daejeon-dong-gu','daejeon','Dong-gu',NULL,NULL,true),('daejeon-seo-gu','daejeon','Seo-gu',NULL,NULL,true),('daejeon-yuseong-gu','daejeon','Yuseong-gu',NULL,NULL,true),
('gangwon-chuncheon','gangwon','Chuncheon',NULL,NULL,true),('gangwon-gangneung','gangwon','Gangneung',NULL,NULL,true),('gangwon-wonju','gangwon','Wonju',NULL,NULL,true),
('gwangju-buk-gu','gwangju','Buk-gu',NULL,NULL,true),('gwangju-dong-gu','gwangju','Dong-gu',NULL,NULL,true),('gwangju-gwangsan-gu','gwangju','Gwangsan-gu',NULL,NULL,true),
('gyeongbuk-gumi','gyeongbuk','Gumi',NULL,NULL,true),('gyeongbuk-gyeongsan','gyeongbuk','Gyeongsan',NULL,NULL,true),('gyeongbuk-pohang','gyeongbuk','Pohang',NULL,NULL,true),
('gyeonggi-goyang','gyeonggi','Goyang',NULL,NULL,true),('gyeonggi-seongnam','gyeonggi','Seongnam',NULL,NULL,true),('gyeonggi-suwon','gyeonggi','Suwon',NULL,NULL,true),('gyeonggi-yongin','gyeonggi','Yongin',NULL,NULL,true),
('gyeongnam-changwon','gyeongnam','Changwon',NULL,NULL,true),('gyeongnam-gimhae','gyeongnam','Gimhae',NULL,NULL,true),('gyeongnam-jinju','gyeongnam','Jinju',NULL,NULL,true),
('incheon-michuhol-gu','incheon','Michuhol-gu',NULL,NULL,true),('incheon-namdong-gu','incheon','Namdong-gu',NULL,NULL,true),('incheon-yeonsu-gu','incheon','Yeonsu-gu',NULL,NULL,true),
('jeju-jeju-si','jeju','Jeju-si',NULL,NULL,true),('jeju-seogwipo','jeju','Seogwipo',NULL,NULL,true),
('jeonbuk-iksan','jeonbuk','Iksan',NULL,NULL,true),('jeonbuk-jeonju','jeonbuk','Jeonju',NULL,NULL,true),
('jeonnam-mokpo','jeonnam','Mokpo',NULL,NULL,true),('jeonnam-suncheon','jeonnam','Suncheon',NULL,NULL,true),('jeonnam-yeosu','jeonnam','Yeosu',NULL,NULL,true),
('sejong-sejong-single-unit','sejong','Sejong (single unit)',NULL,NULL,true),
('seoul-gangnam-gu','seoul','Gangnam-gu',NULL,NULL,true),('seoul-gwanak-gu','seoul','Gwanak-gu',NULL,NULL,true),('seoul-jongno-gu','seoul','Jongno-gu',NULL,NULL,true),
('seoul-mapo-gu','seoul','Mapo-gu',NULL,NULL,true),('seoul-seodaemun-gu','seoul','Seodaemun-gu',NULL,NULL,true),('seoul-seongbuk-gu','seoul','Seongbuk-gu',NULL,NULL,true),('seoul-seongdong-gu','seoul','Seongdong-gu',NULL,NULL,true),
('ulsan-buk-gu','ulsan','Buk-gu',NULL,NULL,true),('ulsan-nam-gu','ulsan','Nam-gu',NULL,NULL,true)
on conflict (code) do nothing;

insert into public.universities (id,name_en,name_ko,district_code,is_prototype_seed) values
('358652e2-d0e0-4b6c-b3bc-f419f7167469','Hanyang University',NULL,'seoul-seongdong-gu',true),
('7cc4ab5d-ac4c-47a6-ad52-207bfe7c8f57','Korea University',NULL,'seoul-seongbuk-gu',true),
('ccd7a4c8-6698-447e-b652-f282ca4a66f9','Kyungpook National University',NULL,'daegu-buk-gu',true),
('5966ab9d-7ccb-460e-9c7b-09c94ffc09f5','Pusan National University',NULL,'busan-geumjeong-gu',true),
('b02413f1-ab6a-4365-9c8a-de4c585eb6c2','Yonsei University',NULL,'seoul-seodaemun-gu',true)
on conflict (id) do nothing;
