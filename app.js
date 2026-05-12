// State
let cropper = null;
let originalImageSrc = '';
let processedImageSrc = ''; // After BG removal
let currentWidth = 295;
let currentHeight = 413;
let currentBgColor = 'transparent';
let isBgRemoved = false;
let originalFileType = 'image/jpeg';
let currentRatioName = '一寸';

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const workspace = document.getElementById('workspace');
const imageToCrop = document.getElementById('imageToCrop');
const sizeSelector = document.getElementById('sizeSelector');
const removeBgToggle = document.getElementById('removeBgToggle');
const colorOptions = document.getElementById('colorOptions');
const exportBtn = document.getElementById('exportBtn');
const sizeHelper = document.getElementById('sizeHelper');
const loader = document.getElementById('loader');
const reselectBtn = document.getElementById('reselectBtn');
const customSizePanel = document.getElementById('customSizePanel');
const customWidthInput = document.getElementById('customWidth');
const customHeightInput = document.getElementById('customHeight');
const applyCustomSizeBtn = document.getElementById('applyCustomSizeBtn');
const beautifyToggle = document.getElementById('beautifyToggle');
const toast = document.getElementById('toast');
const installGuide = document.getElementById('installGuide');
const closeInstallGuide = document.getElementById('closeInstallGuide');
const downloadSheetOverlay = document.getElementById('downloadSheetOverlay');
const saveToAlbumBtn = document.getElementById('saveToAlbumBtn');
const downloadToFileBtn = document.getElementById('downloadToFileBtn');
const closeSheetBtn = document.getElementById('closeSheetBtn');

let toastTimeout = null;
let pendingDataUrl = '';
let pendingFilename = '';

// PWA Install Guide Check
window.addEventListener('DOMContentLoaded', () => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const hasClosedGuide = localStorage.getItem('hideInstallGuide');
    
    if (!isStandalone && !hasClosedGuide && installGuide) {
        installGuide.style.display = 'block';
    }
});

if (closeInstallGuide) {
    closeInstallGuide.addEventListener('click', () => {
        installGuide.style.display = 'none';
        localStorage.setItem('hideInstallGuide', 'true');
    });
}

function showToast(message) {
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        if (toastTimeout) clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }
}

// Setup Events
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--color-primary)';
});
uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = 'var(--color-border)';
});
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = 'var(--color-border)';
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

// Size Selection
sizeSelector.addEventListener('click', (e) => {
    if (e.target.classList.contains('segment-btn')) {
        document.querySelectorAll('.segment-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        if (e.target.dataset.width === 'custom') {
            customSizePanel.style.display = 'flex';
        } else {
            customSizePanel.style.display = 'none';
            currentWidth = parseInt(e.target.dataset.width);
            currentHeight = parseInt(e.target.dataset.height);
            currentRatioName = e.target.dataset.name;
            sizeHelper.textContent = `裁剪框：${currentRatioName}比例`;
            
            if (cropper) {
                cropper.setAspectRatio(currentWidth / currentHeight);
            }
        }
    }
});

if (applyCustomSizeBtn) {
    applyCustomSizeBtn.addEventListener('click', () => {
        const w_mm = parseFloat(customWidthInput.value);
        const h_mm = parseFloat(customHeightInput.value);
        if (w_mm > 0 && h_mm > 0) {
            // Convert mm to pixels at 300 DPI
            currentWidth = Math.round((w_mm / 25.4) * 300);
            currentHeight = Math.round((h_mm / 25.4) * 300);
            currentRatioName = `${w_mm}x${h_mm}mm`;
            sizeHelper.textContent = `裁剪框：自定义 ${currentRatioName}`;
            
            if (cropper) {
                cropper.setAspectRatio(currentWidth / currentHeight);
            }
        }
    });
}

