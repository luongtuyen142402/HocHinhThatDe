
import { GoogleGenAI, Type } from "@google/genai";
import { GeometryData } from "../types";

// Define the response schema for Gemini
const geometrySchema = {
  type: Type.OBJECT,
  properties: {
    points: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          x: { type: Type.NUMBER, description: "X coordinate." },
          y: { type: Type.NUMBER, description: "Y coordinate" },
          z: { type: Type.NUMBER, description: "Z coordinate (0 for 2D)" },
          label: { type: Type.STRING, description: "Point label (A, B, C)" },
          color: { type: Type.STRING, description: "Hex color." }
        },
        required: ["id", "x", "y", "z"]
      }
    },
    edges: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          from: { type: Type.STRING, description: "ID of start point" },
          to: { type: Type.STRING, description: "ID of end point" },
          color: { type: Type.STRING, description: "Hex color" },
          label: { type: Type.STRING, description: "Length label" },
          marker: { type: Type.STRING, enum: ["tick", "double-tick", "arrow", "double-arrow"], description: "Symbol for equality or parallel" }
        },
        required: ["id", "from", "to"]
      }
    },
    faces: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          pointIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          color: { type: Type.STRING, description: "Hex color" },
          opacity: { type: Type.NUMBER }
        },
        required: ["id", "pointIds"]
      }
    },
    angles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          centerId: { type: Type.STRING, description: "ID of the vertex point" },
          arm1Id: { type: Type.STRING, description: "ID of point on first arm" },
          arm2Id: { type: Type.STRING, description: "ID of point on second arm" },
          type: { type: Type.STRING, enum: ["right", "arc", "double-arc"] },
          label: { type: Type.STRING, description: "Label like '60°' or 'x'" }
        },
        required: ["id", "centerId", "arm1Id", "arm2Id", "type"]
      }
    },
    circles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          centerId: { type: Type.STRING, description: "ID of the center point" },
          radius: { type: Type.NUMBER, description: "Radius length in geometry units" },
          color: { type: Type.STRING, description: "Hex color" },
          label: { type: Type.STRING, description: "Label for the circle (e.g., '(O)')" },
          isDashed: { type: Type.BOOLEAN, description: "True if part of the circle is hidden/3D dashed line" }
        },
        required: ["id", "centerId", "radius"]
      }
    },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stepNumber: { type: Type.INTEGER },
          description: { type: Type.STRING, description: "Vietnamese explanation" },
          activeElementIds: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["stepNumber", "description", "activeElementIds"]
      }
    },
    reasoning: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING, description: "Câu hỏi định hướng/Gợi ý suy luận." },
          answer: { type: Type.STRING, description: "Giải thích ngắn gọn." }
        },
        required: ["id", "question", "answer"]
      },
      description: "Step-by-step backward reasoning logic (Text only)"
    },
    type: { type: Type.STRING, enum: ["2D", "3D"] },
    message: { type: Type.STRING, description: "Friendly message from the AI tutor" },
    mathSolution: { type: Type.STRING, description: "Detailed solution (Markdown)" }
  },
  required: ["points", "edges", "steps", "type"]
};

const SYSTEM_INSTRUCTION = `
Bạn là "Gia Sư Toán THCS" chuyên nghiệp, am hiểu sâu sắc chương trình Toán lớp 6, 7, 8, 9 của Việt Nam.

**YÊU CẦU QUAN TRỌNG VỀ NGÔN NGỮ:**
1. **Ngôn ngữ chuẩn mực:** Sử dụng thuật ngữ toán học chính thống (Ví dụ: "Xét tam giác ABC", "Ta có", "Suy ra", "Mà", "Theo định lý Py-ta-go", "Theo tính chất đường trung tuyến", "Chứng minh tương tự").
2. **Ký hiệu toán học:** Sử dụng các ký hiệu chuẩn trong phần 'mathSolution' như ∆ABC, ∠ABC hoặc $\\widehat{ABC}$, ⊥, ∥, ≡, ∽.
3. **Cấu trúc trình bày:** Lời giải phải được trình bày theo phong cách sư phạm Việt Nam:
   - Có lập luận logic từng bước.
   - Trích dẫn định lý/tính chất làm căn cứ trong ngoặc đơn.
   - Kết luận rõ ràng cho từng ý hỏi (a, b, c...).

**NHIỆM VỤ:**
1. **Vẽ hình (Geometry):** 
    - Tạo hình vẽ chính xác, tỷ lệ chuẩn.
    - Gắn nhãn điểm đầy đủ (A, B, C...).
2. **Phân tích gợi ý (Reasoning):** Đưa ra câu hỏi định hướng để học sinh tự tư duy thay vì xem lời giải ngay.
3. **Lời giải chi tiết (mathSolution):** Trình bày bài giải hoàn chỉnh bằng ngôn ngữ toán học chuẩn mực nhất.

**HƯỚNG DẪN VẼ HÌNH TRÒN:**
- Xác định tâm và bán kính phù hợp trong hệ tọa độ sao cho hình vẽ cân đối.

**PHONG CÁCH:** Nghiêm túc nhưng thân thiện, hỗ trợ tối đa cho học sinh (đặc biệt là vùng khó khăn).
`;

export const generateGeometry = async (prompt: string, history: string = "", imageBase64?: string): Promise<GeometryData> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const parts: any[] = [{ text: `Lịch sử chat:\n${history}\n\nYêu cầu mới của học sinh: ${prompt}` }];
    
    if (imageBase64) {
      const base64Data = imageBase64.includes('base64,') 
        ? imageBase64.split('base64,')[1] 
        : imageBase64;
        
      parts.push({
        inlineData: {
          mimeType: "image/jpeg", 
          data: base64Data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts: parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: geometrySchema,
        temperature: 0.1, 
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const parsed = JSON.parse(text) as GeometryData;
    
    return {
      points: parsed.points || [],
      edges: parsed.edges || [],
      faces: parsed.faces || [],
      angles: parsed.angles || [],
      circles: parsed.circles || [],
      steps: parsed.steps || [],
      reasoning: parsed.reasoning || [],
      type: parsed.type || '2D',
      message: parsed.message,
      mathSolution: parsed.mathSolution
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw error;
  }
};
