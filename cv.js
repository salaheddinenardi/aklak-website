/*
 * AKLAKE CV BUILDER
 * =================
 * هذا الملف مخصص بالكامل لمنطق أداة السيرة الذاتية:
 * - حالة ومشاريع ونسخ CV
 * - حقول الإدخال والتعديل
 * - الصورة الشخصية ومحررها وتعديلها بالذكاء الاصطناعي
 * - المعاينة والكود والتنزيل وPDF
 * - اختيار النموذج والطلبات والحفظ
 *
 * يعتمد على الأدوات العامة الموجودة في workspace.js
 * وعلى إعدادات Appwrite والنماذج الموجودة في app.js وقت التشغيل.
 * ترتيب التحميل المطلوب داخل index.html:
 * workspace.js ثم cv.js ثم app.js
 */

// ==========================================
// منشئ السيرة الذاتية — HTML واحد عبر الكود الوظيفي الأول
// ==========================================
const CV_STORAGE_KEY = 'aklake_cv_projects_v1';
const CV_MODEL_MEMORY_KEY = 'aklake_cv_model_v1';
const CV_MAX_PROJECTS = 24;
const CV_MAX_VERSIONS = 20;
const CV_MODEL_INFO = Object.freeze({
    'cloudflare:llama': { provider: 'cloudflare', model: 'llama', points: 5, label: 'LLaMA 3.3' },
    'openai:gpt-4o-mini': { provider: 'openai', model: 'gpt-4o-mini', points: 8, label: 'GPT-4o mini' },
    'openai:gpt-4.1-mini': { provider: 'openai', model: 'gpt-4.1-mini', points: 10, label: 'GPT-4.1 mini' }
});

const cvState = {
    projects: [],
    activeProjectId: null,
    currentVersionIndex: -1,
    provider: 'openai',
    model: 'gpt-4.1-mini',
    points: 10,
    pendingKey: 'openai:gpt-4.1-mini',
    busy: false,
    previewOpen: false,
    chatCollapsed: false,
    activeView: 'preview',
    profileImage: null,
    profileImageDirty: false,
    editBaseline: null,
    editPhotoBaseline: '',
    editVersionId: null,
    photoAI: {
        busy: false,
        sourceDataUrl: '',
        resultDataUrl: '',
        model: 'gpt-image-1.5'
    },
    photoEditor: {
        image: null,
        sourceDataUrl: '',
        sourceName: '',
        shape: 'square',
        zoom: 1,
        rotation: 0,
        flipX: 1,
        offsetX: 0,
        offsetY: 0,
        dragging: false,
        pointerX: 0,
        pointerY: 0
    }
};

const cvUI = {};
function cacheCVUI() {
    Object.assign(cvUI, {
        studio: elementById('cv-builder-studio'),
        conversation: elementById('cv-conversation'),
        generationCard: elementById('cv-generation-card'),
        completeCard: elementById('cv-complete-card'),
        progressName: elementById('cv-progress-name'),
        progressModel: elementById('cv-progress-model'),
        completeTitle: elementById('cv-complete-title'),
        openResultBtn: elementById('cv-open-result-btn'),
        projectsToggle: elementById('cv-projects-toggle'),
        projectsPanel: elementById('cv-projects-panel'),
        projectsList: elementById('cv-projects-list'),
        newProjectBtn: elementById('cv-new-project-btn'),
        closeChatBtn: elementById('cv-close-chat-btn'),
        output: elementById('cv-output-panel'),
        previewView: elementById('cv-preview-view'),
        emptyPreview: elementById('cv-empty-preview'),
        previewShell: elementById('cv-preview-shell'),
        previewFrame: elementById('cv-preview-frame'),
        codeView: elementById('cv-code-view'),
        editView: elementById('cv-edit-info-view'),
        editSubmitBtn: elementById('cv-edit-submit-btn'),
        editNote: elementById('cv-edit-note'),
        editFullName: elementById('cv-edit-full-name'),
        editJobTitle: elementById('cv-edit-job-title'),
        editLanguage: elementById('cv-edit-language'),
        editBirthDate: elementById('cv-edit-birth-date'),
        editAge: elementById('cv-edit-age'),
        editEmail: elementById('cv-edit-email'),
        editPhone: elementById('cv-edit-phone'),
        editLocation: elementById('cv-edit-location'),
        editNationality: elementById('cv-edit-nationality'),
        editLinks: elementById('cv-edit-links'),
        editSummary: elementById('cv-edit-summary'),
        editProjects: elementById('cv-edit-projects'),
        editAchievements: elementById('cv-edit-achievements'),
        editExperience: elementById('cv-edit-experience'),
        editEducation: elementById('cv-edit-education'),
        editCertifications: elementById('cv-edit-certifications'),
        editSkills: elementById('cv-edit-skills'),
        editLanguages: elementById('cv-edit-languages'),
        editExtra: elementById('cv-edit-extra'),
        editVolunteering: elementById('cv-edit-volunteering'),
        editReferences: elementById('cv-edit-references'),
        codeEditor: elementById('cv-code-editor'),
        applyCodeBtn: elementById('cv-apply-code-btn'),
        copyBtn: elementById('cv-copy-code-btn'),
        downloadBtn: elementById('cv-download-btn'),
        downloadPdfBtn: elementById('cv-download-pdf-btn'),
        closePreviewBtn: elementById('cv-close-preview-btn'),
        revisionPanel: elementById('cv-revision-panel'),
        revisionPrompt: elementById('cv-revision-prompt'),
        reviseBtn: elementById('cv-revise-btn'),
        prevVersionBtn: elementById('cv-prev-version-btn'),
        nextVersionBtn: elementById('cv-next-version-btn'),
        versionLabel: elementById('cv-version-label'),
        fullName: elementById('cv-full-name'),
        jobTitle: elementById('cv-job-title'),
        language: elementById('cv-language'),
        birthDate: elementById('cv-birth-date'),
        age: elementById('cv-age'),
        email: elementById('cv-email'),
        phone: elementById('cv-phone'),
        location: elementById('cv-location'),
        nationality: elementById('cv-nationality'),
        links: elementById('cv-links'),
        summary: elementById('cv-summary'),
        projects: elementById('cv-projects'),
        achievements: elementById('cv-achievements'),
        experience: elementById('cv-experience'),
        education: elementById('cv-education'),
        certifications: elementById('cv-certifications'),
        skills: elementById('cv-skills'),
        languages: elementById('cv-languages'),
        extra: elementById('cv-extra'),
        volunteering: elementById('cv-volunteering'),
        references: elementById('cv-references'),
        assistantToggle: elementById('cv-assistant-toggle'),
        assistantPanel: elementById('cv-assistant-panel'),
        assistantCloseBtn: elementById('cv-assistant-close-btn'),
        photoAssistantHost: elementById('cv-photo-assistant-host'),
        photoEditHost: elementById('cv-photo-edit-host'),
        photoEditorBlock: elementById('cv-photo-editor-block'),
        photoEditorPanel: elementById('cv-photo-editor-panel'),
        photoCanvas: elementById('cv-photo-canvas'),
        photoZoom: elementById('cv-photo-zoom'),
        photoRotateLeft: elementById('cv-photo-rotate-left'),
        photoRotateRight: elementById('cv-photo-rotate-right'),
        photoFlip: elementById('cv-photo-flip'),
        photoReset: elementById('cv-photo-reset'),
        photoReplace: elementById('cv-photo-replace'),
        photoApplyBtn: elementById('cv-photo-apply-btn'),
        profileFile: elementById('cv-profile-image-file'),
        profilePreview: elementById('cv-profile-image-preview'),
        profileThumb: elementById('cv-profile-image-thumb'),
        profileName: elementById('cv-profile-image-name'),
        removeProfileBtn: elementById('cv-remove-profile-image-btn'),
        attachBtn: elementById('cv-attach-btn'),
        photoAIPanel: elementById('cv-photo-ai-panel'),
        photoAIPrompt: elementById('cv-photo-ai-prompt'),
        photoAIModel: elementById('cv-photo-ai-model'),
        photoAIEditBtn: elementById('cv-photo-ai-edit-btn'),
        photoAIStatus: elementById('cv-photo-ai-status'),
        photoAIResult: elementById('cv-photo-ai-result'),
        photoAINewImage: elementById('cv-photo-ai-new-image'),
        photoAIOriginalImage: elementById('cv-photo-ai-original-image'),
        photoAIDownloadBtn: elementById('cv-photo-ai-download-btn'),
        photoAIUseBtn: elementById('cv-photo-ai-use-btn'),
        prompt: elementById('cv-main-prompt'),
        generateBtn: elementById('cv-generate-btn'),
        modelToggle: elementById('cv-model-toggle'),
        modelPopover: elementById('cv-model-popover'),
        modelCards: elementById('cv-model-cards'),
        activeModel: elementById('cv-active-model'),
        generateCost: elementById('cv-generate-cost'),
        rememberModelToggle: elementById('cv-remember-model-toggle'),
        rememberIcon: document.querySelector('.cv-remember-toggle-icon'),
        confirmModelBtn: elementById('cv-confirm-model-btn'),
        closeModelBtn: elementById('cv-close-model-btn'),
        status: elementById('cv-status')
    });
}

function loadCVProjects() {
    try {
        const stored = JSON.parse(localStorage.getItem(CV_STORAGE_KEY) || '[]');
        cvState.projects = Array.isArray(stored) ? stored.filter(Boolean).slice(0, CV_MAX_PROJECTS) : [];
    } catch (_) {
        cvState.projects = [];
    }
}

function persistCVProjects() {
    try {
        const sorted = cvState.projects.slice().sort(function(a, b) { return Number(b.updatedAt || 0) - Number(a.updatedAt || 0); }).slice(0, CV_MAX_PROJECTS);
        cvState.projects = sorted;
        localStorage.setItem(CV_STORAGE_KEY, JSON.stringify(sorted));
    } catch (error) {
        console.warn('تعذر حفظ مشاريع CV محليًا:', error);
        setCVStatus('تم إنشاء السيرة، لكن مساحة التخزين المحلية ممتلئة. نزّل الملف للاحتفاظ به.', 'info');
    }
}

function getActiveCVProject() {
    return cvState.projects.find(function(project) { return project.id === cvState.activeProjectId; }) || null;
}

function setCVStatus(message, type) {
    setStatusElement(cvUI.status, 'landing-status', message, type, 'is-');
}

