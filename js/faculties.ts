// src/lib/faculties.ts
// Auto-generated from UTP faculty logos — do not edit manually

export interface Faculty {
  id:        string;   // used as asset filename key: logo_{id}.png
  shortName: string;   // used in portada line 2 (FACULTAD DE ...)
  fullLine:  string;   // exact string to draw on the portada header
}

export const FACULTIES: Faculty[] = [
  {
    id:        'fisc',
    shortName: 'FISC',
    fullLine:  'FACULTAD DE INGENIERÍA DE SISTEMAS COMPUTACIONALES',
  },
  {
    id:        'fct',
    shortName: 'FCT',
    fullLine:  'FACULTAD DE CIENCIAS Y TECNOLOGÍA',
  },
  {
    id:        'fic',
    shortName: 'FIC',
    fullLine:  'FACULTAD DE INGENIERÍA CIVIL',
  },
  {
    id:        'fim',
    shortName: 'FIM',
    fullLine:  'FACULTAD DE INGENIERÍA MECÁNICA',
  },
  {
    id:        'fie',
    shortName: 'FIE',
    fullLine:  'FACULTAD DE INGENIERÍA ELÉCTRICA',
  },
  {
    id:        'fii',
    shortName: 'FII',
    fullLine:  'FACULTAD DE INGENIERÍA INDUSTRIAL',
  },
];

// Usage in generatePortada.ts:
//
//   const faculty = FACULTIES.find(f => f.id === data.facultyId)!;
//
//   const logoBytes = await fetch(`/assets/logo_${faculty.id}.png`)
//                       .then(r => r.arrayBuffer());
//   const logo = await pdfDoc.embedPng(logoBytes);
//
//   page.drawText(faculty.fullLine, {
//     x: /* center dynamically */,
//     y: 423,
//     size: 18,
//     font: fontBold,
//     color: TEXT_COLOR,
//   });
//
// NOTE: "FACULTAD DE INGENIERÍA DE SISTEMAS COMPUTACIONALES" is the longest
// line and was measured at x=112 in the original template at size 18pt.
// Shorter faculty names should be centered dynamically:
//
//   const lineWidth = fontBold.widthOfTextAtSize(faculty.fullLine, 18);
//   const x = Math.max(112, (PAGE_WIDTH - lineWidth) / 2);
//
// Test each faculty — some shorter names will shift position slightly.
