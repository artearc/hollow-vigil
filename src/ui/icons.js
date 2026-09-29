// Hand-drawn sigil icons (24×24, stroke = currentColor). One consistent engraving style.
const I = {
  flame: '<path d="M12 21c-4 0-6-2.6-6-5.6 0-3.7 3.4-5.3 3.6-9.4 2.4 1.7 3 4 2.6 6 1-.6 1.9-1.7 2.1-3.3 2 1.8 3.7 4 3.7 6.7 0 3-2 5.6-6 5.6z"/><path d="M12 21c-1.6 0-2.6-1.1-2.6-2.5 0-1.7 1.5-2.4 2.3-4 1.3 1 2.9 2.2 2.9 4 0 1.4-1 2.5-2.6 2.5z"/>',
  shard: '<path d="M12 2l3 8-3 12-3-12z"/><path d="M5 7l3 5-2 6M19 7l-3 5 2 6"/>',
  bolt: '<path d="M13 2L5 13h6l-2 9 9-12h-6l2-8z"/>',
  orbit: '<circle cx="12" cy="12" r="7.5"/><path d="M12 2.5l1.3 3-1.3 1.5-1.3-1.5zM21.5 12l-3 1.3-1.5-1.3 1.5-1.3zM12 21.5l-1.3-3 1.3-1.5 1.3 1.5zM2.5 12l3-1.3 1.5 1.3-1.5 1.3z"/><circle cx="12" cy="12" r="1.6"/>',
  skull: '<path d="M12 3c-4.4 0-7 3-7 6.8 0 2.4 1.1 3.9 2.6 4.8V18h8.8v-3.4c1.5-.9 2.6-2.4 2.6-4.8C19 6 16.4 3 12 3z"/><circle cx="9.2" cy="10.5" r="1.6"/><circle cx="14.8" cy="10.5" r="1.6"/><path d="M10 18v3M14 18v3M12 13.5v1.5"/>',
  scythe: '<path d="M6 21L15 4"/><path d="M15 4c-4.5-.6-9 1.5-11 5.5 3.6-2.2 7.4-2.6 10.4-1.6"/>',
  thorn: '<path d="M12 22V9M12 9l-2.5-6M12 9l2.5-6M12 14l-4-3M12 17l4-3M8 22h8"/>',
  halo: '<ellipse cx="12" cy="7" rx="7" ry="2.6"/><path d="M12 11v10M8.5 15h7"/>',
  eye: '<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M19.5 4.5l-1.4 1.4M5.9 18.1l-1.4 1.4"/>',
  vessel: '<path d="M9 3h6M10 3v3c-3 1-5 3.5-5 7 0 4.4 3.1 8 7 8s7-3.6 7-8c0-3.5-2-6-5-7V3"/><path d="M8 14h8"/>',
  reliquary: '<path d="M5 9h14v11H5zM4 9l8-6 8 6"/><path d="M12 12v5M9.5 14.5h5"/>',
  bead: '<circle cx="12" cy="6" r="3"/><circle cx="12" cy="15" r="2"/><path d="M12 9v4M12 17v5M9 20l3 2 3-2"/>',
  astrolabe: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4M4 12h16M12 12l5-5"/>',
  crown: '<path d="M3 18h18L19 7l-4 4-3-6-3 6-4-4z"/><path d="M5 21h14"/>',
  mirror: '<ellipse cx="12" cy="9" rx="5.5" ry="6.5"/><path d="M12 15.5V22M9 22h6M9.5 6.5c.8-1 1.7-1.5 2.8-1.6"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2C4.5 7 6.4 5 8.8 5c1.5 0 2.6.8 3.2 2 .6-1.2 1.7-2 3.2-2 2.4 0 4.3 2 4.3 4.8C19.5 15.4 12 20 12 20z"/><path d="M12 7v9M9.5 11h5"/>',
  coin: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/><path d="M12 9v6M10 12h4"/>',
  sandal: '<path d="M8 3c3 0 5 2 5 6v8c0 2.5-1.5 4-3.5 4S6 19.5 6 17V7c0-2 .8-4 2-4z"/><path d="M6 10l7-2M6 14l7 1"/>',
  lodestone: '<path d="M6 4v8a6 6 0 0012 0V4h-4v8a2 2 0 01-4 0V4z"/><path d="M6 7h4M14 7h4"/>',
  tooth: '<path d="M7 4c-2 0-3 2-3 4 0 3 1.5 4 2 7l1 6 2-5h6l2 5 1-6c.5-3 2-4 2-7 0-2-1-4-3-4-1.8 0-3 1-5 1S8.8 4 7 4z"/>',
  drop: '<path d="M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z"/><path d="M9.5 15a2.5 2.5 0 002.5 2.5"/>',
  steam: '<path d="M7 20c-2-3 2-5 0-8s2-5 0-8M12 20c-2-3 2-5 0-8s2-5 0-8M17 20c-2-3 2-5 0-8s2-5 0-8"/>',
  rift: '<path d="M12 2l2 6 6 1-5 4 2 7-5-4-5 4 2-7-5-4 6-1z"/><circle cx="12" cy="11.5" r="2"/>',
  gold: '<circle cx="12" cy="12" r="8"/><path d="M12 7l1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5z"/>',
  kill: '<path d="M4 20L20 4M14 4h6v6M4 14l6 6M3 21l3-3"/>',
  dash: '<path d="M3 12h11M3 7h7M3 17h7M14 6l6 6-6 6"/>',
  ult: '<path d="M12 2l2.4 6.6L21 9l-5 4.6L17.6 21 12 17.3 6.4 21 8 13.6 3 9l6.6-.4z"/>',
  chest: '<path d="M3 10h18v10H3zM3 10c0-3 2-5 5-5h8c3 0 5 2 5 5M11 13h2v3h-2z"/>',
  lock: '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 018 0v4"/>',
};
export function icon(name, color) {
  const body = I[name] || I.rift;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${color || 'currentColor'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