// Beautify toggle
if (beautifyToggle) {
    beautifyToggle.addEventListener('change', (e) => {
        const isBeautify = e.target.checked;
        const cropperContainer = document.querySelector('.cropper-container');
        if (cropperContainer) {
            cropperContainer.style.filter = isBeautify ? 'brightness(1.05) contrast(1.02) saturate(1.05)' : 'none';
        }
    });
}

// Background Removal Toggle
removeBgToggle.addEventListener('change', async (e) => {
    if (e.target.checked) {
        colorOptions.classList.add('active');
        if (!processedImageSrc) {
            await performBackgroundRemoval();
        }
        
        // After processing, verify if the user hasn't toggled it off while waiting
        if (removeBgToggle.checked && processedImageSrc) {
            updateCropperImage(processedImageSrc);
            isBgRemoved = true;
        }
    } else {
        colorOptions.classList.remove('active');
        updateCropperImage(originalImageSrc);
        isBgRemoved = false;
        
        // Reset crop box background
        const cropperContainer = document.querySelector('.cropper-container');
        const viewBox = document.querySelector('.cropper-view-box');
        if (cropperContainer) {
            cropperContainer.style.background = 'none';
            if (viewBox) viewBox.style.background = 'none';
        }
    }
});

// Color Selection
colorOptions.addEventListener('click', (e) => {
    const btn = e.target.closest('.color-btn');
    if (btn) {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBgColor = btn.dataset.color;
        
        // Apply background to cropper preview wrapper
        const cropperContainer = document.querySelector('.cropper-container');
        const viewBox = document.querySelector('.cropper-view-box');
        if (cropperContainer) {
            if (currentBgColor === 'transparent') {
                const bg = 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 50% / 10px 10px';
                cropperContainer.style.background = bg;
                if (viewBox) viewBox.style.background = bg;
            } else {
                cropperContainer.style.background = currentBgColor;
                if (viewBox) viewBox.style.background = currentBgColor;
            }
        }
    }
});

