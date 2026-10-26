# -*- coding: utf-8 -*-
"""쉼(休)마루 공모전 제출 PPT — 텍스트 전면 보강 + OpenAPI 목록 슬라이드 추가."""
import copy
from pptx import Presentation
from pptx.oxml.ns import qn

SRC = 'deck.pptx'
OUT = 'deck_v8.pptx'

prs = Presentation(SRC)


# ── 셀 텍스트 교체 — 첫 run 의 서식을 그대로 복제해 유지한다 ────────────────
def set_cell(cell, lines):
    if isinstance(lines, str):
        lines = [lines]
    txBody = cell.text_frame._txBody
    paras = txBody.findall(qn('a:p'))
    tmpl_p = tmpl_r = None
    for p in paras:
        rs = p.findall(qn('a:r'))
        if rs:
            tmpl_p, tmpl_r = p, rs[0]
            break
    if tmpl_r is None:                      # 서식 템플릿이 없으면 평문으로
        cell.text_frame.text = '\n'.join(lines)
        return
    for p in paras:
        txBody.remove(p)
    for line in lines:
        np = copy.deepcopy(tmpl_p)
        for child in list(np):
            if child.tag in (qn('a:r'), qn('a:br'), qn('a:fld')):
                np.remove(child)
        nr = copy.deepcopy(tmpl_r)
        nr.find(qn('a:t')).text = line
        end = np.find(qn('a:endParaRPr'))
        (np.insert(list(np).index(end), nr) if end is not None else np.append(nr))
        txBody.append(np)


def tables(idx):
    return [sh.table for sh in prs.slides[idx].shapes if sh.has_table]


# ══ 슬라이드 2 — 서비스 개요 ═══════════════════════════════════════════════
t = tables(1)[0]
set_cell(t.cell(1, 1), '웹 서비스 — 설치 없이 쓰는 모바일 우선 PWA · 한·영·일·중 4개 언어 지원')
set_cell(t.cell(2, 1),
         '경상북도 22개 시군의 전통문화 여행지를 한 곳에서 찾고, 지역·기간·취향·동반만 고르면 '
         '이동 동선·날씨·축제까지 반영한 일차별 여행 코스를 자동으로 완성해 주는 여행 서비스')
set_cell(t.cell(3, 1), [
    '① 정보가 흩어져 있습니다 — 한옥 숙소·전통체험·문화재·전통시장·축제 정보가 서로 다른 사이트에 나뉘어 있어, 여행자가 직접 모아 코스를 짜야 합니다.',
    '② 여행이 한쪽으로 쏠립니다 — 경북 관광은 경주·안동에 집중되고, 전통문화 자원이 풍부한 봉화·청송·영양 등 내륙 시군은 상대적으로 덜 찾습니다.',
    '③ 쉼마루는 한국관광공사 OpenAPI로 흩어진 정보를 하나로 통합하고, 시군별 방문자 통계를 근거로 덜 알려진 지역에 추천 가중치를 부여해 '
    '‘정보 탐색’과 ‘지역 쏠림’을 동시에 해결합니다.',
])

# ══ 슬라이드 3 — 핵심기능 ═════════════════════════════════════════════════
set_cell(tables(2)[0].cell(0, 1), [
    '1. 전통문화 통합 탐색 — 한옥·서원·사찰·전통체험·전통시장·축제 등 경북 22개 시군 관광정보를 카테고리·키워드·거리순으로 한 화면에서 검색',
    '2. 상세 정보·예약 원스톱 연결 — 소개·운영시간·연락처·홈페이지(예약 링크)·사진을 한 화면에 모아 예약·문의까지 바로 연결',
    '3. 맞춤형 코스 자동 생성 — 지역·기간·취향·동반만 고르면 이동 동선과 날씨를 반영한 일차별 일정을 자동 구성',
    '4. 코스 편집·지도·공유 — 보기/수정 모드 분리, 일차별 지도 확인, 순서 변경·장소 추가·삭제 후 동선 재최적화, 찜·카카오톡 공유·코스 키 공동 편집',
    '5. 숨은 경북 발견 — 시군별 방문자 통계로 계산한 한적지수로 봉화·청송·영양 등 덜 알려진 지역을 우선 추천하고, ‘지금 경북’ 화면에서 시군별 방문 통계 제공',
    '6. 축제 캘린더 — 진행·예정 중인 경북 축제를 한눈에 확인하고, 여행 날짜에 열리는 축제만 코스에 자동 연계',
    '7. 모두를 위한 접근성 — 무장애·반려동물 동반 조건을 코스에 반영, 한·영·일·중 4개 언어, 앱 설치 없이 모바일 웹으로 바로 이용',
])

