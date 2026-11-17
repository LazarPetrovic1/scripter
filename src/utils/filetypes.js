
const extensions = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif', 'tiff'],
  audio: ['mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'm4a', 'aac', 'wma'],
  video: ['mp4', 'webm', 'mov', 'm4v', 'ogv', 'ogg', 'avi', 'mpeg', 'mpg'],
  pdf: ['pdf'],
};

export function getFileType(filePath) {
  const extension = filePath.split('.').pop()?.toLowerCase();
  for (const [type, supportedExtensions] of Object.entries(extensions))
    if (supportedExtensions.includes(extension)) return type;
  return 'text';
}

export function isMediaFile(filePath) {
  return ['image', 'audio', 'video'].includes(getFileType(filePath));
}
