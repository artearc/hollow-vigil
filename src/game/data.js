// Static design data: elements, relics, arcana (synergy keystones), characters,
// sanctum upgrades, vows, maps, run timeline. Weapon data lives beside its logic in weapons.js.

// HDR colours for VFX (values >1 feed bloom) + UI colour.
export const ELEM = {
  fire:      { c: [3.2, 1.05, 0.22], ui: '#ff7a38', name: 'Fire' },
  ice:       { c: [0.55, 1.5, 2.8], ui: '#9fe6ff', name: 'Ice' },
  lightning: { c: [1.3, 1.6, 3.6], ui: '#b9c8ff', name: 'Lightning' },
  arcane:    { c: [1.7, 0.85, 3.2], ui: '#c49bff', name: 'Arcane' },
  shadow:    { c: [0.75, 0.18, 1.5], ui: '#a877ff', name: 'Shadow' },
  blood:     { c: [2.8, 0.12, 0.2], ui: '#ff3552', name: 'Blood' },
  holy:      { c: [3.2, 2.5, 1.2], ui: '#ffe9a8', name: 'Holy' },
  necro:     { c: [0.45, 2.4, 1.25], ui: '#79e0a8', name: 'Necromancy' },
  physical:  { c: [2, 1.9, 1.7], ui: '#ece2cc', name: 'Physical' },
};

// Relics: passive items. Most are also the key that evolves one weapon.
export const RELICS = {
  tallow:    { name: 'Tallow Vessel', icon: 'vessel', max: 5, desc: (l) => `+${8 * l}% damage`, stat: { might: 0.08 }, evolves: 'ember', lore: 'Rendered from the fat of martyrs. It never stops burning.' },
  reliquary: { name: 'Winter Reliquary', icon: 'reliquary', max: 5, desc: (l) => `+${8 * l}% area`, stat: { area: 0.08 }, evolves: 'rime', lore: 'A saint\'s fingerbone, still cold after nine centuries.' },
  stormbead: { name: 'Storm-Bead', icon: 'bead', max: 5, desc: (l) => `−${6 * l}% cooldowns`, stat: { haste: 0.06 }, evolves: 'tempest', lore: 'One bead of a rosary that was struck forty times.' },
  astrolabe: { name: 'Brass Astrolabe', icon: 'astrolabe', max: 5, desc: (l) => `+${10 * l}% projectile speed & duration`, stat: { speedP: 0.1, duration: 0.1 }, evolves: 'orrery', lore: 'It charts heavens that no longer exist.' },
  bonecrown: { name: 'Bone Crown', icon: 'crown', max: 5, desc: (l) => `+${12 * l}% summon damage, +${Math.ceil(l / 2)} max summons`, stat: { summon: 0.12 }, evolves: 'choir', lore: 'Every tine was once a king.' },
  mirror:    { name: 'Black Mirror', icon: 'mirror', max: 5, desc: (l) => `+${4 * l}% critical chance`, stat: { crit: 0.04 }, evolves: 'scythe', lore: 'It shows you standing somewhere you have not yet died.' },
  heart:     { name: 'Martyr\'s Heart', icon: 'heart', max: 5, desc: (l) => `+${15 * l} max health, +${(0.25 * l).toFixed(2)} regen/s`, stat: { maxHp: 15, regen: 0.25 }, evolves: 'thorns', lore: 'Still beating. Faintly. Out of spite.' },
  tithe:     { name: 'Saint\'s Tithe', icon: 'coin', max: 4, desc: (l) => `+${l} armor`, stat: { armor: 1 }, evolves: 'halo', lore: 'The price of mercy, paid in advance.' },
  witcheye:  { name: 'Witch\'s Eye', icon: 'eye', max: 5, desc: (l) => `+${15 * l}% status potency & duration`, stat: { status: 0.15 }, evolves: 'hex', lore: 'Plucked, pickled, and still watching.' },
  sandals:   { name: 'Pilgrim\'s Sandals', icon: 'sandal', max: 5, desc: (l) => `+${7 * l}% move speed`, stat: { moveSpd: 0.07 }, lore: 'Worn thin on the road to a shrine that was never there.' },
  lodestone: { name: 'Lodestone', icon: 'lodestone', max: 5, desc: (l) => `+${25 * l}% pickup radius, +${5 * l}% experience`, stat: { magnet: 0.25, growth: 0.05 }, lore: 'It pulls toward whatever you want most.' },
  tooth:     { name: 'Gilded Tooth', icon: 'tooth', max: 5, desc: (l) => `+${12 * l}% tithe, +${6 * l}% luck`, stat: { greed: 0.12, luck: 0.06 }, lore: 'Pulled from a bishop who swallowed the collection plate.' },
};