# ══ 슬라이드 4 — 이미지 자리 안내 ═════════════════════════════════════════
t = tables(3)[0]
set_cell(t.cell(0, 1), [
    '[대표 이미지 1개 삽입]',
    '쉼마루 로고 — 정사각(1:1), 배경 여백 포함 PNG',
])
set_cell(t.cell(1, 1), [
    '[주요 화면 이미지 3개 삽입]',
    '① 홈 — 검색바에서 조건 선택   ② 코스 결과 — 지도 + 일차별 일정',
    '③ 지금 경북 — 한적한 시군 카드',
])

# ══ 슬라이드 5 — 지역특화 ═════════════════════════════════════════════════
t = tables(4)[0]
set_cell(t.cell(0, 1), '경상북도 (22개 시군 전역)')
set_cell(t.cell(1, 1), [
    '경북 전통문화 통합 탐색 — 22개 시군을 시군구 코드 단위로 조회해 한옥·서원·사찰·전통체험·전통시장·축제 등 전통문화 자원만 선별해 제공',
    '숨은 지역 우선 추천 — 시군별 방문자 통계로 ‘한적지수’를 계산해, 방문이 적은 내륙 시군(봉화·청송·영양 등)의 자원에 추천 가중치 부여',
    '경북형 동선 설계 — 시군 간 이동거리가 긴 경북의 지리 특성을 반영해 한 생활권으로 장소를 묶고, 이동거리가 최소가 되도록 일정을 재배치',
    '지역 축제 연계 — 여행 날짜에 실제로 열리는 경북 축제만 골라 주변 관광지와 함께 코스에 편성',
    '경북 문화 코드 검색 — 서원·고택·탈춤·가야·신라 등 지역 고유 키워드로 전통문화 자원을 바로 탐색',
])

