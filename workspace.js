const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_IMAGE_GENERATIONS_URL = 'https://api.openai.com/v1/images/generations';
const OPENAI_IMAGE_EDITS_URL = 'https://api.openai.com/v1/images/edits';

const TEXT_MODELS = {
    'gpt-5.6-luna': { model: 'gpt-5.6-luna', cost: 8, effort: 'low' },
    'gpt-5.6-terra': { model: 'gpt-5.6-terra', cost: 10, effort: 'medium' },
    'gpt-5.6': { model: 'gpt-5.6', cost: 15, effort: 'medium' },
    // توافق مع اختيارات قديمة بقيت في localStorage عند بعض المستخدمين.
    'gpt-4o': { model: 'gpt-5.6-luna', cost: 8, effort: 'low' },
    'gpt-5.4-mini': { model: 'gpt-5.6-terra', cost: 10, effort: 'medium' },
    'gpt-5.5': { model: 'gpt-5.6', cost: 15, effort: 'medium' }
};

const IMAGE_MODELS = {
    'gpt-image-1-mini': { model: 'gpt-image-1-mini', cost: 10, quality: 'low' },
    'gpt-image-1.5': { model: 'gpt-image-1.5', cost: 15, quality: 'medium' },
    'gpt-image-2': { model: 'gpt-image-2', cost: 20, quality: 'high' }
};

const LANDING_MODELS = {
    'gpt-5.6-luna': { model: 'gpt-5.6-luna', cost: 20, effort: 'low' },
    'gpt-5.6-terra': { model: 'gpt-5.6-terra', cost: 40, effort: 'medium' },
    'gpt-5.6': { model: 'gpt-5.6', cost: 60, effort: 'high' },
    // تحويل تلقائي للخيارات القديمة حتى لا تتعطل جلسة محفوظة في المتصفح.
    'gpt-4o-mini': { model: 'gpt-5.6-luna', cost: 20, effort: 'low' },
    'gpt-4o': { model: 'gpt-5.6-terra', cost: 40, effort: 'medium' },
    'gpt-5': { model: 'gpt-5.6', cost: 60, effort: 'high' }
};

function safeText(value, maxLength = 100000) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function getOpenAIKey() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('مفتاح OPENAI_API_KEY غير مضبوط داخل متغيرات الكود الوظيفي الثاني.');
    return key;
}

function extractOpenAIText(data) {
    if (typeof data?.output_text === 'string' && data.output_text.trim()) {
        return data.output_text.trim();
    }

    const parts = [];
    for (const item of data?.output || []) {
        if (item?.type !== 'message') continue;
        for (const content of item.content || []) {
            if (content?.type === 'output_text' && typeof content.text === 'string') {
                parts.push(content.text);
            }
        }
    }
    return parts.join('\n').trim();
}

function extractOpenAIError(data, fallback) {
    return data?.error?.message || data?.message || fallback;
}

async function fetchWithTimeout(url, options, timeoutMs = 120000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (error?.name === 'AbortError') throw new Error('انتهت مهلة اتصال النموذج. حاول مرة أخرى.');
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

async function callOpenAIText({ model, effort, instructions, input, maxOutputTokens = 6000 }) {
    const response = await fetchWithTimeout(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${getOpenAIKey()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            instructions,
            input,
            reasoning: { effort },
            max_output_tokens: maxOutputTokens,
            store: false
        })
    }, 180000);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(extractOpenAIError(data, `رفض OpenAI الطلب (HTTP ${response.status}).`));
    }

    const text = extractOpenAIText(data);
    if (!text) throw new Error('أعاد OpenAI استجابة بلا نص قابل للاستخدام.');
    return text;
}

function normalizeImageDataUrl(value) {
    const match = safeText(value, 70_000_000).match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i);
    if (!match) throw new Error('صيغة الصورة المرفوعة غير صالحة. استخدم PNG أو JPG أو WEBP.');

    const mimeType = match[1].toLowerCase().replace('image/jpg', 'image/jpeg');
    const base64 = match[2].replace(/\s+/g, '');
    const bytes = Buffer.from(base64, 'base64');
    if (!bytes.length) throw new Error('ملف الصورة فارغ.');
    if (bytes.length > 50 * 1024 * 1024) throw new Error('حجم الصورة أكبر من 50MB. صغّرها ثم أعد المحاولة.');
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
    return { bytes, mimeType, extension };
}

