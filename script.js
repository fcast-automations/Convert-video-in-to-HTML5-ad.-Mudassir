/**
 * Playable HTML5 Video Ad Generator
 * Supports Google Ads (ExitApi) and Mintegral (gameReady / gameStart / gameEnd / install).
 * End card image is optional. No CTA button — full-screen tap handles install/exit.
 */

// ------------------- DOM -------------------
const form = document.getElementById('generator-form');
const adNameInput = document.getElementById('ad-name');
const storeUrlInput = document.getElementById('store-url');
const adDimensionsSelect = document.getElementById('ad-dimensions');
const networkBadge = document.getElementById('network-badge');
const statusCtaApi = document.getElementById('status-cta-api');
const statusEndcard = document.getElementById('status-endcard');
const packageSizeWarning = document.getElementById('package-size-warning');
const mintegralOptions = document.getElementById('mintegral-options');

const videoFile = document.getElementById('video-file');
const videoUploadPlaceholder = document.getElementById('video-upload-placeholder');
const videoFileInfo = document.getElementById('video-file-info');
const videoFilename = document.getElementById('video-filename');
const videoFilesize = document.getElementById('video-filesize');

const timestampsFile = document.getElementById('timestamps-file');
const timestampsUploadPlaceholder = document.getElementById('timestamps-upload-placeholder');
const timestampsFileInfo = document.getElementById('timestamps-file-info');
const timestampsFilename = document.getElementById('timestamps-filename');
const timestampsParsedPreview = document.getElementById('timestamps-parsed-preview');
const statusCheckpoints = document.getElementById('status-checkpoints');

const imageFile = document.getElementById('image-file');
const imageUploadPlaceholder = document.getElementById('image-upload-placeholder');
const imageFileInfo = document.getElementById('image-file-info');
const imageFilename = document.getElementById('image-filename');
const imageFilesize = document.getElementById('image-filesize');

const removeVideoBtn = document.getElementById('remove-video');
const removeTimestampsBtn = document.getElementById('remove-timestamps');
const removeImageBtn = document.getElementById('remove-image');

const generateBtn = document.getElementById('generate-btn');
const btnText = document.getElementById('btn-text');
const btnLoader = document.getElementById('btn-loader');

const previewIframe = document.getElementById('preview-iframe');
const iframePreviewPlaceholder = document.getElementById('iframe-preview-placeholder');

// ------------------- State -------------------
let selectedVideos = [];
let selectedTimestampsByVideo = [];
let selectedImages = [];
let videoObjectURLs = [];
let imageObjectURLs = [];

const MAX_PACKAGE_BYTES = 5 * 1024 * 1024; // 5 MB network limit

// ------------------- Helpers -------------------
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function cleanVideoObjectURLs() {
  videoObjectURLs.forEach((url) => URL.revokeObjectURL(url));
  videoObjectURLs = [];
}

function cleanImageObjectURLs() {
  imageObjectURLs.forEach((url) => URL.revokeObjectURL(url));
  imageObjectURLs = [];
}

/** Returns selected networks in stable order: google first, then mintegral */
function getSelectedNetworks() {
  const checked = Array.from(document.querySelectorAll('input[name="ad-network"]:checked')).map(
    (el) => el.value
  );
  const ordered = [];
  if (checked.includes('google')) ordered.push('google');
  if (checked.includes('mintegral')) ordered.push('mintegral');
  return ordered;
}

/** Network used for live preview (prefer Google when both selected — original Google build) */
function getPreviewNetwork() {
  const networks = getSelectedNetworks();
  if (networks.length === 0) return 'google';
  return networks[0];
}

function getStoreUrl() {
  return (storeUrlInput.value || '').trim();
}