// Export
exportBtn.addEventListener('click', () => {
    if (!cropper) return;
    
    let cropOptions = {
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    };

    // 为标准证件照（一寸/二寸）注入最低印刷级（约 600 DPI）分辨率保障
    // 这样即使用户在小图里抠出很小的脸，也能强制超采样输出高清图，避免发虚
    if (currentRatioName === '一寸比例') {
        cropOptions.minWidth = 590;  // 295 * 2
        cropOptions.minHeight = 826; // 413 * 2
    } else if (currentRatioName === '二寸比例') {
        cropOptions.minWidth = 826;  // 413 * 2
        cropOptions.minHeight = 1252; // 626 * 2
    }

    // Get cropped canvas at its natural, maximum resolution (or upscaled to minWidth/Height)
    const croppedCanvas = cropper.getCroppedCanvas(cropOptions);

    const finalCanvas = document.createElement('canvas');
    // Use the natural high-res cropped dimensions
    const outputWidth = croppedCanvas.width;
    const outputHeight = croppedCanvas.height;
    
    finalCanvas.width = outputWidth;
    finalCanvas.height = outputHeight;
    const ctx = finalCanvas.getContext('2d');
    
    // Draw background if any
    if (isBgRemoved && currentBgColor !== 'transparent') {
        ctx.fillStyle = currentBgColor;
        ctx.fillRect(0, 0, outputWidth, outputHeight);
    }
    
    // Apply Beautify Filter ONLY to the person, not the background color
    if (beautifyToggle && beautifyToggle.checked) {
        ctx.filter = 'brightness(1.05) contrast(1.02) saturate(1.05)';
    }
    
    // Draw the cropped person on top
    ctx.drawImage(croppedCanvas, 0, 0);
    
    // Reset filter
    ctx.filter = 'none';
    
    // Determine export format (use 1.0 maximum quality for jpeg)
    let exportMimeType = 'image/jpeg';
    let exportExt = 'jpg';
    
    // 如果启用了抠图并且底色是透明的，必须用 PNG 格式保留透明度
    if (isBgRemoved && currentBgColor === 'transparent') {
        exportMimeType = 'image/png';
        exportExt = 'png';
    } 
    // 如果没有启用抠图，且原图就是 PNG，则保持 PNG 格式
    else if (!isBgRemoved && originalFileType === 'image/png') {
        exportMimeType = 'image/png';
        exportExt = 'png';
    }
    
    pendingDataUrl = finalCanvas.toDataURL(exportMimeType, 1.0);
    pendingFilename = `证件照_${currentRatioName}_高清.${exportExt}`;
    
    // Check if the device supports Web Share API for files
    let canShareFiles = false;
    if (navigator.canShare) {
        try {
            const testFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
            canShareFiles = navigator.canShare({ files: [testFile] });
        } catch (e) {
            canShareFiles = false;
        }
    }

    if (canShareFiles) {
        // Device supports sharing, show options sheet
        if (downloadSheetOverlay) {
            downloadSheetOverlay.style.display = 'block';
        }
    } else {
        // PWA Mode / PC Mode fallback: Show the image directly on screen for long-press saving to Album!
        const resultOverlay = document.getElementById('resultPreviewOverlay');
        const finalImg = document.getElementById('finalResultImg');
        const forceDownloadLink = document.getElementById('forceDownloadLink');
        const closeResultBtn = document.getElementById('closeResultBtn');
        const directClickSaveBtn = document.getElementById('directClickSaveBtn');
        
        if (resultOverlay && finalImg) {
            finalImg.src = pendingDataUrl;
            resultOverlay.style.display = 'flex';
            
            // Direct click to save
            if (directClickSaveBtn) {
                directClickSaveBtn.onclick = () => {
                    const link = document.createElement('a');
                    link.download = pendingFilename;
                    link.href = pendingDataUrl;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showToast('✨ 绝美证件照已保存！');
                    
                    // Delay close
                    setTimeout(() => {
                        resultOverlay.style.display = 'none';
                    }, 800);
                };
            }
            
            // Backup download handler
            if (forceDownloadLink) {
                forceDownloadLink.onclick = (e) => {
                    e.preventDefault();
                    const link = document.createElement('a');
                    link.download = pendingFilename;
                    link.href = pendingDataUrl;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showToast('✨ 已为您下载到系统【文件】夹！');
                };
            }
            
            // Close modal handler
            closeResultBtn.onclick = () => {
                resultOverlay.style.display = 'none';
            };
        }
    }
});

// Action Sheet Handlers
if (closeSheetBtn) {
    closeSheetBtn.addEventListener('click', () => {
        downloadSheetOverlay.style.display = 'none';
    });
}

if (saveToAlbumBtn) {
    saveToAlbumBtn.addEventListener('click', async () => {
        downloadSheetOverlay.style.display = 'none';
        const file = dataURLtoFile(pendingDataUrl, pendingFilename);
        
        // Check if the device supports Web Share API for files
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                showToast('准备就绪！✨\n👉 弹窗后请点击【保存图像】即可存入手机相册');
                await navigator.share({
                    files: [file],
                    title: 'YY小工具',
                });
            } catch (err) {
                console.log('User canceled share or failed: ', err);
            }
        } else {
            showToast('抱歉宝宝，当前浏览器不支持直接存入相册 🥺\n请重新点击选择【下载到本地文件】哦～');
        }
    });
}

if (downloadToFileBtn) {
    downloadToFileBtn.addEventListener('click', () => {
        downloadSheetOverlay.style.display = 'none';
        const link = document.createElement('a');
        link.download = pendingFilename;
        link.href = pendingDataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('✨ 绝美高清照下载成功！\n已保存至您的系统【下载/文件夹】中，快去看看吧～');
    });
}

