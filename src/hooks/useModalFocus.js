import { useEffect } from 'react';

/** 차단할 배경은 패널에서 body까지의 형제 가지로 한정한다. */
export default function useModalFocus(active, panelRef, returnRef) {
  useEffect(() => {
    if (!active || !panelRef.current) return;
    const panel = panelRef.current;
    const blocked = [];
    for (let branch = panel; branch.parentElement; branch = branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && !sibling.inert) { sibling.inert = true; blocked.push(sibling); }
      }
      if (branch.parentElement === document.body) break;
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => [...panel.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),[tabindex="0"]')].filter(node => node.getClientRects().length);
    (controls()[0] || panel).focus();
    const keyboard = event => {
      if (event.key !== 'Tab') return;
      const list = controls(), first = list[0], last = list.at(-1);
      if (!list.length) { event.preventDefault(); panel.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !list.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !list.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      blocked.forEach(node => { node.inert = false; });
      document.body.style.overflow = overflow;
      returnRef?.current?.focus();
    };
  }, [active, panelRef, returnRef]);
}
