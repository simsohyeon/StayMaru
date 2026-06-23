/* eslint-disable react-refresh/only-export-components -- 라우트 매니페스트 파일: router(비컴포넌트)를 export 하며 Fast Refresh 대상이 아님 */
import { createBrowserRouter } from 'react-router-dom'
import { lazy } from 'react'
import AppShell from '@/components/AppShell'
import RouteError from '@/components/RouteError'
import Home from '@/pages/Home'

// 첫 화면(Home)과 셸은 즉시 로드해 초기 페인트를 빠르게 유지하고,
// 나머지 라우트는 코드 스플리팅으로 분리해 초기 번들 크기를 줄인다.
// 청크 로드 중에는 AppShell 의 <Suspense> 가 폴백을, 실패는 RouteError 가 처리한다.
const CourseResult = lazy(() => import('@/pages/CourseResult'))
const CourseMap = lazy(() => import('@/pages/CourseMap'))
const CourseEdit = lazy(() => import('@/pages/CourseEdit'))
const CourseShared = lazy(() => import('@/pages/CourseShared'))
const CourseJoin = lazy(() => import('@/pages/CourseJoin'))
const PlaceDetail = lazy(() => import('@/pages/PlaceDetail'))
const Explore = lazy(() => import('@/pages/Explore'))
const Festivals = lazy(() => import('@/pages/Festivals'))
const FestivalDetail = lazy(() => import('@/pages/FestivalDetail'))
const Favorites = lazy(() => import('@/pages/Favorites'))
const Journal = lazy(() => import('@/pages/Journal'))
const Insights = lazy(() => import('@/pages/Insights'))
const Settings = lazy(() => import('@/pages/Settings'))
const Admin = lazy(() => import('@/pages/Admin'))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Home /> },
      { path: 'course', element: <CourseResult /> },
      { path: 'course/map', element: <CourseMap /> },
      { path: 'course/edit', element: <CourseEdit /> },
      { path: 'course/shared/:payload', element: <CourseShared /> },
      { path: 'join/:code', element: <CourseJoin /> },
      { path: 'place/:id', element: <PlaceDetail /> },
      { path: 'explore', element: <Explore /> },
      // 축제 목록 — 캘린더/지도/리스트 토글 지원. cat=festival 리다이렉트 폐기.
      { path: 'festivals', element: <Festivals /> },
      { path: 'festivals/:id', element: <FestivalDetail /> },
      { path: 'favorites', element: <Favorites /> },
      { path: 'journal', element: <Journal /> },
      { path: 'insights', element: <Insights /> },
      { path: 'settings', element: <Settings /> },
      // /admin 운영 통계 — 개발 빌드에서만 라우트 등록(프로덕션 URL 직접 진입 차단).
      ...(import.meta.env.DEV ? [{ path: 'admin', element: <Admin /> }] : []),
    ],
  },
])
