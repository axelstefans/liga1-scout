import { toPng, toBlob } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { EXPORT_PIXEL_RATIO } from '../components/scouting/scoutingConstants';

export interface ExportScoutingOptions {
  targetElement: HTMLElement;
  playerName: string;
  teamName?: string | null;
  pixelRatio?: number;
  backgroundColor?: string;
}

export interface ExportCursorSnapshot {
  originalTargetCursor: string;
  originalBodyCursor: string;
}

export const shouldIncludeExportNode = (node: Node): boolean => {
  if (node instanceof HTMLElement && node.classList.contains('export-ignore')) {
    return false;
  }
  return true;
};

export const prepareExportCanvas = async (
  targetElement: HTMLElement
): Promise<ExportCursorSnapshot> => {
  const snapshot: ExportCursorSnapshot = {
    originalTargetCursor: targetElement.style.cursor,
    originalBodyCursor: document.body.style.cursor,
  };
  targetElement.style.cursor = 'none';
  document.body.style.cursor = 'none';

  await document.fonts.ready;
  await new Promise((resolve) => setTimeout(resolve, 60));

  return snapshot;
};

export const restoreExportCanvas = (
  targetElement: HTMLElement,
  snapshot: ExportCursorSnapshot
): void => {
  targetElement.style.cursor = snapshot.originalTargetCursor;
  document.body.style.cursor = snapshot.originalBodyCursor;
};

export const buildScoutingExportFilename = (
  playerName: string,
  teamName: string | null | undefined,
  ext: 'png' | 'pdf'
): string => {
  const cleanPlayer = playerName.trim().replace(/\s+/g, '_');
  const cleanTeam = (teamName || 'Liga1').trim().replace(/\s+/g, '_');
  return `Scouting_Report_${cleanPlayer}_${cleanTeam}.${ext}`;
};

export async function exportScoutingReportPNG({
  targetElement,
  playerName,
  teamName,
  pixelRatio: requestedRatio = EXPORT_PIXEL_RATIO,
  backgroundColor = '#f8fafc',
}: ExportScoutingOptions): Promise<void> {
  const snapshot = await prepareExportCanvas(targetElement);

  try {
    const captureWidth = Math.ceil(Math.max(targetElement.scrollWidth, targetElement.offsetWidth));
    const captureHeight = Math.ceil(Math.max(targetElement.scrollHeight, targetElement.offsetHeight));

    // Guard: Ensure dimensions stay within browser canvas limits (16k max side, 100MP max area)
    let pixelRatio = requestedRatio;
    const MAX_SIDE = 16384;
    const MAX_AREA = 100_000_000;

    if (
      captureWidth * pixelRatio > MAX_SIDE ||
      captureHeight * pixelRatio > MAX_SIDE ||
      captureWidth * pixelRatio * captureHeight * pixelRatio > MAX_AREA
    ) {
      const maxRatioSide = Math.min(MAX_SIDE / captureWidth, MAX_SIDE / captureHeight);
      const maxRatioArea = Math.sqrt(MAX_AREA / (captureWidth * captureHeight));
      pixelRatio = Math.max(1, Math.min(pixelRatio, maxRatioSide, maxRatioArea));
    }

    const blob = await toBlob(targetElement, {
      pixelRatio,
      cacheBust: true,
      backgroundColor,
      width: captureWidth,
      height: captureHeight,
      style: {
        cursor: 'none',
        width: `${captureWidth}px`,
        minWidth: `${captureWidth}px`,
        maxWidth: `${captureWidth}px`,
        height: `${captureHeight}px`,
        minHeight: `${captureHeight}px`,
        maxHeight: `${captureHeight}px`,
        margin: '0',
        transform: 'none',
      },
      filter: shouldIncludeExportNode,
    });

    if (!blob) {
      throw new Error('Failed to generate image blob');
    }

    // Verification: decode image bitmap and confirm dimensions match expectations
    try {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(blob);
        const expectedWidth = Math.round(captureWidth * pixelRatio);
        const expectedHeight = Math.round(captureHeight * pixelRatio);
        if (bitmap.width !== expectedWidth || bitmap.height !== expectedHeight) {
          console.warn(
            `[Export PNG] Bitmap dimension mismatch: captured ${bitmap.width}x${bitmap.height}, expected ${expectedWidth}x${expectedHeight}`
          );
        }
        bitmap.close();
      }
    } catch {
      // createImageBitmap verification is non-blocking
    }

    const filename = buildScoutingExportFilename(playerName, teamName, 'png');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    restoreExportCanvas(targetElement, snapshot);
  }
}

export async function exportScoutingReportPDF({
  targetElement,
  playerName,
  teamName,
  pixelRatio = EXPORT_PIXEL_RATIO,
  backgroundColor = '#f8fafc',
}: ExportScoutingOptions): Promise<void> {
  const snapshot = await prepareExportCanvas(targetElement);

  try {
    const fullHeight = Math.max(
      targetElement.scrollHeight,
      targetElement.offsetHeight,
      targetElement.clientHeight
    );
    const fullWidth = Math.max(
      targetElement.scrollWidth,
      targetElement.offsetWidth,
      targetElement.clientWidth
    );

    const dataUrl = await toPng(targetElement, {
      pixelRatio,
      cacheBust: true,
      backgroundColor,
      width: fullWidth,
      height: fullHeight,
      style: {
        cursor: 'none',
        width: `${fullWidth}px`,
        height: `${fullHeight}px`,
        maxHeight: 'none',
        overflow: 'visible',
      },
      filter: shouldIncludeExportNode,
    });

    // Calculate exact image properties from captured bitmap
    const dummyPdf = new jsPDF({ unit: 'mm' });
    const imgProps = dummyPdf.getImageProperties(dataUrl);

    // Fit 297mm width and scale height dynamically to match entire bitmap aspect ratio
    const pdfWidth = 297;
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    const pdf = new jsPDF({
      orientation: pdfHeight > pdfWidth ? 'portrait' : 'landscape',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });

    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'SLOW');

    const filename = buildScoutingExportFilename(playerName, teamName, 'pdf');
    pdf.save(filename);
  } finally {
    restoreExportCanvas(targetElement, snapshot);
  }
}
