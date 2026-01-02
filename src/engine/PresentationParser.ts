import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

export interface ParsedSlide {
  id: string;
  index: number;
  previewUrl?: string; // Blob URL of the background or thumbnail
  title?: string;
}

export class PresentationParser {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_"
    });
  }

  async parsePPTX(file: File): Promise<ParsedSlide[]> {
    const zip = await JSZip.loadAsync(file);
    const slides: ParsedSlide[] = [];

    // 1. Read [Content_Types].xml to find slides? 
    // Or just look for ppt/slides/slideX.xml structure which is standard.
    
    // Find all slide files
    const slideFiles = Object.keys(zip.files).filter(path => 
      path.match(/ppt\/slides\/slide\d+\.xml/)
    );

    // Sort by number (slide1, slide2, ..., slide10 - needs numeric sort)
    slideFiles.sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml/)![1]);
        const numB = parseInt(b.match(/slide(\d+)\.xml/)![1]);
        return numA - numB;
    });

    console.log(`Found ${slideFiles.length} slides`);

    // 2. Extract relationships to find images
    // slide1.xml.rels contains links to images
    
    for (let i = 0; i < slideFiles.length; i++) {
        const slidePath = slideFiles[i];
        const relsPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
        
        let backgroundUrl = undefined;

        // Try to find background image in relationships
        if (zip.files[relsPath]) {
            const relsXml = await zip.files[relsPath].async('string');
            const rels = this.parser.parse(relsXml);
            
            // Look for image relationships
            const relationships = rels.Relationships.Relationship;
            const relsArray = Array.isArray(relationships) ? relationships : [relationships];
            
            // Filter for images. Usually used in blipFill -> blip -> embed
            // We need to parse the slide XML to see WHICH r:id is the background.
            // But for a quick hack, let's just grab the FIRST image? 
            // Or maybe look for the biggest image?
            // PPTX often stores background in the slideLayout, not the slide itself if it's master based.
            // But let's check for direct images.
            
            // For MVP: Let's extract specific valid image extensions
            const imageRels = relsArray.filter((r: any) => 
                r['@_Target'].match(/\.(png|jpg|jpeg|gif)$/i)
            );

            if (imageRels.length > 0) {
                // Take the first one for now (often the background or main visual)
                // We need to resolve the path. relative to ppt/slides/
                // Target is usually "../media/image1.png"
                let target = imageRels[0]['@_Target'];
                if (target.startsWith('../')) {
                    target = target.replace('../', 'ppt/');
                }

                if (zip.files[target]) {
                    const imgBlob = await zip.files[target].async('blob');
                    backgroundUrl = URL.createObjectURL(imgBlob);
                }
            }
        }

        // If no image found in slide, maybe it's using a layout?
        // Skip for now.
        
        // If we still have no image, let's create a placeholder text
        // Parse slide XML for text?
        // const slideXml = await zip.files[slidePath].async('string');
        // ...

        slides.push({
            id: `slide-${i + 1}`,
            index: i + 1,
            previewUrl: backgroundUrl,
            title: `Slide ${i + 1}`
        });
    }

    return slides;
  }
}
