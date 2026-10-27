// The scene accepts this same album shape from a future catalog adapter. `disc` is an optional
// scan of the printed CD (see scripts/download-covers.sh); without it the cover is used.
export const artist = 'Nirvana';

export const albums = [
  { id: 'bleach', title: 'Bleach', year: '1989', kind: 'Studio album', cover: '/covers/bleach.jpg', disc: '/discs/bleach.jpg', color: '#302c29', accent: '#ccc4b5', motif: 'lines' },
  { id: 'nevermind', title: 'Nevermind', year: '1991', kind: 'Studio album', cover: '/covers/nevermind.jpg', disc: '/discs/nevermind.jpg', color: '#13506c', accent: '#b2dae5', motif: 'waves' },
  { id: 'incesticide', title: 'Incesticide', year: '1992', kind: 'Compilation', cover: '/covers/incesticide.jpg', disc: '/discs/incesticide.jpg', color: '#a56846', accent: '#e4c4a0', motif: 'arches' },
  { id: 'in-utero', title: 'In Utero', year: '1993', kind: 'Studio album', cover: '/covers/in-utero.jpg', disc: '/discs/in-utero.jpg', color: '#ad906e', accent: '#f0d7bc', motif: 'sun' },
  { id: 'mtv-unplugged', title: 'MTV Unplugged in New York', year: '1994', kind: 'Live album', cover: '/covers/mtv-unplugged.jpg', disc: '/discs/mtv-unplugged.jpg', color: '#76492e', accent: '#d1a277', motif: 'stars' },
  { id: 'muddy-banks', title: 'From the Muddy Banks of the Wishkah', year: '1996', kind: 'Live album', cover: '/covers/muddy-banks.jpg', disc: '/discs/muddy-banks.jpg', color: '#3d5344', accent: '#c5c8b0', motif: 'rings' },
  { id: 'nirvana', title: 'Nirvana', year: '2002', kind: 'Compilation', cover: '/covers/nirvana.jpg', disc: '/discs/nirvana.jpg', color: '#20201f', accent: '#c6c4b5', motif: 'lines' },
  { id: 'sliver', title: 'Sliver: The Best of the Box', year: '2005', kind: 'Compilation', cover: '/covers/sliver.jpg', disc: '/discs/sliver.jpg', color: '#6d6457', accent: '#e2ccb2', motif: 'arches' },
  { id: 'live-at-reading', title: 'Live at Reading', year: '2009', kind: 'Live album', cover: '/covers/live-at-reading.jpg', disc: '/discs/live-at-reading.jpg', color: '#4d3b3a', accent: '#c9aca2', motif: 'stars' },
  { id: 'icon', title: 'Icon', year: '2010', kind: 'Compilation', cover: '/covers/icon.jpg', color: '#2d3644', accent: '#a8b9c8', motif: 'rings' },
];
