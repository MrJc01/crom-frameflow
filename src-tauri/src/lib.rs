
use serde::{Serialize, Deserialize};
use tauri::{Manager, Emitter}; // Import Manager and Emitter

#[derive(Serialize, Deserialize)]
pub struct VideoMetadata {
    width: u64,
    height: u64,
    duration: f64,
}

#[tauri::command]
fn get_video_metadata(path: String) -> Result<VideoMetadata, String> {
    // If path implies custom protocol or is relative, we might need adjustments.
    // Assuming absolute path for now (dropped from OS).
    // If it's a "frameflow://" url, we strip it.
    let clean_path = if path.starts_with("frameflow://") {
        let decoded = percent_encoding::percent_decode_str(&path.replace("frameflow://", ""))
            .decode_utf8_lossy()
            .to_string();
        decoded
    } else {
        path
    };

    match ffprobe::ffprobe(&clean_path) {
        Ok(info) => {
            // Find first video stream
            let video_stream = info.streams.iter().find(|s| s.codec_type == Some(String::from("video")));
            let format = info.format;

            let width = video_stream.and_then(|s| s.width).unwrap_or(0) as u64;
            let height = video_stream.and_then(|s| s.height).unwrap_or(0) as u64;
            
            // Duration can be in stream or format. Format is usually more reliable for container duration.
            let duration_str = format.duration.unwrap_or_else(|| String::from("0"));
            let duration: f64 = duration_str.parse().unwrap_or(0.0);

            Ok(VideoMetadata {
                width,
                height,
                duration,
            })
        },
        Err(e) => Err(format!("FFprobe failed: {}", e)),
    }
}

#[tauri::command]
fn save_project_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn close_splash(window: tauri::Window) {
  // Close splash screen
  if let Some(splash) = window.get_webview_window("splash") {
    splash.close().unwrap();
  }
  // Show main window
  if let Some(main) = window.get_webview_window("main") {
    main.show().unwrap();
  }
}

#[tauri::command]
async fn generate_proxy(input_path: String, output_path: String) -> Result<String, String> {
    // Basic scaling to 540p height (keeping aspect ratio)
    // ffmpeg -i input.mp4 -vf scale=-2:540 -c:v libx264 -preset ultrafast -crf 28 output.mp4
    let output = std::process::Command::new("ffmpeg")
        .args(&[
            "-i", &input_path,
            "-vf", "scale=-2:540",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "28",
            "-y", // Overwrite
            &output_path
        ])
        .output()
        .map_err(|e| format!("Failed to execute ffmpeg: {}", e))?;

    if output.status.success() {
        Ok(output_path)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("FFmpeg error: {}", stderr))
    }
}

