/**
 * Playable HTML5 Video Ad Generator
 * logic for processing user inputs and packing them into a Google Ads compliant HTML5 Ad ZIP file.
 */

// DOM Elements
const form = document.getElementById('generator-form');
const adNameInput = document.getElementById('ad-name');

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

// State Variables
let selectedVideos = [];
let selectedTimestampsByVideo = []; // Array of arrays: [ [3, 5, 8], [4, 5, 6] ]
let selectedImages = [];
let videoObjectURLs = [];
let imageObjectURLs = [];

// Helpers to format bytes
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Revoke Object URLs to prevent memory leaks
function cleanVideoObjectURLs() {
  videoObjectURLs.forEach(url => URL.revokeObjectURL(url));
  videoObjectURLs = [];
}

function cleanImageObjectURLs() {
  imageObjectURLs.forEach(url => URL.revokeObjectURL(url));
  imageObjectURLs = [];
}

const adDimensionsSelect = document.getElementById('ad-dimensions');

// Function to update the iframe with the fully live rendered ad preview
function updateLiveIframePreview() {
  if (selectedVideos.length === 0 || selectedImages.length === 0) {
    previewIframe.classList.add('hidden');
    iframePreviewPlaceholder.classList.remove('hidden');
    return;
  }

  // Use the first video and matching image/timestamps for previewing
  const firstVideoURL = videoObjectURLs[0] || '';
  const firstImageURL = imageObjectURLs[0] || '';
  // Set preview device orientation by reading user dropdown selection
  const selectedDimensions = adDimensionsSelect.value;
  const wrapper = document.getElementById('preview-wrapper');
  const notch = document.getElementById('preview-notch');

  const checkpoints = selectedTimestampsByVideo[0] || [];
  // Generate the ad markup
  const adHtmlContent = getAdTemplateHTML(firstVideoURL, firstImageURL, checkpoints, selectedDimensions);

  if (selectedDimensions === '320x480') {
    // Portrait (320 x 480)
    wrapper.className = "relative aspect-[320/480] max-w-[280px] mx-auto w-full bg-slate-950 rounded-[36px] overflow-hidden border-8 border-slate-800 shadow-2xl flex items-center justify-center transition-all duration-300";
    notch.className = "absolute top-2 left-1/2 transform -translate-x-1/2 w-24 h-4 bg-slate-800 rounded-full z-50";
  } else if (selectedDimensions === '300x250') {
    // Medium Rectangle (300 x 250)
    wrapper.className = "relative aspect-[300/250] max-w-[320px] mx-auto w-full bg-slate-950 rounded-lg overflow-hidden border-8 border-slate-800 shadow-2xl flex items-center justify-center transition-all duration-300";
    notch.className = "hidden"; // No phone notch for rectangles
  } else if (selectedDimensions === '728x90') {
    // Landscape / Leaderboard (728 x 90)
    wrapper.className = "relative aspect-[728/90] max-w-[500px] mx-auto w-full bg-slate-950 rounded-lg overflow-hidden border-4 border-slate-800 shadow-2xl flex items-center justify-center transition-all duration-300";
    notch.className = "hidden";
  }

  // Write content to iframe srcdoc
  previewIframe.srcdoc = adHtmlContent;
  previewIframe.classList.remove('hidden');
  iframePreviewPlaceholder.classList.add('hidden');
}

// Add dimensions change listener
adDimensionsSelect.addEventListener('change', updateLiveIframePreview);

// ------------------- FILE UPLOAD EVENT LISTENERS -------------------

// Video Upload Handler (Multiple Videos Supported - Appends Files)
videoFile.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  // Append new files to the list
  selectedVideos = [...selectedVideos, ...files];

  // Load preview urls dynamically for the new files
  files.forEach(file => {
    videoObjectURLs.push(URL.createObjectURL(file));
  });

  // Update details UI
  videoFilename.textContent = selectedVideos.length > 1 ? `${selectedVideos.length} Videos selected` : selectedVideos[0].name;
  
  const totalSize = selectedVideos.reduce((acc, f) => acc + f.size, 0);
  videoFilesize.textContent = formatBytes(totalSize);
  videoUploadPlaceholder.classList.add('hidden');
  videoFileInfo.classList.remove('hidden');

  updateLiveIframePreview();
  // Clear input value so same files can be selected again if needed
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
});

// Timestamps Upload Handler
timestampsFile.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const content = event.target.result;
    parseTimestamps(content);

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

