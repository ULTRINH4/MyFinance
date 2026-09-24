// Makes the mobile/Android hardware back button close an open modal instead
// of navigating away from the page (or exiting the app on the browser's
// first history entry) — reported while testing on mobile: back was
// leaving the screen instead of closing whatever modal was open.
//
// Pattern: push a throwaway history entry when a modal opens; a `popstate`
// (fired by the back button, and by our own history.back() call when the
// modal is closed some other way) closes the modal instead of the browser
// actually navigating anywhere.
export function createModalHistory(setClosed) {
  let active = false;

  function onPopState() {
    if (!active) return;
    active = false;
    setClosed();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', onPopState);
  }

  return {
    // Call right after marking the modal open. Safe to call repeatedly
    // while already open (e.g. switching from an action menu straight into
    // a form) — only pushes one history entry per open/close cycle.
    opened() {
      if (active) return;
      active = true;
      history.pushState({ modal: true }, '');
    },
    isActive() {
      return active;
    },
    // Call from every "close this modal" path (X button, overlay click,
    // save, cancel...) instead of only setting the open flag to false.
    closed() {
      if (!active) return;
      active = false;
      history.back();
    },
    destroy() {
      if (typeof window !== 'undefined') window.removeEventListener('popstate', onPopState);
    }
  };
}