function escapeJsString(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function updateEndcardStatus() {
  if (selectedImages.length === 0) {
    statusEndcard.textContent = 'None';
    statusEndcard.className = 'font-bold text-slate-500 text-xs';
  } else {
    statusEndcard.textContent = selectedImages.length > 1 ? `${selectedImages.length} images` : 'Loaded';
    statusEndcard.className = 'font-bold text-emerald-600 text-xs';
  }
}

function updatePackageSizeWarning() {
  let total = selectedVideos.reduce((acc, f) => acc + f.size, 0);
  total += selectedImages.reduce((acc, f) => acc + f.size, 0);
  // Rough HTML/overhead budget
  total += 25 * 1024;

  if (selectedVideos.length === 0) {
    packageSizeWarning.classList.add('hidden');
    return;
  }

  if (total > MAX_PACKAGE_BYTES) {
    packageSizeWarning.classList.remove('hidden');
    packageSizeWarning.textContent =
      `Estimated package ~${formatBytes(total)} exceeds the 5 MB network limit. Compress/re-encode your video (shorter length, lower bitrate) before upload.`;
  } else if (total > MAX_PACKAGE_BYTES * 0.85) {
    packageSizeWarning.classList.remove('hidden');
    packageSizeWarning.textContent =
      `Estimated package ~${formatBytes(total)} is close to the 5 MB limit. Leave headroom for the HTML wrapper.`;
  } else {
    packageSizeWarning.classList.add('hidden');
  }
}

function updateNetworkUI() {
  const networks = getSelectedNetworks();
  const exportLabel = document.getElementById('network-export-label');

  document.querySelectorAll('.network-card').forEach((card) => {
    const input = card.querySelector('input[name="ad-network"]');
    card.classList.toggle('selected', input && input.checked);
  });

  const hasGoogle = networks.includes('google');
  const hasMintegral = networks.includes('mintegral');

  // Mintegral-only options panel
  if (hasMintegral) {
    mintegralOptions.classList.remove('hidden');
  } else {
    mintegralOptions.classList.add('hidden');
  }

  if (networks.length === 0) {
    networkBadge.textContent = 'Select a network';
    networkBadge.className =
      'text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shadow-sm';
    statusCtaApi.textContent = '—';
    statusCtaApi.className = 'font-bold text-slate-400 text-xs';
    if (exportLabel) exportLabel.textContent = 'None selected (pick at least one)';
  } else if (hasGoogle && hasMintegral) {
    networkBadge.textContent = 'Google + Mintegral';
    networkBadge.className =
      'text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm';
    statusCtaApi.textContent = 'Both APIs';
    statusCtaApi.className = 'font-bold text-indigo-600 text-xs';
    if (exportLabel) {
      exportLabel.textContent = 'Separate ZIPs: *-google.zip and *-mintegral.zip';
    }
  } else if (hasMintegral) {
    networkBadge.textContent = 'Mintegral Ready';
    networkBadge.className =
      'text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm';
    statusCtaApi.textContent = 'install()';
    statusCtaApi.className = 'font-bold text-emerald-600 text-xs';
    if (exportLabel) exportLabel.textContent = 'Mintegral only → one ZIP';
  } else {
    networkBadge.textContent = 'Google Ads Ready';
    networkBadge.className =
      'text-xs font-semibold px-3 py-1.5 rounded-full bg-[#1e80f0]/10 text-[#1e80f0] border border-[#1e80f0]/20 shadow-sm';
    statusCtaApi.textContent = 'ExitApi';
    statusCtaApi.className = 'font-bold text-[#1e80f0] text-xs';
    if (exportLabel) exportLabel.textContent = 'Google Ads only → one ZIP';
  }

  updateLiveIframePreview();
}

// ------------------- Preview -------------------
function updateLiveIframePreview() {
  // Video is required; end card is optional
  if (selectedVideos.length === 0) {
    previewIframe.classList.add('hidden');
    iframePreviewPlaceholder.classList.remove('hidden');
    return;
  }

  const firstVideoURL = videoObjectURLs[0] || '';
  const firstImageURL = imageObjectURLs[0] || '';
  const selectedDimensions = adDimensionsSelect.value;
  const [width, height] = selectedDimensions.split('x').map(Number);
  const wrapper = document.getElementById('preview-wrapper');
  const notch = document.getElementById('preview-notch');
  const checkpoints = selectedTimestampsByVideo[0] || [];
  const network = getPreviewNetwork();

  const adHtmlContent = getAdTemplateHTML({
    videoFile: firstVideoURL,
    imageFile: firstImageURL,
    checkpoints,
    dimensions: selectedDimensions,
    network,
    storeUrl: getStoreUrl(),
    hasEndcard: Boolean(firstImageURL)
  });

  wrapper.style.aspectRatio = `${width}/${height}`;

  if (selectedDimensions === '480x320') {
    wrapper.className =
      'relative bg-slate-950 rounded-lg overflow-hidden border-4 border-slate-800 shadow-2xl flex items-center justify-center transition-all duration-300 w-full';
    wrapper.style.maxWidth = '420px';
    notch.classList.add('hidden');
  } else {
    wrapper.className =
      'relative bg-slate-950 rounded-[30px] overflow-hidden border-8 border-slate-800 shadow-2xl flex items-center justify-center transition-all duration-300 w-full';
    wrapper.style.maxWidth = '220px';
    notch.className =
      'absolute top-1.5 left-1/2 transform -translate-x-1/2 w-20 h-3.5 bg-slate-800 rounded-full z-50';
    notch.classList.remove('hidden');
  }

  previewIframe.srcdoc = adHtmlContent;
  previewIframe.classList.remove('hidden');
  iframePreviewPlaceholder.classList.add('hidden');
}

adDimensionsSelect.addEventListener('change', updateLiveIframePreview);
storeUrlInput.addEventListener('input', updateLiveIframePreview);

document.querySelectorAll('input[name="ad-network"]').forEach((checkbox) => {
  checkbox.addEventListener('change', updateNetworkUI);
});

// ------------------- File uploads -------------------
videoFile.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  files.forEach((file) => {
    selectedVideos.push(file);
    videoObjectURLs.push(URL.createObjectURL(file));
  });

  videoFilename.textContent =
    selectedVideos.length > 1 ? `${selectedVideos.length} Videos selected` : selectedVideos[0].name;
  const totalSize = selectedVideos.reduce((acc, f) => acc + f.size, 0);
  videoFilesize.textContent = formatBytes(totalSize);
  videoUploadPlaceholder.classList.add('hidden');
  videoFileInfo.classList.remove('hidden');

  updatePackageSizeWarning();
  updateLiveIframePreview();
  videoFile.value = '';
});

removeVideoBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  selectedVideos = [];
  cleanVideoObjectURLs();

  previewIframe.removeAttribute('srcdoc');
  previewIframe.classList.add('hidden');
  iframePreviewPlaceholder.classList.remove('hidden');

  videoFile.value = '';
  videoUploadPlaceholder.classList.remove('hidden');
  videoFileInfo.classList.add('hidden');
  updatePackageSizeWarning();
});

timestampsFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    parseTimestamps(event.target.result);
    timestampsFilename.textContent = file.name;
    timestampsUploadPlaceholder.classList.add('hidden');
    timestampsFileInfo.classList.remove('hidden');
    updateLiveIframePreview();
  };
  reader.readAsText(file);
});

removeTimestampsBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  selectedTimestampsByVideo = [];
  statusCheckpoints.textContent = '0';
  timestampsFile.value = '';
  timestampsUploadPlaceholder.classList.remove('hidden');
  timestampsFileInfo.classList.add('hidden');
  updateLiveIframePreview();
});

function parseTimestamps(content) {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  selectedTimestampsByVideo = [];

  lines.forEach((line) => {
    const rawSeconds = line.split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
    const parsedSeconds = [];

    rawSeconds.forEach((val) => {
      let secs = 0;
      if (val.includes(':')) {
        const parts = val.split(':');
        const s = parseFloat(parts[0]) || 0;
        const msStr = parts[1] || '0';
        const msVal = parseFloat(msStr) || 0;
        secs = s + msVal / Math.pow(10, msStr.length);
      } else {
        secs = parseFloat(val);
      }
      if (!isNaN(secs)) parsedSeconds.push(secs);
    });

    selectedTimestampsByVideo.push(parsedSeconds.sort((a, b) => a - b));
  });

  statusCheckpoints.textContent = String(selectedTimestampsByVideo.flat().length);
  timestampsParsedPreview.textContent = selectedTimestampsByVideo
    .map((arr, i) => `V${i + 1}: [${arr.map((t) => t.toFixed(2)).join(', ')}]`)
    .join(' | ');
}

imageFile.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  selectedImages = [...selectedImages, ...files];
  files.forEach((file) => imageObjectURLs.push(URL.createObjectURL(file)));

  imageFilename.textContent =
    selectedImages.length > 1 ? `${selectedImages.length} Images selected` : selectedImages[0].name;
  const totalSize = selectedImages.reduce((acc, f) => acc + f.size, 0);
  imageFilesize.textContent = formatBytes(totalSize);
  imageUploadPlaceholder.classList.add('hidden');
  imageFileInfo.classList.remove('hidden');

  updateEndcardStatus();
  updatePackageSizeWarning();
  updateLiveIframePreview();
  imageFile.value = '';
});

removeImageBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  selectedImages = [];
  cleanImageObjectURLs();

  imageFile.value = '';
  imageUploadPlaceholder.classList.remove('hidden');
  imageFileInfo.classList.add('hidden');

  updateEndcardStatus();
  updatePackageSizeWarning();
  updateLiveIframePreview();
});

// ------------------- ZIP generation -------------------

/**
 * Build one network-specific ad ZIP blob for a video index.
 */
async function buildAdZipForNetwork(videoIndex, network, options) {
  const { selectedDimensions, storeUrl } = options;
  const video = selectedVideos[videoIndex];
  const videoExt = (video.name.split('.').pop() || 'mp4').toLowerCase();
  const videoFilenameInZip = `video.${videoExt}`;

  let imageToUse = null;
  let imageFilenameInZip = '';
  if (selectedImages.length > 0) {
    imageToUse =
      videoIndex < selectedImages.length
        ? selectedImages[videoIndex]
        : selectedImages[selectedImages.length - 1];
    const imageExt = (imageToUse.name.split('.').pop() || 'png').toLowerCase();
    imageFilenameInZip = `endcard.${imageExt}`;
  }

  const checkpoints =
    selectedTimestampsByVideo[videoIndex] || selectedTimestampsByVideo[0] || [];

  const adZip = new JSZip();
  adZip.file(videoFilenameInZip, video);
  if (imageToUse) {
    adZip.file(imageFilenameInZip, imageToUse);
  }

  const htmlContent = getAdTemplateHTML({
    videoFile: videoFilenameInZip,
    imageFile: imageFilenameInZip,
    checkpoints,
    dimensions: selectedDimensions,
    network,
    storeUrl,
    hasEndcard: Boolean(imageToUse)
  });
  adZip.file('index.html', htmlContent);

  const archiveBlob = await adZip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  if (archiveBlob.size > MAX_PACKAGE_BYTES) {
    console.warn(
      `[${network}] video ${videoIndex + 1} package is ${formatBytes(archiveBlob.size)} (over 5 MB).`
    );
  }

  return archiveBlob;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const networks = getSelectedNetworks();
  if (networks.length === 0) {
    alert('Please select at least one network: Google Ads and/or Mintegral.');
    return;
  }
  if (selectedVideos.length === 0) {
    alert('Please upload at least one video file.');
    return;
  }
  if (selectedTimestampsByVideo.length === 0) {
    alert('Please upload a timestamps / checkpoints file.');
    return;
  }

  generateBtn.disabled = true;
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');

  const selectedDimensions = adDimensionsSelect.value;
  const storeUrl = getStoreUrl();
  const adNameBase =
    adNameInput.value.trim().replace(/[^a-zA-Z0-9-_]/g, '') || 'interactive-ad';
  const buildOpts = { selectedDimensions, storeUrl };

  try {
    // When both networks are selected → separate ZIPs per network.
    // When one network → only that network.
    // Multiple videos → pack that network's ads into a parent ZIP for that network.
    for (const network of networks) {
      if (selectedVideos.length === 1) {
        const blob = await buildAdZipForNetwork(0, network, buildOpts);
        saveAs(blob, `${adNameBase}-${network}.zip`);
      } else {
        const networkBundle = new JSZip();
        for (let i = 0; i < selectedVideos.length; i++) {
          const blob = await buildAdZipForNetwork(i, network, buildOpts);
          networkBundle.file(`${adNameBase}-${network}-video${i + 1}.zip`, blob);
        }
        const bundleBlob = await networkBundle.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
        saveAs(bundleBlob, `${adNameBase}-${network}-all-ads.zip`);
      }
    }
  } catch (err) {
    console.error('Error generating playable ad:', err);
    alert('Failed to generate ad package. Check the console for details.');
  } finally {
    generateBtn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
  }
});

// ------------------- Ad HTML template -------------------
/**
 * Build a self-contained playable ad HTML document.
 * @param {object} opts
 */
