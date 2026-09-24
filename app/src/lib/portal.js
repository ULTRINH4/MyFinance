// Moves a node to document.body so it escapes any ancestor stacking context
// (e.g. a card with backdrop-filter, which — per spec — traps absolutely
// positioned descendants no matter how high their z-index is). Needed for
// floating UI like FormSelect's dropdown: on mobile the account dropdown
// in Reports rendered behind the "Report results" card below it because
// .filter-card's blur effect created that trap.
export function portal(node, target = document.body) {
  target.appendChild(node);
  return {
    destroy() {
      if (node.parentNode) node.parentNode.removeChild(node);
    }
  };
}