# ══ 슬라이드 6~10 — 핵심 기능 상세 ════════════════════════════════════════
FEATURES = [
    (5, '경북 전통문화 통합 탐색',
     '한옥·템플스테이·전통체험·문화재·전통시장·축제를 카테고리와 경북 특화 키워드(서원·고택·탈춤·가야·신라)로 '
     '한 화면에서 찾고, 지도·목록·거리순으로 확인하는 기능입니다.',
     ['1. 카테고리를 고르고 지역(시군)·정렬로 범위를 좁힌다.',
      '2. 경북 특화 키워드로 검색하거나 ‘무장애’만 본다.',
      '3. 목록과 지도에서 결과를 확인한다.']),
    (6, '상세 정보 · 예약 링크 원스톱 연결',
     '관광공사 API의 소개·운영정보·연락처·홈페이지를 한 화면에 모아 예약·문의 채널까지 바로 연결하고, '
     '‘함께 찾은 곳’ 연관 추천으로 다음 장소를 이어 주는 기능입니다.',
     ['1. 탐색 결과에서 장소를 고르면 대표 이미지·소개·운영정보가 열린다.',
      '2. 연락처·홈페이지·예약 링크와 연관 추천을 본다.',
      '3. 예약·문의로 바로 이동하거나 찜한다.']),
    (7, '여행 코스 자동 구성',
     '홈 검색바에서 지역·기간·취향·동반만 고르면 장소를 점수화해 고르고, 이동거리가 최소가 되도록 일차별 일정을 짜는 기능입니다. '
     '한 생활권으로 동선을 묶어 장거리 이동을 막고, 비 예보일은 실내 위주로 구성하며, 찜한 장소와 여행 기간의 축제를 함께 반영합니다.',
     ['1. 홈 검색바에서 지역·기간·취향·동반(무장애·반려동물)을 고른다.',
      '2. ‘검색하기’를 누르면 지도와 일차별 일정이 자동 생성된다.',
      '3. ‘수정’에서 순서·장소를 바꾸면 동선이 재최적화된다.']),
    (8, '지도 동선 · 찜 · 공유',
     '코스를 지도 위 방문 순서와 구간 거리로 보여 주고, 일차 칩으로 그날 동선만 따로 볼 수 있습니다. '
     '찜·카카오톡 공유와 코스 키(QR·링크) 기반 실시간 공동 편집으로 친구·가족과 함께 계획합니다.',
     ['1. 일차 칩으로 그날 방문 순서와 구간 거리를 확인한다.',
      '2. 코스를 찜하거나 카카오톡으로 공유한다.',
      '3. 코스 키(QR·링크)로 친구와 함께 편집한다.']),
    (9, '숨은 경북 · 데이터 인사이트',
     '관광 데이터랩의 시군별 방문자 통계로 한적지수를 계산해 방문이 적은 내륙 시군의 전통문화 자원을 우선 추천하고, '
     '시군별 방문 통계와 이번 주말 한적한 시군을 ‘지금 경북’ 화면으로 보여 주는 기능입니다.',
     ['1. 검색바 취향에서 ‘한적한 코스’를 고르면 한적지수가 높은 시군이 우선 추천된다.',
      '2. ‘지금 경북’에서 이번 주말 한적한 시군을 확인한다.',
      '3. 그 시군으로 바로 코스를 만든다.']),
]
FLOW_SHIFT = 446674      # 기능 설명이 3줄로 늘어도 흠름도 표와 겹치지 않도록 아래로 이동
CAPTURE_TRIM = 456208    # 이동한 만큼 캡처 행 높이를 줄여 슬라이드 밖으로 나가지 않게 한다


def drop_last_column(table):
    """흠름도 4칸 → 3칸. 마지막 열을 지우고 그 폭을 남은 열에 균등 분배한다.

    캡처 장수를 줄이려고 열을 줄였다 — 양식의 ‘기능 흠름도’ 영역과
    머리글 병합 셀(r0)은 그대로 두고 칸 개수만 바꾼다.
    """
    tbl = table._tbl
    grid = tbl.find(qn('a:tblGrid'))
    cols = grid.findall(qn('a:gridCol'))
    dead = int(cols[-1].get('w'))
    grid.remove(cols[-1])
    share = dead // (len(cols) - 1)
    for c in cols[:-1]:
        c.set('w', str(int(c.get('w')) + share))
    for tr in tbl.findall(qn('a:tr')):
        tcs = tr.findall(qn('a:tc'))
        tr.remove(tcs[-1])


for idx, title, desc, steps in FEATURES:
    flow, info = tables(idx)[0], tables(idx)[1]
    flow_shape = [sh for sh in prs.slides[idx].shapes if sh.has_table][0]
    flow_shape.top += FLOW_SHIFT
    flow.rows[1].height -= CAPTURE_TRIM
    drop_last_column(flow)
    set_cell(info.cell(0, 1), title)
    set_cell(info.cell(1, 1), desc)
    for c, step in enumerate(steps):
        set_cell(flow.cell(2, c), step)
    for c in range(3):
        set_cell(flow.cell(1, c), f'[화면 {c + 1} 캡처]')