#[tauri::command]
fn get_available_memory() -> u64 {
    use sysinfo::{System, SystemExt};
    let mut sys = System::new();
    sys.refresh_memory();
    sys.available_memory() // Returns bytes
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![get_video_metadata, save_project_file, close_splash, generate_proxy, get_available_memory])
    .register_uri_scheme_protocol("frameflow", |_app, request| {
      use std::io::{Seek, SeekFrom, Read};

      let url = request.uri().to_string();
      let path = url.replace("frameflow://", "");
      let path = percent_encoding::percent_decode_str(&path)
        .decode_utf8_lossy()
        .to_string();

      let file_path = std::path::PathBuf::from(&path);
      
      if !file_path.exists() {
         return tauri::http::Response::builder()
            .status(404)
            .body("File not found".as_bytes().to_vec())
            .unwrap();
      }

      // Get file size
      let len = match std::fs::metadata(&file_path) {
          Ok(m) => m.len(),
          Err(e) => return tauri::http::Response::builder().status(500).body(e.to_string().into_bytes()).unwrap(),
      };

      // Detect Mime Type
      let mime_type = if let Some(ext) = file_path.extension() {
          match ext.to_str().unwrap_or("").to_lowercase().as_str() {
              "png" => "image/png",
              "jpg" | "jpeg" => "image/jpeg",
              "mp4" => "video/mp4",
              "mp3" => "audio/mpeg",
              "wav" => "audio/wav",
              _ => "application/octet-stream"
          }
      } else {
          "application/octet-stream"
      };

      let mut file = match std::fs::File::open(&file_path) {
          Ok(f) => f,
          Err(e) => return tauri::http::Response::builder().status(500).body(e.to_string().into_bytes()).unwrap(),
      };

      // Check Range Header
      let range_header = request.headers().get("Range").and_then(|h| h.to_str().ok());

      if let Some(range_str) = range_header {
          // Parse "bytes=start-end" or "bytes=start-"
          if range_str.starts_with("bytes=") {
              let ranges: Vec<&str> = range_str["bytes=".len()..].split('-').collect();
              
              if ranges.len() >= 1 {
                  let start: u64 = ranges[0].parse().unwrap_or(0);
                  let end: u64 = if ranges.len() > 1 && !ranges[1].is_empty() {
                      ranges[1].parse().unwrap_or(len - 1)
                  } else {
                      len - 1
                  };
                  
                  // Clamp
                  let start = start.min(len - 1);
                  let end = end.min(len - 1);
                  
                  if start > end {
                       return tauri::http::Response::builder()
                          .status(416) // Range Not Satisfiable
                          .header("Content-Range", format!("bytes */{}", len))
                          .body(vec![])
                          .unwrap();
                  }

                  let chunk_size = end - start + 1;
                  let mut buffer = vec![0; chunk_size as usize];
                  
                  if let Err(e) = file.seek(SeekFrom::Start(start)) {
                      return tauri::http::Response::builder().status(500).body(e.to_string().into_bytes()).unwrap();
                  }
                  
                  if let Err(e) = file.read_exact(&mut buffer) {
                       return tauri::http::Response::builder().status(500).body(e.to_string().into_bytes()).unwrap(); 
                  }

                  return tauri::http::Response::builder()
                      .status(206)
                      .header("Content-Type", mime_type)
                      .header("Content-Range", format!("bytes {}-{}/{}", start, end, len))
                      .header("Content-Length", chunk_size.to_string())
                      .header("Access-Control-Allow-Origin", "*")
                      .header("Accept-Ranges", "bytes")
                      .body(buffer)
                      .unwrap();
              }
          }
      }

      // Full content fallback
      let mut content = Vec::new();
      if let Err(e) = file.read_to_end(&mut content) {
          return tauri::http::Response::builder().status(500).body(e.to_string().into_bytes()).unwrap();
      }

      tauri::http::Response::builder()
        .header("Access-Control-Allow-Origin", "*") 
        .header("Content-Type", mime_type)
        .header("Content-Length", len.to_string())
        .header("Accept-Ranges", "bytes")
        .body(content)
        .unwrap()
    })
    .setup(|app| {
      // --- Persistent Logger Setup ---
      use tauri_plugin_log::{Target, TargetKind};

      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .targets([
              Target::new(TargetKind::Stdout),
              Target::new(TargetKind::LogDir { file_name: Some("frameflow.log".into()) }),
              Target::new(TargetKind::Webview),
          ])
          .level(if cfg!(debug_assertions) { log::LevelFilter::Debug } else { log::LevelFilter::Info })
          .build(),
      )?;

      // --- Native Menu Setup ---
      use tauri::menu::{Menu, MenuItem, Submenu};
      
      let file_menu = Submenu::with_items(
          app.handle(),
          "File",
          true,
          &[
              &MenuItem::with_id(app.handle(), "new", "New Project", true, None::<&str>)?,
              &MenuItem::with_id(app.handle(), "open", "Open Project...", true, None::<&str>)?,
              &MenuItem::with_id(app.handle(), "save", "Save", true, None::<&str>)?,
              &MenuItem::with_id(app.handle(), "save_as", "Save As...", true, None::<&str>)?,
              &MenuItem::with_id(app.handle(), "export", "Export...", true, None::<&str>)?,
              &MenuItem::with_id(app.handle(), "exit", "Exit", true, None::<&str>)?,
          ],
      )?;

      let edit_menu = Submenu::with_items(
          app.handle(),
          "Edit",
          true,
          &[
              &MenuItem::with_id(app.handle(), "undo", "Undo", true, None::<&str>)?,
              &MenuItem::with_id(app.handle(), "redo", "Redo", true, None::<&str>)?,
              &MenuItem::with_id(app.handle(), "cut", "Cut", true, None::<&str>)?,
              &MenuItem::with_id(app.handle(), "copy", "Copy", true, None::<&str>)?,
              &MenuItem::with_id(app.handle(), "paste", "Paste", true, None::<&str>)?,
          ],
      )?;

      let view_menu = Submenu::with_items(
          app.handle(),
          "View",
          true,
          &[
              &MenuItem::with_id(app.handle(), "zoom_in", "Zoom In", true, None::<&str>)?,
              &MenuItem::with_id(app.handle(), "zoom_out", "Zoom Out", true, None::<&str>)?,
              &MenuItem::with_id(app.handle(), "fit", "Fit to Screen", true, None::<&str>)?,
          ],
      )?;

       let menu = Menu::with_items(app.handle(), &[
          &file_menu,
          &edit_menu,
          &view_menu
      ])?;

      app.set_menu(menu)?;

      app.on_menu_event(|app, event| {
         // Emit event to frontend
         let _ = app.emit("menu-event", event.id().as_str());
      });

      // --- Tray Icon Setup ---
      use tauri::tray::{TrayIconBuilder, TrayIconEvent};
      
      let quit_i = MenuItem::with_id(app.handle(), "quit", "Quit", true, None::<&str>)?;
      let show_i = MenuItem::with_id(app.handle(), "show", "Show", true, None::<&str>)?;
      let tray_menu = Menu::with_items(app.handle(), &[&show_i, &quit_i])?;

      TrayIconBuilder::new()
        .menu(&tray_menu)
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "quit" => {
                    app.exit(0);
                }
                "show" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