function setCVBusy(busy, message) {
    cvState.busy = Boolean(busy);
    if (cvUI.generateBtn) cvUI.generateBtn.disabled = cvState.busy;
    if (cvUI.reviseBtn) cvUI.reviseBtn.disabled = cvState.busy;
    if (cvUI.editSubmitBtn) cvUI.editSubmitBtn.disabled = cvState.busy;
    if (cvUI.photoApplyBtn) cvUI.photoApplyBtn.disabled = cvState.busy;
    if (cvUI.photoAIEditBtn) cvUI.photoAIEditBtn.disabled = cvState.busy || cvState.photoAI.busy;
    if (cvUI.photoAIUseBtn) cvUI.photoAIUseBtn.disabled = cvState.busy || cvState.photoAI.busy;
    if (cvState.busy && message) setCVStatus(message, 'loading');
}

function setCVAssistantOpen(open) {
    const expanded = Boolean(open);
    if (expanded && cvUI.photoAssistantHost) mountCVPhotoEditor(cvUI.photoAssistantHost);
    // لا نسمح للمساعد وإعدادات النموذج أن يتراكبا فوق خانة الإدخال.
    if (expanded && cvUI.modelPopover && !cvUI.modelPopover.classList.contains('hidden')) {
        cvUI.modelPopover.classList.add('hidden');
        cvUI.modelPopover.setAttribute('aria-hidden', 'true');
        cvUI.modelToggle?.setAttribute('aria-expanded', 'false');
    }
    cvUI.assistantPanel?.classList.toggle('hidden', !expanded);
    cvUI.assistantPanel?.setAttribute('aria-hidden', String(!expanded));
    cvUI.assistantToggle?.classList.toggle('is-open', expanded);
    cvUI.assistantToggle?.setAttribute('aria-expanded', String(expanded));
}

function setCVProjectsOpen(open) {
    setExpandablePanel(cvUI.projectsPanel, cvUI.projectsToggle, open);
}

function readCVRememberedModel() {
    try {
        const data = JSON.parse(localStorage.getItem(CV_MODEL_MEMORY_KEY) || 'null');
        const key = data && data.provider && data.model ? data.provider + ':' + data.model : '';
        return CV_MODEL_INFO[key] ? CV_MODEL_INFO[key] : null;
    } catch (_) { return null; }
}

function updateCVRememberIcon() {
    syncToggleIcon(cvUI.rememberIcon, Boolean(cvUI.rememberModelToggle?.checked));
}

function setCVPendingModel(key) {
    if (!CV_MODEL_INFO[key]) return;
    cvState.pendingKey = key;
    cvUI.modelCards?.querySelectorAll('[data-cv-model]').forEach(function(card) {
        const cardKey = card.dataset.cvProvider + ':' + card.dataset.cvModel;
        const selected = cardKey === key;
        card.classList.toggle('selected', selected);
        card.setAttribute('aria-checked', String(selected));
    });
}

function applyCVModel(info) {
    if (!info) return;
    cvState.provider = info.provider;
    cvState.model = info.model;
    cvState.points = info.points;
    cvState.pendingKey = info.provider + ':' + info.model;
    if (cvUI.activeModel) cvUI.activeModel.textContent = info.label;
    if (cvUI.generateCost) cvUI.generateCost.textContent = info.points + ' نقاط';
    setCVPendingModel(cvState.pendingKey);
}

function setCVModelPopoverOpen(open) {
    const expanded = Boolean(open);
    if (expanded) {
        setCVPendingModel(cvState.provider + ':' + cvState.model);
        // إعدادات النموذج تفتح فوق الـ dock من دون تحريك خانة الكتابة.
        cvUI.assistantPanel?.classList.add('hidden');
        cvUI.assistantPanel?.setAttribute('aria-hidden', 'true');
        cvUI.assistantToggle?.classList.remove('is-open');
        cvUI.assistantToggle?.setAttribute('aria-expanded', 'false');
    }
    cvUI.modelPopover?.classList.toggle('hidden', !expanded);
    cvUI.modelPopover?.setAttribute('aria-hidden', String(!expanded));
    cvUI.modelToggle?.setAttribute('aria-expanded', String(expanded));
}
window.setCVModelPopoverOpen = setCVModelPopoverOpen;

function confirmCVModelChoice() {
    const info = CV_MODEL_INFO[cvState.pendingKey];
    if (!info) return;
    applyCVModel(info);
    if (cvUI.rememberModelToggle?.checked) {
        localStorage.setItem(CV_MODEL_MEMORY_KEY, JSON.stringify({ provider: info.provider, model: info.model }));
    } else {
        localStorage.removeItem(CV_MODEL_MEMORY_KEY);
    }
    setCVModelPopoverOpen(false);
    setCVStatus('تم اعتماد ' + info.label + ' عبر الكود الوظيفي الأول.', 'success');
}

function collectCVForm() {
    return {
        fullName: cvUI.fullName?.value.trim() || '',
        jobTitle: cvUI.jobTitle?.value.trim() || '',
        language: cvUI.language?.value || '',
        birthDate: cvUI.birthDate?.value || '',
        age: cvUI.age?.value.trim() || '',
        email: cvUI.email?.value.trim() || '',
        phone: cvUI.phone?.value.trim() || '',
        location: cvUI.location?.value.trim() || '',
        nationality: cvUI.nationality?.value.trim() || '',
        links: cvUI.links?.value.trim() || '',
        summary: cvUI.summary?.value.trim() || '',
        projects: cvUI.projects?.value.trim() || '',
        achievements: cvUI.achievements?.value.trim() || '',
        experience: cvUI.experience?.value.trim() || '',
        education: cvUI.education?.value.trim() || '',
        certifications: cvUI.certifications?.value.trim() || '',
        skills: cvUI.skills?.value.trim() || '',
        languages: cvUI.languages?.value.trim() || '',
        extra: cvUI.extra?.value.trim() || '',
        volunteering: cvUI.volunteering?.value.trim() || '',
        references: cvUI.references?.value.trim() || '',
        prompt: cvUI.prompt?.value.trim() || '',
        profilePhotoPath: cvState.profileImage?.path || '',
        profilePhotoName: cvState.profileImage?.name || ''
    };
}

function fillCVForm(form) {
    const f = form || {};
    const map = {
        fullName: cvUI.fullName, jobTitle: cvUI.jobTitle, birthDate: cvUI.birthDate, age: cvUI.age,
        email: cvUI.email, phone: cvUI.phone, location: cvUI.location, nationality: cvUI.nationality, links: cvUI.links,
        summary: cvUI.summary, projects: cvUI.projects, achievements: cvUI.achievements, experience: cvUI.experience, education: cvUI.education,
        certifications: cvUI.certifications, skills: cvUI.skills, languages: cvUI.languages,
        extra: cvUI.extra, volunteering: cvUI.volunteering, references: cvUI.references, prompt: cvUI.prompt
    };
    Object.keys(map).forEach(function(key) { if (map[key]) map[key].value = f[key] || ''; });
    if (cvUI.language) cvUI.language.value = f.language || '';
    if (cvUI.prompt) {
        cvUI.prompt.style.height = 'auto';
        cvUI.prompt.style.height = Math.min(cvUI.prompt.scrollHeight, 180) + 'px';
    }
}

const CV_EDITABLE_FIELDS = Object.freeze([
    ['fullName', 'الاسم الكامل'],
    ['jobTitle', 'المسمى الوظيفي المستهدف'],
    ['language', 'لغة السيرة'],
    ['birthDate', 'تاريخ الازدياد'],
    ['age', 'العمر'],
    ['email', 'البريد الإلكتروني'],
    ['phone', 'رقم الهاتف'],
    ['location', 'المدينة / البلد'],
    ['nationality', 'الجنسية'],
    ['links', 'LinkedIn / Portfolio'],
    ['summary', 'النبذة المهنية'],
    ['projects', 'المشاريع والأعمال'],
    ['achievements', 'الإنجازات والجوائز'],
    ['experience', 'الخبرات والوظائف السابقة'],
    ['education', 'الدراسة والشهادات الأكاديمية'],
    ['certifications', 'الشهادات والدورات'],
    ['skills', 'المهارات'],
    ['languages', 'اللغات'],
    ['extra', 'معلومات إضافية'],
    ['volunteering', 'العمل التطوعي والأنشطة'],
    ['references', 'المراجع المهنية']
]);

function cloneCVForm(form) {
    const source = form || {};
    const copy = {};
    CV_EDITABLE_FIELDS.forEach(function(item) { copy[item[0]] = String(source[item[0]] || ''); });
    copy.prompt = String(source.prompt || '');
    copy.profilePhotoPath = String(source.profilePhotoPath || '');
    copy.profilePhotoName = String(source.profilePhotoName || '');
    return copy;
}

function getCVEditInput(key) {
    const map = {
        fullName: cvUI.editFullName, jobTitle: cvUI.editJobTitle, language: cvUI.editLanguage,
        birthDate: cvUI.editBirthDate, age: cvUI.editAge, email: cvUI.editEmail, phone: cvUI.editPhone,
        location: cvUI.editLocation, nationality: cvUI.editNationality, links: cvUI.editLinks, summary: cvUI.editSummary,
        projects: cvUI.editProjects, achievements: cvUI.editAchievements, experience: cvUI.editExperience, education: cvUI.editEducation,
        certifications: cvUI.editCertifications, skills: cvUI.editSkills,
        languages: cvUI.editLanguages, extra: cvUI.editExtra,
        volunteering: cvUI.editVolunteering, references: cvUI.editReferences
    };
    return map[key] || null;
}

function fillCVEditForm(form) {
    const source = cloneCVForm(form);
    CV_EDITABLE_FIELDS.forEach(function(item) {
        const input = getCVEditInput(item[0]);
        if (input) input.value = source[item[0]] || '';
    });
    if (cvUI.editNote) cvUI.editNote.value = '';
    cvState.editBaseline = cloneCVForm(source);
    cvState.editPhotoBaseline = cvState.profileImage?.dataUrl || '';
}

function collectCVEditForm() {
    const form = cloneCVForm(cvState.editBaseline || {});
    CV_EDITABLE_FIELDS.forEach(function(item) {
        const input = getCVEditInput(item[0]);
        if (input) form[item[0]] = String(input.value || '').trim();
    });
    form.prompt = getActiveCVProject()?.form?.prompt || '';
    form.profilePhotoPath = cvState.profileImage?.path || '';
    form.profilePhotoName = cvState.profileImage?.name || '';
    return form;
}

