import { createBrowserRouter, Navigate } from 'react-router-dom'
import AppShell from '@/components/AppShell'
import Home from '@/pages/Home'
import CourseResult from '@/pages/CourseResult'
import CourseMap from '@/pages/CourseMap'
import PlaceDetail from '@/pages/PlaceDetail'
import Favorites from '@/pages/Favorites'
import Settings from '@/pages/Settings'
import Explore from '@/pages/Explore'
import FestivalDetail from '@/pages/FestivalDetail'
import CourseEdit from '@/pages/CourseEdit'
import CourseShared from '@/pages/CourseShared'
import Admin from '@/pages/Admin'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      // /regions 는 /explore 로 통합됨. 이전 링크 호환을 위해 redirect.
      { path: 'regions', element: <Navigate to="/explore" replace /> },
      { path: 'course', element: <CourseResult /> },
      { path: 'course/map', element: <CourseMap /> },
      { path: 'course/edit', element: <CourseEdit /> },
      { path: 'course/shared/:payload', element: <CourseShared /> },
      { path: 'place/:id', element: <PlaceDetail /> },
      { path: 'explore', element: <Explore /> },
      // 축제 목록 탭은 /explore 의 'festival' 카테고리로 통합. 이전 링크는 그쪽으로 리다이렉트.
      { path: 'festivals', element: <Navigate to="/explore?cat=festival" replace /> },
      { path: 'festivals/:id', element: <FestivalDetail /> },
      { path: 'favorites', element: <Favorites /> },
      { path: 'settings', element: <Settings /> },
      { path: 'admin', element: <Admin /> },
    ],
  },
])