# ══ 슬라이드 11 — 한국관광공사 OpenAPI (1/2) ══════════════════════════════
API_1 = [
    ('한국관광공사 국문 관광정보 서비스 (KorService2)',
     '경북(areaCode=35) 22개 시군구 코드로 관광지·숙박·체험·문화시설을 수집하고(지역기반·위치기반), 서원·고택·탈춤 등 경북 특화 키워드로 검색하며(키워드 검색), 상세 화면의 소개·운영시간·연락처·홈페이지·이미지를 제공(공통·소개·이미지)'),
    ('한국관광공사 영문·일문·중문 관광정보 서비스 (EngService2 · JpnService2 · ChsService2)',
     '언어 설정(English·日本語·中文)에 따라 같은 화면이 해당 언어 API 로 자동 전환되어 외국인 관광객에게 현지어 정보를 제공'),
    ('한국관광공사 무장애 여행정보 서비스 (KorWithService2)',
     '휠체어·유모차 등 접근성 정보를 조회해 탐색의 ‘무장애’ 필터와 동반 조건 선택 시 접근성이 확인된 장소를 우선 추천'),
]
API_2 = [
    ('한국관광공사 반려동물 동반여행 서비스 (KorPetTourService2)',
     '반려동물 동반 가능 여부·동반 조건을 조회해 동반 선택 시 입장 가능한 장소 위주로 코스를 구성'),
    ('한국관광공사 관광지 연관 추천 정보 서비스 (TarRlteTarService1 · 관광 빅데이터)',
     '실제 방문자의 동반 방문 패턴으로 장소 상세 화면에 ‘함께 찾은 곳’을 추천하고 코스 후보를 확장'),
    ('한국관광공사 한국관광 데이터랩 (DataLabService · 관광 빅데이터)',
     '경북 시군별 방문자 통계로 ‘한적지수’를 계산해 방문이 적은 시군에 추천 가중치를 부여하고, ‘지금 경북’ 화면의 시군별 랭킹과 이번 주말 한적 시군을 구성'),
    ('한국관광공사 관광공모전 사진 수상작 서비스 (PhokoAwrdService)',
     '법정동 시도 코드로 경상북도 수상 사진을 선별해 홈·테마 화면의 대표 이미지로 사용 (공공누리 제1유형, 출처 표기)'),
]


def fill_api_table(table, entries, start_no):
    for i, (name, detail) in enumerate(entries):
        set_cell(table.cell(i * 2, 0), str(start_no + i))
        set_cell(table.cell(i * 2, 2), name)
        set_cell(table.cell(i * 2 + 1, 2), detail)



# ── OpenAPI 목록 2/2 슬라이드를 11번 뒤에 새로 만든다 ──────────────────────
src = prs.slides[10]
new = prs.slides.add_slide(src.slide_layout)
for shp in list(new.shapes):                       # 레이아웃 자동 플레이스홀더 제거
    shp._element.getparent().remove(shp._element)
for shp in src.shapes:                             # 제목 텍스트박스 + 표 복제
    new.shapes._spTree.append(copy.deepcopy(shp._element))

sldIdLst = prs.slides._sldIdLst
moved = list(sldIdLst)[-1]
sldIdLst.remove(moved)
sldIdLst.insert(11, moved)

new_tbl = [sh.table for sh in new.shapes if sh.has_table][0]
api1_tbl = tables(10)[0]
for _ in range(4):                                 # 5개 → 3개 항목(행 4개 제거)
    _rows = api1_tbl._tbl.findall(qn('a:tr'))
    api1_tbl._tbl.remove(_rows[-1])
fill_api_table(api1_tbl, API_1, 1)
for _ in range(2):                                 # 5개 → 4개 항목(행 2개 제거)
    _rows2 = new_tbl._tbl.findall(qn('a:tr'))
    new_tbl._tbl.remove(_rows2[-1])
fill_api_table(new_tbl, API_2, 4)
for sh in new.shapes:
    if sh.has_text_frame and sh.text_frame.text.strip():
        sh.width = int(sh.width * 1.3)
        p = sh.text_frame.paragraphs[0]
        if p.runs:
            p.runs[0].text = '서비스 개발에 활용한 한국관광공사 OpenAPI 리스트 (2/2)'
            for r in p.runs[1:]:
                r.text = ''
for sh in prs.slides[10].shapes:
    if sh.has_text_frame and sh.text_frame.text.strip():
        sh.width = int(sh.width * 1.3)
        p = sh.text_frame.paragraphs[0]
        if p.runs:
            p.runs[0].text = '서비스 개발에 활용한 한국관광공사 OpenAPI 리스트 (1/2)'
            for r in p.runs[1:]:
                r.text = ''