function getCVFormChanges(baseForm, nextForm) {
    const base = cloneCVForm(baseForm);
    const next = cloneCVForm(nextForm);
    return CV_EDITABLE_FIELDS.reduce(function(changes, item) {
        const key = item[0];
        if (String(base[key] || '').trim() !== String(next[key] || '').trim()) {
            changes.push({ key: key, label: item[1], oldValue: String(base[key] || '').trim(), newValue: String(next[key] || '').trim() });
        }
        return changes;
    }, []);
}

function mountCVPhotoEditor(target) {
    if (!cvUI.photoEditorBlock || !target) return;
    if (cvUI.photoEditorBlock.parentElement !== target) target.appendChild(cvUI.photoEditorBlock);
}

function updateCVPhotoTile() {
    const photo = cvState.profileImage;
    const hasPhoto = Boolean(photo?.dataUrl);
    if (cvUI.profileThumb) {
        if (hasPhoto) cvUI.profileThumb.src = photo.dataUrl;
        else cvUI.profileThumb.removeAttribute('src');
        cvUI.profileThumb.classList.toggle('hidden', !hasPhoto);
    }
    cvUI.attachBtn?.classList.toggle('has-image', hasPhoto);
    cvUI.profilePreview?.classList.toggle('hidden', !hasPhoto);
    if (cvUI.profileName) cvUI.profileName.textContent = hasPhoto ? (photo.name || 'الصورة الشخصية جاهزة') : '';
    syncCVPhotoAIPanel();
}

function clearCVProfileImage(markDirty) {
    const shouldMarkDirty = markDirty !== false;
    cvState.profileImage = null;
    cvState.profileImageDirty = shouldMarkDirty;
    cvState.photoEditor.image = null;
    cvState.photoEditor.sourceDataUrl = '';
    cvState.photoEditor.sourceName = '';
    cvState.photoEditor.shape = 'square';
    cvState.photoEditor.zoom = 1;
    cvState.photoEditor.rotation = 0;
    cvState.photoEditor.flipX = 1;
    cvState.photoEditor.offsetX = 0;
    cvState.photoEditor.offsetY = 0;
    if (cvUI.profileFile) cvUI.profileFile.value = '';
    cvUI.photoEditorPanel?.classList.add('hidden');
    resetCVPhotoAIResult(true);
    updateCVPhotoTile();
    drawCVPhotoEditor();
}

function roundedRectCVPath(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
}

function buildCVPhotoShapePath(ctx, size, shape) {
    const padding = size * 0.035;
    const left = padding;
    const top = padding;
    const side = size - padding * 2;
    const center = size / 2;
    ctx.beginPath();
    if (shape === 'circle') {
        ctx.arc(center, center, side / 2, 0, Math.PI * 2);
    } else if (shape === 'diamond') {
        ctx.moveTo(center, top);
        ctx.lineTo(left + side, center);
        ctx.lineTo(center, top + side);
        ctx.lineTo(left, center);
        ctx.closePath();
    } else if (shape === 'hexagon') {
        const r = side / 2;
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI / 3 * i - Math.PI / 2;
            const x = center + Math.cos(angle) * r;
            const y = center + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
    } else if (shape === 'rounded') {
        roundedRectCVPath(ctx, left, top, side, side, side * 0.16);
        ctx.closePath();
    } else {
        ctx.rect(left, top, side, side);
    }
}

function renderCVPhoto(ctx, size, forExport) {
    const editor = cvState.photoEditor;
    const image = editor.image;
    ctx.clearRect(0, 0, size, size);
    if (!image) return;
    ctx.save();
    buildCVPhotoShapePath(ctx, size, editor.shape || 'square');
    ctx.clip();
    const quarterTurns = Math.abs(Math.round((editor.rotation || 0) / 90)) % 2;
    const rotatedWidth = quarterTurns ? image.naturalHeight : image.naturalWidth;
    const rotatedHeight = quarterTurns ? image.naturalWidth : image.naturalHeight;
    const coverScale = Math.max(size / rotatedWidth, size / rotatedHeight) * Number(editor.zoom || 1);
    const sourceSize = cvUI.photoCanvas?.width || size;
    const ratio = size / sourceSize;
    ctx.translate(size / 2 + Number(editor.offsetX || 0) * ratio, size / 2 + Number(editor.offsetY || 0) * ratio);
    ctx.rotate((Number(editor.rotation || 0) * Math.PI) / 180);
    ctx.scale((editor.flipX || 1) * coverScale, coverScale);
    ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    ctx.restore();
    if (!forExport) {
        ctx.save();
        buildCVPhotoShapePath(ctx, size, editor.shape || 'square');
        ctx.strokeStyle = 'rgba(121,226,173,.95)';
        ctx.lineWidth = Math.max(3, size * .008);
        ctx.stroke();
        ctx.restore();
    }
}

function drawCVPhotoEditor() {
    const canvas = cvUI.photoCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    renderCVPhoto(ctx, canvas.width, false);
}

function resetCVPhotoTransform(preserveShape) {
    const shape = preserveShape === false ? 'square' : (cvState.photoEditor.shape || 'square');
    Object.assign(cvState.photoEditor, { shape: shape, zoom: 1, rotation: 0, flipX: 1, offsetX: 0, offsetY: 0 });
    if (cvUI.photoZoom) cvUI.photoZoom.value = '1';
    document.querySelectorAll('[data-cv-photo-shape]').forEach(function(button) {
        button.classList.toggle('active', button.dataset.cvPhotoShape === shape);
    });
    drawCVPhotoEditor();
}

function normalizeCVPhotoSource(image) {
    const maxSide = 1200;
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    try { return canvas.toDataURL('image/webp', .88); }
    catch (_) { return canvas.toDataURL('image/jpeg', .88); }
}

function loadCVPhotoEditorImage(dataUrl, name, crop) {
    return new Promise(function(resolve, reject) {
        const image = new Image();
        image.onload = function() {
            cvState.photoEditor.image = image;
            cvState.photoEditor.sourceDataUrl = String(dataUrl || '');
            cvState.photoEditor.sourceName = name || 'profile-photo';
            const saved = crop || {};
            cvState.photoEditor.shape = saved.shape || 'square';
            cvState.photoEditor.zoom = Number(saved.zoom || 1);
            cvState.photoEditor.rotation = Number(saved.rotation || 0);
            cvState.photoEditor.flipX = Number(saved.flipX || 1) || 1;
            const canvasSize = cvUI.photoCanvas?.width || 560;
            cvState.photoEditor.offsetX = Number(saved.offsetXRatio || 0) * canvasSize;
            cvState.photoEditor.offsetY = Number(saved.offsetYRatio || 0) * canvasSize;
            if (cvUI.photoZoom) cvUI.photoZoom.value = String(cvState.photoEditor.zoom);
            document.querySelectorAll('[data-cv-photo-shape]').forEach(function(button) {
                button.classList.toggle('active', button.dataset.cvPhotoShape === cvState.photoEditor.shape);
            });
            cvUI.photoEditorPanel?.classList.remove('hidden');
            drawCVPhotoEditor();
            resolve(image);
        };
        image.onerror = reject;
        image.src = String(dataUrl || '');
    });
}

function commitCVPhotoCrop(closeEditor) {
    const editor = cvState.photoEditor;
    if (!editor.image) return false;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 720;
    exportCanvas.height = 720;
    renderCVPhoto(exportCanvas.getContext('2d'), 720, true);
    const finalDataUrl = exportCanvas.toDataURL('image/png');
    const sourceSize = cvUI.photoCanvas?.width || 560;
    cvState.profileImage = {
        name: editor.sourceName || 'profile-photo.png',
        path: 'assets/profile-photo.png',
        dataUrl: finalDataUrl,
        originalDataUrl: normalizeCVPhotoSource(editor.image),
        crop: {
            shape: editor.shape || 'square',
            zoom: Number(editor.zoom || 1),
            rotation: Number(editor.rotation || 0),
            flipX: Number(editor.flipX || 1),
            offsetXRatio: Number(editor.offsetX || 0) / sourceSize,
            offsetYRatio: Number(editor.offsetY || 0) / sourceSize
        }
    };
    cvState.profileImageDirty = true;
    resetCVPhotoAIResult(false);
    updateCVPhotoTile();
    if (closeEditor !== false) cvUI.photoEditorPanel?.classList.add('hidden');
    setCVStatus('تم اعتماد الصورة بالشكل والقص الحاليين.', 'success');
    return true;
}

function openExistingCVPhotoEditor() {
    const photo = cvState.profileImage;
    if (!photo?.dataUrl) return false;
    const source = photo.originalDataUrl || photo.dataUrl;
    loadCVPhotoEditorImage(source, photo.name || 'profile-photo.png', photo.crop || {}).catch(function() {
        setCVStatus('تعذر فتح الصورة الحالية للتحرير.', 'error');
    });
    return true;
}

function setCVProfileImage(file) {
    if (!file) return;
    resetCVPhotoAIResult(false);
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type || '')) {
        setCVStatus('اختر صورة PNG أو JPG أو WEBP للصورة الشخصية.', 'error');
        return;
    }
    if (file.size > 6 * 1024 * 1024) {
        setCVStatus('حجم الصورة كبير. اختر صورة أقل من 6MB.', 'error');
        return;
    }
    const reader = new FileReader();
    reader.onload = function() {
        loadCVPhotoEditorImage(String(reader.result || ''), file.name, null).then(function() {
            resetCVPhotoTransform(false);
            commitCVPhotoCrop(false);
            setCVStatus('حرّك الصورة واختر الشكل المناسب، ثم اضغط «اعتماد الصورة».', 'info');
        }).catch(function() { setCVStatus('تعذر قراءة الصورة الشخصية.', 'error'); });
    };
    reader.onerror = function() { setCVStatus('تعذر قراءة الصورة الشخصية.', 'error'); };
    reader.readAsDataURL(file);
}

function ensureCVProfileImageFinal() {
    if (cvState.photoEditor.image && !cvUI.photoEditorPanel?.classList.contains('hidden')) commitCVPhotoCrop(true);
    return cvState.profileImage;
}

function setCVPhotoAIStatus(message, type) {
    if (!cvUI.photoAIStatus) return;
    cvUI.photoAIStatus.textContent = message || '';
    cvUI.photoAIStatus.className = 'cv-photo-ai-status' + (type ? ' is-' + type : '');
}