// Arcana: synergy keystones. Only offered when their prerequisites are met.
export const ARCANA = {
  wildfire:   { name: 'Wildfire Litany', icon: 'flame', elem: 'fire', req: (b) => b.has('ember'), desc: 'Burning enemies <b>ignite their neighbours</b> on death and burst in a small blaze.', lore: 'Fire is a gospel. It wants to be shared.' },
  shatter:    { name: 'Shatterpoint', icon: 'shard', elem: 'ice', req: (b) => b.has('rime') && (b.has('orrery') || b.has('scythe') || b.has('thorns')), desc: 'Kinetic hits on <b>frozen</b> enemies deal <b>×3.5</b> and burst into ice shards.', lore: 'Everything frozen is waiting to break.' },
  thermal:    { name: 'Thermal Heresy', icon: 'steam', elem: 'fire', req: (b) => b.has('ember') && b.has('rime'), desc: 'Fire striking a <b>frozen</b> enemy detonates a <b>steam blast</b> that leaves foes <b>drenched</b>.', lore: 'Two elements. One scream.' },
  conductive: { name: 'Conductive Sin', icon: 'bolt', elem: 'lightning', req: (b) => b.has('tempest'), desc: 'Lightning chains <b>+3 times</b> and deals <b>+60%</b> when it passes through <b>drenched or cursed</b> enemies.', lore: 'Sin conducts. The wet and the damned light up first.' },
  hemomancy:  { name: 'Hemomancy', icon: 'drop', elem: 'blood', req: (b) => b.has('thorns') || b.hasRelic('heart'), desc: 'Below <b>50%</b> health, all damage <b>+45%</b>. Kills heal <b>1</b>.', lore: 'The less of you remains, the more of you bites.' },
  gravebound: { name: 'Gravebound', icon: 'skull', elem: 'necro', req: (b) => b.has('choir') && (b.has('hex') || b.has('scythe')), desc: 'Every <b>cursed</b> enemy that dies <b>rises as your thrall</b>.', lore: 'A curse is only a contract with a later date.' },
  contagion:  { name: 'Hex Contagion', icon: 'eye', elem: 'shadow', req: (b) => b.has('hex') || b.has('scythe'), desc: 'Cursed enemies <b>explode</b> on death, spreading their curse.', lore: 'Rot travels fastest through the faithful.' },
  consecrate: { name: 'Consecration', icon: 'halo', elem: 'holy', req: (b) => b.has('halo'), desc: 'Holy damage <b>purges curses</b>: ×2 damage and a radiant burst against <b>cursed</b> enemies.', lore: 'Light is not kind. It is only thorough.' },
  umbral:     { name: 'Umbral Step', icon: 'rift', elem: 'shadow', req: () => true, desc: 'Your dash tears a <b>shadow rift</b> that drags enemies in. Dash cooldown <b>−30%</b>.', lore: 'Step through the dark and leave the door open.' },
  glass:      { name: 'Glass Covenant', icon: 'mirror', elem: 'arcane', req: () => true, desc: '<b>+55% damage</b>. <b>−40% max health</b>. No refunds.', lore: 'Sign here, in whatever you have left.', risk: true },
  avarice:    { name: 'Covenant of Avarice', icon: 'coin', elem: 'holy', req: () => true, desc: '<b>+60% experience and tithe</b>. Enemies have <b>+30% health</b>.', lore: 'Greed is a prayer that is always answered.', risk: true },
  cinder:     { name: 'Cinder Chain', icon: 'flame', elem: 'lightning', req: (b) => b.has('tempest') && b.has('ember'), desc: 'Lightning <b>ignites</b>. Burning enemies struck by lightning <b>erupt</b>.', lore: 'The storm remembers every fire it started.' },
};

