import { GoogleGenAI, Type } from "@google/genai";
import { Student } from "../types";

// Initialize Gemini client
// Note: In a real production app, you should proxy this through a backend to protect the key.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-2.5-flash";

/**
 * Identifies students in a classroom frame by comparing them with reference photos.
 */
export const identifyStudentsInFrame = async (
  frameBase64: string,
  students: Student[]
): Promise<string[]> => {
  // 1. Validation
  if (!students || students.length === 0) return [];
  
  // Basic check for empty frame or very short string
  if (!frameBase64 || frameBase64.length < 100) {
     console.warn("Frame ảnh quá nhỏ hoặc bị lỗi.");
     return [];
  }

  try {
    // 2. Prepare Data
    const cleanFrame = frameBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    
    // Filter valid students only (must have photo data)
    const validStudents = students.filter(s => s.referencePhoto && s.referencePhoto.length > 100);
    
    if (validStudents.length === 0) {
      console.warn("Không có học sinh nào có ảnh hợp lệ.");
      return [];
    }

    const parts: any[] = [];

    // --- PART A: SCENE IMAGE ---
    // The first image is always the Classroom Frame (Context)
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: cleanFrame,
      },
    });

    // --- PART B: REFERENCE IMAGES ---
    // We add all reference images continuously.
    // Grouping images together is more efficient and less error-prone for the API than interleaving text/images.
    
    let mappingDescription = "Danh sách ảnh tham chiếu (Reference Images):\n";

    validStudents.forEach((student, index) => {
      const cleanRef = student.referencePhoto.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
      
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanRef,
        },
      });

      // Note: The parts array is 0-indexed. 
      // index 0 = Scene Image.
      // index 1 = First Student (which is validStudents[0]).
      // So student at index `i` corresponds to image at parts index `i + 1`.
      // Let's use 1-based indexing for the prompt description to be clear for the model.
      // Scene is Image 1. First student is Image 2.
      mappingDescription += `- Ảnh thứ ${index + 2}: ID "${student.id}" (Tên: ${student.name})\n`;
    });

    // --- PART C: INSTRUCTION PROMPT ---
    // Single text block at the end describing the task.
    const prompt = `
      Nhiệm vụ: Điểm danh học sinh trong lớp.
      
      Ảnh 1 (đầu tiên) là "Ảnh Lớp Học" (Scene) chứa nhiều người.
      Các ảnh còn lại (từ Ảnh 2 trở đi) là "Ảnh Chân Dung Mẫu" của từng học sinh cần tìm.
      
      ${mappingDescription}
      
      Yêu cầu xử lý:
      1. Tìm tất cả các khuôn mặt xuất hiện trong "Ảnh 1" (Scene).
      2. So sánh từng khuôn mặt tìm được với các "Ảnh Chân Dung Mẫu" được cung cấp.
      3. Nếu khuôn mặt trong "Ảnh 1" khớp với bất kỳ ảnh mẫu nào, hãy ghi nhận ID tương ứng.
      
      Trả về:
      Một mảng JSON chứa danh sách các ID duy nhất đã tìm thấy.
      Ví dụ: ["id_hocsinh_A", "id_hocsinh_B"]
      Nếu không tìm thấy ai khớp, trả về mảng rỗng [].
    `;

    parts.push({ text: prompt });

    // 3. Call API
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: parts,
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
      },
    });

    const jsonText = response.text;
    if (!jsonText) return [];

    return JSON.parse(jsonText);

  } catch (error) {
    console.error("Lỗi khi gọi Gemini:", error);
    // Rethrow so the UI can show the error message
    throw error;
  }
};