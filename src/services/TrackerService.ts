
export interface Point {
    x: number;
    y: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class TrackerService {
    // Template Matching (SSD)
    // Runs on ImageData (CPU) - simple and robust enough for basic high-contrast tracking.
    
    static track(
        frame: ImageData, 
        prevFrame: ImageData | null, 
        roi: Rect
    ): Rect {
        if (!prevFrame) return roi;
        return this.templateMatch(frame, prevFrame, roi);
    }

    private static templateMatch(
        currentFrame: ImageData,
        prevFrame: ImageData,
        prevRoi: Rect
    ): Rect {
        const { width, height, data } = currentFrame;
        const searchMargin = 20; // How far to search
        
        // Clamp ROI
        const rx = Math.max(0, Math.floor(prevRoi.x));
        const ry = Math.max(0, Math.floor(prevRoi.y));
        const rw = Math.min(width - rx, Math.floor(prevRoi.width));
        const rh = Math.min(height - ry, Math.floor(prevRoi.height));
        
        if (rw <= 0 || rh <= 0) return prevRoi;

        // Extract Template from Previous Frame
        // Optimization: Could pass template directly instead of prevFrame.
        // For now, extract from prevFrame.
        
        // Search Area
        const sx = Math.max(0, rx - searchMargin);
        const sy = Math.max(0, ry - searchMargin);
        const sw = Math.min(width - sx, rw + searchMargin * 2);
        const sh = Math.min(height - sy, rh + searchMargin * 2);
        
        let bestX = rx;
        let bestY = ry;
        let minSsd = Infinity; // Lower is better
        
        // Loop through Search Area
        for (let y = sy; y <= sy + sh - rh; y++) {
            for (let x = sx; x <= sx + sw - rw; x++) {
                
                let ssd = 0;
                let stop = false;
                
                // Compare with Template (at rx, ry in prevFrame)
                for (let ty = 0; ty < rh; ty += 2) { // Skip pixels for speed
                   for (let tx = 0; tx < rw; tx += 2) {
                       const pIdx = ((ry + ty) * width + (rx + tx)) * 4;
                       const cIdx = ((y + ty) * width + (x + tx)) * 4;
                       
                       const dr = prevFrame.data[pIdx] - data[cIdx];
                       const dg = prevFrame.data[pIdx+1] - data[cIdx+1];
                       const db = prevFrame.data[pIdx+2] - data[cIdx+2];
                       
                       ssd += dr*dr + dg*dg + db*db;
                       
                       // Early Exit
                       if (ssd > minSsd) {
                           stop = true;
                           break;
                       }
                   }
                   if (stop) break;
                }
                
                if (ssd < minSsd) {
                    minSsd = ssd;
                    bestX = x;
                    bestY = y;
                }
            }
        }
        
        return {
            x: bestX,
            y: bestY,
            width: rw,
            height: rh
        };
    }
}