export const CHARACTERS = {
  penitent: {
    name: 'The Ashen Penitent', cls: 'Pyre-Priest', weapon: 'ember', hp: 110, speed: 6.4, color: 0xff7a38, accent: '#ff7a38',
    ult: { id: 'immolation', name: 'Immolation Rite', desc: 'A cathedral-wide nova of fire.' },
    desc: 'Walks the burned road. Starts with Ember Litany. Balanced, forgiving.',
    unlock: null, bonus: { might: 0.05 },
  },
  witch: {
    name: 'Ysolde of the Rime', cls: 'Frost Anchorite', weapon: 'rime', hp: 85, speed: 6.9, color: 0x9fe6ff, accent: '#9fe6ff',
    ult: { id: 'zero', name: 'Absolute Zero', desc: 'Freezes everything that can see you.' },
    desc: 'Frail and fast. Starts with Rime Lance. +12% area.',
    unlock: { text: 'Survive 5:00 in any vigil', test: (s) => s.stats.bestTime >= 300, cost: 600 }, bonus: { area: 0.12 },
  },
  cantor: {
    name: 'The Bone Cantor', cls: 'Necro-Chorister', weapon: 'choir', hp: 100, speed: 6.2, color: 0x79e0a8, accent: '#79e0a8',
    ult: { id: 'exhume', name: 'Mass Exhumation', desc: 'Raises a choir of eight thralls in a necrotic burst.' },
    desc: 'Never fights alone. Starts with Grave Choir. +20% summon damage.',
    unlock: { text: 'Slay 1,500 creatures across all vigils', test: (s) => s.stats.kills >= 1500, cost: 900 }, bonus: { summon: 0.2 },
  },
  saint: {
    name: 'Sister Vael', cls: 'Blood Saint', weapon: 'thorns', hp: 140, speed: 6.3, color: 0xff3552, accent: '#ff3552',
    ult: { id: 'exsanguinate', name: 'Exsanguinate', desc: 'Drains a tithe of blood from every creature nearby.' },
    desc: 'Grows deadlier as she bleeds. Starts with Sanguine Thorns. −0.4 regen, +10% crit.',
    unlock: { text: 'Destroy the Bellwraith', test: (s) => (s.stats.bossKills.bellwraith || 0) > 0, cost: 1200 }, bonus: { crit: 0.1, regen: -0.4 },
  },
};

// Weapons that start locked, and how to unlock them (they join the level-up pool).
export const WEAPON_UNLOCKS = {
  choir: { text: 'Unlock the Bone Cantor, or pay', test: (s) => s.unlocked.chars.includes('cantor'), cost: 500 },
  thorns: { text: 'Reach level 20 in a vigil, or pay', test: (s) => s.stats.maxLevel >= 20, cost: 500 },
  hex: { text: 'Defeat the Tithe-Collector, or pay', test: (s) => (s.stats.bossKills.collector || 0) > 0, cost: 450 },
};

