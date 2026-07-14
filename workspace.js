import { Client, Databases, Query, ID, Functions } from 'node-appwrite';
import { handleLegacyChat, handleLandingPage } from './legacyChat.js';
import { handleBookOutline } from './bookGenerator.js';

const DATABASE_ID = '6a3706880011ad5651b5';
const USERS_COLLECTION_ID = 'cvs_chat_cv_mab';
const BOOKS_COLLECTION_ID = 'books';
const LANDING_PAGES_COLLECTION_ID = process.env.LANDING_PAGES_COLLECTION_ID || 'landing_pages';
const AUTO_BOOK_COST = 40;
const LANDING_MAX_VERSIONS = 15;
const ALLOWED_TEXT_MODELS = new Set(['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-5.5']);
const LANDING_MODEL_POINTS = Object.freeze({
    'gpt-4o-mini': 20,
    'gpt-4.1-mini': 40,
    'gpt-5.5': 60
});

function normalizeTextModel(value, fallback = 'gpt-4.1-mini') {
    const model = typeof value === 'string' ? value.trim() : '';
    return ALLOWED_TEXT_MODELS.has(model) ? model : fallback;
}

function landingPointsForModel(model) {
    return LANDING_MODEL_POINTS[normalizeTextModel(model)];
}

function parseBody(req) {
    if (!req?.body) return {};
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
}

function safeText(value, maxLength = 200000) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function safeJsonParse(value, fallback) {
    if (value && typeof value === 'object') return value;
    try {
        return JSON.parse(value || '');
    } catch (error) {
        return fallback;
    }
}

function clampInteger(value, fallback, minimum, maximum) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(maximum, Math.max(minimum, number));
}

function estimatePages(text) {
    const words = safeText(text, 500000).split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 250));
}

function getRequestHeader(req, name) {
    if (!req?.headers) return '';
    return req.headers[name] || req.headers[name.toLowerCase()] || req.headers[name.toUpperCase()] || '';
}

function sanitizeLandingForm(input = {}) {
    return {
        prompt: safeText(input.prompt, 12000),
        productName: safeText(input.productName, 300),
        audience: safeText(input.audience, 1000),
        productDetails: safeText(input.productDetails, 12000),
        phone: safeText(input.phone, 100),
        whatsapp: safeText(input.whatsapp, 100),
        ctaUrl: safeText(input.ctaUrl, 2000),
        language: safeText(input.language, 80) || 'العربية',
        sourceBookId: safeText(input.sourceBookId, 80)
    };
}

function projectFromDocument(document) {
    const stored = safeJsonParse(document?.project_data, {});
    const storedModel = normalizeTextModel(stored.model);
    return {
        id: document.$id,
        title: safeText(document.title, 300) || safeText(stored.title, 300) || 'صفحة هبوط',
        createdAt: stored.createdAt || Date.parse(document.$createdAt || '') || Date.now(),
        updatedAt: Date.parse(document.$updatedAt || '') || stored.updatedAt || Date.now(),
        form: sanitizeLandingForm(stored.form || {}),
        model: storedModel,
        points: landingPointsForModel(storedModel),
        versions: Array.isArray(stored.versions) ? stored.versions : []
    };
}

function landingProjectSummary(project) {
    return {
        id: project.id,
        title: project.title,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        model: project.model,
        points: project.points,
        form: project.form,
        versionCount: project.versions.length,
        latestVersion: project.versions.length
            ? {
                id: project.versions[project.versions.length - 1].id,
                label: project.versions[project.versions.length - 1].label,
                createdAt: project.versions[project.versions.length - 1].createdAt
            }
            : null
    };
}

async function getOwnedLandingDocument(databases, userId, projectId) {
    if (!projectId) throw new Error('معرّف صفحة الهبوط مفقود.');
    const document = await databases.getDocument(DATABASE_ID, LANDING_PAGES_COLLECTION_ID, projectId);
    if (document.userId !== userId) throw new Error('لا تملك صلاحية الوصول إلى صفحة الهبوط هذه.');
    return document;
}

