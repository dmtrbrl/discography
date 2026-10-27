// The scene accepts this same album shape from a future catalog adapter. The optional scans (see
// scripts/download-covers.sh): `disc` is the printed CD, otherwise the cover is used; `back` is the
// back insert, ideally with its spines; `bookletBack` is the booklet's back page, seen inside the
// open lid. Without `back` or `bookletBack` the case generates them from the album data, including
// an optional `tracks` list.
export const artist = 'Nirvana';

export const albums = [
  { id: 'bleach', title: 'Bleach', year: '1989', kind: 'Studio album', cover: '/covers/bleach.jpg', disc: '/discs/bleach.jpg', back: '/backs/bleach.jpg', bookletBack: '/booklets/bleach-back.jpg', color: '#302c29', accent: '#ccc4b5', motif: 'lines' },
  { id: 'nevermind', title: 'Nevermind', year: '1991', kind: 'Studio album', cover: '/covers/nevermind.jpg', disc: '/discs/nevermind.jpg', back: '/backs/nevermind.jpg', bookletBack: '/booklets/nevermind-back.jpg', color: '#13506c', accent: '#b2dae5', motif: 'waves' },
  { id: 'incesticide', title: 'Incesticide', year: '1992', kind: 'Compilation', cover: '/covers/incesticide.jpg', disc: '/discs/incesticide.jpg', back: '/backs/incesticide.jpg', bookletBack: '/booklets/incesticide-back.jpg', color: '#a56846', accent: '#e4c4a0', motif: 'arches' },
  { id: 'in-utero', title: 'In Utero', year: '1993', kind: 'Studio album', cover: '/covers/in-utero.jpg', disc: '/discs/in-utero.jpg', back: '/backs/in-utero.jpg', bookletBack: '/booklets/in-utero-back.jpg', color: '#ad906e', accent: '#f0d7bc', motif: 'sun' },
  { id: 'mtv-unplugged', title: 'MTV Unplugged in New York', year: '1994', kind: 'Live album', cover: '/covers/mtv-unplugged.jpg', disc: '/discs/mtv-unplugged.jpg', back: '/backs/mtv-unplugged.jpg', bookletBack: '/booklets/mtv-unplugged-back.jpg', color: '#76492e', accent: '#d1a277', motif: 'stars' },
  { id: 'muddy-banks', title: 'From the Muddy Banks of the Wishkah', year: '1996', kind: 'Live album', cover: '/covers/muddy-banks.jpg', disc: '/discs/muddy-banks.jpg', back: '/backs/muddy-banks.jpg', bookletBack: '/booklets/muddy-banks-back.jpg', color: '#3d5344', accent: '#c5c8b0', motif: 'rings' },
  { id: 'nirvana', title: 'Nirvana', year: '2002', kind: 'Compilation', cover: '/covers/nirvana.jpg', disc: '/discs/nirvana.jpg', back: '/backs/nirvana.jpg', bookletBack: '/booklets/nirvana-back.jpg', color: '#20201f', accent: '#c6c4b5', motif: 'lines' },
];
