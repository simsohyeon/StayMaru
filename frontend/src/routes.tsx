import { createBrowserRouter } from 'react-router-dom'
import AppShell from '@/components/AppShell'
import Home from '@/pages/Home'
import CourseResult from '@/pages/CourseResult'
import CourseMap from '@/pages/CourseMap'
import PlaceDetail from '@/pages/PlaceDetail'
import Favorites from '@/pages/Favorites'
import Settings from '@/pages/Settings'
import Explore from '@/pages/Explore'
import Festivals from '@/pages/Festivals'
import FestivalDetail from '@/pages/FestivalDetail'
import Journal from '@/pages/Journal'
import CourseEdit from '@/pages/CourseEdit'
import CourseShared from '@/pages/CourseShared'
import Admin from '@/pages/Admin'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'course', element: <CourseResult /> },
      { path: 'course/map', element: <CourseMap /> },
      { path: 'course/edit', element: <CourseEdit /> },
      { path: 'course/shared/:payload', element: <CourseShared /> },
      { path: 'place/:id', element: <PlaceDetail /> },
      { path: 'explore', element: <Explore /> },
      // 축제 목록 — 캘린더/지도/리스트 토글 지원. cat=festival 리다이렉트 폐기.
      { path: 'festivals', element: <Festivals /> },
      { path: 'festivals/:id', element: <FestivalDetail /> },
      { path: 'favorites', element: <Favorites /> },
      { path: 'journal', element: <Journal /> },
      { path: 'settings', element: <Settings /> },
      { path: 'admin', element: <Admin /> },
    ],
  },
])
