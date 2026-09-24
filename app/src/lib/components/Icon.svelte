<script>
  let { name, size = 18 } = $props();

  const paths = {
    grid: 'M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z',
    dashboard: 'M4 4h6v6H4V4zm10 0h6v10h-6V4zM4 14h6v6H4v-6zm10 4h6v2h-6v-2z',
    bank: 'M3 21h18M4 21V10M20 21V10M2 10l10-6 10 6M6 10v11M18 10v11M10 14v4M14 14v4',
    wallet: 'M3 7h18v13H5a2 2 0 01-2-2V6a2 2 0 012-2h13M15 12h6v5h-6a2.5 2.5 0 010-5zM16 14.5h.01',
    tag: 'M20 13l-7 7-9-9V4h7l9 9zM8 8h.01',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    card: 'M2 7h20v13a1 1 0 01-1 1H3a1 1 0 01-1-1V7zM2 7V5a1 1 0 011-1h18a1 1 0 011 1v2M2 11h20',
    trending: 'M3 17l6-6 4 4 8-8M15 6h6v6',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3',
    shapes: 'M9 3L3 15h12L9 3zM17 21a4 4 0 100-8 4 4 0 000 8z',
    calendar: 'M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM3 9h18M8 3v4M16 3v4',
    gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'M18 6L6 18M6 6l12 12',
    eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z',
    eyeCircle: 'M12 9a3 3 0 100 6 3 3 0 000-6z',
    chevronLeft: 'M15 18l-6-6 6-6',
    chevronRight: 'M9 18l6-6-6-6',
    dots: 'M12 12h.01M6 12h.01M18 12h.01',
    check: 'M20 6L9 17l-5-5',
    clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
    arrowDown: 'M12 5v14M5 12l7 7 7-7',
    arrowUp: 'M12 19V5M5 12l7-7 7 7',
    swap: 'M7 3L3 7l4 4M3 7h13M17 21l4-4-4-4M21 17H8',
    utensils: 'M7 2v8a2 2 0 002 2 2 2 0 002-2V2M9 12v10M17 2c-2 0-3.5 2-3.5 5s1.5 5 3.5 5 3.5-2 3.5-5-1.5-5-3.5-5zM17 12v10',
    cart: 'M3 3h2l2.4 12.4a2 2 0 002 1.6h8.6a2 2 0 002-2L21 8H6M9 21a1 1 0 100-2 1 1 0 000 2zM19 21a1 1 0 100-2 1 1 0 000 2z',
    ticket: 'M4 9a2 2 0 012-2h12a2 2 0 012 2v1a2 2 0 000 4v1a2 2 0 01-2 2H6a2 2 0 01-2-2v-1a2 2 0 000-4V9z',
    car: 'M5 17h14M5 17a2 2 0 104 0M15 17a2 2 0 104 0M3 17V11l2-5h14l2 5v6M3 11h18',
    shirt: 'M8 3L4 7l3 3v11h10V10l3-3-4-4-2 2h-4L8 3z',
    wrench: 'M14.7 6.3a4 4 0 10-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.8 2.8-2-2 2.8-2.8z',
    percent: 'M19 5L5 19M6.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM17.5 20a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    bolt: 'M13 2L3 14h7l-1 8 11-14h-7l1-6z',
    repeat: 'M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3',
    user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
    flask: 'M9 2v6.3L3.8 18a2 2 0 001.7 3h13a2 2 0 001.7-3L15 8.3V2M8.5 2h7M8 15h8',
    camera: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z M12 17a4 4 0 100-8 4 4 0 000 8z'
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
  {#if name === 'eye'}
    <path d={paths.eye} stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
    <path d={paths.eyeCircle} stroke="currentColor" stroke-width="2" />
  {:else}
    <path d={paths[name]} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  {/if}
</svg>
