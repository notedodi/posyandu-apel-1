(() => {
    'use strict';

    // ===== DOM Elements =====
    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');
    const wrapper = document.getElementById('canvasWrapper');
    const placeholder = document.getElementById('placeholderText');
    const zoomControl = document.getElementById('zoomControl');
    const zoomRange = document.getElementById('zoomRange');
    const zoomValue = document.getElementById('zoomValue');
    const btnUpload = document.getElementById('btnUpload');
    const btnReset = document.getElementById('btnReset');
    const btnDownload = document.getElementById('btnDownload');
    const fileInput = document.getElementById('fileInput');

    // ===== Template Dimensions (must match template.png) =====
    const TEMPLATE_W = 828;
    const TEMPLATE_H = 1472;

    // ===== State =====
    let templateImg = null;
    let templatePixelData = null; // pixel data to check transparency
    let userImg = null;
    let photoState = { x: 0, y: 0, scale: 1 };
    let isDragging = false;
    let touchIsOnPhoto = false; // tracks if current touch started on photo area
    let dragStart = { x: 0, y: 0 };
    let lastPhotoState = { x: 0, y: 0 };

    // Pinch zoom
    let lastPinchDist = 0;
    let lastPinchScale = 1;

    // ===== Load Template =====
    function loadTemplate() {
        templateImg = new Image();
        templateImg.onload = () => {
            initCanvas();
            buildTemplatePixelData();
            render();
        };
        templateImg.src = 'template.png';
    }

    // ===== Build pixel data from template to detect transparent areas =====
    function buildTemplatePixelData() {
        const offscreen = document.createElement('canvas');
        offscreen.width = TEMPLATE_W;
        offscreen.height = TEMPLATE_H;
        const offCtx = offscreen.getContext('2d');
        offCtx.drawImage(templateImg, 0, 0, TEMPLATE_W, TEMPLATE_H);
        templatePixelData = offCtx.getImageData(0, 0, TEMPLATE_W, TEMPLATE_H).data;
    }

    // ===== Check if a canvas coordinate is on a transparent (photo) area =====
    function isPhotoArea(cx, cy) {
        if (!templatePixelData) return false;
        const x = Math.round(cx);
        const y = Math.round(cy);
        if (x < 0 || x >= TEMPLATE_W || y < 0 || y >= TEMPLATE_H) return false;
        const idx = (y * TEMPLATE_W + x) * 4;
        const alpha = templatePixelData[idx + 3];
        return alpha < 128; // transparent or semi-transparent = photo area
    }

    // ===== Init Canvas =====
    function initCanvas() {
        canvas.width = TEMPLATE_W;
        canvas.height = TEMPLATE_H;
    }

    // ===== Render =====
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw user photo behind template
        if (userImg) {
            ctx.save();
            const w = userImg.width * photoState.scale;
            const h = userImg.height * photoState.scale;
            ctx.drawImage(userImg, photoState.x, photoState.y, w, h);
            ctx.restore();
        }

        // Draw template on top
        if (templateImg) {
            ctx.drawImage(templateImg, 0, 0, TEMPLATE_W, TEMPLATE_H);
        }
    }

    // ===== Fit photo to canvas =====
    function fitPhoto() {
        if (!userImg) return;
        // Scale to cover the canvas (fill)
        const scaleX = TEMPLATE_W / userImg.width;
        const scaleY = TEMPLATE_H / userImg.height;
        const scale = Math.max(scaleX, scaleY);
        photoState.scale = scale;

        // Center
        const w = userImg.width * scale;
        const h = userImg.height * scale;
        photoState.x = (TEMPLATE_W - w) / 2;
        photoState.y = (TEMPLATE_H - h) / 2;

        // Update zoom slider
        zoomRange.value = Math.round(scale * 100);
        zoomValue.textContent = Math.round(scale * 100) + '%';
    }

    // ===== Convert page coords to canvas coords =====
    function getCanvasCoords(clientX, clientY) {
        const rect = wrapper.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }

    // ===== Drag Handlers =====
    function onPointerDown(e) {
        if (!userImg) return;
        if (e.touches && e.touches.length > 1) return; // let pinch handle

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const coords = getCanvasCoords(clientX, clientY);

        // Only start drag if touching the transparent photo area
        if (!isPhotoArea(coords.x, coords.y)) {
            touchIsOnPhoto = false;
            return; // let page scroll
        }

        touchIsOnPhoto = true;
        isDragging = true;
        dragStart.x = coords.x;
        dragStart.y = coords.y;
        lastPhotoState.x = photoState.x;
        lastPhotoState.y = photoState.y;
    }

    function onPointerMove(e) {
        if (!isDragging || !userImg) return;
        if (e.touches && e.touches.length > 1) return;

        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const coords = getCanvasCoords(clientX, clientY);
        photoState.x = lastPhotoState.x + (coords.x - dragStart.x);
        photoState.y = lastPhotoState.y + (coords.y - dragStart.y);
        render();
    }

    function onPointerUp() {
        isDragging = false;
        touchIsOnPhoto = false;
    }

    // ===== Pinch Zoom =====
    function getPinchDist(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function onTouchStart(e) {
        if (e.touches.length === 2) {
            e.preventDefault();
            lastPinchDist = getPinchDist(e.touches);
            lastPinchScale = photoState.scale;
        } else if (e.touches.length === 1) {
            onPointerDown(e);
            // Only preventDefault if touch is on the photo area
            if (touchIsOnPhoto) e.preventDefault();
        }
    }

    function onTouchMove(e) {
        if (e.touches.length === 2 && userImg) {
            e.preventDefault();
            const dist = getPinchDist(e.touches);
            const ratio = dist / lastPinchDist;
            photoState.scale = Math.max(0.1, lastPinchScale * ratio);

            // Re-center around pinch midpoint
            zoomRange.value = Math.round(photoState.scale * 100);
            zoomValue.textContent = Math.round(photoState.scale * 100) + '%';
            render();
        } else if (e.touches.length === 1) {
            // Only preventDefault if dragging on photo area
            if (touchIsOnPhoto) e.preventDefault();
            onPointerMove(e);
        }
    }

    function onTouchEnd(e) {
        if (e.touches.length < 2) {
            lastPinchDist = 0;
        }
        if (e.touches.length === 0) {
            isDragging = false;
            touchIsOnPhoto = false;
        }
    }

    // ===== Mouse Wheel Zoom =====
    function onWheel(e) {
        if (!userImg) return;
        const coords = getCanvasCoords(e.clientX, e.clientY);
        if (!isPhotoArea(coords.x, coords.y)) return; // let page scroll
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        photoState.scale = Math.max(0.1, photoState.scale + delta);
        zoomRange.value = Math.round(photoState.scale * 100);
        zoomValue.textContent = Math.round(photoState.scale * 100) + '%';
        render();
    }

    // ===== Event Listeners =====

    // Canvas drag (mouse)
    wrapper.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    // Canvas drag & pinch (touch)
    wrapper.addEventListener('touchstart', onTouchStart, { passive: false });
    wrapper.addEventListener('touchmove', onTouchMove, { passive: false });
    wrapper.addEventListener('touchend', onTouchEnd);

    // Mouse wheel zoom
    wrapper.addEventListener('wheel', onWheel, { passive: false });

    // Zoom slider
    zoomRange.addEventListener('input', () => {
        if (!userImg) return;
        const newScale = parseInt(zoomRange.value) / 100;
        // Zoom towards center
        const cx = TEMPLATE_W / 2;
        const cy = TEMPLATE_H / 2;
        const ratio = newScale / photoState.scale;
        photoState.x = cx - (cx - photoState.x) * ratio;
        photoState.y = cy - (cy - photoState.y) * ratio;
        photoState.scale = newScale;
        zoomValue.textContent = Math.round(newScale * 100) + '%';
        render();
    });

    // Tap canvas to upload if no photo
    wrapper.addEventListener('click', (e) => {
        if (!userImg) {
            fileInput.click();
        }
    });

    // Upload button
    btnUpload.addEventListener('click', () => {
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                userImg = img;
                fitPhoto();
                render();

                // Show controls
                placeholder.classList.add('hidden');
                zoomControl.style.display = '';
                btnReset.disabled = false;
                btnDownload.disabled = false;
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);

        // Reset file input so same file can be re-selected
        fileInput.value = '';
    });

    // Reset button
    btnReset.addEventListener('click', () => {
        if (!userImg) return;
        fitPhoto();
        render();
    });

    // Download button
    btnDownload.addEventListener('click', () => {
        if (!userImg) return;

        // Create a temporary canvas for high-quality export
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = TEMPLATE_W;
        exportCanvas.height = TEMPLATE_H;
        const exportCtx = exportCanvas.getContext('2d');

        // Draw user photo
        const w = userImg.width * photoState.scale;
        const h = userImg.height * photoState.scale;
        exportCtx.drawImage(userImg, photoState.x, photoState.y, w, h);

        // Draw template overlay
        exportCtx.drawImage(templateImg, 0, 0, TEMPLATE_W, TEMPLATE_H);

        // Download as PNG
        const link = document.createElement('a');
        link.download = 'twibbon-campak.png';
        link.href = exportCanvas.toDataURL('image/png');
        link.click();
    });

    // ===== Initialize =====
    loadTemplate();
})();