// Parse csv/txt timestamps (seconds on each line matching separate videos)
function parseTimestamps(content) {
  // Split by newlines to get rows for each video
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  selectedTimestampsByVideo = [];

  lines.forEach((line, index) => {
    // Parse comma-separated raw seconds for this line
    const rawSeconds = line.split(/[,;]+/).map(t => t.trim()).filter(Boolean);
    const parsedSeconds = [];

    rawSeconds.forEach(val => {
      // Direct raw seconds integer parsing
      const secs = parseFloat(val);
      if (!isNaN(secs)) {
        parsedSeconds.push(secs);
      }
    });

    // Sort checkpoints for this video
    selectedTimestampsByVideo.push(parsedSeconds.sort((a, b) => a - b));
  });

  statusCheckpoints.textContent = selectedTimestampsByVideo.flat().length;
  
  // Show a preview of the mapped rows
  timestampsParsedPreview.textContent = selectedTimestampsByVideo
    .map((arr, i) => `V${i+1}: [${arr.join(', ')}]`)
    .join(' | ');
}

// Image Upload Handler (Multiple Images Supported - Appends Files)
imageFile.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;

  // Append new files to the list
  selectedImages = [...selectedImages, ...files];

  // Load preview urls dynamically for the new files
  files.forEach(file => {
    imageObjectURLs.push(URL.createObjectURL(file));
  });

  imageFilename.textContent = selectedImages.length > 1 ? `${selectedImages.length} Images selected` : selectedImages[0].name;
  
  const totalSize = selectedImages.reduce((acc, f) => acc + f.size, 0);
  imageFilesize.textContent = formatBytes(totalSize);
  imageUploadPlaceholder.classList.add('hidden');
  imageFileInfo.classList.remove('hidden');

  updateLiveIframePreview();
  // Clear input value so same files can be selected again if needed
  imageFile.value = '';
});

removeImageBtn.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  selectedImages = [];
  cleanImageObjectURLs();
  
  previewIframe.removeAttribute('srcdoc');
  previewIframe.classList.add('hidden');
  iframePreviewPlaceholder.classList.remove('hidden');

  imageFile.value = '';
  imageUploadPlaceholder.classList.remove('hidden');
  imageFileInfo.classList.add('hidden');
});


// ------------------- ZIP GENERATION & DOWNLOAD -------------------

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (selectedVideos.length === 0 || selectedImages.length === 0 || selectedTimestampsByVideo.length === 0) {
    alert('Please load all files: Videos, Timestamps, and End Card overlay images.');
    return;
  }

  // Set loading state
  generateBtn.disabled = true;
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');

  try {
    const mainZip = new JSZip();

    // Loop through each video to build separate self-contained interactive ads
    for (let i = 0; i < selectedVideos.length; i++) {
      const video = selectedVideos[i];
      const videoExt = video.name.split('.').pop();
      const videoFilenameInZip = `video.${videoExt}`;

      // Pick corresponding image matching this video index
      // If videos are more than images (e.g. 5 videos, 3 images):
      // V1 -> Img1, V2 -> Img2, V3 -> Img3, V4 -> Img3, V5 -> Img3
      let imageToUse;
      if (i < selectedImages.length) {
        imageToUse = selectedImages[i];
      } else {
        imageToUse = selectedImages[selectedImages.length - 1]; // Use last remaining image
      }

      const imageExt = imageToUse.name.split('.').pop();
      const imageFilenameInZip = `endcard.${imageExt}`;

      // Get timestamps mapped to this video index (if timestamps lines are less than videos, use first line)
      const checkpoints = selectedTimestampsByVideo[i] || selectedTimestampsByVideo[0] || [];

      // Create a ZIP folder or standalone ZIP for this ad
      const adZip = new JSZip();
      adZip.file(videoFilenameInZip, video);
      adZip.file(imageFilenameInZip, imageToUse);

      const selectedDimensions = adDimensionsSelect.value;
      const htmlContent = getAdTemplateHTML(videoFilenameInZip, imageFilenameInZip, checkpoints, selectedDimensions);
      adZip.file('index.html', htmlContent);

      const adNameBase = adNameInput.value.trim().replace(/[^a-zA-Z0-9-_]/g, '') || 'interactive-ad';
      const archiveBlob = await adZip.generateAsync({ type: 'blob' });

      if (selectedVideos.length === 1) {
        // Single file: Download the direct ad zip file directly
        saveAs(archiveBlob, `${adNameBase}.zip`);
      } else {
        // Multiple files: Pack individual ready-to-upload ZIPs into a main parent download bundle
        mainZip.file(`${adNameBase}-video${i + 1}.zip`, archiveBlob);
      }
    }

    if (selectedVideos.length > 1) {
      const adNameBase = adNameInput.value.trim().replace(/[^a-zA-Z0-9-_]/g, '') || 'interactive-ad';
      const bundleBlob = await mainZip.generateAsync({ type: 'blob' });
      saveAs(bundleBlob, `${adNameBase}-all-ads.zip`);
    }

  } catch (err) {
    console.error('Error generating playable ad:', err);
    alert('Failed to generate ad package. Check console log.');
  } finally {
    // Reset loader
    generateBtn.disabled = false;
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
  }
});


