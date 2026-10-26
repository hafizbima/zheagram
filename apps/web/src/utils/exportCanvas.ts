import { DocumentStore } from '@diagrammer/engine';

export interface ExportArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function exportToJson(documentStore: DocumentStore, title: string = 'diagram'): void {
  const state = documentStore.getState();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `${slugify(title)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportToSvg(
  svgElement: SVGSVGElement | null,
  title: string = 'diagram',
  area?: ExportArea
): void {
  if (!svgElement) return;

  const viewport = getExportViewport(svgElement, area);
  const source = serializeSvg(svgElement, viewport, true);

  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  const downloadLink = document.createElement('a');
  downloadLink.href = svgUrl;
  downloadLink.download = `${slugify(title)}.svg`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(svgUrl);
}

export async function exportToPng(
  svgElement: SVGSVGElement | null,
  title: string = 'diagram',
  scale: number = 2,
  area?: ExportArea
): Promise<void> {
  if (!svgElement) return;

  const viewport = getExportViewport(svgElement, area);
  const svgString = serializeSvg(svgElement, viewport, false);

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.crossOrigin = 'anonymous';

  return new Promise((resolve, reject) => {
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.area.width * scale));
        canvas.height = Math.max(1, Math.round(viewport.area.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          return reject(new Error('Canvas context not available'));
        }

        // Draw background
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the selected viewport at the requested output scale.
        ctx.drawImage(
          img,
          -viewport.area.x * scale,
          -viewport.area.y * scale,
          viewport.width * scale,
          viewport.height * scale
        );
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('Blob conversion failed'));
          const pngUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = pngUrl;
          link.download = `${slugify(title)}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(pngUrl);
          resolve();
        }, 'image/png');
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };

    img.src = url;
  });
}

interface ExportViewport {
  width: number;
  height: number;
  area: ExportArea;
}

function getExportViewport(svgElement: SVGSVGElement, requestedArea?: ExportArea): ExportViewport {
  const rect = svgElement.getBoundingClientRect();
  const width = Math.max(1, rect.width || svgElement.clientWidth || 1);
  const height = Math.max(1, rect.height || svgElement.clientHeight || 1);

  if (!requestedArea) {
    return {
      width,
      height,
      area: { x: 0, y: 0, width, height },
    };
  }

  const x = Math.max(0, Math.min(width, requestedArea.x - rect.left));
  const y = Math.max(0, Math.min(height, requestedArea.y - rect.top));
  const right = Math.max(x, Math.min(width, requestedArea.x - rect.left + requestedArea.width));
  const bottom = Math.max(y, Math.min(height, requestedArea.y - rect.top + requestedArea.height));

  return {
    width,
    height,
    area: {
      x,
      y,
      width: Math.max(1, right - x),
      height: Math.max(1, bottom - y),
    },
  };
}

function serializeSvg(
  svgElement: SVGSVGElement,
  viewport: ExportViewport,
  cropToArea: boolean
): string {
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);
  const openingTagMatch = source.match(/^<svg\b[^>]*>/);
  if (!openingTagMatch) return source;

  let openingTag = openingTagMatch[0];
  if (!/\sxmlns=/.test(openingTag)) {
    openingTag = openingTag.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const viewBox = cropToArea
    ? viewport.area
    : { x: 0, y: 0, width: viewport.width, height: viewport.height };
  const outputWidth = cropToArea ? viewport.area.width : viewport.width;
  const outputHeight = cropToArea ? viewport.area.height : viewport.height;

  openingTag = openingTag
    .replace(/\s(width|height|viewBox)="[^"]*"/g, '')
    .replace(
      '>',
      ` width="${outputWidth}" height="${outputHeight}" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}">`
    );

  const background = `<rect x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}" fill="#f8fafc"/>`;
  const fontFamily = getExportFontFamily(svgElement);
  const fontStyle = `<style type="text/css"><![CDATA[text, tspan { font-family: ${fontFamily}; }]]></style>`;
  return source.replace(openingTagMatch[0], `${openingTag}${fontStyle}${background}`);
}

function getExportFontFamily(svgElement: SVGSVGElement): string {
  const textElement = svgElement.querySelector('text');
  if (textElement && typeof window !== 'undefined') {
    const computedFontFamily = window.getComputedStyle(textElement).fontFamily;
    if (computedFontFamily) return computedFontFamily;
  }

  return "'Inter', system-ui, -apple-system, sans-serif";
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
}