export const META = [
  { id: 'might', name: 'Zeal', desc: '+5% damage per rank', max: 5, cost: 120, stat: { might: 0.05 } },
  { id: 'vigor', name: 'Vigor', desc: '+10 max health per rank', max: 5, cost: 100, stat: { maxHp: 10 } },
  { id: 'ward', name: 'Ward', desc: '+1 armor per rank', max: 3, cost: 220, stat: { armor: 1 } },
  { id: 'haste', name: 'Litany', desc: '−3% cooldowns per rank', max: 5, cost: 180, stat: { haste: 0.03 } },
  { id: 'swift', name: 'Pilgrimage', desc: '+4% move speed per rank', max: 4, cost: 110, stat: { moveSpd: 0.04 } },
  { id: 'area', name: 'Expanse', desc: '+4% area per rank', max: 4, cost: 150, stat: { area: 0.04 } },
  { id: 'greed', name: 'Tithe', desc: '+10% tithe gained per rank', max: 5, cost: 90, stat: { greed: 0.1 } },
  { id: 'growth', name: 'Scripture', desc: '+6% experience per rank', max: 5, cost: 140, stat: { growth: 0.06 } },
  { id: 'reach', name: 'Lodestar', desc: '+15% pickup radius per rank', max: 3, cost: 80, stat: { magnet: 0.15 } },
  { id: 'luck', name: 'Omen', desc: '+5% luck per rank (rarer offerings)', max: 3, cost: 200, stat: { luck: 0.05 } },
  { id: 'revival', name: 'Second Vigil', desc: 'Rise once from death with half health', max: 1, cost: 900, stat: { revive: 1 } },
  { id: 'reroll', name: 'Recant', desc: '+1 reroll of offerings per run', max: 3, cost: 160, stat: { rerolls: 1 } },
  { id: 'banish', name: 'Anathema', desc: '+1 banish per run', max: 2, cost: 200, stat: { banish: 1 } },
];

export const VOWS = {
  multitude: { name: 'Vow of Multitudes', desc: '+60% enemies', gold: 0.25 },
  iron: { name: 'Vow of Iron', desc: 'Enemies +50% health', gold: 0.3 },
  haste: { name: 'Vow of Haste', desc: 'Enemies +20% speed', gold: 0.25 },
  famine: { name: 'Vow of Famine', desc: 'No healing sacraments drop', gold: 0.2 },
  eclipse: { name: 'Vow of Eclipse', desc: 'The dark closes in', gold: 0.15 },
};

export const MAPS = {
  nave: {
    name: 'The Drowned Nave', desc: 'A cathedral that sank into its own crypts. The candles still burn.',
    fog: 0x100d17, fogDensity: 0.0155, sky: 0x3a3558, groundCol: 0x1a1216, moon: 0xa9b4ff, moonI: 1.9, hemiI: 0.62,
    torch: 0xff8a3a, accent: 0xff7a38, grade: [1.0, 0.97, 1.03], unlock: null,
  },
  thornwood: {
    name: 'Thornwood Ossuary', desc: 'A forest that learned to eat the dead. Now it is hungry for the living.',
    fog: 0x0b120f, fogDensity: 0.02, sky: 0x2a3a34, groundCol: 0x0c100c, moon: 0xa8ffd8, moonI: 1.1, hemiI: 0.5,
    torch: 0x7dffb0, accent: 0x79e0a8, grade: [0.95, 1.02, 0.97],
    unlock: { text: 'Destroy the Hollow Saint', test: (s) => (s.stats.bossKills.saint || 0) > 0, cost: 1500 },
  },
};

// Run timeline (seconds). Spawn weights per enemy type ramp in by time.
export const RUN_LENGTH = 600;
export const TIMELINE = [
  { t: 0, phase: 'The First Hour' },
  { t: 150, boss: 'collector', phase: 'The Tithe Comes Due' },
  { t: 180, phase: 'Vespers' },
  { t: 240, event: 'ring', phase: 'Vespers' },
  { t: 300, boss: 'bellwraith', phase: 'The Bell Tolls' },
  { t: 330, phase: 'Compline' },
  { t: 420, boss: 'matron', phase: 'The Brood Stirs' },
  { t: 450, phase: 'The Long Dark' },
  { t: 510, event: 'surge', phase: 'The Long Dark' },
  { t: 600, boss: 'saint', phase: 'The Hollow Saint' },
];
