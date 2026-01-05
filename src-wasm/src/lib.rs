use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct LutData {
    size: i32,
    data: Vec<f32>,
}

#[wasm_bindgen]
impl LutData {
    #[wasm_bindgen(getter)]
    pub fn size(&self) -> i32 {
        self.size
    }

    #[wasm_bindgen(getter)]
    pub fn data(&self) -> Vec<f32> {
        self.data.clone()
    }
}

#[wasm_bindgen]
pub fn parse_cube(content: &str) -> Result<LutData, JsValue> {
    let mut size = 0;
    let mut data = Vec::new();
    let lines = content.lines();

    let mut data_index = 0;
    let mut initialized = false;

    for line in lines {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') || line.starts_with("TITLE") || line.starts_with("DOMAIN_") {
            continue;
        }

        if line.starts_with("LUT_3D_SIZE") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 2 {
                return Err(JsValue::from_str("Invalid LUT_3D_SIZE"));
            }
            size = parts[1].parse::<i32>().map_err(|_| JsValue::from_str("Invalid size"))?;
            let total_points = (size * size * size) as usize;
            data = vec![0.0; total_points * 4];
            initialized = true;
            continue;
        }

        if initialized {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                if let (Ok(r), Ok(g), Ok(b)) = (parts[0].parse::<f32>(), parts[1].parse::<f32>(), parts[2].parse::<f32>()) {
                     if data_index < data.len() / 4 {
                        data[data_index * 4 + 0] = r;
                        data[data_index * 4 + 1] = g;
                        data[data_index * 4 + 2] = b;
                        data[data_index * 4 + 3] = 1.0;
                        data_index += 1;
                     }
                }
            }
        }
    }

    if !initialized || size == 0 {
         return Err(JsValue::from_str("Invalid .cube file: size or data missing"));
    }

    Ok(LutData { size, data })
}
