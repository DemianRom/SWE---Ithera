import { inflateSync, deflateSync } from 'zlib';
import type { BudgetSummary } from './budget.service';

type PdfLine = {
  label?: string;
  value: string;
};

type PdfSection = {
  title: string;
  lines: PdfLine[];
};

type PdfImage = {
  width: number;
  height: number;
  colorSpace: '/DeviceRGB' | '/DeviceGray';
  bitsPerComponent: number;
  filter: '/DCTDecode' | '/FlateDecode';
  data: Buffer;
  smask?: PdfImage;
};

type PdfDocumentData = {
  title: string;
  subtitle: string;
  folio: string;
  total?: string | null;
  authCode?: string | null;
  recipientEmail?: string | null;
  heroImageUrl?: string | null;
  sections: PdfSection[];
  /** Etiquetas de los tres datos del encabezado (por defecto: Folio, Total, Autorizacion). */
  labels?: { folio?: string; total?: string; auth?: string };
  footer?: string;
  summaryBudget?: string;
};


const toPdfSafeText = (value: string): string =>
  String(value ?? '')
    .normalize('NFC')
    .replace(/[áàäâ]/gi, (m) => (m === m.toUpperCase() ? 'A' : 'a'))
    .replace(/[éèëê]/gi, (m) => (m === m.toUpperCase() ? 'E' : 'e'))
    .replace(/[íìïî]/gi, (m) => (m === m.toUpperCase() ? 'I' : 'i'))
    .replace(/[óòöô]/gi, (m) => (m === m.toUpperCase() ? 'O' : 'o'))
    .replace(/[úùüû]/gi, (m) => (m === m.toUpperCase() ? 'U' : 'u'))
    .replace(/ñ/gi, (m) => (m === 'Ñ' ? 'N' : 'n'))
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');

const escapePdfText = (value: string): string =>
  toPdfSafeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const moneyText = (value?: string | null): string => value || 'No especificado';

const wrapText = (text: string, maxChars: number): string[] => {
  const words = toPdfSafeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

const addText = (commands: string[], text: string, x: number, y: number, size = 10, font = 'F1', color = '0 0 0'): void => {
  commands.push('BT');
  commands.push(`${color} rg`);
  commands.push(`/${font} ${size} Tf`);
  commands.push(`${x} ${y} Td`);
  commands.push(`(${escapePdfText(text)}) Tj`);
  commands.push('ET');
};

const addRect = (commands: string[], x: number, y: number, width: number, height: number, color: string): void => {
  commands.push('q');
  commands.push(`${color} rg`);
  commands.push(`${x} ${y} ${width} ${height} re f`);
  commands.push('Q');
};

const addRoundedRect = (commands: string[], x: number, y: number, width: number, height: number, radius: number, color: string): void => {
  const r = Math.min(radius, width / 2, height / 2);
  const k = r * 0.55228475;
  commands.push('q', `${color} rg`, `${x + r} ${y} m`, `${x + width - r} ${y} l`,
    `${x + width - r + k} ${y} ${x + width} ${y + r - k} ${x + width} ${y + r} c`,
    `${x + width} ${y + height - r} l`, `${x + width} ${y + height - r + k} ${x + width - r + k} ${y + height} ${x + width - r} ${y + height} c`,
    `${x + r} ${y + height} l`, `${x + r - k} ${y + height} ${x} ${y + height - r + k} ${x} ${y + height - r} c`,
    `${x} ${y + r} l`, `${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y} c`, 'f', 'Q');
};

const addImage = (commands: string[], name: string, x: number, y: number, width: number, height: number): void => {
  commands.push('q');
  commands.push(`${width} 0 0 ${height} ${x} ${y} cm`);
  commands.push(`/${name} Do`);
  commands.push('Q');
};

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
};