async function storeLandingVersion(databases, bodyData, html, options = {}) {
    const userId = bodyData.userId;
    const form = sanitizeLandingForm(bodyData.landingPageDetails || bodyData.form || {});
    const now = Date.now();
    let document = null;
    let project;

    if (bodyData.projectId) {
        document = await getOwnedLandingDocument(databases, userId, bodyData.projectId);
        project = projectFromDocument(document);
    } else {
        project = {
            id: '',
            title: form.productName || safeText(bodyData.title, 300) || 'صفحة هبوط جديدة',
            createdAt: now,
            updatedAt: now,
            form,
            model: normalizeTextModel(bodyData.modelTier || bodyData.model),
            points: landingPointsForModel(bodyData.modelTier || bodyData.model),
            versions: []
        };
    }

    const requestedVersionModel = safeText(options.model || bodyData.modelTier || bodyData.model, 80);
    const version = {
        id: ID.unique(),
        html,
        label: safeText(options.label, 200) || 'نسخة جديدة',
        kind: safeText(options.kind, 40) || 'ai',
        parentVersionId: safeText(bodyData.baseVersionId, 80),
        model: requestedVersionModel === 'manual' ? 'manual' : normalizeTextModel(requestedVersionModel),
        points: Number(options.points || 0),
        createdAt: now
    };

    project.title = form.productName || project.title || 'صفحة هبوط جديدة';
    project.form = form;
    if (version.model !== 'manual') project.model = version.model || project.model;
    project.points = Number(options.points || project.points || 0);
    project.updatedAt = now;
    project.versions = [...(project.versions || []), version].slice(-LANDING_MAX_VERSIONS);

    const projectData = JSON.stringify({
        title: project.title,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        form: project.form,
        model: project.model,
        points: project.points,
        versions: project.versions
    });

    if (document) {
        const updated = await databases.updateDocument(
            DATABASE_ID,
            LANDING_PAGES_COLLECTION_ID,
            document.$id,
            { title: project.title, project_data: projectData }
        );
        return projectFromDocument(updated);
    }

    const created = await databases.createDocument(
        DATABASE_ID,
        LANDING_PAGES_COLLECTION_ID,
        ID.unique(),
        { userId, title: project.title, project_data: projectData }
    );
    return projectFromDocument(created);
}

async function listLandingProjects(databases, userId) {
    const response = await databases.listDocuments(DATABASE_ID, LANDING_PAGES_COLLECTION_ID, [
        Query.equal('userId', userId),
        Query.orderDesc('$updatedAt'),
        Query.limit(50)
    ]);
    return response.documents.map(projectFromDocument).map(landingProjectSummary);
}

function bookProfileForMemory(bodyData) {
    const details = bodyData.bookDetails || {};
    return [
        `ثوابت الكتاب — العنوان: ${safeText(bodyData.title || details.title, 300) || 'غير محدد'}`,
        `الموضوع: ${safeText(details.topic, 2000) || 'راجع الخطة'}`,
        `النوع: ${safeText(details.genre, 300) || 'راجع الخطة'}`,
        `الجمهور: ${safeText(details.audience, 300) || 'الجمهور العام'}`,
        `النبرة: ${safeText(details.tone, 300) || 'واضحة واحترافية'}`,
        `وجهة النظر: ${safeText(details.pov, 300) || 'حسب الخطة'}`,
        `اللغة: ${safeText(details.language, 100) || 'العربية'}`
    ].join('\n');
}