// Reselect Image
if (reselectBtn) {
    reselectBtn.addEventListener('click', () => {
        workspace.style.display = 'none';
        workspace.classList.remove('animate-fade-in');
        uploadArea.style.display = 'block';
        fileInput.value = ''; // clear selection
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        originalImageSrc = '';
        processedImageSrc = '';
    });
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('请上传图片文件');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        originalImageSrc = e.target.result;
        originalFileType = file.type;
        processedImageSrc = ''; // Reset processed state
        removeBgToggle.checked = false; // Reset toggle
        colorOptions.classList.remove('active');
        currentBgColor = 'transparent';
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-color="transparent"]').classList.add('active');
        
        uploadArea.style.display = 'none';
        workspace.style.display = 'flex';
        workspace.classList.remove('animate-fade-in');
        void workspace.offsetWidth;
        workspace.classList.add('animate-fade-in');
        
        updateCropperImage(originalImageSrc);
        
        // Asynchronously check if there is a portrait (deferred to let UI render first)
        setTimeout(() => {
            checkPortraitPresence(originalImageSrc);
        }, 100);
    };
    reader.readAsDataURL(file);
}

function updateCropperImage(src) {
    let oldCropData = null;
    let oldCanvasData = null;
    
    if (cropper) {
        oldCropData = cropper.getData();
        oldCanvasData = cropper.getCanvasData();
        cropper.destroy();
    }
    
    imageToCrop.src = src;
    
    cropper = new Cropper(imageToCrop, {
        aspectRatio: currentWidth / currentHeight,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 0.8,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        cropBoxMovable: true,
        cropBoxResizable: true,
        toggleDragModeOnDblclick: false,
        ready: function() {
            // Restore previous crop box and zoom state if available
            if (oldCanvasData) cropper.setCanvasData(oldCanvasData);
            if (oldCropData) cropper.setData(oldCropData);
            
            // Reapply background color or transparent pattern if bg is removed
            const cropperContainer = document.querySelector('.cropper-container');
            const viewBox = document.querySelector('.cropper-view-box');
            if (cropperContainer) {
                if (isBgRemoved && currentBgColor !== 'transparent') {
                    cropperContainer.style.background = currentBgColor;
                    if (viewBox) viewBox.style.background = currentBgColor;
                } else if (isBgRemoved && currentBgColor === 'transparent') {
                    const bg = 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 50% / 10px 10px';
                    cropperContainer.style.background = bg;
                    if (viewBox) viewBox.style.background = bg;
                } else {
                    cropperContainer.style.background = 'none';
                    if (viewBox) viewBox.style.background = 'none';
                }
            }
        }
    });
}

let selfieSegmentation = null;
let currentSegmentationResolve = null;
let isEngineBusy = false;
const engineQueue = [];

function getSelfieSegmentation() {
    if (!selfieSegmentation) {
        selfieSegmentation = new SelfieSegmentation({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        });
        selfieSegmentation.setOptions({
            modelSelection: 0,
        });
        selfieSegmentation.onResults((results) => {
            if (currentSegmentationResolve) {
                currentSegmentationResolve(results);
            }
        });
    }
    return selfieSegmentation;
}

function processNextInQueue() {
    if (isEngineBusy || engineQueue.length === 0) return;
    isEngineBusy = true;
    
    const { engine, imageSource, resolve, reject } = engineQueue.shift();
    
    currentSegmentationResolve = (results) => {
        isEngineBusy = false;
        resolve(results);
        processNextInQueue();
    };
    
    engine.send({ image: imageSource }).catch((err) => {
        isEngineBusy = false;
        if (reject) reject(err);
        processNextInQueue();
    });
}

function enqueueEngineProcess(engine, imageSource) {
    return new Promise((resolve, reject) => {
        engineQueue.push({ engine, imageSource, resolve, reject });
        processNextInQueue();
    });
}