function setCVPhotoAIBusy(busy) {
    cvState.photoAI.busy = Boolean(busy);
    if (cvUI.photoAIEditBtn) {
        cvUI.photoAIEditBtn.disabled = cvState.photoAI.busy || cvState.busy;
        cvUI.photoAIEditBtn.innerHTML = cvState.photoAI.busy
            ? '<i class="fas fa-spinner fa-spin"></i><span>يتم تعديل الصورة</span>'
            : '<i class="fas fa-wand-magic-sparkles"></i><span>تعديل الصورة</span>';
    }
    if (cvUI.photoAIUseBtn) cvUI.photoAIUseBtn.disabled = cvState.photoAI.busy || cvState.busy;
    if (cvUI.photoAIDownloadBtn) cvUI.photoAIDownloadBtn.disabled = cvState.photoAI.busy;
}

function syncCVPhotoAIPanel() {
    const hasPhoto = Boolean(cvState.profileImage?.dataUrl);
    cvUI.photoAIPanel?.classList.toggle('hidden', !hasPhoto);
    if (hasPhoto && !cvState.photoAI.resultDataUrl && cvUI.photoAIOriginalImage) {
        cvUI.photoAIOriginalImage.src = cvState.profileImage.dataUrl;
    }
    if (!hasPhoto) resetCVPhotoAIResult(false);
}

function resetCVPhotoAIResult(clearPrompt) {
    cvState.photoAI.sourceDataUrl = '';
    cvState.photoAI.resultDataUrl = '';
    cvUI.photoAIResult?.classList.add('hidden');
    if (cvUI.photoAINewImage) cvUI.photoAINewImage.removeAttribute('src');
    if (cvUI.photoAIOriginalImage) cvUI.photoAIOriginalImage.removeAttribute('src');
    if (clearPrompt && cvUI.photoAIPrompt) cvUI.photoAIPrompt.value = '';
    setCVPhotoAIStatus('', '');
}

function readBlobAsDataURL(blob) {
    return new Promise(function(resolve, reject) {
        const reader = new FileReader();
        reader.onload = function() { resolve(String(reader.result || '')); };
        reader.onerror = function() { reject(reader.error || new Error('تعذر قراءة الصورة الناتجة.')); };
        reader.readAsDataURL(blob);
    });
}