# ══ 슬라이드 13(기타 API) — 항목 1개 추가 ═════════════════════════════════
etc_tbl = tables(12)[0]
tbl_el = etc_tbl._tbl
rows = tbl_el.findall(qn('a:tr'))
for src_row in (rows[-2], rows[-1]):               # 마지막 항목 2행을 복제해 4번 항목 생성
    tbl_el.append(copy.deepcopy(src_row))
ETC = [
    ('행정안전부 전국문화축제 표준데이터 (공공데이터포털 OpenAPI)',
     '경북 축제의 일정·장소·주최 정보를 받아 축제 캘린더를 구성하고, 여행 기간과 겹치는 축제만 코스에 연계하며, ‘지금 경북’ 에서 이번 주말 시군별 축제 여부를 표시'),
    ('기상청 단기예보 조회서비스 (공공데이터포털 OpenAPI)',
     '여행 날짜의 강수확률(POP)을 조회해 비 예보일에는 실내 장소를, 맑은 날에는 실외 장소를 우선 배치하고, ‘지금 경북’ 의 주말 날씨를 함께 제공 (예보 범위를 벗어나면 평년 강수 경향으로 대체)'),
    ('카카오맵 JavaScript SDK · 카카오톡 공유 SDK',
     '코스의 방문 순서와 이동 동선을 지도에 표시하고(일차별 보기 포함), 완성한 코스를 카카오톡으로 공유'),
    ('한국불교문화사업단 템플스테이 포털 (templestay.com)',
     '경북 템플스테이 운영 사찰 목록을 연계해 전통 숙박 카테고리와 템플스테이 테마 코스를 보강 (OpenAPI 미제공 화면이라 서버 프록시로 목록만 파싱)'),
]
fill_api_table(etc_tbl, ETC, 1)

# ══ 마지막 슬라이드 — 차별성 · 발전계획 ═══════════════════════════════════
last = tables(len(prs.slides._sldIdLst) - 1)[0]
set_cell(last.cell(0, 1), [
    '• 통합 플랫폼 — 숙박·체험·관광·전통시장·축제를 한 곳에서 탐색하고 예약 링크까지 연결',
    '• 완성형 코스 — 이동거리를 최소화한 일차별 일정을 자동 구성(비 오는 날 실내 / 맑은 날 실외), 보기·수정 모드 분리',
    '• 경북 특화 — 시군구 코드·경북 문화 키워드로 전통문화 자원만 선별, 방문이 적은 내륙 시군을 우선 노출해 관광 쏠림 완화',
    '• 함께 계획 — 로그인 없이 코스 키(QR·링크) 하나로 친구·가족과 실시간 공동 편집, 카카오톡 공유',
    '• 포용·다국어 — 무장애·반려동물 동반 조건 반영, 한·영·일·중 4개 언어, 설치 없는 PWA',
    '• 제안서 대비 추가 구현 — 날씨 기반 실내/실외 코스, 코스 편집·동선 재최적화, 로그인 없는 실시간 협업, 축제 캘린더, 데이터 인사이트·한적지수, 무장애·반려동물 코스',
])
set_cell(last.cell(1, 1), [
    '• 단기 — 경북 전통문화 여행의 표준 플랫폼: 안동·경주·영주 거점의 완성도를 높이고, 쌓인 코스·찜 데이터로 봉화·청송·고령 등 소외 거점으로 확대',
    '• 중기 — 외국인 인바운드 창구: 4개 언어를 바탕으로 경북문화관광공사·시군 문화관광과와 협력해 콘텐츠 신뢰도와 범위를 확장',
    '• 장기 — 경북 전통문화 생태계 활성화: 한옥 숙소·전통체험 업체·향토 음식점과 여행자를 연결하고, 코스·찜 데이터를 지역 관광 정책의 실증 자료로 제공',
])

prs.save(OUT)
print('saved', OUT, '| slides:', len(prs.slides._sldIdLst))
