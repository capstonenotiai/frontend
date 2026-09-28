import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getToday, parseMonthKey, shiftMonth, toMonthKey } from '../utils/date';

/**
 * 캘린더 화면의 현재 월을 URL(?month=2026-05)로 관리.
 * 새로고침/공유해도 같은 달이 보이고, 탑바의 '오늘' 버튼은 ?month 를 지워 오늘 달로 돌아간다.
 */
export function useCalendarMonth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const monthParam = searchParams.get('month');

  const current = useMemo(() => {
    const parsed = parseMonthKey(monthParam);
    if (parsed) return parsed;
    const today = getToday();
    return { year: today.getFullYear(), month: today.getMonth() };
  }, [monthParam]);

  const goToMonth = useCallback(
    (target) => {
      const today = getToday();
      const isThisMonth = target.year === today.getFullYear() && target.month === today.getMonth();
      setSearchParams(isThisMonth ? {} : { month: toMonthKey(target.year, target.month) });
    },
    [setSearchParams],
  );

  return {
    ...current,
    goPrev: () => goToMonth(shiftMonth(current, -1)),
    goNext: () => goToMonth(shiftMonth(current, 1)),
    goToday: () => setSearchParams({}),
  };
}