async function generateOpenAIImage(bodyData, imageConfig) {
    const prompt = safeText(bodyData.prompt, 32000);
    const quality = ['low', 'medium', 'high'].includes(bodyData.quality)
        ? bodyData.quality
        : imageConfig.quality;

    const response = await fetchWithTimeout(OPENAI_IMAGE_GENERATIONS_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${getOpenAIKey()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: imageConfig.model,
            prompt,
            n: 1,
            quality,
            size: '1024x1024',
            output_format: 'png'
        })
    }, 240000);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(extractOpenAIError(data, `فشل توليد الصورة (HTTP ${response.status}).`));
    }
    const base64 = data?.data?.[0]?.b64_json;
    const url = data?.data?.[0]?.url;
    if (base64) return `data:image/png;base64,${base64}`;
    if (url) return url;
    throw new Error('نجح الطلب لكن OpenAI لم يُرجع بيانات صورة.');
}

async function editOpenAIImage(bodyData, imageConfig) {
    const image = normalizeImageDataUrl(bodyData.imageBase64);
    const form = new FormData();
    form.append('model', imageConfig.model);
    form.append('prompt', safeText(bodyData.prompt, 32000));
    form.append('image[]', new Blob([image.bytes], { type: image.mimeType }), `input.${image.extension}`);
    form.append('quality', ['low', 'medium', 'high'].includes(bodyData.quality) ? bodyData.quality : imageConfig.quality);
    form.append('size', '1024x1024');
    form.append('output_format', 'png');
    if (bodyData.inputFidelity === 'high') form.append('input_fidelity', 'high');

    const response = await fetchWithTimeout(OPENAI_IMAGE_EDITS_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getOpenAIKey()}` },
        body: form
    }, 300000);

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(extractOpenAIError(data, `فشل تعديل الصورة (HTTP ${response.status}).`));
    }
    const base64 = data?.data?.[0]?.b64_json;
    const url = data?.data?.[0]?.url;
    if (base64) return `data:image/png;base64,${base64}`;
    if (url) return url;
    throw new Error('نجح الطلب لكن OpenAI لم يُرجع الصورة المعدلة.');
}

async function callCloudflare(bodyData) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!accountId || !apiToken) throw new Error('مفاتيح Cloudflare غير مضبوطة في الكود الوظيفي الثاني.');

    const mode = bodyData.mode;
    const model = mode === 'text'
        ? '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
        : '@cf/black-forest-labs/flux-1-schnell';
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
    const requestBody = mode === 'text'
        ? { messages: [{ role: 'user', content: safeText(bodyData.prompt, 32000) }] }
        : { prompt: safeText(bodyData.prompt, 32000) };

    const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    }, 180000);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) {
        throw new Error(data?.errors?.[0]?.message || `رفض Cloudflare الطلب (HTTP ${response.status}).`);
    }

    if (mode === 'text') {
        const content = data?.result?.response || data?.result?.text;
        if (!content) throw new Error('لم يُرجع Cloudflare نصًا.');
        return { type: 'text', content };
    }

    const image = data?.result?.image;
    if (typeof image === 'string') return { type: 'image', content: `data:image/jpeg;base64,${image}` };
    if (Array.isArray(image)) return { type: 'image', content: `data:image/jpeg;base64,${Buffer.from(image).toString('base64')}` };
    throw new Error('لم يُرجع Cloudflare صورة قابلة للعرض.');
}

export const handleLegacyChat = async (bodyData, userTokens, log = () => {}) => {
    const mode = safeText(bodyData?.mode, 20).toLowerCase();
    const provider = safeText(bodyData?.provider || 'openai', 30).toLowerCase();
    const prompt = safeText(bodyData?.prompt, 32000);

    if (!['text', 'generate', 'edit'].includes(mode)) {
        return { success: false, error: 'نوع الخدمة غير مدعوم. استخدم text أو generate أو edit.' };
    }
    if (!prompt) return { success: false, error: 'نص الطلب مطلوب.' };
    if (mode === 'edit' && !bodyData?.imageBase64) return { success: false, error: 'صورة التعديل مفقودة.' };

    try {
        if (provider === 'cloudflare') {
            if (mode === 'edit') return { success: false, error: 'تعديل الصور متاح عبر OpenAI فقط.' };
            const tokensCost = 5;
            if (userTokens < tokensCost) return { success: false, error: `رصيدك غير كافٍ. تحتاج ${tokensCost} نقاط.` };
            log(`legacyChat cloudflare/${mode}`);
            const result = await callCloudflare({ ...bodyData, mode, prompt });
            return { success: true, tokensCost, ...result, sourceFunction: `legacy_${provider}_${mode}` };
        }

        if (provider !== 'openai') return { success: false, error: 'مزود النموذج غير مدعوم.' };

        if (mode === 'text') {
            const requestedModel = safeText(bodyData.modelTier || bodyData.model || 'gpt-5.6-luna', 50);
            const config = TEXT_MODELS[requestedModel] || TEXT_MODELS['gpt-5.6-luna'];
            if (userTokens < config.cost) return { success: false, error: `رصيدك غير كافٍ. تحتاج ${config.cost} نقاط.` };
            log(`legacyChat openai/text model=${config.model}`);
            const content = await callOpenAIText({
                model: config.model,
                effort: config.effort,
                instructions: 'أنت مساعد AKLAKE. أجب مباشرة وبدقة وباللغة التي يستخدمها المستخدم. لا تدّع تنفيذ أفعال لم تنفذها.',
                input: prompt,
                maxOutputTokens: 7000
            });
            return {
                success: true,
                tokensCost: config.cost,
                type: 'text',
                content,
                sourceFunction: `legacy_openai_text_${config.model}`
            };
        }

        const requestedImageModel = safeText(bodyData.imageModel || bodyData.model || bodyData.modelTier || 'gpt-image-2', 50);
        const config = IMAGE_MODELS[requestedImageModel] || IMAGE_MODELS['gpt-image-2'];
        if (userTokens < config.cost) return { success: false, error: `رصيدك غير كافٍ. تحتاج ${config.cost} نقاط.` };
        log(`legacyChat openai/${mode} model=${config.model}`);
        const content = mode === 'edit'
            ? await editOpenAIImage(bodyData, config)
            : await generateOpenAIImage(bodyData, config);
        return {
            success: true,
            tokensCost: config.cost,
            type: 'image',
            content,
            sourceFunction: `legacy_openai_${mode}_${config.model}`
        };
    } catch (error) {
        return { success: false, error: error?.message || 'فشل تنفيذ الطلب.' };
    }
};

export const handleLandingPage = async (bodyData, userTokens, log = () => {}) => {
    const mode = safeText(bodyData?.mode || 'generate', 20).toLowerCase();
    if (!['generate', 'revise'].includes(mode)) {
        return { success: false, error: 'وضع صفحة الهبوط غير مدعوم.' };
    }

    const requestedModel = safeText(bodyData?.modelTier || bodyData?.model || 'gpt-5.6-terra', 50);
    const config = LANDING_MODELS[requestedModel] || LANDING_MODELS['gpt-5.6-terra'];
    if (userTokens < config.cost) {
        return { success: false, error: `رصيدك غير كافٍ. تحتاج ${config.cost} نقطة.` };
    }

    const prompt = safeText(bodyData?.prompt, mode === 'revise' ? 450000 : 80000);
    if (!prompt) return { success: false, error: 'تفاصيل صفحة الهبوط مفقودة.' };
    if (mode === 'revise' && !safeText(bodyData?.currentHtml, 400000)) {
        return { success: false, error: 'كود النسخة المراد تعديلها مفقود.' };
    }

    const instructions = [
        'You are AKLAKE Landing Architect, a senior conversion copywriter and front-end designer.',
        'Create production-quality, original, responsive landing pages with excellent visual hierarchy and accessible contrast.',
        'Return exactly one complete self-contained HTML5 document. Put all CSS and JavaScript inline.',
        'Do not use Markdown fences, explanations, placeholders such as lorem ipsum, external JavaScript, or external CSS frameworks.',
        'Use only HTTPS image URLs when an image is truly needed; otherwise use CSS shapes and gradients so the file remains portable.',
        'All buttons and navigation links must have valid href values. Keep phone and WhatsApp values exactly as supplied.',
        'For revisions, preserve every unrelated section and behavior, applying only the requested change.',
        'The first non-whitespace characters of the answer must be <!DOCTYPE html>.'
    ].join('\n');

    try {
        log(`landingPage ${mode} model=${config.model} cost=${config.cost}`);
        const html = await callOpenAIText({
            model: config.model,
            effort: config.effort,
            instructions,
            input: prompt,
            maxOutputTokens: 30000
        });
        const cleaned = html
            .replace(/^```(?:html)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .trim();
        if (!/<!doctype\s+html/i.test(cleaned) || !/<html[\s>]/i.test(cleaned) || !/<\/html>/i.test(cleaned)) {
            throw new Error('النموذج لم يُرجع ملف HTML كاملًا. لم تُخصم النقاط؛ حاول بصياغة أوضح.');
        }
        return {
            success: true,
            tokensCost: config.cost,
            type: 'html',
            content: cleaned,
            model: config.model,
            sourceFunction: `landing_${mode}_${config.model}`
        };
    } catch (error) {
        return { success: false, error: error?.message || 'فشل إنشاء صفحة الهبوط.' };
    }
};

export const LANDING_MODEL_COSTS = Object.freeze({
    'gpt-5.6-luna': 20,
    'gpt-5.6-terra': 40,
    'gpt-5.6': 60
});