const readPng = (buffer: Buffer): PdfImage | null => {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType)) return null;

  const channels = colorType === 6 ? 4 : 3;
  const bytesPerPixel = channels;
  const stride = width * channels;
  const inflated = inflateSync(Buffer.concat(idat));
  const raw = Buffer.alloc(width * height * channels);
  let inOffset = 0;
  let outOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inOffset];
    inOffset += 1;
    for (let x = 0; x < stride; x += 1) {
      const value = inflated[inOffset + x];
      const left = x >= bytesPerPixel ? raw[outOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? raw[outOffset + x - stride] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? raw[outOffset + x - stride - bytesPerPixel] : 0;
      let decoded = value;
      if (filter === 1) decoded = (value + left) & 0xff;
      else if (filter === 2) decoded = (value + up) & 0xff;
      else if (filter === 3) decoded = (value + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) decoded = (value + paeth(left, up, upLeft)) & 0xff;
      raw[outOffset + x] = decoded;
    }
    inOffset += stride;
    outOffset += stride;
  }

  if (colorType === 2) {
    return { width, height, colorSpace: '/DeviceRGB', bitsPerComponent: 8, filter: '/FlateDecode', data: deflateSync(raw) };
  }

  const rgb = Buffer.alloc(width * height * 3);
  const alpha = Buffer.alloc(width * height);
  for (let i = 0, r = 0, a = 0; i < raw.length; i += 4, r += 3, a += 1) {
    rgb[r] = raw[i];
    rgb[r + 1] = raw[i + 1];
    rgb[r + 2] = raw[i + 2];
    alpha[a] = raw[i + 3];
  }

  return {
    width,
    height,
    colorSpace: '/DeviceRGB',
    bitsPerComponent: 8,
    filter: '/FlateDecode',
    data: deflateSync(rgb),
    smask: {
      width,
      height,
      colorSpace: '/DeviceGray',
      bitsPerComponent: 8,
      filter: '/FlateDecode',
      data: deflateSync(alpha),
    },
  };
};

const fetchPdfImage = async (url?: string | null): Promise<PdfImage | null> => {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') ?? '';
    const buffer = Buffer.from(await response.arrayBuffer());
    if (contentType.includes('jpeg') || contentType.includes('jpg') || buffer.subarray(0, 2).toString('hex') === 'ffd8') {
      return { width: 900, height: 520, colorSpace: '/DeviceRGB', bitsPerComponent: 8, filter: '/DCTDecode', data: buffer };
    }
    return readPng(buffer);
  } catch (error) {
    console.error('[checkout-pdf] No se pudo cargar imagen remota:', error);
    return null;
  }
};

const fitImage = (image: PdfImage, maxWidth: number, maxHeight: number): { width: number; height: number } => {
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
  return { width: image.width * ratio, height: image.height * ratio };
};

const buildImageObjects = (images: Record<string, PdfImage>, startId: number) => {
  const objects: string[] = [];
  const names: Record<string, number> = {};
  let nextId = startId;

  Object.entries(images).forEach(([name, image]) => {
    let smaskId: number | null = null;
    if (image.smask) {
      smaskId = nextId;
      objects.push(`${nextId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.smask.width} /Height ${image.smask.height} /ColorSpace ${image.smask.colorSpace} /BitsPerComponent ${image.smask.bitsPerComponent} /Filter ${image.smask.filter} /Length ${image.smask.data.length} >>\nstream\n${image.smask.data.toString('binary')}\nendstream\nendobj\n`);
      nextId += 1;
    }

    names[name] = nextId;
    objects.push(`${nextId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace ${image.colorSpace} /BitsPerComponent ${image.bitsPerComponent} /Filter ${image.filter}${smaskId ? ` /SMask ${smaskId} 0 R` : ''} /Length ${image.data.length} >>\nstream\n${image.data.toString('binary')}\nendstream\nendobj\n`);
    nextId += 1;
  });

  return { objects, names };
};

