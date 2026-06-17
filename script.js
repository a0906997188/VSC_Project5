// ==========================================
// 1. 取得畫面上的 HTML 元素 (DOM 元素)
// ==========================================
const radioText = document.querySelector('input[value="text"]');
const radioPdf = document.querySelector('input[value="pdf"]');
const textInputArea = document.getElementById('textInputArea');
const pdfInputArea = document.getElementById('pdfInputArea');
const apiKeyInput = document.getElementById('apiKeyInput');
const textInput = document.getElementById('textInput');
const pdfUpload = document.getElementById('pdfUpload');
const pdfStatus = document.getElementById('pdfStatus');
const pdfExtractedText = document.getElementById('pdfExtractedText');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingMsg = document.getElementById('loadingMsg');
const resultSection = document.getElementById('resultSection');
const resultContent = document.getElementById('resultContent');

// 從 LocalStorage 載入之前儲存的 API Key (如果有)
if (localStorage.getItem('savedGeminiApiKey')) {
    apiKeyInput.value = localStorage.getItem('savedGeminiApiKey');
}

// ==========================================
// 2. 事件監聽：切換「貼上文字」與「上傳 PDF」
// ==========================================
radioText.addEventListener('change', () => {
    if (radioText.checked) {
        textInputArea.style.display = 'block'; // 顯示文字輸入框
        pdfInputArea.style.display = 'none';   // 隱藏 PDF 上傳區
    }
});

radioPdf.addEventListener('change', () => {
    if (radioPdf.checked) {
        textInputArea.style.display = 'none';  // 隱藏文字輸入框
        pdfInputArea.style.display = 'block';  // 顯示 PDF 上傳區
    }
});

// ==========================================
// 3. 事件監聽：處理 PDF 檔案上傳與解析
// ==========================================
pdfUpload.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        pdfStatus.textContent = '❌ 請上傳 PDF 格式的檔案！';
        return;
    }

    pdfStatus.textContent = '⏳ 正在讀取 PDF 內容...';
    pdfExtractedText.value = ''; // 清空先前的內容

    try {
        // 使用 FileReader 讀取檔案轉換為 ArrayBuffer
        const reader = new FileReader();
        reader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            
            // 呼叫 PDF.js 解析文件
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = '';
            
            // 逐頁讀取文字
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }
            
            pdfExtractedText.value = fullText;
            pdfStatus.className = 'status-msg';
            pdfStatus.textContent = `✅ PDF 讀取成功！共 ${pdf.numPages} 頁。`;
        };
        reader.readAsArrayBuffer(file);
    } catch (error) {
        console.error("PDF 解析錯誤:", error);
        pdfStatus.className = 'status-msg error';
        pdfStatus.textContent = '❌ PDF 讀取失敗，請確認檔案是否損壞。';
    }
});

// ==========================================
// 4. 核心功能：開始分析按鈕點擊事件
// ==========================================
analyzeBtn.addEventListener('click', async () => {
    // 取得使用者輸入的 API Key
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert("請先填寫你的 Google Gemini API Key！");
        return;
    }

    // 儲存 API Key 到 LocalStorage，方便下次使用
    localStorage.setItem('savedGeminiApiKey', apiKey);

    // 取得文章內容
    let sourceText = "";
    if (radioText.checked) {
        sourceText = textInput.value.trim();
    } else {
        sourceText = pdfExtractedText.value.trim();
    }

    if (!sourceText) {
        alert("請輸入文章內容或上傳成功解析的 PDF 檔案！");
        return;
    }

    // 取得使用者勾選的功能
    const checkboxes = document.querySelectorAll('input[name="feature"]:checked');
    if (checkboxes.length === 0) {
        alert("請至少選擇一項分析功能！");
        return;
    }

    // 組合給 AI 的指令 (Prompt)
    let prompt = "你是一個幫助學生閱讀文章的 AI 老師。請閱讀以下文章，並完成我要求的功能。\n\n";
    prompt += "【文章內容】：\n" + sourceText + "\n\n";
    prompt += "【請幫我完成以下任務】：\n";
    
    checkboxes.forEach((cb, index) => {
        prompt += `${index + 1}. ${cb.value}\n`;
    });
    
    prompt += "\n請清楚標示每個任務的標題來回答。";

    // 準備呼叫 API，更新畫面狀態
    loadingMsg.style.display = 'block';
    resultSection.style.display = 'none';
    analyzeBtn.disabled = true;

    try {
        // 呼叫 Gemini API
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API 請求失敗 (${response.status}): ${errorData.error?.message || '未知錯誤'}`);
        }

        const data = await response.json();
        
        // 取得 AI 回傳的文字
        const aiText = data.candidates[0].content.parts[0].text;
        
        // 使用 marked.js 將 Markdown 轉換為 HTML 並顯示
        resultContent.innerHTML = marked.parse(aiText);
        
        // 顯示結果區塊
        resultSection.style.display = 'block';

    } catch (error) {
        console.error("呼叫 API 時發生錯誤:", error);
        alert("抱歉，分析過程中發生錯誤，請檢查網路連線或 API Key 是否正確。\n錯誤詳細資訊: " + error.message);
    } finally {
        // 恢復按鈕狀態
        loadingMsg.style.display = 'none';
        analyzeBtn.disabled = false;
    }
});