async function normalizeCVPhotoAIResult(source) {
    const value = String(source || '').trim();
    if (!value) throw new Error('لم يرجع نموذج الصور نتيجة صالحة.');
    if (/^data:image\//i.test(value)) return value;
    try {
        const response = await fetch(value);
        if (!response.ok) throw new Error('تعذر تحميل الصورة الناتجة من الخادم.');
        return await readBlobAsDataURL(await response.blob());
    } catch (_) {
        // بعض مزودي الصور يعيدون رابطًا صالحًا للعرض لكنهم يمنعون تحويله إلى Base64 عبر CORS.
        return value;
    }
}

function loadCVAIImage(dataUrl) {
    return new Promise(function(resolve, reject) {
        const image = new Image();
        image.onload = function() { resolve(image); };
        image.onerror = function() { reject(new Error('تعذر فتح الصورة الناتجة.')); };
        image.src = dataUrl;
    });
}

async function buildCVAIProfileImage(dataUrl) {
    const image = await loadCVAIImage(dataUrl);
    const size = 720;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    const shape = cvState.profileImage?.crop?.shape || cvState.photoEditor.shape || 'square';
    const scale = Math.max(size / Math.max(1, image.naturalWidth), size / Math.max(1, image.naturalHeight));
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    ctx.save();
    buildCVPhotoShapePath(ctx, size, shape);
    ctx.clip();
    ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
    ctx.restore();
    return canvas.toDataURL('image/png');
}

async function editCVPhotoWithAI() {
    if (cvState.photoAI.busy || cvState.busy) return;
    const photo = ensureCVProfileImageFinal();
    const prompt = cvUI.photoAIPrompt?.value.trim() || '';
    if (!photo?.dataUrl) return setCVPhotoAIStatus('ارفع صورة شخصية واعتمدها أولًا.', 'error');
    if (!prompt) {
        setCVPhotoAIStatus('اكتب التعديل المطلوب على الصورة.', 'error');
        cvUI.photoAIPrompt?.focus();
        return;
    }
    if (!currentUser) {
        setCVPhotoAIStatus('سجّل الدخول أولًا لتعديل الصورة بالذكاء الاصطناعي.', 'error');
        openModal();
        return;
    }

    const model = cvUI.photoAIModel?.value || 'gpt-image-1.5';
    const modelChoice = (MODEL_CATALOG.edit || []).find(function(item) { return item.model === model; })
        || (MODEL_CATALOG.edit || [])[0]
        || { model: model, modelTier: model, quality: 'medium' };
    cvState.photoAI.model = modelChoice.model;
    cvState.photoAI.sourceDataUrl = photo.dataUrl;
    if (cvUI.photoAIOriginalImage) cvUI.photoAIOriginalImage.src = photo.dataUrl;
    cvUI.photoAIResult?.classList.add('hidden');
    setCVPhotoAIBusy(true);
    setCVPhotoAIStatus('يتم تعديل الصورة مع الحفاظ على ملامح الوجه...', 'loading');

    try {
        const payload = {
            userId: currentUser.$id,
            action: 'legacy_chat',
            mode: 'edit',
            prompt: prompt,
            provider: 'openai',
            model: modelChoice.model,
            imageModel: modelChoice.model,
            modelTier: modelChoice.modelTier || modelChoice.model,
            quality: modelChoice.quality || 'medium',
            clientFeature: 'cv_profile_photo_edit',
            imageBase64: photo.dataUrl
        };
        if (modelChoice.inputFidelity) payload.inputFidelity = modelChoice.inputFidelity;
        const responseData = await executeRequest(payload);
        const result = normalizeImageResult(responseData);
        if (!responseData?.success || !result) throw new Error(responseData?.error || 'لم يرجع نموذج الصور صورة معدلة.');
        cvState.photoAI.resultDataUrl = await normalizeCVPhotoAIResult(result);
        if (cvUI.photoAINewImage) cvUI.photoAINewImage.src = cvState.photoAI.resultDataUrl;
        cvUI.photoAIResult?.classList.remove('hidden');
        if (responseData.remainingTokens !== undefined && typeof syncCreditDisplays === 'function') {
            syncCreditDisplays(responseData.remainingTokens);
        }
        setCVPhotoAIStatus('اكتملت الصورة الجديدة. يمكنك تنزيلها أو اعتمادها داخل السيرة.', 'success');
    } catch (error) {
        setCVPhotoAIStatus(error.message || 'تعذر تعديل الصورة.', 'error');
    } finally {
        setCVPhotoAIBusy(false);
    }
}

function downloadCVPhotoAIResult() {
    const dataUrl = cvState.photoAI.resultDataUrl;
    if (!dataUrl) return setCVPhotoAIStatus('أنشئ صورة معدلة أولًا.', 'error');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'aklake-cv-profile-ai.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setCVPhotoAIStatus('تم تجهيز الصورة الجديدة للتنزيل.', 'success');
}

async function adoptCVPhotoAIResult() {
    if (cvState.photoAI.busy || cvState.busy) return;
    const resultDataUrl = cvState.photoAI.resultDataUrl;
    if (!resultDataUrl) return setCVPhotoAIStatus('أنشئ صورة معدلة أولًا.', 'error');

    setCVPhotoAIBusy(true);
    setCVPhotoAIStatus('يتم اعتماد الصورة الجديدة...', 'loading');
    try {
        let shapedDataUrl = resultDataUrl;
        try { shapedDataUrl = await buildCVAIProfileImage(resultDataUrl); } catch (_) {}
        const shape = cvState.profileImage?.crop?.shape || cvState.photoEditor.shape || 'square';
        const oldPath = cvState.profileImage?.path || 'assets/profile-photo.png';
        const newPath = 'assets/profile-photo-ai-' + Date.now() + '.png';
        cvState.profileImage = {
            name: 'profile-photo-ai.png',
            path: newPath,
            dataUrl: shapedDataUrl,
            originalDataUrl: resultDataUrl,
            crop: { shape: shape, zoom: 1, rotation: 0, flipX: 1, offsetXRatio: 0, offsetYRatio: 0 }
        };
        cvState.profileImageDirty = true;
        updateCVPhotoTile();

        const project = getActiveCVProject();
        const version = project?.versions?.[cvState.currentVersionIndex];
        if (!version?.html) {
            setCVPhotoAIStatus('تم اعتماد الصورة الجديدة. ستُستخدم عند إنشاء السيرة.', 'success');
            return;
        }

        const form = cloneCVForm(version.form || project.form || collectCVForm());
        form.profilePhotoPath = newPath;
        form.profilePhotoName = 'profile-photo-ai.png';
        const instruction = 'غيّر فقط مسار src للصورة الشخصية من ' + oldPath + ' إلى ' + newPath + '. لا تعدل أي نص أو لون أو تخطيط أو مقاس أو قسم آخر داخل السيرة.';
        appendCVUserMessage('تحديث الصورة الشخصية الاحترافية فقط', true);
        showCVGeneration(true, project.title, 'تحديث مسار الصورة');
        setCVBusy(true, 'يتم تحديث مسار الصورة داخل HTML الحالي فقط...');
        const response = await requestCVFromFirstFunction('revise', form, instruction, version.html, [], 'replace');
        if (!response) { showCVGeneration(false); return; }
        const html = extractCVHtml(response);
        saveCVVersion(html, 'تحديث الصورة الشخصية', form, 'revise');
        if (response.remainingTokens !== undefined && typeof syncCreditDisplays === 'function') syncCreditDisplays(response.remainingTokens);
        fillCVForm(form);
        setCVPreviewOpen(true);
        showCVVersion(getActiveCVProject()?.versions?.[cvState.currentVersionIndex]);
        showCVView('preview');
        showCVComplete(form.fullName || project.title, false);
        setCVPhotoAIStatus('تم اعتماد الصورة الجديدة وتحديث مسارها داخل CV كنسخة جديدة.', 'success');
        setCVStatus('تم تحديث الصورة الشخصية فقط مع الاحتفاظ بالنسخة السابقة.', 'success');
    } catch (error) {
        showCVGeneration(false);
        setCVPhotoAIStatus(error.message || 'تعذر اعتماد الصورة داخل السيرة.', 'error');
    } finally {
        setCVBusy(false);
        setCVPhotoAIBusy(false);
    }
}

function cvField(label, value) {
    const clean = String(value || '').trim();
    return clean ? label + ': ' + clean : '';
}

function buildCVGenerationPrompt(form) {
    const fields = [
        cvField('الاسم الكامل', form.fullName),
        cvField('المسمى الوظيفي المستهدف', form.jobTitle),
        cvField('تاريخ الازدياد', form.birthDate),
        cvField('العمر', form.age),
        cvField('البريد الإلكتروني', form.email),
        cvField('الهاتف', form.phone),
        cvField('الموقع', form.location),
        cvField('الجنسية', form.nationality),
        cvField('LinkedIn / Portfolio', form.links),
        cvField('النبذة المهنية', form.summary),
        cvField('المشاريع والأعمال', form.projects),
        cvField('الإنجازات والجوائز', form.achievements),
        cvField('الخبرات والوظائف السابقة', form.experience),
        cvField('الدراسة والشهادات الأكاديمية', form.education),
        cvField('الشهادات والدورات', form.certifications),
        cvField('المهارات', form.skills),
        cvField('اللغات', form.languages),
        cvField('معلومات إضافية', form.extra),
        cvField('العمل التطوعي والأنشطة', form.volunteering),
        cvField('المراجع المهنية', form.references)
    ].filter(Boolean).join('\n\n');
    const photoRule = form.profilePhotoPath
        ? 'توجد صورة شخصية جاهزة داخل أصول المشروع. استخدم هذا المسار حرفيًا داخل src للصورة: ' + form.profilePhotoPath + '. لا تحتاج إلى رؤية الصورة نفسها ولا إلى تحليل محتواها؛ استخدم المسار كما هو، ولا تخترع رابطًا آخر ولا تغيّر القص أو الشكل بالكود.'
        : 'لا توجد صورة شخصية مرفقة؛ لا تضف صورة وهمية ولا صورة من الإنترنت.';
    return [
        'أنت مصمم سير ذاتية ومهندس واجهات محترف داخل AKLAKE.',
        'أنشئ سيرة ذاتية احترافية جدًا كوثيقة HTML واحدة كاملة تبدأ بـ <!DOCTYPE html> وتحتوي CSS داخل <style> ويمكن أن تحتوي JavaScript داخليًا عند الحاجة فقط.',
        'الوثيقة يجب أن تكون جاهزة للعرض والطباعة على A4، متجاوبة، نظيفة، سهلة القراءة، وتستخدم البيانات المقدمة فقط دون اختراع خبرات أو شهادات أو أرقام أو جهات عمل.',
        'اختر RTL تلقائيًا للعربية وLTR للغات الأخرى. اجعل التصميم مناسبًا للتوظيف واحترافيًا أكثر من كونه صفحة تسويق.',
        'مهم جدًا: أعد HTML فقط دون Markdown ودون ``` ودون شرح قبل أو بعد الكود.',
        photoRule,
        '',
        'لغة السيرة: ' + (form.language || 'استنتج اللغة المناسبة من طلب المستخدم ومعلوماته'),
        '',
        'تعليمات المستخدم:',
        form.prompt || 'أنشئ CV احترافيًا اعتمادًا على المعلومات المتوفرة.',
        '',
        'معلومات السيرة:',
        fields || 'لم تُدخل معلومات إضافية غير الاسم.'
    ].join('\n');
}

function buildCVRevisionPrompt(instruction, currentHtml, form, changes, photoChange) {
    const photoRule = form.profilePhotoPath
        ? 'الصورة الشخصية موجودة محليًا في أصول المشروع. حافظ على مسارها حرفيًا: ' + form.profilePhotoPath + '، ولا تحتاج إلى رؤية الصورة نفسها أو تحليلها، ولا تضف CSS يعيد قصها أو يغيّر شكلها.'
        : (photoChange === 'remove' ? 'احذف الصورة الشخصية الحالية من السيرة ولا تستبدلها بصورة وهمية.' : 'لا تضف صورة شخصية غير مقدمة.');
    const normalizedChanges = Array.isArray(changes) ? changes : [];
    const changesText = normalizedChanges.length
        ? normalizedChanges.map(function(change) {
            const value = String(change.newValue || '').trim();
            return '- ' + change.label + ': ' + (value ? 'استبدل القيمة الحالية بالقيمة الجديدة «' + value + '».' : 'احذف القيمة القديمة من السيرة لأنها أصبحت فارغة.');
        }).join('\n')
        : '- لا توجد تغييرات حقول منظمة؛ نفّذ الملاحظة فقط.';
    const note = String(instruction || '').trim();
    return [
        'أنت تعدّل سيرة ذاتية HTML جاهزة داخل AKLAKE.',
        'نفّذ فقط تغييرات المعلومات المحددة أدناه والملاحظة إن وجدت، وحافظ على كل جزء لم يُطلب تغييره.',
        'معلومات الحقول الجديدة هي المصدر المعتمد: استبدل القيم القديمة بها، وإذا قيل إن حقلًا أصبح فارغًا فاحذف قيمته القديمة من السيرة.',
        'لا تستنتج أو تملأ حقولًا لم يغيرها المستخدم، ولا تخترع خبرات أو شهادات أو أرقامًا أو جهات عمل.',
        photoRule,
        'أعد وثيقة HTML كاملة فقط دون Markdown ودون شرح.',
        '',
        'تغييرات المعلومات المنظمة:',
        changesText,
        photoChange === 'replace' ? '- الصورة الشخصية: استبدل الصورة الحالية بمسار الصورة الجديد المحدد فقط؛ الصورة نفسها لا تُرسل للنموذج.' : '',
        photoChange === 'remove' ? '- الصورة الشخصية: أزل الصورة القديمة بالكامل.' : '',
        '',
        'ملاحظة المستخدم:',
        note || 'لا توجد ملاحظة إضافية؛ طبّق تغييرات المعلومات فقط.',
        '',
        'HTML الحالي:',
        currentHtml
    ].filter(function(line) { return line !== ''; }).join('\n');
}

function cleanCVHtml(raw) {
    let html = String(raw || '').trim();
    const fenced = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
    if (fenced) html = fenced[1].trim();
    const doctypeIndex = html.search(/<!doctype\s+html/i);
    const htmlIndex = html.search(/<html\b/i);
    const start = doctypeIndex >= 0 ? doctypeIndex : htmlIndex;
    if (start > 0) html = html.slice(start);
    const end = html.toLowerCase().lastIndexOf('</html>');
    if (end >= 0) html = html.slice(0, end + 7);
    return html.trim();
}

function validateCVHtml(raw) {
    const html = cleanCVHtml(raw);
    if (!html || !/<html\b/i.test(html) || !/<body\b/i.test(html)) {
        return { valid: false, html: '', error: 'رد النموذج لا يحتوي على وثيقة HTML كاملة للسيرة الذاتية.' };
    }
    if (/id\s*=\s*["'](?:app-shell|main-inputs-wrapper|cv-builder-studio)["']/i.test(html)) {
        return { valid: false, html: '', error: 'تم منع النتيجة لأنها أعادت واجهة AKLAKE بدل السيرة الذاتية.' };
    }
    return { valid: true, html: html, error: '' };
}

function hydrateCVPhoto(html, project) {
    let output = String(html || '');
    const photo = project?.profileImage || cvState.profileImage;
    if (!photo?.path || !photo?.dataUrl) return output;
    return output.split(photo.path).join(photo.dataUrl);
}

function extractCVHtml(responseData) {
    if (!responseData) return '';
    const candidate = responseData.data || responseData.html || responseData.code || responseData.content || responseData.output || responseData.result || '';
    const value = candidate && typeof candidate === 'object'
        ? (candidate.html || candidate.code || candidate.content || candidate.output || '')
        : candidate;
    const validation = validateCVHtml(value);
    if (!validation.valid) throw new Error(validation.error);
    return validation.html;
}

async function requestCVFromFirstFunction(mode, form, instruction, currentHtml, changes, photoChange) {
    if (!currentUser) {
        alert('يرجى تسجيل الدخول أولاً. ستبقى المعلومات التي كتبتها في مكانها.');
        openModal();
        return null;
    }
    ui.source.value = FIRST_FUNCTION_ID;
    const prompt = mode === 'revise'
        ? buildCVRevisionPrompt(instruction, currentHtml, form, changes, photoChange)
        : buildCVGenerationPrompt(form);
    const payload = {
        userId: currentUser.$id,
        action: 'legacy_chat',
        mode: 'text',
        prompt: prompt,
        provider: cvState.provider,
        model: cvState.model,
        modelTier: cvState.model,
        cvRequest: true,
        // مثل منشئ المواقع: النموذج يستلم مسار الأصل فقط، أما بيانات الصورة فتبقى محليًا للمعاينة والتنزيل.
        cvProfileImagePath: cvState.profileImage?.path || ''
    };
    const execution = await appwriteFunctions.createExecution(
        FIRST_FUNCTION_ID,
        JSON.stringify(payload),
        false,
        '/',
        'POST',
        { 'Content-Type': 'application/json' }
    );
    let data = null;
    try { data = execution.responseBody ? JSON.parse(execution.responseBody) : null; }
    catch (_) { throw new Error('رد الكود الوظيفي الأول ليس JSON صالحًا.'); }
    if (execution.status === 'failed' || Number(execution.responseStatusCode || 200) >= 400 || data?.success === false) {
        throw new Error(data?.error || execution.errors || 'تعذر إنشاء السيرة عبر الكود الوظيفي الأول.');
    }
    return data || {};
}

function appendCVUserMessage(message, hasPhoto) {
    if (!cvUI.conversation) return;
    const row = document.createElement('div');
    row.className = 'message-row user-message landing-user-message';
    row.dataset.cvDynamic = 'true';
    row.innerHTML = '<div class="message-avatar"><i class="far fa-user"></i></div><div class="message-content"><div class="message-bubble"></div>' +
        (hasPhoto ? '<div class="message-source"><i class="far fa-image"></i> صورة شخصية نهائية مرفقة</div>' : '') + '</div>';
    row.querySelector('.message-bubble').textContent = message;
    cvUI.conversation.insertBefore(row, cvUI.generationCard || null);
    row.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function clearCVDynamicMessages() {
    cvUI.conversation?.querySelectorAll('[data-cv-dynamic="true"]').forEach(function(row) { row.remove(); });
}

function showCVGeneration(visible, name, label) {
    cvUI.generationCard?.classList.toggle('hidden', !visible);
    if (!visible) return;
    cvUI.completeCard?.classList.add('hidden');
    if (cvUI.progressName) cvUI.progressName.textContent = name || 'السيرة الجديدة';
    if (cvUI.progressModel) cvUI.progressModel.textContent = (label || 'إنشاء CV') + ' · ' + (CV_MODEL_INFO[cvState.provider + ':' + cvState.model]?.label || cvState.model) + ' · الكود 1';
    cvUI.generationCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showCVComplete(name, shouldScroll) {
    showCVGeneration(false);
    if (cvUI.completeTitle) cvUI.completeTitle.textContent = name || getActiveCVProject()?.title || 'CV جاهز';
    cvUI.completeCard?.classList.remove('hidden');
    if (shouldScroll !== false) cvUI.completeCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function saveCVVersion(html, label, form, operation) {
    const validation = validateCVHtml(html);
    if (!validation.valid) throw new Error(validation.error);
    const now = Date.now();
    let project = getActiveCVProject();
    if (!project) {
        project = {
            id: createScopedId('cv'),
            title: form.fullName || 'CV جديد',
            createdAt: now,
            updatedAt: now,
            form: {},
            profileImage: null,
            versions: []
        };
        cvState.projects.unshift(project);
        cvState.activeProjectId = project.id;
    }
    project.title = form.fullName || project.title || 'CV جديد';
    project.form = Object.assign({}, cloneCVForm(form), { prompt: form.prompt || project.form?.prompt || '' });
    if (cvState.profileImageDirty) project.profileImage = cvState.profileImage ? Object.assign({}, cvState.profileImage) : null;
    else if (cvState.profileImage && !project.profileImage) project.profileImage = Object.assign({}, cvState.profileImage);
    project.updatedAt = now;
    project.versions = Array.isArray(project.versions) ? project.versions : [];
    project.versions.push({
        id: createScopedId('cv-version'),
        html: validation.html,
        label: label || 'نسخة جديدة',
        operation: operation || 'generate',
        instruction: operation === 'revise' ? (label || '') : (form.prompt || ''),
        form: cloneCVForm(form),
        createdAt: now
    });
    if (project.versions.length > CV_MAX_VERSIONS) project.versions = project.versions.slice(-CV_MAX_VERSIONS);
    cvState.currentVersionIndex = project.versions.length - 1;
    cvState.editVersionId = null;
    cvState.profileImageDirty = false;
    persistCVProjects();
    renderCVProjects();
    if (typeof renderContextHistory === 'function') renderContextHistory(false);
    return project;
}

function renderCVProjects() {
    if (!cvUI.projectsList) return;
    cvUI.projectsList.innerHTML = '';
    if (!cvState.projects.length) {
        cvUI.projectsList.innerHTML = '<div class="landing-empty-projects"><i class="far fa-id-card"></i><span>لا توجد سير محفوظة بعد.</span></div>';
        return;
    }
    cvState.projects.forEach(function(project) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'landing-project-card' + (project.id === cvState.activeProjectId ? ' active' : '');
        const count = Array.isArray(project.versions) ? project.versions.length : 0;
        button.innerHTML = '<span class="landing-project-icon"><i class="far fa-id-card"></i></span><span class="landing-project-copy"><strong></strong><small></small></span><span class="landing-project-count"></span>';
        button.querySelector('strong').textContent = project.title || 'CV بدون اسم';
        button.querySelector('small').textContent = new Date(project.updatedAt || project.createdAt || Date.now()).toLocaleDateString('ar-MA');
        button.querySelector('.landing-project-count').textContent = count + ' نسخة';
        button.addEventListener('click', function() { openCVProject(project.id); });
        cvUI.projectsList.appendChild(button);
    });
}

function getCurrentCVVersion() {
    const project = getActiveCVProject();
    return project?.versions?.[cvState.currentVersionIndex] || null;
}

function getCurrentCVVersionForm() {
    const project = getActiveCVProject();
    const version = getCurrentCVVersion();
    return cloneCVForm(version?.form || project?.form || {});
}

function showCVView(viewName) {
    const requested = ['preview', 'edit', 'code'].includes(viewName) ? viewName : 'preview';
    cvState.activeView = requested;
    const showPreview = requested === 'preview';
    const showEdit = requested === 'edit';
    const showCode = requested === 'code';
    cvUI.previewView?.classList.toggle('hidden', !showPreview);
    cvUI.editView?.classList.toggle('hidden', !showEdit);
    cvUI.codeView?.classList.toggle('hidden', !showCode);
    if (cvUI.output) cvUI.output.dataset.cvActiveView = requested;
    if (showEdit) {
        const version = getCurrentCVVersion();
        if (cvState.editVersionId !== version?.id) {
            fillCVEditForm(getCurrentCVVersionForm());
            cvState.editVersionId = version?.id || null;
            cvState.profileImageDirty = false;
        }
        if (cvUI.photoEditHost) mountCVPhotoEditor(cvUI.photoEditHost);
        cvUI.photoEditorPanel?.classList.add('hidden');
        updateCVPhotoTile();
    } else {
        if (cvUI.photoAssistantHost) mountCVPhotoEditor(cvUI.photoAssistantHost);
        cvUI.photoEditorPanel?.classList.add('hidden');
    }
    document.querySelectorAll('[data-cv-view]').forEach(function(button) {
        button.classList.toggle('active', button.dataset.cvView === cvState.activeView);
    });
}

function setCVDevice(device) {
    applyPreviewDevice(cvUI.previewShell, '[data-cv-device]', 'data-cv-device', device);
}

function updateCVVersionNavigation() {
    const project = getActiveCVProject();
    const total = project?.versions?.length || 0;
    const current = total ? cvState.currentVersionIndex + 1 : 0;
    if (cvUI.versionLabel) cvUI.versionLabel.textContent = total ? 'النسخة ' + current + ' من ' + total : 'لا توجد نسخ';
    if (cvUI.prevVersionBtn) cvUI.prevVersionBtn.disabled = current <= 1;
    if (cvUI.nextVersionBtn) cvUI.nextVersionBtn.disabled = !total || current >= total;
}

function showCVVersion(version) {
    const validation = validateCVHtml(version?.html || '');
    const hasVersion = validation.valid;
    const project = getActiveCVProject();
    cvUI.emptyPreview?.classList.toggle('hidden', hasVersion);
    cvUI.previewShell?.classList.toggle('hidden', !hasVersion);
    cvUI.revisionPanel?.classList.toggle('hidden', !hasVersion);
    if (cvUI.previewFrame) cvUI.previewFrame.srcdoc = hasVersion ? hydrateCVPhoto(validation.html, project) : '';
    if (cvUI.codeEditor) cvUI.codeEditor.value = hasVersion ? validation.html : '';
    if (hasVersion) showCVComplete(project?.title, false);
    else cvUI.completeCard?.classList.add('hidden');
    if (hasVersion && cvState.activeView === 'edit') {
        fillCVEditForm(version?.form || project?.form || {});
        cvState.editVersionId = version?.id || null;
        cvState.profileImageDirty = false;
    }
    updateCVVersionNavigation();
}

function syncCVWorkspaceLayout() {
    const active = Boolean(cvState.previewOpen && ui?.action?.value === 'cv_builder');
    ui?.appShell?.classList.toggle('landing-preview-layout', active);
    cvUI.studio?.classList.toggle('is-preview-mode', active);
    cvUI.studio?.classList.toggle('is-chat-collapsed', active && cvState.chatCollapsed);
    document.body.classList.toggle('cv-preview-open', active);
    if (cvUI.closeChatBtn) {
        cvUI.closeChatBtn.setAttribute('aria-hidden', String(!active));
        cvUI.closeChatBtn.tabIndex = active ? 0 : -1;
    }
}

function setCVPreviewOpen(open) {
    cvState.previewOpen = Boolean(open);
    cvUI.output?.classList.toggle('hidden', !cvState.previewOpen);
    if (cvState.previewOpen) {
        cvState.chatCollapsed = false;
        showCVView('preview');
    } else {
        cvState.chatCollapsed = false;
    }
    syncCVWorkspaceLayout();
}

function collapseCVChatPanel() {
    if (!cvState.previewOpen) return false;
    cvState.chatCollapsed = true;
    syncCVWorkspaceLayout();
    return true;
}

window.restoreCVChatPanel = function() {
    if (!cvState.previewOpen || !cvState.chatCollapsed) return false;
    cvState.chatCollapsed = false;
    syncCVWorkspaceLayout();
    requestAnimationFrame(function() { cvUI.prompt?.focus(); });
    return true;
};
window.closeCVPreviewWorkspace = function() { setCVPreviewOpen(false); };

function startNewCVProject() {
    cvState.activeProjectId = null;
    cvState.currentVersionIndex = -1;
    cvState.profileImage = null;
    cvState.profileImageDirty = false;
    cvState.editBaseline = null;
    cvState.editVersionId = null;
    fillCVForm({ language: '' });
    clearCVProfileImage(false);
    clearCVDynamicMessages();
    showCVGeneration(false);
    cvUI.completeCard?.classList.add('hidden');
    setCVPreviewOpen(false);
    setCVAssistantOpen(false);
    setCVProjectsOpen(false);
    setCVStatus('', '');
    renderCVProjects();
    if (typeof renderContextHistory === 'function') renderContextHistory(false);
    requestAnimationFrame(function() { cvUI.fullName?.focus(); });
}

function openCVProject(projectId, versionId) {
    const project = cvState.projects.find(function(item) { return item.id === projectId; });
    if (!project) return;
    cvState.activeProjectId = project.id;
    fillCVForm(project.form || {});
    cvState.profileImage = project.profileImage ? Object.assign({}, project.profileImage) : null;
    cvState.profileImageDirty = false;
    cvState.editVersionId = null;
    cvState.photoEditor.image = null;
    cvState.photoEditor.sourceDataUrl = '';
    resetCVPhotoAIResult(false);
    if (cvState.profileImage?.dataUrl) updateCVPhotoTile();
    else clearCVProfileImage(false);
    const versions = project.versions || [];
    let index = versionId ? versions.findIndex(function(v) { return v.id === versionId; }) : versions.length - 1;
    if (index < 0) index = Math.max(0, versions.length - 1);
    cvState.currentVersionIndex = versions.length ? index : -1;
    clearCVDynamicMessages();
    showCVVersion(versions[index] || null);
    setCVPreviewOpen(Boolean(versions[index]?.html));
    renderCVProjects();
    setCVProjectsOpen(false);
    if (typeof renderContextHistory === 'function') renderContextHistory(false);
}
window.openCVProject = openCVProject;

function moveCVVersion(direction) {
    const project = getActiveCVProject();
    if (!project?.versions?.length) return;
    const next = cvState.currentVersionIndex + direction;
    if (next < 0 || next >= project.versions.length) return;
    cvState.currentVersionIndex = next;
    showCVVersion(project.versions[next]);
    setCVStatus('تم فتح ' + (project.versions[next].label || 'نسخة محفوظة') + '.', 'info');
}

async function generateCV() {
    if (cvState.busy) return;
    const activeProject = getActiveCVProject();
    const activeVersion = activeProject?.versions?.[cvState.currentVersionIndex];
    const currentPrompt = cvUI.prompt?.value.trim() || '';
    if (cvState.previewOpen && activeVersion?.html) {
        if (!currentPrompt) {
            setCVStatus('اكتب التعديل المطلوب على السيرة الحالية.', 'error');
            cvUI.prompt?.focus();
            return;
        }
        if (cvUI.revisionPrompt) cvUI.revisionPrompt.value = currentPrompt;
        if (cvUI.prompt) { cvUI.prompt.value = ''; cvUI.prompt.style.height = 'auto'; }
        return reviseCV();
    }
    ensureCVProfileImageFinal();
    const form = collectCVForm();
    const required = cvUI.fullName?.closest('.landing-required-name');
    required?.classList.remove('has-error');
    if (!form.fullName) {
        required?.classList.add('has-error');
        setCVStatus('أدخل الاسم الكامل أولاً.', 'error');
        cvUI.fullName?.focus();
        return;
    }
    const hasUsefulDetails = [form.jobTitle, form.summary, form.projects, form.achievements, form.experience, form.education, form.skills, form.prompt].some(Boolean);
    if (!hasUsefulDetails) {
        setCVStatus('أضف وصفًا أو بعض الخبرات/الدراسة/المهارات حتى تكون السيرة مفيدة.', 'error');
        cvUI.prompt?.focus();
        return;
    }
    appendCVUserMessage(form.prompt || 'أنشئ سيرة ذاتية احترافية من المعلومات التي أدخلتها.', Boolean(cvState.profileImage));
    setCVPreviewOpen(false);
    showCVGeneration(true, form.fullName, 'إنشاء السيرة');
    setCVAssistantOpen(false);
    setCVModelPopoverOpen(false);
    setCVBusy(true, 'النموذج يصمم السيرة عبر الكود الوظيفي الأول...');
    try {
        const response = await requestCVFromFirstFunction('generate', form, '', '');
        if (!response) { showCVGeneration(false); return; }
        const html = extractCVHtml(response);
        saveCVVersion(html, 'النسخة الأولى', form, 'generate');
        if (response.remainingTokens !== undefined && typeof syncCreditDisplays === 'function') syncCreditDisplays(response.remainingTokens);
        showCVVersion(getActiveCVProject()?.versions?.[cvState.currentVersionIndex]);
        showCVComplete(form.fullName);
        setCVStatus('تم إنشاء السيرة وحفظ النسخة الأولى. يمكنك معاينتها أو طلب تعديل جديد.', 'success');
        if (cvUI.prompt) { cvUI.prompt.value = ''; cvUI.prompt.style.height = 'auto'; }
    } catch (error) {
        showCVGeneration(false);
        setCVStatus(error.message || 'تعذر إنشاء السيرة الذاتية.', 'error');
    } finally {
        setCVBusy(false);
    }
}

async function reviseCV(options) {
    if (cvState.busy) return;
    const opts = options && typeof options === 'object' && !(options instanceof Event) ? options : {};
    const project = getActiveCVProject();
    const version = project?.versions?.[cvState.currentVersionIndex];
    if (!version?.html) return setCVStatus('أنشئ سيرة أولاً قبل طلب التعديل.', 'error');

    const fromEditPanel = Boolean(opts.fromEditPanel);
    let instruction = '';
    let form;
    let changes = [];
    let photoChange = '';

    if (fromEditPanel) {
        ensureCVProfileImageFinal();
        const baseline = cloneCVForm(cvState.editBaseline || version.form || project.form || {});
        form = collectCVEditForm();
        changes = getCVFormChanges(baseline, form);
        instruction = cvUI.editNote?.value.trim() || '';
        if (cvState.profileImageDirty) photoChange = cvState.profileImage ? 'replace' : 'remove';
        if (!changes.length && !photoChange && !instruction) {
            setCVStatus('لم تغيّر أي معلومة ولم تكتب ملاحظة تعديل.', 'info');
            return;
        }
    } else {
        instruction = cvUI.revisionPrompt?.value.trim() || '';
        if (!instruction) {
            setCVStatus('اكتب التعديل المطلوب بوضوح.', 'error');
            cvUI.revisionPrompt?.focus();
            return;
        }
        form = cloneCVForm(version.form || project.form || collectCVForm());
    }

    form.profilePhotoPath = cvState.profileImage?.path || '';
    form.profilePhotoName = cvState.profileImage?.name || '';
    const changeSummary = fromEditPanel
        ? [
            changes.length ? 'تحديث ' + changes.length + ' من حقول السيرة' : '',
            photoChange === 'replace' ? 'تحديث الصورة الشخصية' : '',
            photoChange === 'remove' ? 'إزالة الصورة الشخصية' : '',
            instruction
        ].filter(Boolean).join(' · ')
        : instruction;

    appendCVUserMessage(changeSummary || 'تحديث معلومات السيرة الذاتية', Boolean(photoChange === 'replace'));
    showCVGeneration(true, project.title, fromEditPanel ? 'تحديث المعلومات' : 'تعديل السيرة');
    setCVBusy(true, 'يتم إرسال HTML الحالي مع التغييرات إلى النموذج...');
    try {
        const response = await requestCVFromFirstFunction('revise', form, instruction, version.html, changes, photoChange);
        if (!response) { showCVGeneration(false); return; }
        const html = extractCVHtml(response);
        const label = fromEditPanel
            ? ('تحديث معلومات' + (instruction ? ': ' + instruction.slice(0, 45) : ''))
            : ('تعديل: ' + instruction.slice(0, 55));
        saveCVVersion(html, label, form, 'revise');
        if (response.remainingTokens !== undefined && typeof syncCreditDisplays === 'function') syncCreditDisplays(response.remainingTokens);
        if (cvUI.revisionPrompt) cvUI.revisionPrompt.value = '';
        if (cvUI.editNote) cvUI.editNote.value = '';
        fillCVForm(form);
        setCVPreviewOpen(true);
        showCVVersion(getActiveCVProject()?.versions?.[cvState.currentVersionIndex]);
        showCVView('preview');
        showCVComplete(form.fullName || project.title, false);
        setCVStatus('تم تطبيق التغييرات وحفظها كنسخة جديدة، والنسخة السابقة ما زالت متاحة.', 'success');
    } catch (error) {
        showCVGeneration(false);
        setCVStatus(error.message || 'تعذر تعديل السيرة.', 'error');
    } finally {
        setCVBusy(false);
    }
}

function applyCVCodeManually() {
    const validation = validateCVHtml(cvUI.codeEditor?.value || '');
    if (!validation.valid) return setCVStatus(validation.error, 'error');
    const project = getActiveCVProject();
    const form = project?.form || collectCVForm();
    saveCVVersion(validation.html, 'تعديل يدوي على الكود', form, 'manual');
    showCVVersion(getActiveCVProject()?.versions?.[cvState.currentVersionIndex]);
    showCVView('preview');
    setCVStatus('تم تطبيق الكود وحفظه كنسخة جديدة.', 'success');
}

async function copyCVCode() {
    const project = getActiveCVProject();
    const code = hydrateCVPhoto(cvUI.codeEditor?.value || '', project);
    if (!code) return setCVStatus('لا يوجد كود لنسخه بعد.', 'error');
    await copyTextWithFallback(code, cvUI.codeEditor);
    setCVStatus('تم نسخ كود السيرة، متضمنًا الصورة محليًا عند وجودها.', 'success');
}

function downloadCVCode() {
    const project = getActiveCVProject();
    const code = hydrateCVPhoto(cvUI.codeEditor?.value || '', project);
    if (!code) return setCVStatus('لا يوجد CV لتنزيله بعد.', 'error');
    const safeName = sanitizeDownloadName(project?.title, 'aklake-cv');
    downloadTextFile(code, safeName + '-cv.html', 'text/html;charset=utf-8');
    setCVStatus('تم تجهيز ملف HTML للسيرة الذاتية.', 'success');
}


let cvPdfLibraryPromise = null;


function ensureCVPdfLibrary() {
    if (typeof window.html2pdf === 'function') return Promise.resolve(window.html2pdf);
    if (!cvPdfLibraryPromise) {
        cvPdfLibraryPromise = loadScriptOnce('aklake-html2pdf-library', 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js')
            .then(function() {
                if (typeof window.html2pdf !== 'function') throw new Error('مكتبة PDF لم تصبح جاهزة.');
                return window.html2pdf;
            })
            .catch(function(error) { cvPdfLibraryPromise = null; throw error; });
    }
    return cvPdfLibraryPromise;
}

function waitForDocumentImages(doc) {
    return Promise.all(Array.from(doc?.images || []).map(function(image) {
        if (image.complete) return Promise.resolve();
        return new Promise(function(resolve) {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
        });
    }));
}

function prepareCVHtmlForPdf(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    doc.querySelectorAll('script').forEach(function(script) { script.remove(); });
    const style = doc.createElement('style');
    style.setAttribute('data-aklake-pdf', 'true');
    style.textContent = '@page{size:A4;margin:0}html,body{margin:0!important;padding:0!important;background:#fff!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}body{width:210mm!important;min-height:297mm!important;overflow:visible!important}*{box-sizing:border-box}a{text-decoration:none;color:inherit}';
    doc.head.appendChild(style);
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
}

async function downloadCVPdf() {
    const project = getActiveCVProject();
    const version = getCurrentCVVersion();
    if (!project || !version?.html) return setCVStatus('لا يوجد CV لتحويله إلى PDF بعد.', 'error');
    if (cvState.busy) return;
    const hydrated = hydrateCVPhoto(version.html, project);
    const safeName = sanitizeDownloadName(project.title, 'aklake-cv');
    if (cvUI.downloadPdfBtn) cvUI.downloadPdfBtn.disabled = true;
    setCVStatus('يتم تجهيز نسخة PDF عالية الجودة...', 'loading');
    let frame = null;
    try {
        await ensureCVPdfLibrary();
        const pdfHtml = prepareCVHtmlForPdf(hydrated);
        frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.tabIndex = -1;
        frame.style.cssText = 'position:fixed;left:-100000px;top:0;width:794px;height:1123px;border:0;visibility:hidden;pointer-events:none;';
        document.body.appendChild(frame);
        const doc = frame.contentDocument;
        if (!doc) throw new Error('تعذر فتح نسخة PDF المؤقتة.');
        doc.open();
        doc.write(pdfHtml);
        doc.close();
        await new Promise(function(resolve) {
            requestAnimationFrame(function() { requestAnimationFrame(resolve); });
        });
        if (!doc.body) throw new Error('تعذر قراءة محتوى السيرة لتصديره.');
        if (doc.fonts?.ready) await Promise.race([doc.fonts.ready, new Promise(function(resolve) { setTimeout(resolve, 2500); })]);
        await waitForDocumentImages(doc);
        await window.html2pdf().set({
            margin: 0,
            filename: safeName + '-cv.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', logging: false, windowWidth: 794 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
            pagebreak: { mode: ['css', 'legacy'] }
        }).from(doc.body).save();
        setCVStatus('تم تنزيل السيرة الذاتية بصيغة PDF.', 'success');
    } catch (error) {
        setCVStatus(error.message || 'تعذر إنشاء ملف PDF. تحقق من الاتصال ثم حاول مجددًا.', 'error');
    } finally {
        frame?.remove();
        if (cvUI.downloadPdfBtn) cvUI.downloadPdfBtn.disabled = false;
    }
}

function initCVPhotoEditorInteractions() {
    cvUI.assistantCloseBtn?.addEventListener('click', function() { setCVAssistantOpen(false); });
    cvUI.attachBtn?.addEventListener('click', function() {
        if (cvState.profileImage?.dataUrl) {
            if (!openExistingCVPhotoEditor()) cvUI.profileFile?.click();
        } else {
            cvUI.profileFile?.click();
        }
    });
    cvUI.profileFile?.addEventListener('change', function() {
        if (cvUI.profileFile.files?.[0]) setCVProfileImage(cvUI.profileFile.files[0]);
    });
    cvUI.removeProfileBtn?.addEventListener('click', function() {
        clearCVProfileImage(true);
        setCVStatus('تمت إزالة الصورة. سيُحذف استخدامها عند تطبيق التعديل التالي.', 'info');
    });
    document.querySelectorAll('[data-cv-photo-shape]').forEach(function(button) {
        button.addEventListener('click', function() {
            cvState.photoEditor.shape = button.dataset.cvPhotoShape || 'square';
            document.querySelectorAll('[data-cv-photo-shape]').forEach(function(item) { item.classList.toggle('active', item === button); });
            drawCVPhotoEditor();
        });
    });
    cvUI.photoZoom?.addEventListener('input', function() {
        cvState.photoEditor.zoom = Math.max(1, Math.min(3.5, Number(cvUI.photoZoom.value || 1)));
        drawCVPhotoEditor();
    });
    cvUI.photoRotateLeft?.addEventListener('click', function() {
        cvState.photoEditor.rotation = Number(cvState.photoEditor.rotation || 0) - 90;
        drawCVPhotoEditor();
    });
    cvUI.photoRotateRight?.addEventListener('click', function() {
        cvState.photoEditor.rotation = Number(cvState.photoEditor.rotation || 0) + 90;
        drawCVPhotoEditor();
    });
    cvUI.photoFlip?.addEventListener('click', function() {
        cvState.photoEditor.flipX = (cvState.photoEditor.flipX || 1) * -1;
        drawCVPhotoEditor();
    });
    cvUI.photoReset?.addEventListener('click', function() { resetCVPhotoTransform(true); });
    cvUI.photoReplace?.addEventListener('click', function() { cvUI.profileFile?.click(); });
    cvUI.photoApplyBtn?.addEventListener('click', function() { commitCVPhotoCrop(true); });
    cvUI.photoAIModel?.addEventListener('change', function() { cvState.photoAI.model = cvUI.photoAIModel.value; });
    cvUI.photoAIEditBtn?.addEventListener('click', editCVPhotoWithAI);
    cvUI.photoAIDownloadBtn?.addEventListener('click', downloadCVPhotoAIResult);
    cvUI.photoAIUseBtn?.addEventListener('click', adoptCVPhotoAIResult);

    const canvas = cvUI.photoCanvas;
    if (canvas) {
        const pointerPosition = function(event) {
            const rect = canvas.getBoundingClientRect();
            return {
                x: (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width)),
                y: (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height))
            };
        };
        canvas.addEventListener('pointerdown', function(event) {
            if (!cvState.photoEditor.image) return;
            const point = pointerPosition(event);
            cvState.photoEditor.dragging = true;
            cvState.photoEditor.pointerX = point.x;
            cvState.photoEditor.pointerY = point.y;
            canvas.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });
        canvas.addEventListener('pointermove', function(event) {
            if (!cvState.photoEditor.dragging) return;
            const point = pointerPosition(event);
            cvState.photoEditor.offsetX += point.x - cvState.photoEditor.pointerX;
            cvState.photoEditor.offsetY += point.y - cvState.photoEditor.pointerY;
            cvState.photoEditor.pointerX = point.x;
            cvState.photoEditor.pointerY = point.y;
            drawCVPhotoEditor();
            event.preventDefault();
        });
        const stopDrag = function(event) {
            if (!cvState.photoEditor.dragging) return;
            cvState.photoEditor.dragging = false;
            try { canvas.releasePointerCapture?.(event.pointerId); } catch (_) {}
        };
        canvas.addEventListener('pointerup', stopDrag);
        canvas.addEventListener('pointercancel', stopDrag);
        canvas.addEventListener('wheel', function(event) {
            if (!cvState.photoEditor.image) return;
            event.preventDefault();
            const next = Math.max(1, Math.min(3.5, Number(cvState.photoEditor.zoom || 1) + (event.deltaY < 0 ? .08 : -.08)));
            cvState.photoEditor.zoom = next;
            if (cvUI.photoZoom) cvUI.photoZoom.value = String(next);
            drawCVPhotoEditor();
        }, { passive: false });
    }
}

function initCVStudio() {
    cacheCVUI();
    if (!cvUI.studio || cvUI.studio.dataset.initialized === 'true') return;
    cvUI.studio.dataset.initialized = 'true';
    loadCVProjects();

    cvUI.newProjectBtn?.addEventListener('click', startNewCVProject);
    cvUI.closeChatBtn?.addEventListener('click', collapseCVChatPanel);
    cvUI.projectsToggle?.addEventListener('click', function() { setCVProjectsOpen(cvUI.projectsPanel?.classList.contains('hidden')); });
    cvUI.assistantToggle?.addEventListener('click', function() { setCVAssistantOpen(cvUI.assistantPanel?.classList.contains('hidden')); });
    initCVPhotoEditorInteractions();
    cvUI.fullName?.addEventListener('input', function() { cvUI.fullName.closest('.landing-required-name')?.classList.remove('has-error'); });
    cvUI.modelToggle?.addEventListener('click', function() { setCVModelPopoverOpen(cvUI.modelPopover?.classList.contains('hidden')); });
    cvUI.closeModelBtn?.addEventListener('click', function() { setCVModelPopoverOpen(false); });
    cvUI.modelCards?.querySelectorAll('[data-cv-model]').forEach(function(card) {
        card.addEventListener('click', function() { setCVPendingModel(card.dataset.cvProvider + ':' + card.dataset.cvModel); });
    });
    cvUI.rememberModelToggle?.addEventListener('change', updateCVRememberIcon);
    cvUI.confirmModelBtn?.addEventListener('click', confirmCVModelChoice);
    cvUI.generateBtn?.addEventListener('click', generateCV);
    cvUI.openResultBtn?.addEventListener('click', function() { setCVPreviewOpen(true); });
    cvUI.closePreviewBtn?.addEventListener('click', function() { setCVPreviewOpen(false); cvUI.completeCard?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    cvUI.reviseBtn?.addEventListener('click', function() { reviseCV(); });
    cvUI.editSubmitBtn?.addEventListener('click', function() { reviseCV({ fromEditPanel: true }); });
    cvUI.applyCodeBtn?.addEventListener('click', applyCVCodeManually);
    cvUI.copyBtn?.addEventListener('click', copyCVCode);
    cvUI.downloadBtn?.addEventListener('click', downloadCVCode);
    cvUI.downloadPdfBtn?.addEventListener('click', downloadCVPdf);
    cvUI.prevVersionBtn?.addEventListener('click', function() { moveCVVersion(-1); });
    cvUI.nextVersionBtn?.addEventListener('click', function() { moveCVVersion(1); });

    document.querySelectorAll('[data-cv-view]').forEach(function(button) {
        button.addEventListener('click', function() { showCVView(button.dataset.cvView); });
    });
    document.querySelectorAll('[data-cv-device]').forEach(function(button) {
        button.addEventListener('click', function() { setCVDevice(button.dataset.cvDevice); });
    });
    cvUI.prompt?.addEventListener('input', function() {
        cvUI.prompt.style.height = 'auto';
        cvUI.prompt.style.height = Math.min(cvUI.prompt.scrollHeight, 180) + 'px';
    });
    cvUI.prompt?.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); generateCV(); }
    });
    cvUI.revisionPrompt?.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); reviseCV(); }
    });

    const remembered = readCVRememberedModel();
    applyCVModel(remembered || CV_MODEL_INFO['openai:gpt-4.1-mini']);
    if (cvUI.rememberModelToggle) cvUI.rememberModelToggle.checked = Boolean(remembered);
    updateCVRememberIcon();
    setCVAssistantOpen(false);
    setCVProjectsOpen(false);
    setCVModelPopoverOpen(false);
    setCVPreviewOpen(false);
    renderCVProjects();
    startNewCVProject();
}
window.initCVStudio = initCVStudio;

// تهيئة مستقلة احتياطية: الدالة نفسها محمية من التكرار عبر data-initialized.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCVStudio, { once: true });
} else {
    initCVStudio();
}