const buildElegantPdf = async (data: PdfDocumentData): Promise<Buffer> => {
  const commands: string[] = [];
  const heroImage = await fetchPdfImage(data.heroImageUrl);
  const images: Record<string, PdfImage> = {};
  if (heroImage) images.ImHero = heroImage;

  addRect(commands, 0, 720, 612, 72, '0.027 0.231 0.322');
  addRect(commands, 390, 720, 222, 72, '1 1 1');
  addRect(commands, 390, 720, 1, 72, '0.796 0.867 0.890');
  addText(commands, 'TRAVELING', 48, 758, 18, 'F2', '1 1 1');
  addText(commands, data.title, 48, 735, 15, 'F2', '1 1 1');

  // Encabezado de texto: sin logo en imagen hasta que el equipo defina el suyo.
  addText(commands, data.subtitle, 408, 744, 9, 'F1', '0.027 0.231 0.322');

  addRect(commands, 48, 654, 516, 46, '0.957 0.976 0.980');
  addText(commands, data.labels?.folio ?? 'Folio', 64, 681, 8, 'F2', '0.322 0.424 0.475');
  addText(commands, data.folio, 64, 665, 13, 'F2', '0.027 0.231 0.322');
  addText(commands, data.labels?.total ?? 'Total', 330, 681, 8, 'F2', '0.322 0.424 0.475');
  addText(commands, moneyText(data.total), 330, 665, 13, 'F2', '0.027 0.231 0.322');
  addText(commands, data.labels?.auth ?? 'Autorizacion', 448, 681, 8, 'F2', '0.322 0.424 0.475');
  addText(commands, data.authCode ?? 'N/A', 448, 665, 13, 'F2', '0.027 0.231 0.322');

  let y = 622;
  if (heroImage) {
    addRect(commands, 48, 500, 516, 112, '0.957 0.976 0.980');
    const fitted = fitImage(heroImage, 516, 112);
    addImage(commands, 'ImHero', 48 + (516 - fitted.width) / 2, 500 + (112 - fitted.height) / 2, fitted.width, fitted.height);
    y = 466;
  }

  // Una sola pagina: si el contenido no cabe, se corta con un aviso.
  const PAGE_BOTTOM = 112;
  let truncated = false;
  const markTruncated = () => {
    if (truncated) return;
    truncated = true;
    addText(commands, 'Contenido truncado: consulta la exportacion CSV para el detalle completo.', 64, y, 9, 'F2', '0.553 0.251 0.204');
  };

  data.sections.forEach((section) => {
    if (truncated) return;
    if (y < PAGE_BOTTOM + 40) {
      markTruncated();
      return;
    }
    addText(commands, section.title, 48, y, 12, 'F2', '0.027 0.231 0.322');
    y -= 14;
    addRect(commands, 48, y - 7, 516, 1, '0.796 0.867 0.890');
    y -= 22;

    section.lines.forEach((line) => {
      if (truncated) return;
      if (y < PAGE_BOTTOM) {
        markTruncated();
        return;
      }
      const label = line.label ? `${line.label}:` : '';
      if (label) addText(commands, label, 64, y, 9, 'F2', '0.322 0.424 0.475');
      const valueX = label ? 180 : 64;
      const wrapped = wrapText(line.value, label ? 58 : 86).slice(0, 4);
      wrapped.forEach((textLine, index) => {
        addText(commands, textLine, valueX, y - index * 12, 9, 'F1', '0.027 0.231 0.322');
      });
      y -= Math.max(18, wrapped.length * 12 + 6);
    });

    y -= 8;
  });

  addRect(commands, 48, 54, 516, 40, '0.957 0.976 0.980');
  addText(commands, data.footer ?? 'Documento generado por Traveling. Conserva este comprobante en los archivos del viaje.', 64, 77, 9, 'F1', '0.027 0.231 0.322');
  if (data.recipientEmail) addText(commands, `PDF enviado a: ${data.recipientEmail}`, 64, 63, 8, 'F1', '0.322 0.424 0.475');

  const imageData = buildImageObjects(images, 7);
  const xObjectEntries = Object.entries(imageData.names).map(([name, id]) => `/${name} ${id} 0 R`).join(' ');
  const content = commands.join('\n');
  const contentLength = Buffer.byteLength(content, 'binary');

  const baseObjects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >>${xObjectEntries ? ` /XObject << ${xObjectEntries} >>` : ''} >> /Contents 6 0 R >>\nendobj\n`,
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
    `6 0 obj\n<< /Length ${contentLength} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  const objects = [...baseObjects, ...imageData.objects];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += object;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'binary');
};

export const generateCollectionReceiptPdf = async (data: {
  folio: string;
  tripLabel: string;
  issuedAt: string;
  creditor: string;
  debtor: string;
  amount: string;
}): Promise<Buffer> => {
  return buildElegantPdf({
    title: 'Comprobante de liquidacion',
    subtitle: 'Movimiento validado en Traveling',
    folio: data.folio,
    total: data.amount,
    sections: [
      {
        title: 'Datos del recibo',
        lines: [
          { label: 'Fecha de emision', value: data.issuedAt },
          { label: 'Viaje', value: data.tripLabel },
          { label: 'Tipo', value: 'Liquidacion entre integrantes' },
        ],
      },
      {
        title: 'Partes involucradas',
        lines: [
          { label: 'Acreedor (cobra)', value: data.creditor },
          { label: 'Deudor', value: data.debtor },
          { label: 'Monto', value: data.amount },
        ],
      },
      {
        title: 'Nota de validacion',
        lines: [
          { value: 'Comprobante emitido por Traveling con el estado de deuda registrado al momento de la emision.' },
        ],
      },
    ],
  });
};