// ------------------- PART 3: GENERATED AD HTML TEMPLATE -------------------

function getAdTemplateHTML(videoFile, imageFile, checkpoints, dimensions = '320x480') {
  const [width, height] = dimensions.split('x');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="ad.size" content="width=${width},height=${height}">
  <title>Interactive HTML5 Ad</title>
  <!-- Google Ads HTML5 Exit API (Required for Playable Ads) -->
  <script src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }
    body, html {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #ad-container {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
      overflow: hidden;
    }
    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
    }
    
    /* Interactive Exit Overlay - triggers ExitApi.exit() */
    #click-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 40;
      cursor: pointer;
    }

    /* Final End Card Image Overlay */
    #endcard-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url('${imageFile}');
      background-size: cover;
      background-position: center;
      z-index: 20;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.8s ease-in-out, visibility 0.8s ease-in-out;
    }

    /* Helper utility classes */
    .show {
      opacity: 1 !important;
      visibility: visible !important;
    }
    .hidden {
      display: none !important;
    }
  </style>
</head>
<body>

  <div id="ad-container">
    <video id="ad-video" src="${videoFile}" playsinline muted autoplay></video>

    <!-- Final static endcard image overlay -->
    <div id="endcard-overlay"></div>

    <!-- Main clickable controller overlay -->
    <div id="click-overlay"></div>
  </div>

  <script>
    // Injected variables
    const checkpoints = [${checkpoints.join(', ')}];
    const totalDurationCheckpoints = checkpoints.length;

    // DOM selectors
    const video = document.getElementById('ad-video');
    const endcardOverlay = document.getElementById('endcard-overlay');
    const clickOverlay = document.getElementById('click-overlay');

    let currentCheckpointIndex = 0;
    let isTransitioningToEnd = false;

    // Setup events
    window.addEventListener('load', init);

    function init() {
      // Setup triggers
      clickOverlay.addEventListener('click', handleAdInteraction);
      
      // Auto-start video playback (initially muted for reliable browser autoplay)
      video.play().then(() => {
        // Autoplay succeeded. Unmute video once it starts playing to allow audio.
        video.muted = false;
      }).catch(err => {
        console.log("Unmuted autoplay failed; continuing muted or waiting for interaction.");
        // If unmuted playback is strictly blocked, try playing muted as fallback
        video.muted = true;
        video.play().catch(e => console.log("Playback entirely blocked without user gesture. Waiting for click."));
      });

      // Track playback
      video.addEventListener('timeupdate', checkCheckpoint);
      video.addEventListener('ended', showEndCard);
    }

    // Keep track of checkpoints we've already paused at
    let triggeredCheckpoints = {};

    function checkCheckpoint() {
      if (isTransitioningToEnd) return;

      const currentTime = video.currentTime;
      const targetTime = checkpoints[currentCheckpointIndex];

      // If we crossed a checkpoint and haven't triggered it yet
      if (targetTime !== undefined && currentTime >= targetTime && !triggeredCheckpoints[currentCheckpointIndex]) {
        // Mark as triggered immediately so it doesn't trigger again on subsequent frames
        triggeredCheckpoints[currentCheckpointIndex] = true;

        // Is this the very last checkpoint?
        if (currentCheckpointIndex === totalDurationCheckpoints - 1) {
          // Pause video immediately and transition to end card image
          isTransitioningToEnd = true;
          video.pause();
          showEndCard();
        } else {
          // Pause for middle checkpoints to request user interaction
          video.pause();
        }
      }
    }

    function handleAdInteraction(e) {
      // If video is not playing yet (e.g. browser blocked auto-play entirely)
      if (video.paused && currentCheckpointIndex === 0 && !triggeredCheckpoints[0]) {
        video.muted = false;
        video.play();
        return;
      }

      // 1. If ad is currently paused at a middle checkpoint: Resume it
      if (video.paused && currentCheckpointIndex < totalDurationCheckpoints - 1) {
        // Increment checkpoint index before resuming playback
        currentCheckpointIndex++;
        
        // Resume video
        video.muted = false;
        video.play();
        return;
      }

      // 2. If video is at the end state or final checkpoint, or if clicked elsewhere, trigger Google Exit
      triggerGoogleExit();
    }

    function showEndCard() {
      endcardOverlay.classList.add('show');
    }

    function triggerGoogleExit() {
      console.log('Exiting ad via Google exit API...');
      if (typeof ExitApi !== 'undefined' && typeof ExitApi.exit === 'function') {
        ExitApi.exit();
      } else {
        console.log('ExitApi not found, fallback debug trigger');
      }
    }
  </script>
</body>
</html>`;
}