function getAdTemplateHTML(opts) {
  const {
    videoFile,
    imageFile = '',
    checkpoints = [],
    dimensions = '320x480',
    network = 'mintegral',
    storeUrl = '',
    hasEndcard = false
  } = opts;

  const [width, height] = dimensions.split('x');
  const orientation = Number(width) >= Number(height) ? 'landscape' : 'portrait';
  const safeStore = escapeJsString(storeUrl);
  const checkpointList = checkpoints.join(', ');
  const endcardBg =
    hasEndcard && imageFile
      ? `background-image: url('${imageFile}'); background-size: cover; background-position: center;`
      : '';

  const isMintegral = network === 'mintegral';

  // Google ExitApi script only for Google — Mintegral forbids external network scripts
  const googleExitScript = isMintegral
    ? ''
    : `<script src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"><\/script>`;

  const metaTags = isMintegral
    ? `<meta name="viewport" content="width=device-width,user-scalable=no,initial-scale=1.0,minimum-scale=1.0,maximum-scale=1.0">
  <meta name="ad.orientation" content="${orientation}">`
    : `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="ad.size" content="width=${width},height=${height}">
  <meta name="ad.orientation" content="${orientation}">`;

  // End card div only when an image is provided (no CTA button ever)
  const endcardHtml =
    hasEndcard && imageFile
      ? `<div id="endcard-overlay" style="${endcardBg}"></div>`
      : `<div id="endcard-overlay" class="no-image"></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  ${metaTags}
  <title>Interactive HTML5 Ad</title>
  ${googleExitScript}
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #ad-container {
      position: relative;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
      display: block;
    }
    #click-overlay {
      position: absolute;
      inset: 0;
      z-index: 40;
      cursor: pointer;
    }
    #endcard-overlay {
      position: absolute;
      inset: 0;
      z-index: 30;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.45s ease, visibility 0.45s ease;
      pointer-events: none;
    }
    #endcard-overlay.no-image {
      background: transparent;
    }
    #endcard-overlay.show {
      opacity: 1;
      visibility: visible;
    }
    #tap-hint {
      position: absolute;
      left: 50%;
      bottom: 10%;
      transform: translateX(-50%);
      z-index: 25;
      pointer-events: none;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-shadow: 0 1px 4px rgba(0,0,0,0.65);
      background: rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 999px;
      padding: 8px 14px;
      opacity: 0;
      transition: opacity 0.25s ease;
      white-space: nowrap;
    }
    #tap-hint.visible {
      opacity: 1;
      animation: pulseHint 1.4s ease-in-out infinite;
    }
    @keyframes pulseHint {
      0%, 100% { transform: translateX(-50%) scale(1); }
      50% { transform: translateX(-50%) scale(1.04); }
    }
  </style>
</head>
<body>
  <div id="ad-container">
    <video id="ad-video" src="${videoFile}" playsinline webkit-playsinline muted autoplay preload="auto"></video>
    <div id="tap-hint">Tap to continue</div>
    ${endcardHtml}
    <div id="click-overlay"></div>
  </div>

  <script>
(function () {
  var checkpoints = [${checkpointList}];
  var totalCheckpoints = checkpoints.length;
  var network = '${isMintegral ? 'mintegral' : 'google'}';
  var storeUrl = '${safeStore}';
  var hasEndcard = ${hasEndcard ? 'true' : 'false'};

  var video = document.getElementById('ad-video');
  var endcardOverlay = document.getElementById('endcard-overlay');
  var clickOverlay = document.getElementById('click-overlay');
  var tapHint = document.getElementById('tap-hint');

  var currentCheckpointIndex = 0;
  var isTransitioningToEnd = false;
  var isLoopingCheckpoint = false;
  var loopStartTime = 0;
  var loopEndTime = 0;
  var triggeredCheckpoints = {};
  var playableStarted = false;
  var gameEnded = false;
  var resourcesReady = false;

  function safeCall(fn) {
    try {
      if (typeof fn === 'function') fn();
    } catch (err) {
      console.log('API call failed', err);
    }
  }

  /** Full-screen tap install / exit (no CTA button) */
  function triggerInstall() {
    if (typeof window.install === 'function') {
      safeCall(window.install);
      return;
    }
    if (typeof ExitApi !== 'undefined' && typeof ExitApi.exit === 'function') {
      safeCall(ExitApi.exit);
      return;
    }
    if (typeof mraid !== 'undefined' && typeof mraid.open === 'function' && storeUrl) {
      try { mraid.open(storeUrl); return; } catch (e) {}
    }
    if (storeUrl) {
      try {
        window.open(storeUrl, '_blank');
      } catch (e) {
        console.log('Could not open store URL');
      }
    } else {
      console.log('Install / exit triggered (no host API / store URL in this environment)');
    }
  }

  function notifyGameReady() {
    if (network === 'mintegral') {
      safeCall(window.gameReady);
    }
  }

  function notifyGameEnd() {
    if (gameEnded) return;
    gameEnded = true;
    if (network === 'mintegral') {
      safeCall(window.gameEnd);
    }
  }

  function startPlayback() {
    if (playableStarted) return;
    playableStarted = true;
    tapHint.classList.remove('visible');

    var playPromise = video.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(function () {
        try { video.muted = false; } catch (e) {}
      }).catch(function () {
        video.muted = true;
        video.play().catch(function () {
          console.log('Playback waiting for user gesture');
        });
      });
    }
  }

  window.gameStart = function () {
    startPlayback();
  };

  window.gameClose = function () {
    try {
      video.pause();
      video.muted = true;
    } catch (e) {}
    tapHint.classList.remove('visible');
  };

  function markResourcesReady() {
    if (resourcesReady) return;
    resourcesReady = true;
    notifyGameReady();

    if (network !== 'mintegral') {
      startPlayback();
    } else {
      setTimeout(function () {
        if (!playableStarted) startPlayback();
      }, 300);
    }
  }

  function showEndCard() {
    isTransitioningToEnd = true;
    isLoopingCheckpoint = false;
    tapHint.classList.remove('visible');
    try { video.pause(); } catch (e) {}
    // Show image end card only when provided; otherwise keep frozen video frame
    if (hasEndcard) {
      endcardOverlay.classList.add('show');
    }
    // Keep full-screen click overlay active for install/exit (no CTA button)
    clickOverlay.style.pointerEvents = 'auto';
    notifyGameEnd();
  }

  function checkCheckpoint() {
    if (isTransitioningToEnd || !playableStarted) return;

    var currentTime = video.currentTime;

    if (isLoopingCheckpoint) {
      if (currentTime >= loopEndTime || currentTime < loopStartTime - 0.05) {
        try { video.currentTime = loopStartTime; } catch (e) {}
      }
      return;
    }

    if (totalCheckpoints === 0) return;

    var targetTime = checkpoints[currentCheckpointIndex];
    if (
      targetTime !== undefined &&
      currentTime >= targetTime &&
      !triggeredCheckpoints[currentCheckpointIndex]
    ) {
      triggeredCheckpoints[currentCheckpointIndex] = true;

      if (currentCheckpointIndex === totalCheckpoints - 1) {
        showEndCard();
      } else {
        isLoopingCheckpoint = true;
        loopStartTime = targetTime;
        loopEndTime = Math.min(targetTime + 1.0, (video.duration || targetTime + 1.0));
        try { video.currentTime = loopStartTime; } catch (e) {}
        tapHint.classList.add('visible');
      }
    }
  }

  function handleMainClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!playableStarted || (video.paused && currentCheckpointIndex === 0 && !isLoopingCheckpoint && !isTransitioningToEnd)) {
      video.muted = false;
      startPlayback();
      return;
    }

    if (isLoopingCheckpoint) {
      isLoopingCheckpoint = false;
      currentCheckpointIndex += 1;
      tapHint.classList.remove('visible');
      try { video.currentTime = loopEndTime; } catch (err) {}
      video.muted = false;
      video.play().catch(function () {});
      return;
    }

    if (!isTransitioningToEnd) {
      return;
    }

    triggerInstall();
  }

  function bindEvents() {
    clickOverlay.addEventListener('click', handleMainClick);
    clickOverlay.addEventListener('touchend', function (e) {
      handleMainClick(e);
    }, { passive: false });

    video.addEventListener('timeupdate', checkCheckpoint);
    video.addEventListener('ended', function () {
      if (!isTransitioningToEnd) showEndCard();
    });

    if (video.readyState >= 2) {
      markResourcesReady();
    } else {
      video.addEventListener('loadeddata', markResourcesReady, { once: true });
      video.addEventListener('canplay', markResourcesReady, { once: true });
      setTimeout(markResourcesReady, 2000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindEvents);
  } else {
    bindEvents();
  }
})();
  <\/script>
</body>
</html>`;
}

// Init UI
updateNetworkUI();
updateEndcardStatus();