function getResizedCanvas(img, maxSize) {
    const canvas = document.createElement('canvas');
    let w = img.width;
    let h = img.height;
    if (w > maxSize || h > maxSize) {
        const ratio = Math.min(maxSize / w, maxSize / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
}

async function checkPortraitPresence(src) {
    const engine = getSelfieSegmentation();
    
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = async () => {
            // Resize to a small canvas for fast software pixel analysis to prevent Out-Of-Memory crashes (闪退)
            const smallCanvas = getResizedCanvas(img, 256);
            try {
                const results = await enqueueEngineProcess(engine, smallCanvas);
                
                if (!results || !results.segmentationMask) {
                    // No mask means no portrait detected by the AI
                    showToast('宝宝，这张照片里好像没有检测到人像哦 🥺\n不换照片也是可以继续截图的哦～');
                    resolve();
                    return;
                }
                
                const canvas = document.createElement('canvas');
                // Safely use results.image.width instead of mask.width just in case it's a webgl texture without exposed dimensions
                canvas.width = results.image ? results.image.width : smallCanvas.width;
                canvas.height = results.image ? results.image.height : smallCanvas.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
                
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                let opaquePixels = 0;
                for (let i = 0; i < imgData.data.length; i += 4) {
                    // Universally check both Red and Alpha channels. 
                    // Some browsers render mask to RGB, some render to Alpha.
                    if (imgData.data[i] > 128 || imgData.data[i + 3] > 128) {
                        opaquePixels++;
                    }
                }
                
                const ratio = opaquePixels / (canvas.width * canvas.height);
                if (ratio < 0.02) {
                    showToast('宝宝，这张照片里好像没有检测到人像哦 🥺\n不换照片也是可以继续截图的哦～');
                }
                resolve();
            } catch (err) {
                console.error('人像检测遇到异常:', err);
                // If it fails processing entirely, we assume no portrait could be extracted safely.
                showToast('宝宝，这张照片里好像没有检测到人像哦 🥺\n不换照片也是可以继续截图的哦～');
                resolve();
            }
        };
        img.onerror = () => resolve();
        img.src = src;
    });
}

async function performBackgroundRemoval() {
    loader.style.display = 'flex';
    document.getElementById('loaderText').innerHTML = '正在加载轻量级 AI 引擎 (约1MB)...<br>仅限首次需要下载';
    
    try {
        const engine = getSelfieSegmentation();
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        const resultDataUrl = await new Promise((resolve, reject) => {
            img.onload = async () => {
                try {
                    const results = await enqueueEngineProcess(engine, img);
                    const canvas = document.createElement('canvas');
                    canvas.width = results.image ? results.image.width : img.width;
                    canvas.height = results.image ? results.image.height : img.height;
                    const ctx = canvas.getContext('2d');

                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    if (results && results.segmentationMask) {
                        ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);
                        
                        // Edge Defringing (Alpha Erosion) to remove background color halo
                        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        for (let i = 0; i < imgData.data.length; i += 4) {
                            const a = imgData.data[i + 3];
                            // Shrink the mask edge inward by treating semi-transparent pixels as background
                            if (a < 160) {
                                imgData.data[i + 3] = 0;
                            } else {
                                imgData.data[i + 3] = Math.min(255, (a - 160) * 2.68);
                            }
                        }
                        ctx.putImageData(imgData, 0, 0);
                    }
                    
                    ctx.globalCompositeOperation = 'source-in';
                    ctx.drawImage(results.image || img, 0, 0, canvas.width, canvas.height);

                    resolve(canvas.toDataURL('image/png'));
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = reject;
            img.src = originalImageSrc;
        });
        processedImageSrc = resultDataUrl;
        
    } catch (err) {
        console.error('抠图失败:', err);
        alert('抠图失败，请检查网络或更换图片。原因: ' + err.message);
        removeBgToggle.checked = false;
        colorOptions.classList.remove('active');
    } finally {
        loader.style.display = 'none';
        document.getElementById('loaderText').innerHTML = '正在智能抠图，请稍候...';
    }
}

function dataURLtoFile(dataurl, filename) {
    let arr = dataurl.split(','),
        mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), 
        n = bstr.length, 
        u8arr = new Uint8Array(n);
        
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new File([u8arr], filename, {type: mime});
}
