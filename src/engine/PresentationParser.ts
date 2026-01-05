import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export interface ParsedSlide {
  id: string;
  index: number;
  previewUrl?: string; // Blob URL of the background or thumbnail
  title?: string;
  elements?: ParsedElement[];
}

export interface ParsedElement {
    type: 'image' | 'text';
    content: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}

export class PresentationParser {
  private parser: XMLParser;
  private zip: JSZip | null = null;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
  }

  async parsePPTX(file: File): Promise<ParsedSlide[]> {
    try {
        this.zip = await JSZip.loadAsync(file);
        const slideFiles = this.findSlideFiles();

        const slides: ParsedSlide[] = [];

        for (let i = 0; i < slideFiles.length; i++) {
            const slidePath = slideFiles[i];
            const slideNumber = i + 1;
            
            // 1. Get Preview Image (Background or First Image)
            const previewUrl = await this.extractSlidePreview(slidePath);
            
            // 2. Parse basic elements (Future work: extract text/layout)
            const elements = await this.extractSlideElements(slidePath);

            slides.push({
                id: `slide-${slideNumber}`,
                index: slideNumber,
                previewUrl: previewUrl,
                title: `Slide ${slideNumber}`,
                elements: elements
            });
        }

        return slides;
    } catch (e) {
        console.error("PresentationParsing Error:", e);
        throw new Error("Failed to parse presentation.");
    } finally {
        // Cleanup if needed? JSZip doesn't really need close.
    }
  }

  private findSlideFiles(): string[] {
      if (!this.zip) return [];
      
      const slideFiles = Object.keys(this.zip.files).filter(path => 
        path.match(/ppt\/slides\/slide\d+\.xml/)
      );

      // Numeric Sort
      return slideFiles.sort((a, b) => {
          const numA = parseInt(a.match(/slide(\d+)\.xml/)![1]);
          const numB = parseInt(b.match(/slide(\d+)\.xml/)![1]);
          return numA - numB;
      });
  }

  private async extractSlidePreview(slidePath: string): Promise<string | undefined> {
      if (!this.zip) return undefined;

      const relsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
      if (!this.zip.files[relsPath]) return undefined;

      try {
        const relsXml = await this.zip.files[relsPath].async('string');
        const rels = this.parser.parse(relsXml);
        
        const relationships = rels.Relationships.Relationship;
        const relsArray = Array.isArray(relationships) ? relationships : [relationships];

        // Find image relationships
        const imageRels = relsArray.filter((r: any) => 
            r['@_Target'] && r['@_Target'].match(/\.(png|jpg|jpeg|gif)$/i)
        );

        if (imageRels.length > 0) {
            // MVP: Grab the first image as preview
            let target = imageRels[0]['@_Target'];
            const resolvedPath = this.resolvePath(target);
            
            if (this.zip.files[resolvedPath]) {
                const imgBlob = await this.zip.files[resolvedPath].async('blob');
                return URL.createObjectURL(imgBlob);
            }
        }
      } catch (e) {
          console.warn(`Failed to extract preview for ${slidePath}`, e);
      }
      return undefined;
  }

  private async extractSlideElements(slidePath: string): Promise<ParsedElement[]> {
      // Stub for future element parsing (Text, custom shapes)
      return [];
  }

  private resolvePath(target: string): string {
      // Targets are usually relative to the relationship file, e.g. "../media/image1.png"
      // Or they might be absolute in the zip context?
      // PPTX structure usually: ppt/slides/_rels/slide1.xml.rels
      // Relative path: "../media/image1.png" -> ppt/media/image1.png
      
      if (target.startsWith('../')) {
          return target.replace('../', 'ppt/');
      }
      return target;
  }
}
