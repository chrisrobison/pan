# Building Icons

The extension needs PNG icons in multiple sizes.

## Required Icons

- `icons/icon-16.png` (16x16) - Browser toolbar
- `icons/icon-48.png` (48x48) - Extensions page
- `icons/icon-128.png` (128x128) - Chrome Web Store

## Option 1: Use ImageMagick

If you have ImageMagick installed:

```bash
cd devtools-extension/icons

# Convert SVG to PNGs
convert -background none icon.svg -resize 16x16 icon-16.png
convert -background none icon.svg -resize 48x48 icon-48.png
convert -background none icon.svg -resize 128x128 icon-128.png
```

## Option 2: Use Online Tool

1. Go to https://www.iloveimg.com/resize-image
2. Upload `icons/icon.svg`
3. Resize to 16x16, 48x48, 128x128
4. Download and save in `icons/` folder

## Option 3: Use Figma/Photoshop

1. Open `icons/icon.svg` in design tool
2. Export as PNG at 16x16, 48x48, 128x128
3. Save in `icons/` folder

## Option 4: Use Placeholder (Quick Start)

For testing, create simple colored squares:

```html
<!-- Save as generate-icons.html and open in browser -->
<!DOCTYPE html>
<html>
<body>
  <canvas id="c" width="128" height="128"></canvas>
  <script>
    const sizes = [16, 48, 128];
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');

    sizes.forEach(size => {
      canvas.width = size;
      canvas.height = size;

      // Blue background
      ctx.fillStyle = '#1a73e8';
      ctx.fillRect(0, 0, size, size);

      // White text
      ctx.fillStyle = 'white';
      ctx.font = `${size * 0.5}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', size / 2, size / 2);

      // Download
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `icon-${size}.png`;
        a.click();
      });
    });
  </script>
</body>
</html>
```

## Verify

After creating icons, verify in extension:
1. Reload extension at `chrome://extensions/`
2. Check extension shows icon
3. Open DevTools and check PAN tab has icon

## Note

The extension will still work without icons, but they improve UX and are required for Chrome Web Store publication.