export default async ({ req, res, log, error }) => {
    const appwriteEndpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT
        || process.env.APPWRITE_FUNCTION_ENDPOINT
        || 'https://fra.cloud.appwrite.io/v1';
    const appwriteProjectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
    const appwriteApiKey = safeText(
        getRequestHeader(req, 'x-appwrite-key')
            || process.env.APPWRITE_API_KEY
            || process.env.APPWRITE_FUNCTION_API_KEY,
        8192
    );

    if (!appwriteProjectId || !appwriteApiKey) {
        error('[Appwrite configuration] Missing injected project ID or dynamic API key.');
        return res.json({
            success: false,
            error: 'تعذر تهيئة اتصال Appwrite داخل الدالة. تأكد من تفعيل صلاحيات المفتاح الديناميكي ثم أعد النشر.'
        }, 200);
    }

    const client = new Client()
        .setEndpoint(appwriteEndpoint)
        .setProject(appwriteProjectId)
        .setKey(appwriteApiKey);

    const databases = new Databases(client);
    const appwriteFunctions = new Functions(client);

    let bodyData;
    try {
        bodyData = parseBody(req);
    } catch (parseError) {
        error(`JSON Parse Error: ${parseError.message}`);
        return res.json({ success: false, error: 'صيغة الطلب غير صحيحة، يجب أن تكون JSON.' }, 200);
    }

    const userId = safeText(bodyData?.userId, 80);
    const action = safeText(bodyData?.action || 'legacy_chat', 80);
    if (!userId) return res.json({ success: false, error: 'بيانات غير مكتملة: userId مفقود.' }, 200);

    // يمنع مستخدمًا مسجلًا من تمرير معرّف حساب شخص آخر. التنفيذات الداخلية لا تحمل هذا الرأس.
    const authenticatedUserId = safeText(getRequestHeader(req, 'x-appwrite-user-id'), 80);
    if (authenticatedUserId && authenticatedUserId !== userId) {
        return res.json({ success: false, error: 'معرّف المستخدم لا يطابق الجلسة الحالية.' }, 200);
    }

    try {
        const userDocs = await databases.listDocuments(DATABASE_ID, USERS_COLLECTION_ID, [
            Query.equal('userId', userId),
            Query.limit(1)
        ]);
        const userAccount = userDocs.documents[0];
        if (!userAccount) {
            return res.json({ success: false, error: 'لم يتم العثور على محفظة نقاط لهذا المستخدم.' }, 200);
        }

        const userTokens = Number(userAccount.tokens || 0);

        // -------------------- مكتبة صفحات الهبوط: قراءة/حذف --------------------
        if (action === 'landing_list') {
            const projects = await listLandingProjects(databases, userId);
            return res.json({ success: true, projects, remainingTokens: userTokens }, 200);
        }

        if (action === 'landing_get') {
            const document = await getOwnedLandingDocument(databases, userId, safeText(bodyData.projectId, 80));
            return res.json({ success: true, project: projectFromDocument(document), remainingTokens: userTokens }, 200);
        }

        if (action === 'landing_delete') {
            const projectId = safeText(bodyData.projectId, 80);
            await getOwnedLandingDocument(databases, userId, projectId);
            await databases.deleteDocument(DATABASE_ID, LANDING_PAGES_COLLECTION_ID, projectId);
            return res.json({ success: true, message: 'تم حذف صفحة الهبوط ونسخها.', remainingTokens: userTokens }, 200);
        }

        if (action === 'landing_save_manual') {
            const html = safeText(bodyData.html, 450000);
            if (!/<!doctype\s+html/i.test(html) || !/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) {
                return res.json({ success: false, error: 'كود HTML اليدوي غير مكتمل.' }, 200);
            }
            const project = await storeLandingVersion(databases, bodyData, html, {
                label: safeText(bodyData.label, 200) || 'تعديل يدوي على الكود',
                kind: 'manual',
                points: 0,
                model: 'manual'
            });
            return res.json({ success: true, project, projectId: project.id, remainingTokens: userTokens }, 200);
        }

        // -------------------- إنشاء/تعديل صفحة هبوط بالذكاء الاصطناعي --------------------
        if (action === 'landing_page') {
            const toolResponse = await handleLandingPage(bodyData, userTokens, log);
            if (!toolResponse.success) return res.json({ success: false, error: toolResponse.error }, 200);

            const newBalance = userTokens - toolResponse.tokensCost;
            await databases.updateDocument(DATABASE_ID, USERS_COLLECTION_ID, userAccount.$id, { tokens: newBalance });

            let project = null;
            let storageWarning = '';
            try {
                const isRevision = bodyData.mode === 'revise';
                project = await storeLandingVersion(databases, bodyData, toolResponse.content, {
                    label: isRevision
                        ? `تعديل: ${safeText(bodyData.instruction, 55) || 'نسخة محسّنة'}`
                        : (bodyData.projectId ? 'إعادة إنشاء بالذكاء الاصطناعي' : 'النسخة الأولى'),
                    kind: isRevision ? 'ai-revision' : 'ai-generation',
                    points: toolResponse.tokensCost,
                    model: toolResponse.model
                });
            } catch (storageError) {
                error(`[Landing storage] ${storageError.message}`);
                storageWarning = 'تم إنشاء الصفحة، لكن تعذر حفظها في قاعدة البيانات؛ احتُفظ بنسخة محلية في المتصفح.';
            }

            return res.json({
                success: true,
                message: `تم إنشاء الصفحة وخصم ${toolResponse.tokensCost} نقطة.`,
                resultType: 'html',
                data: toolResponse.content,
                html: toolResponse.content,
                project,
                projectId: project?.id || bodyData.projectId || null,
                storageWarning,
                remainingTokens: newBalance,
                sourceFunction: toolResponse.sourceFunction
            }, 200);
        }

        // -------------------- بدء التأليف الأوتوماتيكي --------------------
        if (action === 'start_auto_write') {
            if (userTokens < AUTO_BOOK_COST) {
                return res.json({ success: false, error: `الرصيد غير كافٍ. تحتاج ${AUTO_BOOK_COST} نقطة.` }, 200);
            }

            const outline = safeText(bodyData.outline, 140000);
            if (!outline) return res.json({ success: false, error: 'يجب اعتماد خطة الكتاب قبل بدء التأليف.' }, 200);
            const targetPages = clampInteger(bodyData.targetPages, 50, 10, 400);
            const initialPagesArray = Array.isArray(bodyData.introPagesArray)
                ? bodyData.introPagesArray.map(page => safeText(page, 100000)).filter(Boolean)
                : [];
            const functionId = process.env.APPWRITE_FUNCTION_ID;
            if (!functionId) {
                return res.json({ success: false, error: 'متغير APPWRITE_FUNCTION_ID غير مضبوط للتأليف في الخلفية.' }, 200);
            }

            const newBalance = userTokens - AUTO_BOOK_COST;
            await databases.updateDocument(DATABASE_ID, USERS_COLLECTION_ID, userAccount.$id, { tokens: newBalance });

            let bookDocument;
            try {
                bookDocument = await databases.createDocument(DATABASE_ID, BOOKS_COLLECTION_ID, ID.unique(), {
                    userId,
                    title: safeText(bodyData.title || bodyData.bookDetails?.title, 300) || 'كتاب بدون عنوان',
                    status: 'locked_generating',
                    outline,
                    content_pages: JSON.stringify(initialPagesArray),
                    target_pages: targetPages,
                    generated_pages_count: Math.min(targetPages, initialPagesArray.length),
                    current_summary: bookProfileForMemory(bodyData)
                });
            } catch (bookError) {
                // محاولة إعادة الرصيد إذا لم يُنشأ سجل الكتاب أصلًا.
                await databases.updateDocument(DATABASE_ID, USERS_COLLECTION_ID, userAccount.$id, { tokens: userTokens }).catch(() => {});
                throw bookError;
            }

            await appwriteFunctions.createExecution(
                functionId,
                JSON.stringify({
                    userId,
                    action: 'continue_auto_write',
                    bookId: bookDocument.$id,
                    provider: bodyData.provider || 'openai',
                    modelTier: normalizeTextModel(bodyData.modelTier)
                }),
                true
            );

            return res.json({
                success: true,
                message: `بدأ تأليف الكتاب في الخلفية. تم خصم ${AUTO_BOOK_COST} نقطة.`,
                bookId: bookDocument.$id,
                remainingTokens: newBalance
            }, 200);
        }

        // -------------------- دورة التأليف في الخلفية --------------------
        if (action === 'continue_auto_write') {
            const bookId = safeText(bodyData.bookId, 80);
            const bookDocument = await databases.getDocument(DATABASE_ID, BOOKS_COLLECTION_ID, bookId);
            if (bookDocument.userId !== userId) {
                return res.json({ success: false, error: 'هذا الكتاب لا ينتمي إلى المستخدم المحدد.' }, 200);
            }

            let chunks = safeJsonParse(bookDocument.content_pages, []);
            if (!Array.isArray(chunks)) chunks = [safeText(bookDocument.content_pages, 500000)].filter(Boolean);
            let generatedPages = clampInteger(bookDocument.generated_pages_count, chunks.length, 0, 400);
            const targetPages = clampInteger(bookDocument.target_pages, 50, 10, 400);
            let memory = safeText(bookDocument.current_summary, 50000);

            if (generatedPages >= targetPages || bookDocument.status === 'completed') {
                if (bookDocument.status !== 'completed') {
                    await databases.updateDocument(DATABASE_ID, BOOKS_COLLECTION_ID, bookId, { status: 'completed' });
                }
                return res.json({ success: true, message: 'اكتمل الكتاب.', generatedPages, targetPages }, 200);
            }

            const remainingPages = targetPages - generatedPages;
            const lastChunk = chunks.length ? safeText(chunks[chunks.length - 1], 40000) : '';
            const generated = await handleBookOutline({
                bookStep: 'generate_chunk',
                previousOutline: bookDocument.outline,
                memorySummaries: memory,
                lastPageText: lastChunk,
                remainingPages,
                bookDetails: { title: bookDocument.title, maxPages: targetPages },
                provider: bodyData.provider || 'openai',
                modelTier: normalizeTextModel(bodyData.modelTier)
            }, Number.MAX_SAFE_INTEGER, log);

            if (!generated.success) {
                await databases.updateDocument(DATABASE_ID, BOOKS_COLLECTION_ID, bookId, { status: 'failed' }).catch(() => {});
                return res.json({ success: false, error: generated.error || 'فشل توليد المقطع التالي.' }, 200);
            }

            const newChunk = safeText(generated.content, 500000);
            if (!newChunk) return res.json({ success: false, error: 'أعاد النموذج مقطعًا فارغًا.' }, 200);
            chunks.push(newChunk);
            generatedPages += Math.min(remainingPages, estimatePages(newChunk));

            const summary = await handleBookOutline({
                bookStep: 'summarize_chunk',
                textToSummarize: newChunk,
                provider: bodyData.provider || 'openai',
                modelTier: normalizeTextModel(bodyData.modelTier)
            }, Number.MAX_SAFE_INTEGER, log);
            if (summary.success) {
                memory = `${memory}\n- ${safeText(summary.content, 12000)}`.slice(-45000);
            }

            const completed = generatedPages >= targetPages;
            await databases.updateDocument(DATABASE_ID, BOOKS_COLLECTION_ID, bookId, {
                content_pages: JSON.stringify(chunks),
                generated_pages_count: Math.min(generatedPages, targetPages),
                current_summary: memory,
                status: completed ? 'completed' : 'locked_generating'
            });

            if (!completed) {
                const functionId = process.env.APPWRITE_FUNCTION_ID;
                if (!functionId) throw new Error('متغير APPWRITE_FUNCTION_ID غير مضبوط.');
                await appwriteFunctions.createExecution(
                    functionId,
                    JSON.stringify({
                        userId,
                        action: 'continue_auto_write',
                        bookId,
                        provider: bodyData.provider || 'openai',
                        modelTier: normalizeTextModel(bodyData.modelTier)
                    }),
                    true
                );
            }

            return res.json({
                success: true,
                message: completed ? 'اكتمل تأليف الكتاب.' : 'تم حفظ مقطع جديد واستمرار التأليف في الخلفية.',
                generatedPages: Math.min(generatedPages, targetPages),
                targetPages,
                completed
            }, 200);
        }

        // -------------------- الأدوات العادية --------------------
        let toolResponse;
        if (action === 'legacy_chat') {
            toolResponse = await handleLegacyChat(bodyData, userTokens, log);
        } else if (['book_outline', 'refine_outline', 'write_intro', 'refine_intro'].includes(action)) {
            toolResponse = await handleBookOutline(bodyData, userTokens, log);
        } else {
            return res.json({ success: false, error: `أمر غير معروف (Invalid Action): ${action}` }, 200);
        }

        if (!toolResponse.success) return res.json({ success: false, error: toolResponse.error }, 200);
        const newBalance = userTokens - toolResponse.tokensCost;
        await databases.updateDocument(DATABASE_ID, USERS_COLLECTION_ID, userAccount.$id, { tokens: newBalance });

        return res.json({
            success: true,
            message: `تم تنفيذ العملية بنجاح. خُصمت ${toolResponse.tokensCost} نقاط.`,
            resultType: toolResponse.type,
            data: toolResponse.content,
            remainingTokens: newBalance,
            sourceFunction: toolResponse.sourceFunction
        }, 200);
    } catch (caught) {
        error(`[Main function error] action=${action} user=${userId} message=${caught.message}`);
        return res.json({ success: false, error: caught?.message || 'حدث خطأ داخلي في الخادم.' }, 200);
    }
};