const formatPdfMoney = (value: number): string =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`;

// El resumen usa una plantilla propia para no alterar los comprobantes de liquidacion.
// Cada linea puede continuar en otra pagina, incluso cuando un nombre es muy largo.
const buildBudgetSummaryPdf = (data: PdfDocumentData): Buffer => {
  const pages: string[][] = [];
  let commands: string[] = [];
  let y = 0;
  const navy = '0.027 0.231 0.322';
  const blue = '0.027 0.357 0.522';
  const muted = '0.322 0.424 0.475';
  const border = '0.796 0.867 0.89';
  const pale = '0.91 0.957 0.98';
  const startPage = () => {
    commands = [];
    pages.push(commands);
    if (pages.length > 1) {
      addRect(commands, 0, 724, 612, 68, navy);
      addText(commands, 'Resumen de gastos', 48, 755, 17, 'F2', '1 1 1');
      addText(commands, 'Traveling / Continuacion', 48, 736, 9, 'F1', '0.9 0.95 0.97');
    }
    addRect(commands, 30, 18, 552, 32, '0.957 0.976 0.98');
    addRect(commands, 30, 50, 552, 1, border);
    addText(commands, 'Generado por Traveling', 48, 30, 8, 'F1', muted);
    addText(commands, `Pagina ${pages.length}`, 510, 30, 8, 'F1', muted);
    y = 700;
  };
  const ensureSpace = (height: number) => {
    if (y - height < 62) startPage();
  };
  // wrapText no divide palabras largas; este envoltorio tambien las divide.
  const wrap = (value: string, width: number): string[] => {
    const words = toPdfSafeText(value).split(/\s+/).filter(Boolean);
    const chunks = words.flatMap((word) => word.match(new RegExp(`.{1,${width}}`, 'g')) ?? []);
    return wrapText(chunks.join(' '), width);
  };
  const writeWrapped = (value: string, x: number, width: number, size: number, font: string, color: string, leading: number) => {
    wrap(value, width).forEach((line) => {
      ensureSpace(leading);
      addText(commands, line, x, y, size, font, color);
      y -= leading;
    });
  };

  startPage();
  // El mismo degradado azul de las exportaciones de liquidacion, sin perder
  // la paginacion propia del resumen de gastos.
  for (let i = 0; i < 46; i += 1) {
    const t = i / 45;
    const color = [0.027, 0.231 + 0.126 * t, 0.322 + 0.2 * t]
      .map((channel) => channel.toFixed(3)).join(' ');
    addRect(commands, 30 + i * 12, 586, i === 45 ? 12 : 12.1, 176, color);
  }
  addText(commands, data.title, 54, 732, 23, 'F2', '1 1 1');
  const subtitleLines = wrap(data.subtitle, 67);
  subtitleLines.slice(0, 3).forEach((line, index) => {
    addText(commands, line, 54, 707 - index * 15, 11, 'F1', '0.9 0.95 0.97');
  });
  addRoundedRect(commands, 54, 605, 160, 57, 9, '0.165 0.369 0.443');
  addRoundedRect(commands, 226, 605, 160, 57, 9, '0.165 0.400 0.490');
  addRoundedRect(commands, 398, 605, 160, 57, 9, '0.165 0.430 0.530');
  addText(commands, 'Total gastado', 64, 643, 10, 'F1', '1 1 1');
  addText(commands, moneyText(data.total), 64, 622, 14, 'F2', '1 1 1');
  addText(commands, 'Presupuesto', 236, 643, 10, 'F1', '1 1 1');
  addText(commands, data.summaryBudget ?? 'Sin definir', 236, 622, 14, 'F2', '1 1 1');
  addText(commands, 'Gastos', 408, 643, 10, 'F1', '1 1 1');
  addText(commands, data.authCode ?? '0', 408, 622, 14, 'F2', '1 1 1');
  y = 565;
  // Los nombres largos continuan fuera del encabezado sin perder contenido.
  subtitleLines.slice(3).forEach((line) => {
    ensureSpace(15);
    addText(commands, line, 48, y, 11, 'F1', navy);
    y -= 15;
  });

  data.sections.forEach((section) => {
    const lines = section.lines.flatMap((line) => [
      ...(line.label ? wrap(line.label, 78).map((text) => ({ text, font: 'F2', color: navy, size: 10 })) : []),
      ...wrap(line.value, 86).map((text) => ({ text, font: 'F1', color: blue, size: 10 })),
      { text: '', font: 'F1', color: navy, size: 10 },
    ]);
    if (lines.length === 0) return;
    while (lines.length) {
      ensureSpace(76);
      const count = Math.min(lines.length, Math.max(1, Math.floor((y - 62 - 48) / 14)));
      const fragment = lines.splice(0, count);
      const height = 46 + fragment.length * 14;
      addRoundedRect(commands, 48, y - height, 516, height, 12, border);
      addRoundedRect(commands, 49, y - height + 1, 514, height - 2, 11, '1 1 1');
      addRoundedRect(commands, 49, y - 38, 514, 37, 11, pale);
      addRect(commands, 49, y - 38, 514, 10, pale);
      addRect(commands, 49, y - 38, 514, 1, border);
      addText(commands, section.title, 62, y - 25, 13, 'F2', navy);
      fragment.forEach((item, index) => addText(commands, item.text, 62, y - 55 - index * 14, item.size, item.font, item.color));
      y -= height + 16;
    }
  });
  if (data.footer) {
    ensureSpace(36);
    writeWrapped(data.footer, 48, 95, 8, 'F1', muted, 11);
  }

  // Objetos por pagina: pagina y contenido; las fuentes son compartidas.
  const pageIds = pages.map((_, index) => 5 + index * 2);
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    `2 0 obj\n<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`,
    '3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
  ];
  pages.forEach((page, index) => {
    const id = pageIds[index];
    const content = page.join('\n');
    objects.push(`${id} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${id + 1} 0 R >>\nendobj\n`);
    objects.push(`${id + 1} 0 obj\n<< /Length ${Buffer.byteLength(content, 'binary')} >>\nstream\n${content}\nendstream\nendobj\n`);
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, 'binary'));
    pdf += object;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'binary');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
};

/** Resumen de gastos del viaje; el detalle por gasto va en el CSV. */
export const generateBudgetSummaryPdf = async (summary: BudgetSummary): Promise<Buffer> => {
  const { group, totals } = summary;
  const dates = [group.fechaInicio, group.fechaFin].filter(Boolean).join(' a ');
  const generated = new Date(summary.generatedAt).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  const dateKey = summary.generatedAt.slice(0, 10).split('-').join('');

  const budgetLine =
    totals.budget === null
      ? 'Sin presupuesto definido'
      : `${formatPdfMoney(totals.budget)} (${totals.percentCommitted?.toFixed(1)}% usado)`;
  const availableLine =
    totals.available === null
      ? 'No aplica'
      : totals.available >= 0
        ? formatPdfMoney(totals.available)
        : `Excedido por ${formatPdfMoney(Math.abs(totals.available))}`;

  return buildBudgetSummaryPdf({
    title: 'Resumen de gastos',
    subtitle: group.nombre,
    folio: `RES-${group.id}-${dateKey}`,
    total: formatPdfMoney(totals.committed),
    summaryBudget: totals.budget === null ? 'Sin definir' : formatPdfMoney(totals.budget),
    authCode: String(totals.expenseCount),
    labels: { folio: 'Resumen', total: 'Total gastado', auth: 'Gastos' },
    footer: `Resumen generado el ${generated}. El detalle de cada gasto esta en la exportacion CSV.`,
    sections: [
      {
        title: 'Por integrante (saldo positivo = le deben)',
        lines: summary.byMember.map((member) => ({
          label: member.nombre?.trim() || `Integrante ${member.usuarioId}`,
          value: `Pago ${formatPdfMoney(member.paid)} | Le toca ${formatPdfMoney(member.share)} | Saldo ${member.balance >= 0 ? '+' : '-'}${formatPdfMoney(Math.abs(member.balance))}`,
        })),
      },
      {
        title: 'Viaje',
        lines: [
          { label: 'Nombre', value: group.nombre },
          { label: 'Destino', value: group.destino || 'Sin destino' },
          { label: 'Fechas', value: dates || 'Sin fechas' },
        ],
      },
      {
        title: 'Presupuesto',
        lines: [
          { label: 'Presupuesto', value: budgetLine },
          { label: 'Disponible', value: availableLine },
          { label: 'Pagos confirmados', value: formatPdfMoney(totals.confirmedPaymentsTotal) },
        ],
      },
      {
        title: 'Por categoria',
        lines: summary.byCategory
          .filter((item) => item.spent > 0 || item.planned !== null)
          .map((item) => ({
            label: item.label,
            value:
              item.planned !== null
                ? `${formatPdfMoney(item.spent)} de ${formatPdfMoney(item.planned)} planeado`
                : formatPdfMoney(item.spent),
          })),
      },

    ],
  });
};
