import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** 화면 이동 시 맨 위로 스크롤 (원본의 window.scrollTo(0, 0)) */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
